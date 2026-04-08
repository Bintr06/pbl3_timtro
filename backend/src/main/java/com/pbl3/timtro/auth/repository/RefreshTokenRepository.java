package com.pbl3.timtro.auth.repository;

import com.pbl3.timtro.auth.entity.RefreshToken;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByTokenHashAndRevokedFalse(String tokenHash);

    List<RefreshToken> findAllByUserAndRevokedFalse(User user);

    long deleteByExpiresAtBefore(LocalDateTime time);
}
