package ma.fsbm.pfa.dermai.security;

import ma.fsbm.pfa.dermai.config.AppProperties;
import ma.fsbm.pfa.dermai.domain.AnalysisRepository;
import ma.fsbm.pfa.dermai.domain.AppUser;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import ma.fsbm.pfa.dermai.domain.ChatSessionRepository;
import ma.fsbm.pfa.dermai.domain.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Startup: initializes the administrator account from {@code app.admin} (created if missing, always active
 * with the ADMIN role), then assigns to the administrator the analyses and conversations created before
 * accounts existed (otherwise invisible).
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AppUserRepository users;
    private final AnalysisRepository analyses;
    private final ChatSessionRepository chats;
    private final PasswordEncoder encoder;
    private final AppProperties.Admin admin;

    public AdminBootstrap(AppUserRepository users, AnalysisRepository analyses, ChatSessionRepository chats,
                          PasswordEncoder encoder, AppProperties props) {
        this.users = users;
        this.analyses = analyses;
        this.chats = chats;
        this.encoder = encoder;
        this.admin = props.admin();
    }

    @Override
    public void run(ApplicationArguments args) {
        if (admin != null && admin.email() != null && !admin.email().isBlank()) {
            initAdmin();
        }
        users.findAllByOrderByCreatedAtDesc().stream()
                .filter(u -> u.getRole() == Role.ADMIN)
                .reduce((first, second) -> second) // oldest administrator
                .ifPresent(a -> {
                    int n = analyses.claimOrphans(a.getId());
                    int c = chats.claimOrphans(a.getId());
                    if (n + c > 0) {
                        log.info("{} analyse(s) et {} conversation(s) antérieures rattachées à {}", n, c, a.getEmail());
                    }
                });
    }

    /** The configured account always exists, is active and has the ADMIN role (full access). */
    private void initAdmin() {
        String email = admin.email().trim().toLowerCase();
        AppUser u = users.findByEmailIgnoreCase(email).orElse(null);
        if (u == null) {
            u = new AppUser();
            u.setEmail(email);
            u.setFullName(admin.fullName() != null ? admin.fullName() : "Administrateur");
            u.setPasswordHash(encoder.encode(admin.password()));
            u.setRole(Role.ADMIN);
            u.setEnabled(true);
            users.save(u);
            log.info("Compte administrateur initialisé : {} (mot de passe défini dans application.yml)", email);
            return;
        }
        boolean changed = false;
        if (u.getRole() != Role.ADMIN || !u.isEnabled()) {
            u.setRole(Role.ADMIN);
            u.setEnabled(true);
            changed = true;
        }
        if (admin.resetPassword()) {
            u.setPasswordHash(encoder.encode(admin.password()));
            changed = true;
            log.warn("Mot de passe de {} réinitialisé (app.admin.reset-password=true : remettre false)", email);
        }
        if (changed) {
            users.save(u);
        }
    }
}
