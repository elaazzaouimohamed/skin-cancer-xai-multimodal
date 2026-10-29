package ma.fsbm.pfa.dermai.dto;

import com.fasterxml.jackson.databind.JsonNode;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisResponse;

import java.time.Instant;
import java.util.List;

public final class ChatDtos {

    private ChatDtos() {
    }

    public record SessionSummary(Long id, String title, Instant createdAt, Instant updatedAt, Long patientId,
                                 String patientName) {
    }

    /** Message; {@code analysis} is filled in for messages of kind "analysis". */
    public record MessageDto(Long id, String role, String kind, String text, String imageUrl,
                             AnalysisResponse analysis, JsonNode facts, Instant createdAt) {
    }

    public record SessionDetail(Long id, String title, JsonNode clinical, String clinicalSummary,
                                Long lastAnalysisId, boolean factsChangedSinceAnalysis, boolean llmAvailable,
                                Long patientId, String patientName, List<MessageDto> messages) {
    }
}
