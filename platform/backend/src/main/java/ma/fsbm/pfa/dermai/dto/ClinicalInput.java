package ma.fsbm.pfa.dermai.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Clinical variables used by the model (the ones retained in notebook 01).
 * {@code null} means "not provided" (handled by imputation in the model).
 */
public record ClinicalInput(
        @Min(0) @Max(120) Integer age,
        String region,
        Boolean itch,
        Boolean grew,
        Boolean hurt,
        Boolean changed,
        Boolean bleed,
        Boolean elevation) {
}
