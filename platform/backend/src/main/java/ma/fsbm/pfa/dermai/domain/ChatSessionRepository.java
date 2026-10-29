package ma.fsbm.pfa.dermai.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {

    List<ChatSession> findTop50ByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    long countByOwnerId(Long ownerId);

    List<ChatSession> findByOwnerId(Long ownerId);

    List<ChatSession> findByPatientId(Long patientId);

    /** Conversations created before accounts existed: assigned to the administrator. */
    @Modifying
    @Transactional
    @Query("update ChatSession s set s.ownerId = :owner where s.ownerId is null")
    int claimOrphans(@Param("owner") Long owner);
}
