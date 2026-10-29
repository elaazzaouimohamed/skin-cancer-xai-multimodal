package ma.fsbm.pfa.dermai.service;

import com.fasterxml.jackson.databind.JsonNode;
import ma.fsbm.pfa.dermai.domain.ChatMessage;
import ma.fsbm.pfa.dermai.dto.ClinicalInput;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Prompts of the conversational mode: extraction of clinical facts, then grounded answer. */
@Component
public class ChatPromptBuilder {

    public static final Map<String, String> REGIONS = new LinkedHashMap<>();

    static {
        REGIONS.put("FACE", "visage, joue, front, menton, tempe");
        REGIONS.put("NOSE", "nez");
        REGIONS.put("EAR", "oreille");
        REGIONS.put("LIP", "lèvre, bouche");
        REGIONS.put("SCALP", "cuir chevelu, crâne, tête");
        REGIONS.put("NECK", "cou, nuque");
        REGIONS.put("CHEST", "thorax, poitrine, torse");
        REGIONS.put("BACK", "dos, épaule");
        REGIONS.put("ABDOMEN", "abdomen, ventre");
        REGIONS.put("ARM", "bras");
        REGIONS.put("FOREARM", "avant-bras, poignet");
        REGIONS.put("HAND", "main, doigt");
        REGIONS.put("THIGH", "cuisse, jambe, genou");
        REGIONS.put("FOOT", "pied, orteil, cheville");
    }

    public static final Map<String, String> REGION_FR = Map.ofEntries(
            Map.entry("FACE", "visage"), Map.entry("NOSE", "nez"), Map.entry("EAR", "oreille"),
            Map.entry("LIP", "lèvre"), Map.entry("SCALP", "cuir chevelu"), Map.entry("NECK", "cou"),
            Map.entry("CHEST", "thorax"), Map.entry("BACK", "dos"), Map.entry("ABDOMEN", "abdomen"),
            Map.entry("ARM", "bras"), Map.entry("FOREARM", "avant-bras"), Map.entry("HAND", "main"),
            Map.entry("THIGH", "cuisse"), Map.entry("FOOT", "pied"));

    // ------------------------------------------------------------------ extraction
    public String extractionSystem() {
        StringBuilder regions = new StringBuilder();
        REGIONS.forEach((code, words) -> regions.append("- ").append(code).append(" : ").append(words).append('\n'));
        return """
                Tu extrais des informations cliniques d'un message en français à propos d'une lésion de la peau.
                Réponds UNIQUEMENT avec un objet JSON contenant exactement ces clés :
                age (entier ou null), region (code ou null), itch, grew, hurt, changed, bleed, elevation \
                (true, false ou null), intent (une des valeurs : "information", "question", "salutation", "autre").
                Signification : itch = démangeaison ; grew = la lésion a grossi ; hurt = douleur ; \
                changed = la lésion a changé d'aspect (couleur, forme) ; bleed = saignement ; \
                elevation = la lésion est en relief / bombée.
                Règles : mets null si l'information n'est pas mentionnée ; false seulement si elle est explicitement niée \
                (« ne saigne pas ») ; n'invente rien. intent = "question" si l'utilisateur pose une question.
                Codes de localisation autorisés :
                """ + regions;
    }

    public Map<String, Object> extractionSchema() {
        Map<String, Object> nullableBool = Map.of("type", List.of("boolean", "null"));
        List<Object> regionEnum = new ArrayList<>(REGIONS.keySet());
        regionEnum.add(null);
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("age", Map.of("type", List.of("integer", "null")));
        props.put("region", Map.of("type", List.of("string", "null"), "enum", regionEnum));
        for (String k : List.of("itch", "grew", "hurt", "changed", "bleed", "elevation")) {
            props.put(k, nullableBool);
        }
        props.put("intent", Map.of("type", "string", "enum", List.of("information", "question", "salutation", "autre")));
        Map<String, Object> schema = Map.of("type", "object", "properties", props,
                "required", new ArrayList<>(props.keySet()), "additionalProperties", false);
        return Map.of("type", "json_schema",
                "json_schema", Map.of("name", "clinical_facts", "strict", true, "schema", schema));
    }

    // ------------------------------------------------------------------ answer
    public String answerSystem() {
        return """
                Tu es DermAI, l'assistant conversationnel francophone d'un outil de recherche d'aide au diagnostic \
                des lésions de la peau (projet universitaire). Un modèle d'IA validé analyse les PHOTOS et calcule \
                une probabilité de cancer ; toi, tu ne vois pas les images.
                Règles strictes :
                1. Tu ne poses jamais de diagnostic et tu n'inventes jamais de probabilité : seul le modèle les calcule \
                à partir d'une photo.
                2. Si aucune analyse n'existe encore, invite l'utilisateur à envoyer une photo nette et centrée de la lésion \
                (et, s'il le souhaite, âge, localisation et symptômes).
                3. Pour expliquer un résultat, utilise uniquement le contexte fourni (probabilité, conclusion, facteurs, \
                concepts, zone de l'image) ; recopie les valeurs exactes.
                4. Rappelle qu'un dermatologue (et si besoin une biopsie) est nécessaire pour confirmer.
                5. Si l'utilisateur décrit un signe préoccupant (saignement, croissance rapide, changement d'aspect), \
                conseille une consultation rapide, sans alarmer.
                6. Pas de traitement, pas de pronostic. Réponds en français, de façon claire et concise (150 mots maximum).
                """;
    }

    public String answerUser(String question, ClinicalInput facts, JsonNode lastAnalysis,
                             boolean factsChangedSinceAnalysis, List<ChatMessage> history) {
        StringBuilder sb = new StringBuilder();
        sb.append("Informations cliniques connues : ").append(describe(facts)).append("\n\n");
        if (lastAnalysis != null) {
            JsonNode ml = lastAnalysis.path("ml");
            sb.append("Dernière analyse du modèle (valeurs exactes) :\n");
            sb.append("- probabilité estimée de cancer : ").append(ReportPromptBuilder.pct(ml.path("probability").asDouble()))
                    .append(" ; seuil de triage : ").append(ReportPromptBuilder.pct(ml.path("threshold").asDouble())).append('\n');
            sb.append("- conclusion : ").append("suspicion_cancer".equals(ml.path("decision").asText())
                    ? "suspicion de cancer, avis dermatologique recommandé"
                    : "pas de signe fort de cancer selon le modèle").append('\n');
            sb.append("- facteurs (> 0 vers « cancer », < 0 vers « non-cancer ») : ");
            List<String> factors = new ArrayList<>();
            for (JsonNode c : ml.path("contributions")) {
                String v = c.path("value").isNull() ? "" : " = " + c.path("value").asText();
                factors.add(c.path("label").asText() + v + String.format(Locale.FRANCE, " (%+.2f)", c.path("contribution").asDouble()));
                if (factors.size() == 6) {
                    break;
                }
            }
            sb.append(String.join(" ; ", factors)).append('\n');
            List<String> concepts = new ArrayList<>();
            ml.path("concepts").forEach(c -> concepts.add(c.path("label").asText()));
            if (!concepts.isEmpty()) {
                sb.append("- caractéristiques visuelles marquées : ").append(String.join(", ", concepts)).append('\n');
            }
            if (!ml.path("location").isNull() && !ml.path("location").asText().isEmpty()) {
                sb.append("- zone de l'image la plus déterminante : ").append(ml.path("location").asText()).append('\n');
            }
            if (factsChangedSinceAnalysis) {
                sb.append("- ATTENTION : des informations cliniques ont changé depuis cette analyse ; propose de la relancer.\n");
            }
        } else {
            sb.append("Aucune analyse d'image n'a encore été faite.\n");
        }
        sb.append("\nPerformance du modèle (étude, ensemble de test) : AUC 0,947 ; au seuil de triage sensibilité 96,8 %, "
                + "spécificité 78,5 %. Limites : peu de mélanomes, peu de peaux foncées, un seul centre.\n");
        if (!history.isEmpty()) {
            sb.append("\nDerniers échanges :\n");
            for (ChatMessage m : history) {
                if (m.getText() == null || m.getText().isBlank()) {
                    continue;
                }
                String t = m.getText().length() > 400 ? m.getText().substring(0, 400) + "…" : m.getText();
                sb.append(ChatMessage.ROLE_USER.equals(m.getRole()) ? "Utilisateur : " : "DermAI : ").append(t).append('\n');
            }
        }
        sb.append("\nMessage de l'utilisateur : ").append(question).append("\n\nRéponds à l'utilisateur.");
        return sb.toString();
    }

    public static String describe(ClinicalInput f) {
        if (f == null) {
            return "aucune";
        }
        List<String> parts = new ArrayList<>();
        if (f.age() != null) {
            parts.add(f.age() + " ans");
        }
        if (f.region() != null) {
            parts.add("localisation : " + REGION_FR.getOrDefault(f.region(), f.region()));
        }
        addBool(parts, "démangeaison", f.itch());
        addBool(parts, "a grossi", f.grew());
        addBool(parts, "douleur", f.hurt());
        addBool(parts, "a changé d'aspect", f.changed());
        addBool(parts, "saignement", f.bleed());
        addBool(parts, "en relief", f.elevation());
        return parts.isEmpty() ? "aucune" : String.join(", ", parts);
    }

    private static void addBool(List<String> parts, String label, Boolean v) {
        if (v != null) {
            parts.add(label + " : " + (v ? "oui" : "non"));
        }
    }
}
