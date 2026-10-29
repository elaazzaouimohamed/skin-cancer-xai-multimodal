package ma.fsbm.pfa.dermai.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Builds the LLM prompt from the model output alone, then checks that the generated text has not
 * altered the computed facts (safeguard).
 */
@Component
public class ReportPromptBuilder {

    public static final String STYLE_DOCTOR = "medecin";
    public static final String STYLE_PATIENT = "patient";

    private static final String SYSTEM_COMMON = """
            Tu es un assistant de rédaction médicale francophone intégré à un outil d'aide à la décision \
            en dermatologie. Un modèle d'IA validé a DÉJÀ produit une probabilité, une conclusion et des explications. \
            Ton rôle est uniquement de les reformuler en français clair.
            Règles strictes :
            1. Utilise exclusivement les informations fournies ; n'invente aucun symptôme, antécédent ou examen.
            2. Ne modifie jamais la probabilité, le seuil ni la conclusion du modèle ; recopie les valeurs exactes.
            3. Ne pose aucun diagnostic définitif : seule une biopsie et un dermatologue peuvent confirmer.
            4. Termine toujours par l'avertissement : « Outil d'aide à la décision : ne remplace ni l'examen clinique ni la biopsie. »
            5. Pas de liste de traitements, pas de pronostic.
            """;

    private static final String STYLE_DOCTOR_RULES = """
            Public : médecin. Ton professionnel et concis (180 mots maximum).
            Structure avec ces titres : Synthèse ; Éléments en faveur ; Éléments en défaveur ; \
            Zone d'intérêt sur l'image ; Conduite proposée ; Avertissement.
            """;

    private static final String STYLE_PATIENT_RULES = """
            Public : patient. Langage simple et rassurant, sans jargon (150 mots maximum), \
            sans minimiser ni dramatiser. Explique ce que le résultat signifie et qu'un avis médical est nécessaire.
            """;

    public String systemPrompt(String style) {
        return SYSTEM_COMMON + (STYLE_PATIENT.equals(style) ? STYLE_PATIENT_RULES : STYLE_DOCTOR_RULES);
    }

    public String userPrompt(JsonNode ml) {
        StringBuilder sb = new StringBuilder();
        double p = ml.path("probability").asDouble();
        double t = ml.path("threshold").asDouble();
        boolean suspect = "suspicion_cancer".equals(ml.path("decision").asText());
        sb.append("Résultats calculés par le modèle (à recopier sans modification) :\n");
        sb.append("- Probabilité estimée de cancer : ").append(pct(p)).append('\n');
        sb.append("- Seuil de triage (sensibilité ≥ 90 %) : ").append(pct(t)).append('\n');
        sb.append("- Conclusion du modèle : ").append(suspect
                ? "SUSPICION DE CANCER, avis dermatologique recommandé"
                : "PAS DE SIGNE FORT DE CANCER selon le modèle, surveillance selon avis médical").append('\n');
        sb.append("- Modèle : ").append(ml.path("modelName").asText()).append('\n');
        sb.append("\nFacteurs qui ont influencé le modèle (contribution > 0 : vers « cancer », < 0 : vers « non-cancer ») :\n");
        for (JsonNode c : ml.path("contributions")) {
            sb.append("- ").append(c.path("label").asText());
            if (!c.path("value").isNull() && !c.path("value").asText().isEmpty()) {
                sb.append(" = ").append(c.path("value").asText());
            }
            sb.append(" : ").append(String.format(Locale.FRANCE, "%+.2f", c.path("contribution").asDouble())).append('\n');
        }
        if (ml.path("concepts").size() > 0) {
            sb.append("\nCaractéristiques visuelles les plus marquées (concepts cliniques détectés dans l'image) :\n");
            for (JsonNode c : ml.path("concepts")) {
                sb.append("- ").append(c.path("label").asText()).append('\n');
            }
        }
        if (!ml.path("location").isNull() && !ml.path("location").asText().isEmpty()) {
            sb.append("\nZone de l'image la plus déterminante : ").append(ml.path("location").asText()).append('\n');
        }
        sb.append("\nRédige le compte rendu.");
        return sb.toString();
    }

    /**
     * Safeguard: if the generated text does not restate the computed probability, or contradicts the
     * conclusion, the exact facts are appended at the end of the report.
     */
    public String enforceFacts(String text, JsonNode ml) {
        double p = ml.path("probability").asDouble();
        boolean suspect = "suspicion_cancer".equals(ml.path("decision").asText());
        String lower = text.toLowerCase(Locale.ROOT);
        boolean hasProbability = text.contains(pct(p)) || text.contains(String.format(Locale.FRANCE, "%.2f", p))
                || text.contains(String.format(Locale.ROOT, "%.2f", p));
        boolean contradicts = suspect
                ? (lower.contains("pas de signe fort") || lower.contains("aucun signe"))
                : lower.contains("suspicion de cancer");
        StringBuilder out = new StringBuilder(text.trim());
        if (!hasProbability || contradicts) {
            out.append("\n\n[Valeurs exactes du modèle] Probabilité ").append(pct(p))
                    .append(" ; seuil ").append(pct(ml.path("threshold").asDouble()))
                    .append(" ; conclusion : ").append(suspect ? "suspicion de cancer." : "pas de signe fort de cancer.");
        }
        if (!lower.contains("biopsie")) {
            out.append("\n\nOutil d'aide à la décision : ne remplace ni l'examen clinique ni la biopsie.");
        }
        return out.toString();
    }

    static String pct(double v) {
        return String.format(Locale.FRANCE, "%.0f %%", v * 100);
    }
}
