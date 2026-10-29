package ma.fsbm.pfa.dermai.web;

import jakarta.validation.Valid;
import ma.fsbm.pfa.dermai.dto.AdminDtos.AdminStats;
import ma.fsbm.pfa.dermai.dto.AdminDtos.CreateUserRequest;
import ma.fsbm.pfa.dermai.dto.AdminDtos.UpdateUserRequest;
import ma.fsbm.pfa.dermai.dto.AuthDtos.UserDto;
import ma.fsbm.pfa.dermai.service.AdminService;
import ma.fsbm.pfa.dermai.service.StatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Administration (role ADMIN, see SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService admin;
    private final StatsService stats;

    public AdminController(AdminService admin, StatsService stats) {
        this.admin = admin;
        this.stats = stats;
    }

    @GetMapping("/stats")
    public AdminStats stats() {
        return stats.adminStats();
    }

    @GetMapping("/users")
    public List<UserDto> users() {
        return admin.users();
    }

    @PostMapping("/users")
    public UserDto create(@Valid @RequestBody CreateUserRequest r) {
        return admin.create(r);
    }

    @PatchMapping("/users/{id}")
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest r) {
        return admin.update(id, r);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        admin.delete(id);
        return ResponseEntity.noContent().build();
    }
}
