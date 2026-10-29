package ma.fsbm.pfa.dermai.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads the JWT token from the {@code Authorization: Bearer …} header or, for images displayed with
 * {@code <img src>}, from the {@code access_token} parameter. The account is re-read from the database:
 * a disabled account or a changed role takes effect immediately, without waiting for the token to expire.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final AppUserRepository users;

    public JwtAuthFilter(JwtService jwt, AppUserRepository users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = null;
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7);
        } else if ("GET".equals(request.getMethod()) && request.getParameter("access_token") != null) {
            token = request.getParameter("access_token");
        }
        if (token != null) {
            jwt.parse(token)
                    .flatMap(claims -> users.findById(claims.id()))
                    .filter(u -> u.isEnabled())
                    .ifPresent(u -> {
                        AuthUser user = new AuthUser(u.getId(), u.getEmail(), u.getFullName(), u.getRole());
                        var auth = new UsernamePasswordAuthenticationToken(user, null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    });
        }
        chain.doFilter(request, response);
    }
}
