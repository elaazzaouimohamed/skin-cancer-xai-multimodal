package ma.fsbm.pfa.dermai.web;

import ma.fsbm.pfa.dermai.dto.ChatDtos.SessionDetail;
import ma.fsbm.pfa.dermai.dto.ChatDtos.SessionSummary;
import ma.fsbm.pfa.dermai.service.ChatService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    @PostMapping("/sessions")
    public SessionDetail create(@RequestParam(value = "patientId", required = false) Long patientId) {
        return chat.create(patientId);
    }

    @PatchMapping("/sessions/{id}")
    public SessionDetail rename(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return chat.rename(id, body.get("title"));
    }

    @GetMapping("/sessions")
    public List<SessionSummary> list() {
        return chat.list();
    }

    @GetMapping("/sessions/{id}")
    public SessionDetail get(@PathVariable Long id) {
        return chat.get(id);
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        chat.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Message: text, image, or both (multipart/form-data). */
    @PostMapping(value = "/sessions/{id}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SessionDetail send(@PathVariable Long id,
                              @RequestParam(value = "text", required = false) String text,
                              @RequestPart(value = "image", required = false) MultipartFile image,
                              @RequestParam(value = "occlusion", defaultValue = "true") boolean occlusion,
                              @RequestParam(value = "style", defaultValue = "medecin") String style) {
        return chat.send(id, text, image, occlusion, style);
    }

    @PostMapping("/sessions/{id}/rerun")
    public SessionDetail rerun(@PathVariable Long id,
                               @RequestParam(value = "occlusion", defaultValue = "true") boolean occlusion,
                               @RequestParam(value = "style", defaultValue = "medecin") String style) {
        return chat.rerun(id, occlusion, style);
    }

    @GetMapping("/messages/{messageId}/image")
    public ResponseEntity<byte[]> image(@PathVariable Long messageId) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(chat.messageImageType(messageId)))
                .body(chat.messageImage(messageId));
    }
}
