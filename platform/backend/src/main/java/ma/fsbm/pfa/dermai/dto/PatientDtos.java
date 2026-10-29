package ma.fsbm.pfa.dermai.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisSummary;

import java.time.Instant;
import java.util.List;

public final class PatientDtos {

    private PatientDtos() {
    }

    /** {@code doctorId} is only taken into account for an administrator (assignment of the record). */
    public record PatientRequest(@NotBlank @Size(max = 80) String firstName,
                                 @NotBlank @Size(max = 80) String lastName,
                                 @Min(1900) @Max(2100) Integer birthYear,
                                 @Pattern(regexp = "^(F|M)?$") String sex,
                                 @Min(1) @Max(6) Integer phototype,
                                 @Size(max = 30) String phone,
                                 @Size(max = 4000) String notes,
                                 Long doctorId) {
    }

    public record PatientDto(Long id, Long doctorId, String doctorName, String firstName, String lastName,
                             Integer birthYear, Integer age, String sex, Integer phototype, String phone, String notes,
                             Instant createdAt, Instant updatedAt, long analysesCount, Instant lastAnalysisAt,
                             Double lastProbability, String lastDecision) {
    }

    public record PatientDetail(PatientDto patient, List<AnalysisSummary> analyses) {
    }
}
