package ma.fsbm.pfa.dermai.service;

import ma.fsbm.pfa.dermai.domain.Analysis;
import ma.fsbm.pfa.dermai.domain.AnalysisRepository;
import ma.fsbm.pfa.dermai.domain.AppUser;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import ma.fsbm.pfa.dermai.domain.ChatSession;
import ma.fsbm.pfa.dermai.domain.ChatSessionRepository;
import ma.fsbm.pfa.dermai.domain.Patient;
import ma.fsbm.pfa.dermai.domain.PatientRepository;
import ma.fsbm.pfa.dermai.domain.Role;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientDetail;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientDto;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientRequest;
import ma.fsbm.pfa.dermai.security.AuthUser;
import ma.fsbm.pfa.dermai.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/** Patient records: a doctor sees only their own patients, an administrator sees all of them. */
@Service
public class PatientService {

    private final PatientRepository patients;
    private final AnalysisRepository analysesRepo;
    private final AnalysisService analyses;
    private final AppUserRepository users;
    private final ChatSessionRepository chats;

    public PatientService(PatientRepository patients, AnalysisRepository analysesRepo, AnalysisService analyses,
                          AppUserRepository users, ChatSessionRepository chats) {
        this.patients = patients;
        this.analysesRepo = analysesRepo;
        this.analyses = analyses;
        this.users = users;
        this.chats = chats;
    }

    public List<PatientDto> list(String query) {
        AuthUser u = CurrentUser.get();
        List<Patient> list = u.isAdmin()
                ? patients.findAllByOrderByLastNameAscFirstNameAsc()
                : patients.findByDoctorIdOrderByLastNameAscFirstNameAsc(u.id());
        if (query != null && !query.isBlank()) {
            String q = fold(query);
            list = list.stream().filter(p -> fold(p.fullName() + " " + p.getLastName() + " " + p.getFirstName()
                    + " " + (p.getPhone() == null ? "" : p.getPhone())).contains(q)).toList();
        }
        return toDtos(list);
    }

    /** Lists the records, with the statistics of their analyses computed in a single query. */
    public List<PatientDto> toDtos(List<Patient> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        Map<Long, List<Analysis>> byPatient = analysesRepo.findByPatientIds(list.stream().map(Patient::getId).toList())
                .stream().collect(Collectors.groupingBy(Analysis::getPatientId));
        Map<Long, String> doctors = users.findAllById(list.stream().map(Patient::getDoctorId).distinct().toList())
                .stream().collect(Collectors.toMap(AppUser::getId, AppUser::getFullName));
        return list.stream().map(p -> toDto(p, doctors.get(p.getDoctorId()), byPatient.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    public PatientDetail get(Long id) {
        Patient p = find(id);
        List<Analysis> list = analysesRepo.findByPatientIdOrderByCreatedAtDesc(id);
        String doctor = users.findById(p.getDoctorId()).map(AppUser::getFullName).orElse(null);
        return new PatientDetail(toDto(p, doctor, list), analyses.summaries(list));
    }

    public PatientDto create(PatientRequest r) {
        Patient p = new Patient();
        p.setDoctorId(resolveDoctor(r.doctorId()));
        apply(p, r);
        return toDtos(List.of(patients.save(p))).get(0);
    }

    public PatientDto update(Long id, PatientRequest r) {
        Patient p = find(id);
        if (CurrentUser.get().isAdmin() && r.doctorId() != null) {
            p.setDoctorId(resolveDoctor(r.doctorId()));
        }
        apply(p, r);
        p.touch();
        return toDtos(List.of(patients.save(p))).get(0);
    }

    /** Deletes the record and its analyses; the conversations are kept but detached. */
    @Transactional
    public void delete(Long id) {
        Patient p = find(id);
        analyses.deleteForPatient(p.getId());
        for (ChatSession s : chats.findByPatientId(p.getId())) {
            s.setPatientId(null);
            chats.save(s);
        }
        patients.delete(p);
    }

    // ------------------------------------------------------------------ helpers
    private Patient find(Long id) {
        Patient p = patients.findById(id).orElseThrow(() -> new NoSuchElementException("Patient " + id + " introuvable"));
        return analyses.requirePatient(p.getId(), CurrentUser.get());
    }

    private Long resolveDoctor(Long requested) {
        AuthUser u = CurrentUser.get();
        if (!u.isAdmin()) {
            return u.id();
        }
        if (requested == null) {
            throw new IllegalArgumentException("Choisissez le médecin référent du patient.");
        }
        AppUser d = users.findById(requested)
                .orElseThrow(() -> new NoSuchElementException("Médecin " + requested + " introuvable"));
        if (d.getRole() != Role.DOCTOR) {
            throw new IllegalArgumentException("Le référent choisi n'est pas un compte médecin.");
        }
        return d.getId();
    }

    private static void apply(Patient p, PatientRequest r) {
        p.setFirstName(r.firstName().trim());
        p.setLastName(r.lastName().trim());
        p.setBirthYear(r.birthYear());
        p.setSex(AuthService.blankToNull(r.sex()));
        p.setPhototype(r.phototype());
        p.setPhone(AuthService.blankToNull(r.phone()));
        p.setNotes(AuthService.blankToNull(r.notes()));
    }

    private static PatientDto toDto(Patient p, String doctorName, List<Analysis> list) {
        Analysis last = list.isEmpty() ? null : list.get(0);
        Integer age = p.getBirthYear() == null ? null : Year.now().getValue() - p.getBirthYear();
        return new PatientDto(p.getId(), p.getDoctorId(), doctorName, p.getFirstName(), p.getLastName(),
                p.getBirthYear(), age, p.getSex(), p.getPhototype(), p.getPhone(), p.getNotes(), p.getCreatedAt(),
                p.getUpdatedAt(), list.size(), last == null ? null : last.getCreatedAt(),
                last == null ? null : last.getProbability(), last == null ? null : last.getDecision());
    }

    private static String fold(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
    }
}
