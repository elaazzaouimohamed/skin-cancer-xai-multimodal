package ma.fsbm.pfa.dermai.web;

import ma.fsbm.pfa.dermai.dto.AnalysisDtos.ApiError;
import ma.fsbm.pfa.dermai.service.ExternalServiceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Map<String, String> FIELDS = Map.ofEntries(
            Map.entry("email", "E-mail"), Map.entry("password", "Mot de passe"),
            Map.entry("newPassword", "Nouveau mot de passe"), Map.entry("fullName", "Nom complet"),
            Map.entry("firstName", "Prénom"), Map.entry("lastName", "Nom"),
            Map.entry("birthYear", "Année de naissance"), Map.entry("phototype", "Phototype"),
            Map.entry("role", "Rôle"), Map.entry("sex", "Sexe"));

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(new ApiError("requête invalide", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> FIELDS.getOrDefault(f.getField(), f.getField()) + " : " + f.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining(" · "));
        return ResponseEntity.badRequest().body(new ApiError("requête invalide", msg));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(new ApiError("requête invalide", "Corps de requête JSON illisible"));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiError> missingPart(MissingServletRequestPartException e) {
        return ResponseEntity.badRequest().body(new ApiError("requête invalide", "Partie manquante : " + e.getRequestPartName()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(new ApiError("image trop volumineuse", "15 Mo maximum"));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> badCredentials(BadCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError("identifiants invalides", e.getMessage()));
    }

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ApiError> unauthenticated(AuthenticationCredentialsNotFoundException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError("non authentifié", e.getMessage()));
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiError> disabled(DisabledException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError("compte inactif", e.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> forbidden(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError("accès refusé", e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiError> notFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("introuvable", e.getMessage()));
    }

    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ApiError> external(ExternalServiceException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(new ApiError("service externe", e.getMessage()));
    }
}
