package ma.fsbm.pfa.dermai.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public final class AnalysisDtos {

    private AnalysisDtos() {
    }

    /** Report rephrased by the local LLM (presentation only: it never changes the decision). */
    public record LlmReport(String text, String model, String status, Integer durationMs) {
    }

    public record AnalysisResponse(Long id, Instant createdAt, JsonNode clinical, JsonNode ml, LlmReport llm,
                                   String reportStyle, Long patientId, String patientName, String ownerName) {
    }

    public record AnalysisSummary(Long id, Instant createdAt, Integer age, String region, Double probability,
                                  String decision, Double threshold, String modelName, Long patientId,
                                  String patientName, Long ownerId, String ownerName) {
    }

    public record ServiceStatus(String name, boolean up, String detail) {
    }

    public record SystemStatus(ServiceStatus backend, ServiceStatus ml, ServiceStatus llm) {
    }

    public record ApiError(String error, String message) {
    }
}
