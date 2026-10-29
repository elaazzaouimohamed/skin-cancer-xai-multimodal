package ma.fsbm.pfa.dermai.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import ma.fsbm.pfa.dermai.dto.AnalysisDtos.AnalysisSummary;

import java.util.List;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record CreateUserRequest(@NotBlank @Email String email,
                                    @NotBlank @Size(min = 8, max = 100) String password,
                                    @NotBlank @Size(max = 120) String fullName,
                                    @NotBlank String role,
                                    @Size(max = 120) String specialty,
                                    @Size(max = 160) String institution,
                                    Boolean enabled) {
    }

    /** Partial update: null fields are left unchanged. */
    public record UpdateUserRequest(String role, Boolean enabled, @Size(max = 120) String fullName,
                                    @Size(max = 120) String specialty, @Size(max = 160) String institution,
                                    @Size(min = 8, max = 100) String password) {
    }

    public record DayCount(String day, long total, long suspicion) {
    }

    public record LabelCount(String label, long count) {
    }

    public record DoctorActivity(Long id, String fullName, String specialty, long analyses, long patients) {
    }

    /** Dashboard of the logged-in user (doctor, patient) or global (administrator). */
    public record Dashboard(long analyses, long suspicions, double suspicionRate, long patients, long chats,
                            List<DayCount> last14Days, List<LabelCount> regions,
                            List<AnalysisSummary> recent, List<PatientDtos.PatientDto> toReview) {
    }

    public record AdminStats(long users, long admins, long doctors, long patientAccounts, long pendingDoctors,
                             long disabledUsers, long patientRecords, long chats, Dashboard activity,
                             List<DoctorActivity> topDoctors) {
    }
}
