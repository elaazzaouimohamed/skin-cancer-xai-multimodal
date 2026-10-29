package ma.fsbm.pfa.dermai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Duration;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AppProperties props;

    public WebConfig(AppProperties props) {
        this.props = props;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(props.cors().allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }

    @Bean
    public RestClient mlRestClient() {
        return RestClient.builder()
                .baseUrl(props.ml().baseUrl())
                .requestFactory(factory(props.ml().timeoutSeconds()))
                .build();
    }

    @Bean
    public RestClient llmRestClient() {
        return RestClient.builder()
                .baseUrl(props.llm().baseUrl())
                .requestFactory(factory(props.llm().timeoutSeconds()))
                .build();
    }

    private static SimpleClientHttpRequestFactory factory(int timeoutSeconds) {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(5));
        f.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return f;
    }
}
