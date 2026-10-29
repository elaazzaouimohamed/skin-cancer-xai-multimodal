package ma.fsbm.pfa.dermai.service;

import ma.fsbm.pfa.dermai.domain.AppUser;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import ma.fsbm.pfa.dermai.domain.Role;
import ma.fsbm.pfa.dermai.dto.AuthDtos.AuthResponse;
import ma.fsbm.pfa.dermai.dto.AuthDtos.LoginRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.PasswordRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.ProfileRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.RegisterRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.UserDto;
import ma.fsbm.pfa.dermai.security.CurrentUser;
import ma.fsbm.pfa.dermai.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.NoSuchElementException;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(AppUserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    /** A patient account is active immediately; a doctor account waits for validation by an administrator. */
    public AuthResponse register(RegisterRequest r) {
        Role role = parsePublicRole(r.role());
        String email = r.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Un compte existe déjà avec cet e-mail.");
        }
        AppUser u = new AppUser();
        u.setEmail(email);
        u.setFullName(r.fullName().trim());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setRole(role);
        u.setSpecialty(blankToNull(r.specialty()));
        u.setInstitution(blankToNull(r.institution()));
        u.setEnabled(role == Role.PATIENT);
        users.save(u);
        if (!u.isEnabled()) {
            return new AuthResponse(null, UserDto.of(u),
                    "Compte médecin créé : il sera actif après validation par un administrateur.");
        }
        return login(u);
    }

    public AuthResponse login(LoginRequest r) {
        AppUser u = users.findByEmailIgnoreCase(r.email().trim())
                .filter(x -> encoder.matches(r.password(), x.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException("E-mail ou mot de passe incorrect."));
        if (!u.isEnabled()) {
            throw new DisabledException(u.getRole() == Role.DOCTOR
                    ? "Compte médecin en attente de validation par un administrateur."
                    : "Ce compte est désactivé. Contactez l'administrateur.");
        }
        return login(u);
    }

    private AuthResponse login(AppUser u) {
        u.setLastLoginAt(Instant.now());
        users.save(u);
        return new AuthResponse(jwt.issue(u), UserDto.of(u), null);
    }

    public UserDto me() {
        return UserDto.of(current());
    }

    public UserDto updateProfile(ProfileRequest r) {
        AppUser u = current();
        u.setFullName(r.fullName().trim());
        u.setSpecialty(blankToNull(r.specialty()));
        u.setInstitution(blankToNull(r.institution()));
        return UserDto.of(users.save(u));
    }

    public void changePassword(PasswordRequest r) {
        AppUser u = current();
        if (!encoder.matches(r.currentPassword(), u.getPasswordHash())) {
            throw new IllegalArgumentException("Mot de passe actuel incorrect.");
        }
        u.setPasswordHash(encoder.encode(r.newPassword()));
        users.save(u);
    }

    private AppUser current() {
        Long id = CurrentUser.get().id();
        return users.findById(id).orElseThrow(() -> new NoSuchElementException("Compte introuvable"));
    }

    private static Role parsePublicRole(String role) {
        if ("DOCTOR".equalsIgnoreCase(role) || "MEDECIN".equalsIgnoreCase(role)) {
            return Role.DOCTOR;
        }
        if ("PATIENT".equalsIgnoreCase(role)) {
            return Role.PATIENT;
        }
        throw new IllegalArgumentException("Rôle invalide : choisissez « médecin » ou « patient ».");
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
