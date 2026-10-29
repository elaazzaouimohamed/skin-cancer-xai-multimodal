package ma.fsbm.pfa.dermai.service;

import ma.fsbm.pfa.dermai.domain.AppUser;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import ma.fsbm.pfa.dermai.domain.ChatMessageRepository;
import ma.fsbm.pfa.dermai.domain.ChatSession;
import ma.fsbm.pfa.dermai.domain.ChatSessionRepository;
import ma.fsbm.pfa.dermai.domain.PatientRepository;
import ma.fsbm.pfa.dermai.domain.Role;
import ma.fsbm.pfa.dermai.dto.AdminDtos.CreateUserRequest;
import ma.fsbm.pfa.dermai.dto.AdminDtos.UpdateUserRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.UserDto;
import ma.fsbm.pfa.dermai.security.CurrentUser;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;

/** Account management by the administrator. */
@Service
public class AdminService {

    private final AppUserRepository users;
    private final PatientRepository patients;
    private final ChatSessionRepository chats;
    private final ChatMessageRepository messages;
    private final PasswordEncoder encoder;

    public AdminService(AppUserRepository users, PatientRepository patients, ChatSessionRepository chats,
                        ChatMessageRepository messages, PasswordEncoder encoder) {
        this.users = users;
        this.patients = patients;
        this.chats = chats;
        this.messages = messages;
        this.encoder = encoder;
    }

    public List<UserDto> users() {
        return users.findAllByOrderByCreatedAtDesc().stream().map(UserDto::of).toList();
    }

    public UserDto create(CreateUserRequest r) {
        String email = r.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Un compte existe déjà avec cet e-mail.");
        }
        AppUser u = new AppUser();
        u.setEmail(email);
        u.setFullName(r.fullName().trim());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setRole(parseRole(r.role()));
        u.setSpecialty(AuthService.blankToNull(r.specialty()));
        u.setInstitution(AuthService.blankToNull(r.institution()));
        u.setEnabled(r.enabled() == null || r.enabled());
        return UserDto.of(users.save(u));
    }

    public UserDto update(Long id, UpdateUserRequest r) {
        AppUser u = find(id);
        boolean self = Objects.equals(u.getId(), CurrentUser.get().id());
        if (r.role() != null) {
            Role role = parseRole(r.role());
            if (u.getRole() == Role.ADMIN && role != Role.ADMIN) {
                guardLastAdmin(u, self, "retirer le rôle administrateur");
            }
            if (u.getRole() == Role.DOCTOR && role != Role.DOCTOR && patients.countByDoctorId(u.getId()) > 0) {
                throw new IllegalArgumentException("Ce médecin suit encore des patients : réaffectez-les d'abord.");
            }
            u.setRole(role);
        }
        if (r.enabled() != null) {
            if (!r.enabled() && u.getRole() == Role.ADMIN) {
                guardLastAdmin(u, self, "désactiver ce compte");
            }
            u.setEnabled(r.enabled());
        }
        if (r.fullName() != null && !r.fullName().isBlank()) {
            u.setFullName(r.fullName().trim());
        }
        if (r.specialty() != null) {
            u.setSpecialty(AuthService.blankToNull(r.specialty()));
        }
        if (r.institution() != null) {
            u.setInstitution(AuthService.blankToNull(r.institution()));
        }
        if (r.password() != null && !r.password().isBlank()) {
            u.setPasswordHash(encoder.encode(r.password()));
        }
        return UserDto.of(users.save(u));
    }

    /** Deletes the account and its conversations; the analyses stay in the history (author "deleted account"). */
    @Transactional
    public void delete(Long id) {
        AppUser u = find(id);
        if (Objects.equals(u.getId(), CurrentUser.get().id())) {
            throw new IllegalArgumentException("Vous ne pouvez pas supprimer votre propre compte.");
        }
        if (u.getRole() == Role.ADMIN) {
            guardLastAdmin(u, false, "supprimer ce compte");
        }
        if (patients.countByDoctorId(u.getId()) > 0) {
            throw new IllegalArgumentException(
                    "Ce médecin suit encore des patients : désactivez le compte ou réaffectez ses patients.");
        }
        for (ChatSession s : chats.findByOwnerId(u.getId())) {
            messages.deleteBySessionId(s.getId());
            chats.delete(s);
        }
        users.delete(u);
    }

    private void guardLastAdmin(AppUser u, boolean self, String action) {
        if (self) {
            throw new IllegalArgumentException("Vous ne pouvez pas " + action + " sur votre propre compte.");
        }
        if (users.countByRoleAndEnabled(Role.ADMIN, true) <= 1 && u.isEnabled()) {
            throw new IllegalArgumentException("Impossible de " + action + " : c'est le dernier administrateur actif.");
        }
    }

    private AppUser find(Long id) {
        return users.findById(id).orElseThrow(() -> new NoSuchElementException("Compte " + id + " introuvable"));
    }

    private static Role parseRole(String role) {
        try {
            return Role.valueOf(role.trim().toUpperCase());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Rôle invalide : ADMIN, DOCTOR ou PATIENT.");
        }
    }
}
