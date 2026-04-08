package com.pbl3.timtro.auth.repository;

import com.pbl3.timtro.auth.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import com.pbl3.timtro.user.entity.User;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    boolean existsByToken(String token);

    List<PasswordResetToken> findAllByUserAndUsedFalse(User user);
}

