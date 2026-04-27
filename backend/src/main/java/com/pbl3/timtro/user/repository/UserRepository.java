package com.pbl3.timtro.user.repository;

import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByUsernameIgnoreCase(String username);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT u FROM User u WHERE u.id = :id")
        Optional<User> findByIdForUpdate(@Param("id") Long id);

    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);
    Optional<User> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);
    @Query("SELECT u FROM User u WHERE LOWER(TRIM(u.username)) = LOWER(TRIM(:identifier)) OR LOWER(TRIM(u.email)) = LOWER(TRIM(:identifier))")
    Optional<User> findByLoginIdentifier(@Param("identifier") String identifier);

    boolean existsByUsername(String username);
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    List<User> findAllByRole(Role role);

    long countByCreatedAtBetween(java.time.LocalDateTime startDate, java.time.LocalDateTime endDate);

    @Query(value = "SELECT DATE(u.created_at) AS day, COUNT(*) AS cnt FROM users u " +
            "WHERE u.created_at >= :fromDateTime AND u.created_at < :toDateTime " +
            "GROUP BY DATE(u.created_at)", nativeQuery = true)
    List<Object[]> countUsersGroupedByDate(@Param("fromDateTime") LocalDateTime fromDateTime,
                                           @Param("toDateTime") LocalDateTime toDateTime);
}
