package ma.fsbm.pfa.dermai.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PatientRepository extends JpaRepository<Patient, Long> {

    List<Patient> findByDoctorIdOrderByLastNameAscFirstNameAsc(Long doctorId);

    List<Patient> findAllByOrderByLastNameAscFirstNameAsc();

    long countByDoctorId(Long doctorId);
}
