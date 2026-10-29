package ma.fsbm.pfa.dermai.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "chat_message", indexes = @Index(name = "idx_chat_message_session", columnList = "sessionId"))
public class ChatMessage {

    public static final String ROLE_USER = "user";
    public static final String ROLE_ASSISTANT = "assistant";

    /** text: plain message; analysis: result of the model; error: service unavailable. */
    public static final String KIND_TEXT = "text";
    public static final String KIND_ANALYSIS = "analysis";
    public static final String KIND_ERROR = "error";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long sessionId;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String kind = KIND_TEXT;

    @Lob
    private String text;

    private String imageFile;
    private String imageContentType;

    private Long analysisId;

    /** Clinical facts extracted from this message (JSON), shown as chips. */
    @Lob
    private String factsJson;

    public ChatMessage() {
    }

    public ChatMessage(Long sessionId, String role, String kind, String text) {
        this.sessionId = sessionId;
        this.role = role;
        this.kind = kind;
        this.text = text;
    }

    public Long getId() { return id; }
    public Long getSessionId() { return sessionId; }
    public Instant getCreatedAt() { return createdAt; }
    public String getRole() { return role; }
    public String getKind() { return kind; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getImageFile() { return imageFile; }
    public void setImageFile(String imageFile) { this.imageFile = imageFile; }
    public String getImageContentType() { return imageContentType; }
    public void setImageContentType(String imageContentType) { this.imageContentType = imageContentType; }
    public Long getAnalysisId() { return analysisId; }
    public void setAnalysisId(Long analysisId) { this.analysisId = analysisId; }
    public String getFactsJson() { return factsJson; }
    public void setFactsJson(String factsJson) { this.factsJson = factsJson; }
}
