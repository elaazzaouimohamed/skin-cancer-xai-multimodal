package ma.fsbm.pfa.dermai.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/** Client for the Python inference service (FastAPI). */
@Component
public class MlClient {

    private final RestClient client;

    public MlClient(@Qualifier("mlRestClient") RestClient client) {
        this.client = client;
    }

    public JsonNode predict(byte[] image, String filename, String contentType, String clinicalJson, boolean occlusion) {
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.parseMediaType(contentType != null ? contentType : "image/png"));
        ByteArrayResource resource = new ByteArrayResource(image) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "image.png";
            }
        };
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("image", new HttpEntity<>(resource, fileHeaders));
        parts.add("clinical", clinicalJson);
        parts.add("occlusion", String.valueOf(occlusion));
        try {
            return client.post().uri("/predict")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(parts)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw new ExternalServiceException("Service d'inférence : " + e.getResponseBodyAsString(), e);
        } catch (RestClientException e) {
            throw new ExternalServiceException("Service d'inférence injoignable (" + e.getMessage() + ")", e);
        }
    }

    public JsonNode health() {
        return client.get().uri("/health").retrieve().body(JsonNode.class);
    }

    public JsonNode modelInfo() {
        try {
            return client.get().uri("/model-info").retrieve().body(JsonNode.class);
        } catch (RestClientException e) {
            throw new ExternalServiceException("Service d'inférence injoignable (" + e.getMessage() + ")", e);
        }
    }
}
