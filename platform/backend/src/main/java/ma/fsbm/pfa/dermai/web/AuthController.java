package ma.fsbm.pfa.dermai.web;

import jakarta.validation.Valid;
import ma.fsbm.pfa.dermai.dto.AuthDtos.AuthResponse;
import ma.fsbm.pfa.dermai.dto.AuthDtos.LoginRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.PasswordRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.ProfileRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.RegisterRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.UserDto;
import ma.fsbm.pfa.dermai.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest r) {
        return auth.register(r);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    @GetMapping("/me")
    public UserDto me() {
        return auth.me();
    }

    @PutMapping("/me")
    public UserDto updateProfile(@Valid @RequestBody ProfileRequest r) {
        return auth.updateProfile(r);
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordRequest r) {
        auth.changePassword(r);
        return ResponseEntity.noContent().build();
    }
}
