package ma.fsbm.pfa.dermai.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    List<Analysis> findTop100ByOrderByCreatedAtDesc();

    List<Analysis> findTop100ByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    List<Analysis> findByPatientIdOrderByCreatedAtDesc(Long patientId);

    List<Analysis> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    List<Analysis> findAllByOrderByCreatedAtDesc();

    long countByOwnerId(Long ownerId);

    long countByDecision(String decision);

    long countByOwnerIdAndDecision(Long ownerId, String decision);

    long countByPatientId(Long patientId);

    List<Analysis> findByCreatedAtAfter(Instant since);

    List<Analysis> findByOwnerIdAndCreatedAtAfter(Long ownerId, Instant since);

    @Query("select a.ownerId, count(a) from Analysis a where a.ownerId is not null group by a.ownerId order by count(a) desc")
    List<Object[]> countGroupedByOwner();

    @Query("select a from Analysis a where a.patientId in :ids order by a.createdAt desc")
    List<Analysis> findByPatientIds(@Param("ids") List<Long> ids);

    /** Analyses created before accounts existed: assigned to the administrator. */
    @Modifying
    @Transactional
    @Query("update Analysis a set a.ownerId = :owner where a.ownerId is null")
    int claimOrphans(@Param("owner") Long owner);
}
