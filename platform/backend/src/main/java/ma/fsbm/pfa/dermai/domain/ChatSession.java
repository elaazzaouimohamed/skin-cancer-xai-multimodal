package ma.fsbm.pfa.dermai.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

/** A conversation: it accumulates the clinical facts provided and remembers the last image analyzed. */
@Entity
@Table(name = "chat_session")
public class ChatSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    private String title;

    private Long ownerId;

    /** Patient record the conversation is attached to (doctor), or null. */
    private Long patientId;

    /** Clinical facts accumulated during the conversation (JSON of ClinicalInput). */
    @Lob
    private String clinicalJson;

    private Long lastAnalysisId;

    /** Clinical facts used for the last analysis, to detect a change. */
    @Lob
    private String lastAnalysisClinicalJson;

    private String lastImageFile;
    private String lastImageContentType;
    private String lastImageName;

    public Long getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { this.updatedAt = Instant.now(); }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public Long getPatientId() { return patientId; }
    public void setPatientId(Long patientId) { this.patientId = patientId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getClinicalJson() { return clinicalJson; }
    public void setClinicalJson(String clinicalJson) { this.clinicalJson = clinicalJson; }
    public Long getLastAnalysisId() { return lastAnalysisId; }
    public void setLastAnalysisId(Long lastAnalysisId) { this.lastAnalysisId = lastAnalysisId; }
    public String getLastAnalysisClinicalJson() { return lastAnalysisClinicalJson; }
    public void setLastAnalysisClinicalJson(String json) { this.lastAnalysisClinicalJson = json; }
    public String getLastImageFile() { return lastImageFile; }
    public void setLastImageFile(String lastImageFile) { this.lastImageFile = lastImageFile; }
    public String getLastImageContentType() { return lastImageContentType; }
    public void setLastImageContentType(String type) { this.lastImageContentType = type; }
    public String getLastImageName() { return lastImageName; }
    public void setLastImageName(String lastImageName) { this.lastImageName = lastImageName; }
}
