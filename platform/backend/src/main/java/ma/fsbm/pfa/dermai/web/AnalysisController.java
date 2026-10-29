package ma.fsbm.pfa.dermai.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisResponse;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisSummary;
import ma.fsbm.pfa.dermai.dto.ClinicalInput;
import ma.fsbm.pfa.dermai.service.AnalysisService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analyses")
public class AnalysisController {

    private final AnalysisService service;
    private final ObjectMapper mapper;
    private final Validator validator;

    public AnalysisController(AnalysisService service, ObjectMapper mapper, Validator validator) {
        this.service = service;
        this.mapper = mapper;
        this.validator = validator;
    }

    /**
     * New analysis. multipart/form-data parts:
     * image (file), clinical (JSON {@link ClinicalInput}), occlusion (bool), style (medecin|patient),
     * patientId (optional: patient record of the doctor).
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AnalysisResponse create(@RequestPart("image") MultipartFile image,
                                   @RequestParam(value = "clinical", defaultValue = "{}") String clinicalJson,
                                   @RequestParam(value = "occlusion", defaultValue = "true") boolean occlusion,
                                   @RequestParam(value = "style", defaultValue = "medecin") String style,
                                   @RequestParam(value = "patientId", required = false) Long patientId) {
        ClinicalInput clinical = parseClinical(clinicalJson);
        return service.analyze(image, clinical, occlusion, style, patientId);
    }

    @GetMapping
    public List<AnalysisSummary> history() {
        return service.history();
    }

    @GetMapping("/{id}")
    public AnalysisResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable Long id) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(service.imageContentType(id)))
                .body(service.image(id));
    }

    /** Regenerates only the rephrased report (doctor or patient style); the decision is unchanged. */
    @PostMapping("/{id}/report")
    public AnalysisResponse regenerate(@PathVariable Long id,
                                       @RequestParam(value = "style", defaultValue = "medecin") String style) {
        return service.regenerateReport(id, style);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private ClinicalInput parseClinical(String json) {
        ClinicalInput input;
        try {
            input = mapper.readValue(json, ClinicalInput.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Données cliniques invalides : " + e.getOriginalMessage());
        }
        Set<ConstraintViolation<ClinicalInput>> violations = validator.validate(input);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException(violations.stream()
                    .map(v -> v.getPropertyPath() + " " + v.getMessage())
                    .collect(Collectors.joining(", ")));
        }
        return input;
    }
}
