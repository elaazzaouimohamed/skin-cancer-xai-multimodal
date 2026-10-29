package ma.fsbm.pfa.dermai.service;

import ma.fsbm.pfa.dermai.domain.Analysis;
import ma.fsbm.pfa.dermai.domain.AnalysisRepository;
import ma.fsbm.pfa.dermai.domain.AppUser;
import ma.fsbm.pfa.dermai.domain.AppUserRepository;
import ma.fsbm.pfa.dermai.domain.ChatSessionRepository;
import ma.fsbm.pfa.dermai.domain.Patient;
import ma.fsbm.pfa.dermai.domain.PatientRepository;
import ma.fsbm.pfa.dermai.domain.Role;
import ma.fsbm.pfa.dermai.dto.AdminDtos.AdminStats;
import ma.fsbm.pfa.dermai.dto.AdminDtos.Dashboard;
import ma.fsbm.pfa.dermai.dto.AdminDtos.DayCount;
import ma.fsbm.pfa.dermai.dto.AdminDtos.DoctorActivity;
import ma.fsbm.pfa.dermai.dto.AdminDtos.LabelCount;
import ma.fsbm.pfa.dermai.dto.PatientDtos.PatientDto;
import ma.fsbm.pfa.dermai.security.AuthUser;
import ma.fsbm.pfa.dermai.security.CurrentUser;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** Dashboard indicators: personal (doctor, patient) or global (administrator). */
@Service
public class StatsService {

    static final String SUSPICION = "suspicion_cancer";
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final AnalysisRepository analysesRepo;
    private final AnalysisService analyses;
    private final PatientRepository patients;
    private final PatientService patientService;
    private final AppUserRepository users;
    private final ChatSessionRepository chats;

    public StatsService(AnalysisRepository analysesRepo, AnalysisService analyses, PatientRepository patients,
                        PatientService patientService, AppUserRepository users, ChatSessionRepository chats) {
        this.analysesRepo = analysesRepo;
        this.analyses = analyses;
        this.patients = patients;
        this.patientService = patientService;
        this.users = users;
        this.chats = chats;
    }

    public Dashboard dashboard() {
        AuthUser u = CurrentUser.get();
        List<Analysis> list = u.isAdmin()
                ? analysesRepo.findAllByOrderByCreatedAtDesc()
                : analysesRepo.findByOwnerIdOrderByCreatedAtDesc(u.id());
        List<Patient> pts = switch (u.role()) {
            case ADMIN -> patients.findAll();
            case DOCTOR -> patients.findByDoctorIdOrderByLastNameAscFirstNameAsc(u.id());
            case PATIENT -> List.of();
        };
        long chatCount = u.isAdmin() ? chats.count() : chats.countByOwnerId(u.id());
        return build(list, pts, chatCount);
    }

    public AdminStats adminStats() {
        List<AppUser> all = users.findAll();
        long doctors = all.stream().filter(x -> x.getRole() == Role.DOCTOR).count();
        long pending = all.stream().filter(x -> x.getRole() == Role.DOCTOR && !x.isEnabled()).count();
        long disabled = all.stream().filter(x -> !x.isEnabled()).count();
        Dashboard activity = build(analysesRepo.findAllByOrderByCreatedAtDesc(), patients.findAll(), chats.count());

        Map<Long, Long> analysesByOwner = analysesRepo.countGroupedByOwner().stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        List<DoctorActivity> top = all.stream().filter(x -> x.getRole() == Role.DOCTOR)
                .map(d -> new DoctorActivity(d.getId(), d.getFullName(), d.getSpecialty(),
                        analysesByOwner.getOrDefault(d.getId(), 0L), patients.countByDoctorId(d.getId())))
                .sorted(Comparator.comparingLong(DoctorActivity::analyses).reversed()
                        .thenComparing(Comparator.comparingLong(DoctorActivity::patients).reversed()))
                .limit(8)
                .toList();

        return new AdminStats(all.size(), count(all, Role.ADMIN), doctors, count(all, Role.PATIENT), pending,
                disabled, activity.patients(), activity.chats(), activity, top);
    }

    private Dashboard build(List<Analysis> list, List<Patient> pts, long chatCount) {
        long total = list.size();
        long susp = list.stream().filter(a -> SUSPICION.equals(a.getDecision())).count();

        // Activity over the last 14 days (days with no analysis included)
        LocalDate today = LocalDate.now(ZONE);
        Map<LocalDate, long[]> days = new LinkedHashMap<>();
        for (int i = 13; i >= 0; i--) {
            days.put(today.minusDays(i), new long[2]);
        }
        for (Analysis a : list) {
            long[] c = days.get(a.getCreatedAt().atZone(ZONE).toLocalDate());
            if (c != null) {
                c[0]++;
                if (SUSPICION.equals(a.getDecision())) {
                    c[1]++;
                }
            }
        }
        List<DayCount> last14 = days.entrySet().stream()
                .map(e -> new DayCount(e.getKey().toString(), e.getValue()[0], e.getValue()[1])).toList();

        List<LabelCount> regions = list.stream().filter(a -> a.getRegion() != null)
                .collect(Collectors.groupingBy(Analysis::getRegion, Collectors.counting()))
                .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(6)
                .map(e -> new LabelCount(e.getKey(), e.getValue())).toList();

        List<Analysis> recent = list.stream().limit(6).toList();

        // Records whose most recent analysis is a suspicion: to be seen again first
        List<PatientDto> toReview = new ArrayList<>(patientService.toDtos(pts).stream()
                .filter(p -> Objects.equals(p.lastDecision(), SUSPICION))
                .sorted(Comparator.comparing(PatientDto::lastAnalysisAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(6).toList());

        return new Dashboard(total, susp, total == 0 ? 0 : (double) susp / total, pts.size(), chatCount, last14,
                regions, analyses.summaries(recent), toReview);
    }

    private static long count(List<AppUser> all, Role r) {
        return all.stream().filter(x -> x.getRole() == r).count();
    }
}
