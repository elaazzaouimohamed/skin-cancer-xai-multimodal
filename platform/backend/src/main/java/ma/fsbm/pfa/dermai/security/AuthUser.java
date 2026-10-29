package ma.fsbm.pfa.dermai.security;

import ma.fsbm.pfa.dermai.domain.Role;

/** Logged-in user, as carried by the JWT token. */
public record AuthUser(Long id, String email, String fullName, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isDoctor() {
        return role == Role.DOCTOR;
    }
}
