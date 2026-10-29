package ma.fsbm.pfa.dermai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Ml ml, Llm llm, Storage storage, Cors cors, Security security, Admin admin) {

    public record Ml(String baseUrl, int timeoutSeconds) {
    }

    public record Llm(boolean enabled, String baseUrl, String model, double temperature, int maxTokens,
                      int timeoutSeconds) {
    }

    public record Storage(String dir) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Security(String jwtSecret, int jwtTtlHours) {
    }

    /** Administrator account initialized at startup; {@code resetPassword} re-applies the configured password. */
    public record Admin(String email, String password, String fullName, boolean resetPassword) {
    }
}
