package com.pbl3.timtro.auth.service;

import com.pbl3.timtro.auth.repository.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class RefreshTokenCleanupScheduler {
    private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanupScheduler.class);

    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    @Scheduled(
            fixedDelayString = "${app.auth.refresh-token.cleanup.fixed-delay-ms:21600000}",
            initialDelayString = "${app.auth.refresh-token.cleanup.initial-delay-ms:120000}"
    )
    public void cleanupExpiredRefreshTokens() {
        long deleted = refreshTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        if (deleted > 0) {
            log.info("Deleted {} expired refresh token(s)", deleted);
        }
    }
}
