package ma.fsbm.pfa.dermai.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import ma.fsbm.pfa.dermai.domain.AppUser;

import java.time.Instant;

public final class AuthDtos {

    private AuthDtos() {
    }

    /** Public sign-up: role DOCTOR (pending validation by an administrator) or PATIENT. */
    public record RegisterRequest(@NotBlank @Email String email,
                                  @NotBlank @Size(min = 8, max = 100) String password,
                                  @NotBlank @Size(max = 120) String fullName,
                                  @NotBlank String role,
                                  @Size(max = 120) String specialty,
                                  @Size(max = 160) String institution) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record ProfileRequest(@NotBlank @Size(max = 120) String fullName,
                                 @Size(max = 120) String specialty,
                                 @Size(max = 160) String institution) {
    }

    public record PasswordRequest(@NotBlank String currentPassword,
                                  @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    public record UserDto(Long id, String email, String fullName, String role, boolean enabled, String specialty,
                          String institution, Instant createdAt, Instant lastLoginAt) {

        public static UserDto of(AppUser u) {
            return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole().name(), u.isEnabled(),
                    u.getSpecialty(), u.getInstitution(), u.getCreatedAt(), u.getLastLoginAt());
        }
    }

    /** {@code token} is null when the account is pending validation (doctor). */
    public record AuthResponse(String token, UserDto user, String message) {
    }
}
