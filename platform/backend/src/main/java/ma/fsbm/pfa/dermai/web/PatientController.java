package ma.fsbm.pfa.dermai.web;

import jakarta.validation.Valid;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientDetail;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientDto;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientRequest;
import ma.fsbm.pfa.dermai.service.PatientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Patient records (roles DOCTOR and ADMIN, see SecurityConfig). */
@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService service;

    public PatientController(PatientService service) {
        this.service = service;
    }

    @GetMapping
    public List<PatientDto> list(@RequestParam(value = "q", required = false) String q) {
        return service.list(q);
    }

    @GetMapping("/{id}")
    public PatientDetail get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public PatientDto create(@Valid @RequestBody PatientRequest r) {
        return service.create(r);
    }

    @PutMapping("/{id}")
    public PatientDto update(@PathVariable Long id, @Valid @RequestBody PatientRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
