package com.pbl3.timtro.auth.repository;

import com.pbl3.timtro.auth.entity.EmailVerificationToken;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

@Repository
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    Optional<EmailVerificationToken> findByToken(String token);

    boolean existsByToken(String token);

    List<EmailVerificationToken> findAllByUserAndUsedFalse(User user);

    Optional<EmailVerificationToken> findTopByUserOrderByCreatedAtDesc(User user);

    long countByUserAndCreatedAtBetween(User user, LocalDateTime start, LocalDateTime end);
}
