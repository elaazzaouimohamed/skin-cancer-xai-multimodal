package ma.fsbm.pfa.dermai.service;

import com.fasterxml.jackson.databind.JsonNode;
import ma.fsbm.pfa.dermai.config.AppProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * Client for the local LLM served by LM Studio (OpenAI-compatible API, http://127.0.0.1:1234/v1).
 * The LLM only receives values already computed by the model: never the image, never the decision to make.
 */
@Component
public class LlmClient {

    public record Result(String text, String model, long durationMs) {
    }

    private final RestClient client;
    private final AppProperties.Llm props;

    public LlmClient(@Qualifier("llmRestClient") RestClient client, AppProperties props) {
        this.client = client;
        this.props = props.llm();
    }

    public boolean enabled() {
        return props.enabled();
    }

    public String model() {
        return props.model();
    }

    public Result chat(String system, String user) {
        return complete(system, user, null, props.temperature(), props.maxTokens());
    }

    /**
     * Generic call. {@code responseFormat} (optional) forces a JSON response following a schema
     * (structured output supported by LM Studio); if the server refuses it, the call is retried without it.
     */
    public Result complete(String system, String user, Map<String, Object> responseFormat, double temperature,
                           int maxTokens) {
        try {
            return send(system, user, responseFormat, temperature, maxTokens);
        } catch (ExternalServiceException e) {
            if (responseFormat == null) {
                throw e;
            }
            return send(system, user, null, temperature, maxTokens);
        }
    }

    private Result send(String system, String user, Map<String, Object> responseFormat, double temperature,
                        int maxTokens) {
        long t0 = System.currentTimeMillis();
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("model", props.model());
        body.put("messages", List.of(Map.of("role", "system", "content", system),
                Map.of("role", "user", "content", user)));
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("stream", false);
        if (responseFormat != null) {
            body.put("response_format", responseFormat);
        }
        try {
            JsonNode res = client.post().uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            String text = res.path("choices").path(0).path("message").path("content").asText("");
            String model = res.path("model").asText(props.model());
            return new Result(stripReasoning(text), model, System.currentTimeMillis() - t0);
        } catch (RestClientException e) {
            throw new ExternalServiceException("LLM (LM Studio) injoignable : " + e.getMessage(), e);
        }
    }

    /** Lists the models exposed by LM Studio (used by the status page). */
    public List<String> availableModels() {
        JsonNode res = client.get().uri("/models").retrieve().body(JsonNode.class);
        return res.path("data").findValuesAsText("id");
    }

    /** Some models (e.g. reasoning models) emit a <think>...</think> block: it is removed. */
    static String stripReasoning(String text) {
        return text.replaceAll("(?s)<think>.*?</think>", "").trim();
    }
}
