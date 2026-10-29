package ma.fsbm.pfa.dermai.service;

/** Error from an external service (ML service or LLM). */
public class ExternalServiceException extends RuntimeException {

    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
