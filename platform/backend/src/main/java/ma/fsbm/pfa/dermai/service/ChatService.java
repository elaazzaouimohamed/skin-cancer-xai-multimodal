package ma.fsbm.pfa.dermai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ma.fsbm.pfa.dermai.config.AppProperties;
import ma.fsbm.pfa.dermai.domain.ChatMessage;
import ma.fsbm.pfa.dermai.domain.ChatMessageRepository;
import ma.fsbm.pfa.dermai.domain.ChatSession;
import ma.fsbm.pfa.dermai.domain.ChatSessionRepository;
import ma.fsbm.pfa.dermai.domain.Patient;
import ma.fsbm.pfa.dermai.domain.PatientRepository;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisResponse;
import ma.fsbm.pfa.dermai.dto.ChatDtos.MessageDto;
import ma.fsbm.pfa.dermai.dto.ChatDtos.SessionDetail;
import ma.fsbm.pfa.dermai.dto.ChatDtos.SessionSummary;
import ma.fsbm.pfa.dermai.dto.ClinicalInput;
import ma.fsbm.pfa.dermai.security.AuthUser;
import ma.fsbm.pfa.dermai.security.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Year;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Conversational mode. The text is used to (1) extract clinical facts and (2) answer questions;
 * any probability or conclusion comes exclusively from the trained model, run on a photo.
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final int HISTORY = 8;

    private final ChatSessionRepository sessions;
    private final ChatMessageRepository messages;
    private final AnalysisService analyses;
    private final PatientRepository patients;
    private final LlmClient llm;
    private final ChatPromptBuilder prompts;
    private final ObjectMapper mapper;
    private final Path storageDir;

    public ChatService(ChatSessionRepository sessions, ChatMessageRepository messages, AnalysisService analyses,
                       PatientRepository patients, LlmClient llm, ChatPromptBuilder prompts, ObjectMapper mapper,
                       AppProperties props) {
        this.sessions = sessions;
        this.messages = messages;
        this.analyses = analyses;
        this.patients = patients;
        this.llm = llm;
        this.prompts = prompts;
        this.mapper = mapper;
        this.storageDir = Path.of(props.storage().dir(), "chat");
    }

    // ------------------------------------------------------------------ sessions
    /** New conversation, optionally attached to a patient record (doctor): age is pre-filled. */
    public SessionDetail create(Long patientId) {
        AuthUser u = CurrentUser.get();
        ChatSession s = new ChatSession();
        s.setOwnerId(u.id());
        ClinicalInput facts = empty();
        String intro;
        if (patientId != null) {
            Patient p = analyses.requirePatient(patientId, u);
            s.setPatientId(p.getId());
            s.setTitle("Suivi · " + p.fullName());
            if (p.getBirthYear() != null) {
                int age = Year.now().getValue() - p.getBirthYear();
                if (age >= 0 && age <= 120) {
                    facts = new ClinicalInput(age, null, null, null, null, null, null, null);
                }
            }
            intro = "Conversation rattachée au dossier de " + p.fullName()
                    + (facts.age() != null ? " (" + facts.age() + " ans)" : "")
                    + ". Les analyses réalisées ici seront ajoutées à son dossier. ";
        } else {
            s.setTitle("Nouvelle conversation");
            intro = "Bonjour" + (u.fullName() != null ? " " + u.fullName() : "") + ", je suis DermAI. ";
        }
        s.setClinicalJson(toJson(facts));
        sessions.save(s);
        ChatMessage welcome = new ChatMessage(s.getId(), ChatMessage.ROLE_ASSISTANT, ChatMessage.KIND_TEXT,
                intro + "Envoyez une photo nette et centrée de la lésion, avec si possible l'âge, "
                        + "la localisation et les symptômes (saignement, démangeaison, croissance…). Vous pouvez aussi "
                        + "commencer par décrire la lésion en texte : la probabilité est calculée uniquement par le modèle "
                        + "entraîné, à partir de la photo.");
        messages.save(welcome);
        return detail(s);
    }

    public List<SessionSummary> list() {
        return sessions.findTop50ByOwnerIdOrderByUpdatedAtDesc(CurrentUser.get().id()).stream()
                .map(s -> new SessionSummary(s.getId(), s.getTitle(), s.getCreatedAt(), s.getUpdatedAt(),
                        s.getPatientId(), patientName(s)))
                .toList();
    }

    public SessionDetail rename(Long id, String title) {
        ChatSession s = find(id);
        String t = title == null ? "" : title.trim();
        if (t.isEmpty()) {
            throw new IllegalArgumentException("Le titre ne peut pas être vide.");
        }
        s.setTitle(abbreviate(t, 80));
        sessions.save(s);
        return detail(s);
    }

    public SessionDetail get(Long id) {
        return detail(find(id));
    }

    public void delete(Long id) {
        ChatSession s = find(id);
        messages.deleteBySessionId(id);
        sessions.delete(s);
    }

    // ------------------------------------------------------------------ messages
    public SessionDetail send(Long sessionId, String text, MultipartFile image, boolean occlusion, String style) {
        ChatSession s = find(sessionId);
        String cleanText = text == null ? "" : text.trim();
        boolean hasImage = image != null && !image.isEmpty();
        if (cleanText.isEmpty() && !hasImage) {
            throw new IllegalArgumentException("Écrivez un message ou joignez une photo.");
        }
        if (hasImage && (image.getContentType() == null || !image.getContentType().startsWith("image/"))) {
            throw new IllegalArgumentException("Le fichier joint doit être une image (JPEG ou PNG).");
        }

        // 1. User message (+ image)
        ChatMessage user = new ChatMessage(s.getId(), ChatMessage.ROLE_USER, ChatMessage.KIND_TEXT, cleanText);
        byte[] bytes = null;
        if (hasImage) {
            bytes = read(image);
            user.setImageFile(store(bytes, image.getOriginalFilename()));
            user.setImageContentType(image.getContentType());
            s.setLastImageFile(user.getImageFile());
            s.setLastImageContentType(image.getContentType());
            s.setLastImageName(image.getOriginalFilename());
        }

        // 2. Extraction of the clinical facts from the text (the LLM structures, it does not decide)
        Extraction ex = cleanText.isEmpty() ? Extraction.NONE : extract(cleanText);
        if (ex.facts != null) {
            user.setFactsJson(toJson(ex.facts));
            s.setClinicalJson(toJson(merge(clinical(s), ex.facts)));
        }
        messages.save(user);
        if ("Nouvelle conversation".equals(s.getTitle())) {
            s.setTitle(cleanText.isEmpty() ? "Analyse d'une photo" : abbreviate(cleanText, 60));
        }

        // 3. Image → analysis by the model ; text only → grounded answer
        if (hasImage) {
            runAnalysis(s, bytes, image.getOriginalFilename(), image.getContentType(), occlusion, style);
        } else {
            answer(s, cleanText);
        }
        s.touch();
        sessions.save(s);
        return detail(s);
    }

    /** Re-runs the model on the last photo with the updated clinical facts. */
    public SessionDetail rerun(Long sessionId, boolean occlusion, String style) {
        ChatSession s = find(sessionId);
        if (s.getLastImageFile() == null) {
            throw new IllegalArgumentException("Aucune photo dans cette conversation : joignez d'abord une photo.");
        }
        byte[] bytes;
        try {
            bytes = Files.readAllBytes(storageDir.resolve(s.getLastImageFile()));
        } catch (IOException e) {
            throw new NoSuchElementException("Photo de la conversation introuvable");
        }
        messages.save(new ChatMessage(s.getId(), ChatMessage.ROLE_USER, ChatMessage.KIND_TEXT,
                "Relancer l'analyse avec les informations cliniques mises à jour."));
        runAnalysis(s, bytes, s.getLastImageName(), s.getLastImageContentType(), occlusion, style);
        s.touch();
        sessions.save(s);
        return detail(s);
    }

    private void runAnalysis(ChatSession s, byte[] bytes, String name, String type, boolean occlusion, String style) {
        ClinicalInput facts = clinical(s);
        try {
            AnalysisResponse r = analyses.analyzeBytes(bytes, name, type, facts, occlusion, style, s.getPatientId());
            ChatMessage m = new ChatMessage(s.getId(), ChatMessage.ROLE_ASSISTANT, ChatMessage.KIND_ANALYSIS,
                    r.llm() != null && r.llm().text() != null ? r.llm().text() : r.ml().path("templateReport").asText());
            m.setAnalysisId(r.id());
            messages.save(m);
            s.setLastAnalysisId(r.id());
            s.setLastAnalysisClinicalJson(toJson(facts));
        } catch (ExternalServiceException e) {
            log.warn("Analyse impossible : {}", e.getMessage());
            messages.save(new ChatMessage(s.getId(), ChatMessage.ROLE_ASSISTANT, ChatMessage.KIND_ERROR,
                    "Le service d'analyse d'images est indisponible pour le moment ; réessayez dans un instant. ("
                            + e.getMessage() + ")"));
        }
    }

    private void answer(ChatSession s, String question) {
        String text;
        if (!llm.enabled()) {
            text = fallbackAnswer(s);
        } else {
            try {
                List<ChatMessage> all = messages.findBySessionIdOrderByIdAsc(s.getId());
                List<ChatMessage> history = all.subList(Math.max(0, all.size() - 1 - HISTORY), Math.max(0, all.size() - 1));
                JsonNode last = s.getLastAnalysisId() == null ? null : mapper.valueToTree(analyses.get(s.getLastAnalysisId()));
                text = llm.chat(prompts.answerSystem(),
                        prompts.answerUser(question, clinical(s), last, factsChanged(s), history)).text();
                if (text.isBlank()) {
                    text = fallbackAnswer(s);
                }
            } catch (RuntimeException e) {
                log.warn("Réponse LLM indisponible : {}", e.getMessage());
                text = fallbackAnswer(s);
            }
        }
        messages.save(new ChatMessage(s.getId(), ChatMessage.ROLE_ASSISTANT, ChatMessage.KIND_TEXT, text));
    }

    private String fallbackAnswer(ChatSession s) {
        String facts = ChatPromptBuilder.describe(clinical(s));
        if (s.getLastAnalysisId() == null) {
            return "Informations enregistrées : " + facts + ". Pour obtenir une analyse, joignez une photo nette "
                    + "et centrée de la lésion. (Assistant conversationnel indisponible : LM Studio n'est pas démarré.)";
        }
        return "Informations enregistrées : " + facts + "." + (factsChanged(s)
                ? " Elles diffèrent de celles de la dernière analyse : utilisez « Relancer l'analyse »." : "")
                + " (Assistant conversationnel indisponible : LM Studio n'est pas démarré.)";
    }

    // ------------------------------------------------------------------ extraction
    private record Extraction(ClinicalInput facts, String intent) {
        static final Extraction NONE = new Extraction(null, "autre");
    }

    private Extraction extract(String text) {
        if (!llm.enabled()) {
            return Extraction.NONE;
        }
        try {
            String raw = llm.complete(prompts.extractionSystem(), text, prompts.extractionSchema(), 0.0, 200).text();
            JsonNode j = mapper.readTree(firstJsonObject(raw));
            Integer age = j.path("age").isNumber() ? j.path("age").asInt() : null;
            if (age != null && (age < 0 || age > 120)) {
                age = null;
            }
            String region = j.path("region").isTextual() ? j.path("region").asText().toUpperCase() : null;
            if (region != null && !ChatPromptBuilder.REGIONS.containsKey(region)) {
                region = null;
            }
            ClinicalInput f = new ClinicalInput(age, region, bool(j, "itch"), bool(j, "grew"), bool(j, "hurt"),
                    bool(j, "changed"), bool(j, "bleed"), bool(j, "elevation"));
            return new Extraction(isEmpty(f) ? null : f, j.path("intent").asText("autre"));
        } catch (RuntimeException | JsonProcessingException e) {
            log.warn("Extraction clinique impossible : {}", e.getMessage());
            return Extraction.NONE;
        }
    }

    private static String firstJsonObject(String raw) {
        Matcher m = Pattern.compile("\\{.*\\}", Pattern.DOTALL).matcher(raw);
        return m.find() ? m.group() : raw;
    }

    private static Boolean bool(JsonNode j, String key) {
        return j.path(key).isBoolean() ? j.path(key).asBoolean() : null;
    }

    private static ClinicalInput empty() {
        return new ClinicalInput(null, null, null, null, null, null, null, null);
    }

    private static boolean isEmpty(ClinicalInput f) {
        return f.equals(empty());
    }

    private static ClinicalInput merge(ClinicalInput base, ClinicalInput update) {
        return new ClinicalInput(
                update.age() != null ? update.age() : base.age(),
                update.region() != null ? update.region() : base.region(),
                update.itch() != null ? update.itch() : base.itch(),
                update.grew() != null ? update.grew() : base.grew(),
                update.hurt() != null ? update.hurt() : base.hurt(),
                update.changed() != null ? update.changed() : base.changed(),
                update.bleed() != null ? update.bleed() : base.bleed(),
                update.elevation() != null ? update.elevation() : base.elevation());
    }

    // ------------------------------------------------------------------ helpers
    private boolean factsChanged(ChatSession s) {
        return s.getLastAnalysisId() != null
                && !Objects.equals(clinical(s), parse(s.getLastAnalysisClinicalJson()));
    }

    private ClinicalInput clinical(ChatSession s) {
        ClinicalInput c = parse(s.getClinicalJson());
        return c == null ? empty() : c;
    }

    private ClinicalInput parse(String json) {
        if (json == null) {
            return null;
        }
        try {
            return mapper.readValue(json, ClinicalInput.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private SessionDetail detail(ChatSession s) {
        List<MessageDto> dtos = messages.findBySessionIdOrderByIdAsc(s.getId()).stream().map(m -> {
            AnalysisResponse a = null;
            if (m.getAnalysisId() != null) {
                try {
                    a = analyses.get(m.getAnalysisId());
                } catch (NoSuchElementException e) {
                    a = null;
                }
            }
            String imageUrl = m.getImageFile() == null ? null : "/api/chat/messages/" + m.getId() + "/image";
            JsonNode facts = m.getFactsJson() == null ? null : readTree(m.getFactsJson());
            return new MessageDto(m.getId(), m.getRole(), m.getKind(), m.getText(), imageUrl, a, facts, m.getCreatedAt());
        }).toList();
        ClinicalInput c = clinical(s);
        return new SessionDetail(s.getId(), s.getTitle(), mapper.valueToTree(c), ChatPromptBuilder.describe(c),
                s.getLastAnalysisId(), factsChanged(s), llm.enabled(), s.getPatientId(), patientName(s), dtos);
    }

    private String patientName(ChatSession s) {
        return s.getPatientId() == null ? null
                : patients.findById(s.getPatientId()).map(Patient::fullName).orElse(null);
    }

    public byte[] messageImage(Long messageId) {
        ChatMessage m = messages.findById(messageId)
                .orElseThrow(() -> new NoSuchElementException("Message " + messageId + " introuvable"));
        find(m.getSessionId());
        if (m.getImageFile() == null) {
            throw new NoSuchElementException("Ce message n'a pas d'image");
        }
        try {
            return Files.readAllBytes(storageDir.resolve(m.getImageFile()));
        } catch (IOException e) {
            throw new NoSuchElementException("Image introuvable");
        }
    }

    public String messageImageType(Long messageId) {
        return messages.findById(messageId).map(ChatMessage::getImageContentType).orElse("image/png");
    }

    /** Conversation of the logged-in user (an administrator can open any of them). */
    private ChatSession find(Long id) {
        ChatSession s = sessions.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Conversation " + id + " introuvable"));
        AuthUser u = CurrentUser.get();
        if (!u.isAdmin() && !Objects.equals(s.getOwnerId(), u.id())) {
            throw new AccessDeniedException("Cette conversation ne vous appartient pas.");
        }
        return s;
    }

    private String store(byte[] bytes, String originalName) {
        String ext = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.')).toLowerCase() : ".png";
        if (!ext.matches("\\.(png|jpe?g|webp|bmp)")) {
            ext = ".png";
        }
        String name = java.util.UUID.randomUUID() + ext;
        try {
            Files.createDirectories(storageDir);
            Files.write(storageDir.resolve(name), bytes);
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de l'enregistrement de l'image", e);
        }
        return name;
    }

    private static byte[] read(MultipartFile f) {
        try {
            return f.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture de l'image impossible", e);
        }
    }

    private static String abbreviate(String s, int max) {
        String one = s.replaceAll("\\s+", " ");
        return one.length() <= max ? one : one.substring(0, max - 1) + "…";
    }

    private String toJson(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private JsonNode readTree(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
