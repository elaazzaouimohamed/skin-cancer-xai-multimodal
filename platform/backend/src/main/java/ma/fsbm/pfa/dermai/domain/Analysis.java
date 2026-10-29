package ma.fsbm.pfa.dermai.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

/** One analysis: clinical input, model output (stored as JSON) and the rephrased report. */
@Entity
@Table(name = "analysis")
public class Analysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /** User who ran the analysis. */
    private Long ownerId;

    /** Patient record concerned (doctor's analyses), or null. */
    private Long patientId;

    @Lob
    @Column(nullable = false)
    private String clinicalJson;

    private Integer age;
    private String region;

    private Double probability;
    private String decision;
    private Double threshold;
    private String modelName;
    private Integer inferenceMs;

    @Lob
    private String mlResultJson;

    private String reportStyle;

    @Lob
    private String llmReport;
    private String llmModel;
    private String llmStatus;
    private Integer llmMs;

    private String imageFile;
    private String imageContentType;

    public Long getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public Long getPatientId() { return patientId; }
    public void setPatientId(Long patientId) { this.patientId = patientId; }
    public String getClinicalJson() { return clinicalJson; }
    public void setClinicalJson(String clinicalJson) { this.clinicalJson = clinicalJson; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public Double getProbability() { return probability; }
    public void setProbability(Double probability) { this.probability = probability; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public Double getThreshold() { return threshold; }
    public void setThreshold(Double threshold) { this.threshold = threshold; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public Integer getInferenceMs() { return inferenceMs; }
    public void setInferenceMs(Integer inferenceMs) { this.inferenceMs = inferenceMs; }
    public String getMlResultJson() { return mlResultJson; }
    public void setMlResultJson(String mlResultJson) { this.mlResultJson = mlResultJson; }
    public String getReportStyle() { return reportStyle; }
    public void setReportStyle(String reportStyle) { this.reportStyle = reportStyle; }
    public String getLlmReport() { return llmReport; }
    public void setLlmReport(String llmReport) { this.llmReport = llmReport; }
    public String getLlmModel() { return llmModel; }
    public void setLlmModel(String llmModel) { this.llmModel = llmModel; }
    public String getLlmStatus() { return llmStatus; }
    public void setLlmStatus(String llmStatus) { this.llmStatus = llmStatus; }
    public Integer getLlmMs() { return llmMs; }
    public void setLlmMs(Integer llmMs) { this.llmMs = llmMs; }
    public String getImageFile() { return imageFile; }
    public void setImageFile(String imageFile) { this.imageFile = imageFile; }
    public String getImageContentType() { return imageContentType; }
    public void setImageContentType(String imageContentType) { this.imageContentType = imageContentType; }
}
