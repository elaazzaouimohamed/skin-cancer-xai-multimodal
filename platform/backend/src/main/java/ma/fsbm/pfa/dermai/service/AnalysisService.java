package ma.fsbm.pfa.dermai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ma.fsbm.pfa.dermai.config.AppProperties;
import ma.fsbm.pfa.dermai.domain.Analysis;
import ma.fsbm.pfa.dermai.domain.AnalysisRepository;
import ma.fsbm.pfa.dermai.domain.AppUser;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import ma.fsbm.pfa.dermai.domain.Patient;
import ma.fsbm.pfa.dermai.domain.PatientRepository;
import ma.fsbm.pfa.dermai.domain.Role;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisResponse;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisSummary;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.LlmReport;
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
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Orchestration: model inference (decision) → rephrasing by the local LLM (presentation) → history.
 * Each analysis belongs to the account that created it and, for a doctor, can be attached to a patient record.
 */
@Service
public class AnalysisService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisService.class);

    private final MlClient ml;
    private final LlmClient llm;
    private final ReportPromptBuilder prompts;
    private final AnalysisRepository repository;
    private final PatientRepository patients;
    private final AppUserRepository users;
    private final ObjectMapper mapper;
    private final Path storageDir;

    public AnalysisService(MlClient ml, LlmClient llm, ReportPromptBuilder prompts, AnalysisRepository repository,
                           PatientRepository patients, AppUserRepository users, ObjectMapper mapper,
                           AppProperties props) {
        this.ml = ml;
        this.llm = llm;
        this.prompts = prompts;
        this.repository = repository;
        this.patients = patients;
        this.users = users;
        this.mapper = mapper;
        this.storageDir = Path.of(props.storage().dir());
    }

    public AnalysisResponse analyze(MultipartFile image, ClinicalInput clinical, boolean occlusion, String style,
                                    Long patientId) {
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Une photo de la lésion est obligatoire.");
        }
        String contentType = image.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Le fichier doit être une image (JPEG ou PNG).");
        }
        return analyzeBytes(readBytes(image), image.getOriginalFilename(), contentType, clinical, occlusion, style,
                patientId);
    }

    /** Same pipeline from raw bytes (used by the conversational mode). */
    public AnalysisResponse analyzeBytes(byte[] bytes, String filename, String contentType, ClinicalInput clinical,
                                         boolean occlusion, String style, Long patientId) {
        AuthUser user = CurrentUser.get();
        if (patientId != null) {
            requirePatient(patientId, user);
        }
        String clinicalJson = toJson(clinical);

        // 1. Decision: computed only by the trained model
        JsonNode result = ml.predict(bytes, filename, contentType, clinicalJson, occlusion);

        Analysis a = new Analysis();
        a.setOwnerId(user.id());
        a.setPatientId(patientId);
        a.setClinicalJson(clinicalJson);
        a.setAge(clinical.age());
        a.setRegion(clinical.region());
        a.setProbability(result.path("probability").asDouble());
        a.setDecision(result.path("decision").asText());
        a.setThreshold(result.path("threshold").asDouble());
        a.setModelName(result.path("modelName").asText());
        a.setInferenceMs(result.path("inferenceMs").asInt());
        a.setMlResultJson(toJson(result));
        a.setImageFile(store(bytes, filename));
        a.setImageContentType(contentType);

        // 2. Presentation: rephrasing by the local LLM (optional, never blocking)
        applyLlmReport(a, result, normalizeStyle(style));
        return toResponse(repository.save(a));
    }

    public AnalysisResponse regenerateReport(Long id, String style) {
        Analysis a = findAccessible(id);
        applyLlmReport(a, readJson(a.getMlResultJson()), normalizeStyle(style));
        return toResponse(repository.save(a));
    }

    private void applyLlmReport(Analysis a, JsonNode result, String style) {
        a.setReportStyle(style);
        if (!llm.enabled()) {
            a.setLlmReport(null);
            a.setLlmStatus("désactivé");
            return;
        }
        try {
            LlmClient.Result r = llm.chat(prompts.systemPrompt(style), prompts.userPrompt(result));
            if (r.text().isBlank()) {
                throw new IllegalStateException("réponse vide");
            }
            a.setLlmReport(prompts.enforceFacts(r.text(), result));
            a.setLlmModel(r.model());
            a.setLlmStatus("ok");
            a.setLlmMs((int) r.durationMs());
        } catch (RuntimeException e) {
            log.warn("Reformulation LLM indisponible : {}", e.getMessage());
            a.setLlmReport(null);
            a.setLlmModel(llm.model());
            a.setLlmStatus("indisponible : " + e.getMessage());
        }
    }

    /** History: everything for an administrator, own analyses otherwise. */
    public List<AnalysisSummary> history() {
        AuthUser u = CurrentUser.get();
        return summaries(u.isAdmin()
                ? repository.findTop100ByOrderByCreatedAtDesc()
                : repository.findTop100ByOwnerIdOrderByCreatedAtDesc(u.id()));
    }

    public AnalysisResponse get(Long id) {
        return toResponse(findAccessible(id));
    }

    public byte[] image(Long id) {
        Analysis a = findAccessible(id);
        try {
            return Files.readAllBytes(storageDir.resolve(a.getImageFile()));
        } catch (IOException e) {
            throw new NoSuchElementException("Image introuvable pour l'analyse " + id);
        }
    }

    public String imageContentType(Long id) {
        return findAccessible(id).getImageContentType();
    }

    public void delete(Long id) {
        Analysis a = findAccessible(id);
        AuthUser u = CurrentUser.get();
        if (!u.isAdmin() && !Objects.equals(a.getOwnerId(), u.id())) {
            throw new AccessDeniedException("Seul l'auteur de l'analyse ou un administrateur peut la supprimer.");
        }
        try {
            Files.deleteIfExists(storageDir.resolve(a.getImageFile()));
        } catch (IOException e) {
            log.warn("Impossible de supprimer l'image {} : {}", a.getImageFile(), e.getMessage());
        }
        repository.delete(a);
    }

    /** Deletes the analyses of a patient record (and their images) when the record is deleted. */
    void deleteForPatient(Long patientId) {
        for (Analysis a : repository.findByPatientIdOrderByCreatedAtDesc(patientId)) {
            try {
                Files.deleteIfExists(storageDir.resolve(a.getImageFile()));
            } catch (IOException e) {
                log.warn("Impossible de supprimer l'image {} : {}", a.getImageFile(), e.getMessage());
            }
            repository.delete(a);
        }
    }

    // ------------------------------------------------------------------ access
    /** Author, administrator, or doctor in charge of the attached patient record. */
    private Analysis findAccessible(Long id) {
        Analysis a = repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Analyse " + id + " introuvable"));
        AuthUser u = CurrentUser.get();
        if (u.isAdmin() || Objects.equals(a.getOwnerId(), u.id())) {
            return a;
        }
        if (u.isDoctor() && a.getPatientId() != null && patients.findById(a.getPatientId())
                .map(p -> Objects.equals(p.getDoctorId(), u.id())).orElse(false)) {
            return a;
        }
        throw new AccessDeniedException("Cette analyse ne vous appartient pas.");
    }

    /** Patient record usable by the user: a doctor's own patient, or any patient for an administrator. */
    Patient requirePatient(Long patientId, AuthUser u) {
        if (u.role() == Role.PATIENT) {
            throw new AccessDeniedException("Seul un médecin peut rattacher une analyse à un dossier patient.");
        }
        Patient p = patients.findById(patientId)
                .orElseThrow(() -> new NoSuchElementException("Patient " + patientId + " introuvable"));
        if (!u.isAdmin() && !Objects.equals(p.getDoctorId(), u.id())) {
            throw new AccessDeniedException("Ce patient n'est pas suivi par vous.");
        }
        return p;
    }

    // ------------------------------------------------------------------ mapping
    /** Summaries with the patient and author names (resolved in batch). */
    public List<AnalysisSummary> summaries(List<Analysis> list) {
        Map<Long, String> patientNames = patients.findAllById(ids(list, Analysis::getPatientId)).stream()
                .collect(Collectors.toMap(Patient::getId, Patient::fullName));
        Map<Long, String> ownerNames = users.findAllById(ids(list, Analysis::getOwnerId)).stream()
                .collect(Collectors.toMap(AppUser::getId, AppUser::getFullName));
        return list.stream()
                .map(a -> new AnalysisSummary(a.getId(), a.getCreatedAt(), a.getAge(), a.getRegion(),
                        a.getProbability(), a.getDecision(), a.getThreshold(), a.getModelName(), a.getPatientId(),
                        patientNames.get(a.getPatientId()), a.getOwnerId(), ownerNames.get(a.getOwnerId())))
                .toList();
    }

    private static Collection<Long> ids(List<Analysis> list, Function<Analysis, Long> f) {
        return list.stream().map(f).filter(Objects::nonNull).collect(Collectors.toSet());
    }

    private AnalysisResponse toResponse(Analysis a) {
        JsonNode mlResult = readJson(a.getMlResultJson());
        LlmReport report = new LlmReport(a.getLlmReport(), a.getLlmModel(), a.getLlmStatus(), a.getLlmMs());
        String patientName = a.getPatientId() == null ? null
                : patients.findById(a.getPatientId()).map(Patient::fullName).orElse(null);
        String ownerName = a.getOwnerId() == null ? null
                : users.findById(a.getOwnerId()).map(AppUser::getFullName).orElse(null);
        return new AnalysisResponse(a.getId(), a.getCreatedAt(), readJson(a.getClinicalJson()), mlResult, report,
                a.getReportStyle(), a.getPatientId(), patientName, ownerName);
    }

    private static String normalizeStyle(String style) {
        return ReportPromptBuilder.STYLE_PATIENT.equalsIgnoreCase(style)
                ? ReportPromptBuilder.STYLE_PATIENT : ReportPromptBuilder.STYLE_DOCTOR;
    }

    String store(byte[] bytes, String originalName) {
        String ext = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.')).toLowerCase() : ".png";
        if (!ext.matches("\\.(png|jpe?g|webp|bmp)")) {
            ext = ".png";
        }
        String name = UUID.randomUUID() + ext;
        try {
            Files.createDirectories(storageDir);
            Files.write(storageDir.resolve(name), bytes);
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de l'enregistrement de l'image", e);
        }
        return name;
    }

    private static byte[] readBytes(MultipartFile f) {
        try {
            return f.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture de l'image impossible", e);
        }
    }

    private String toJson(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private JsonNode readJson(String json) {
        if (json == null) {
            return mapper.createObjectNode();
        }
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            ObjectNode err = mapper.createObjectNode();
            err.put("error", "JSON illisible");
            return err;
        }
    }
}
