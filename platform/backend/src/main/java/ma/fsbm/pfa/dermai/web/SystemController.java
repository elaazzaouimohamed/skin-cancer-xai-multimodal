package ma.fsbm.pfa.dermai.web;

import com.fasterxml.jackson.databind.JsonNode;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.ServiceStatus;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.SystemStatus;
import ma.fsbm.pfa.dermai.service.LlmClient;
import ma.fsbm.pfa.dermai.service.MlClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final MlClient ml;
    private final LlmClient llm;

    public SystemController(MlClient ml, LlmClient llm) {
        this.ml = ml;
        this.llm = llm;
    }

    @GetMapping("/status")
    public SystemStatus status() {
        ServiceStatus mlStatus;
        try {
            JsonNode h = ml.health();
            boolean loaded = h.path("modelLoaded").asBoolean(false);
            mlStatus = new ServiceStatus("Service d'inférence (DermLIP + modèle)", loaded,
                    loaded ? h.path("modelName").asText() + " sur " + h.path("device").asText()
                            : "modèle non chargé : " + h.path("error").asText());
        } catch (RuntimeException e) {
            mlStatus = new ServiceStatus("Service d'inférence (DermLIP + modèle)", false, "injoignable");
        }

        ServiceStatus llmStatus;
        if (!llm.enabled()) {
            llmStatus = new ServiceStatus("LLM local (LM Studio)", false, "désactivé dans la configuration");
        } else {
            try {
                List<String> models = llm.availableModels();
                boolean present = models.stream().anyMatch(m -> m.equalsIgnoreCase(llm.model()));
                llmStatus = new ServiceStatus("LLM local (LM Studio)", true,
                        present ? llm.model() : llm.model() + " (chargé à la demande ; disponibles : " + String.join(", ", models) + ")");
            } catch (RuntimeException e) {
                llmStatus = new ServiceStatus("LLM local (LM Studio)", false,
                        "serveur LM Studio arrêté : rapport par gabarit utilisé");
            }
        }
        return new SystemStatus(new ServiceStatus("API Spring Boot", true, "ok"), mlStatus, llmStatus);
    }

    @GetMapping("/model-info")
    public JsonNode modelInfo() {
        return ml.modelInfo();
    }
}
