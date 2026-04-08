package com.pbl3.timtro.auth.service;
import com.pbl3.timtro.auth.dto.request.ChangePasswordRequest;
import com.pbl3.timtro.auth.dto.request.ForgotPasswordRequest;
import com.pbl3.timtro.auth.dto.request.GoogleLoginRequest;
import com.pbl3.timtro.auth.dto.request.LoginRequest;
import com.pbl3.timtro.auth.dto.request.ResendVerificationRequest;
import com.pbl3.timtro.auth.dto.request.RegisterRequest;
import com.pbl3.timtro.auth.dto.request.ResetPasswordRequest;
import com.pbl3.timtro.auth.dto.request.VerifyEmailRequest;
import com.pbl3.timtro.auth.dto.response.AuthResponse;
import com.pbl3.timtro.auth.entity.EmailVerificationToken;
import com.pbl3.timtro.auth.entity.PasswordResetToken;
import com.pbl3.timtro.auth.entity.RefreshToken;
import com.pbl3.timtro.auth.repository.EmailVerificationTokenRepository;
import com.pbl3.timtro.auth.repository.PasswordResetTokenRepository;
import com.pbl3.timtro.auth.repository.RefreshTokenRepository;
import com.pbl3.timtro.common.config.security.JwtService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import com.pbl3.timtro.user.repository.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.HexFormat;
import java.util.Random;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
@Service
@RequiredArgsConstructor
public class AuthService {
    private static final NetHttpTransport GOOGLE_HTTP_TRANSPORT = new NetHttpTransport();
    private static final GsonFactory GOOGLE_JSON_FACTORY = GsonFactory.getDefaultInstance();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JavaMailSender mailSender;
    @Value("${google.oauth.client-id:}")
    private String googleOauthClientId;
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedUsername = request.getUsername().trim();
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new RuntimeException("Tên đăng nhập đã tồn tại!");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new RuntimeException("Email đã được sử dụng!");
        }
        User user = User.builder()
                .username(normalizedUsername)
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .email(normalizedEmail)
                .displayName(request.getDisplayName().trim())
                .role(Role.USER)
                .enabled(true)
                .isVerified(false)
                .build();

        user = userRepository.save(user);
        issueEmailVerificationToken(user);

        return AuthResponse.builder()
            .token(null)
            .refreshToken(null)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
    }
    public AuthResponse login(LoginRequest request, HttpServletRequest servletRequest) {
        String loginIdentifier = request.getIdentifier().trim();
        User user = userRepository.findByLoginIdentifier(loginIdentifier)
                .orElseThrow(() -> new RuntimeException("Tài khoản hoặc mật khẩu không đúng"));
        if (!passwordEncoder.matches(request.getPassword(), user.getHashedPassword())) {
            throw new RuntimeException("Tài khoản hoặc mật khẩu không đúng");
        }
        if (!user.isEnabled()) {
            throw new RuntimeException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin!");
        }
        if (!user.isVerified()) {
            throw new RuntimeException("Tài khoản chưa xác thực email. Vui lòng nhập mã xác thực trước khi đăng nhập.");
        }
        return issueAuthTokens(user);
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        if (googleOauthClientId == null || googleOauthClientId.isBlank()) {
            throw new RuntimeException("Đăng nhập Google chưa được cấu hình ở máy chủ");
        }

        GoogleIdToken idToken;
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(GOOGLE_HTTP_TRANSPORT, GOOGLE_JSON_FACTORY)
                    .setAudience(Collections.singletonList(googleOauthClientId))
                    .build();
            idToken = verifier.verify(request.getIdToken().trim());
        } catch (Exception e) {
            throw new RuntimeException("Không thể xác minh Google token");
        }

        if (idToken == null) {
            throw new RuntimeException("Google token không hợp lệ");
        }

        GoogleIdToken.Payload payload = idToken.getPayload();
        String email = payload.getEmail();
        Boolean emailVerified = payload.getEmailVerified();
        if (email == null || email.isBlank() || !Boolean.TRUE.equals(emailVerified)) {
            throw new RuntimeException("Email Google chưa được xác thực");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        String displayName = payload.get("name") instanceof String name ? name : normalizedEmail;

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseGet(() -> {
                    String username = buildUniqueUsername(normalizedEmail);
                    User newUser = User.builder()
                            .username(username)
                            .hashedPassword(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .email(normalizedEmail)
                            .displayName(displayName)
                            .role(Role.USER)
                            .enabled(true)
                            .isVerified(true)
                            .build();
                    return userRepository.save(newUser);
                });

        if (!user.isEnabled()) {
            throw new RuntimeException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin!");
        }

        if (!user.isVerified()) {
            user.setVerified(true);
            userRepository.save(user);
        }

        return issueAuthTokens(user);
    }

    @Transactional
    public AuthResponse refreshAccessToken(String rawRefreshToken) {
        String refreshToken = rawRefreshToken == null ? "" : rawRefreshToken.trim();
        if (refreshToken.isEmpty()) {
            throw new RuntimeException("Refresh token không hợp lệ");
        }

        String username;
        try {
            username = jwtService.extractUsername(refreshToken);
        } catch (Exception e) {
            throw new RuntimeException("Refresh token không hợp lệ");
        }

        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("Tài khoản không tồn tại"));

        String tokenHash = hashToken(refreshToken);
        RefreshToken storedToken = refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)
                .orElseThrow(() -> new RuntimeException("Refresh token không hợp lệ hoặc đã bị thu hồi"));

        if (storedToken.getExpiresAt().isBefore(LocalDateTime.now()) || !jwtService.isRefreshTokenValid(refreshToken, user)) {
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new RuntimeException("Refresh token đã hết hạn hoặc không hợp lệ");
        }

        if (!user.isEnabled()) {
            revokeAllActiveRefreshTokens(user);
            throw new RuntimeException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin!");
        }

        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);
        return issueAuthTokens(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }

        String tokenHash = hashToken(rawRefreshToken.trim());
        refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }



    @Transactional
    public void changePassword(User currentUser, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.getCurrentPassword(), currentUser.getHashedPassword())) {
            throw new RuntimeException("Mật khẩu hiện tại không đúng");
        }
        if (request.getCurrentPassword().equals(request.getNewPassword())) {
            throw new RuntimeException("Mật khẩu mới không được trùng mật khẩu cũ");
        }
        currentUser.setHashedPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(currentUser);
        revokeAllActiveRefreshTokens(currentUser);
    }

    @Transactional
    public void requestPasswordReset(ForgotPasswordRequest request) {
        userRepository.findByEmailIgnoreCase(request.getEmail().trim()).ifPresent(user -> {
            List<PasswordResetToken> activeTokens = passwordResetTokenRepository.findAllByUserAndUsedFalse(user);
            activeTokens.forEach(token -> token.setUsed(true));
            if (!activeTokens.isEmpty()) {
                passwordResetTokenRepository.saveAll(activeTokens);
            }

            String token = generateSixDigitCode();
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .user(user)
                    .token(token)
                    .expiresAt(LocalDateTime.now().plusMinutes(15))
                    .used(false)
                    .build();
            passwordResetTokenRepository.save(resetToken);

            try {
                sendPasswordResetEmail(user.getEmail(), token);
            } catch (Exception ignored) {
            }
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new RuntimeException("Token không hợp lệ"));

        if (resetToken.isUsed() || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Token đã hết hạn hoặc đã được sử dụng");
        }

        User user = resetToken.getUser();
        user.setHashedPassword(passwordEncoder.encode(request.getNewPassword()));

        resetToken.setUsed(true);

        userRepository.save(user);
        passwordResetTokenRepository.save(resetToken);
    }

    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
        String verificationCode = request.getToken().trim();

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new RuntimeException("Email hoặc mã xác thực không đúng"));

        EmailVerificationToken token = emailVerificationTokenRepository.findByToken(verificationCode)
                .orElseThrow(() -> new RuntimeException("Email hoặc mã xác thực không đúng"));

        if (!token.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Email hoặc mã xác thực không đúng");
        }

        if (token.isUsed() || token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Mã xác thực đã hết hạn hoặc đã được sử dụng");
        }

        user.setVerified(true);
        token.setUsed(true);
        userRepository.save(user);
        emailVerificationTokenRepository.save(token);
    }

    @Transactional
    public void resendVerificationEmail(ResendVerificationRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản với email này"));

        if (user.isVerified()) {
            throw new RuntimeException("Email này đã được xác thực");
        }

        issueEmailVerificationToken(user);
    }

    private String generateSixDigitCode() {
        Random random = new Random();
        String code;
        do {
            code = String.format("%06d", random.nextInt(1_000_000));
        } while (passwordResetTokenRepository.existsByToken(code));
        return code;
    }

    private String buildUniqueUsername(String normalizedEmail) {
        String localPart = normalizedEmail.split("@")[0].replaceAll("[^a-zA-Z0-9._-]", "");
        String base = localPart.isBlank() ? "google_user" : localPart;
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
    }

    private String generateEmailVerificationCode() {
        Random random = new Random();
        String code;
        do {
            code = String.format("%06d", random.nextInt(1_000_000));
        } while (emailVerificationTokenRepository.existsByToken(code));
        return code;
    }

    private AuthResponse issueAuthTokens(User user) {
        refreshTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .user(user)
                .tokenHash(hashToken(refreshToken))
                .expiresAt(LocalDateTime.ofInstant(jwtService.extractExpiration(refreshToken).toInstant(), java.time.ZoneId.systemDefault()))
                .revoked(false)
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        return AuthResponse.builder()
                .token(accessToken)
                .refreshToken(refreshToken)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
    }

    private void revokeAllActiveRefreshTokens(User user) {
        List<RefreshToken> activeTokens = refreshTokenRepository.findAllByUserAndRevokedFalse(user);
        if (activeTokens.isEmpty()) {
            return;
        }
        activeTokens.forEach(token -> token.setRevoked(true));
        refreshTokenRepository.saveAll(activeTokens);
    }

    private String hashToken(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Không thể xử lý refresh token", e);
        }
    }

    private void issueEmailVerificationToken(User user) {
        enforceVerificationRateLimits(user);

        List<EmailVerificationToken> activeTokens = emailVerificationTokenRepository.findAllByUserAndUsedFalse(user);
        activeTokens.forEach(token -> token.setUsed(true));
        if (!activeTokens.isEmpty()) {
            emailVerificationTokenRepository.saveAll(activeTokens);
        }

        String code = generateEmailVerificationCode();
        EmailVerificationToken verificationToken = EmailVerificationToken.builder()
                .user(user)
                .token(code)
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .build();
        emailVerificationTokenRepository.save(verificationToken);

        try {
            sendEmailVerificationEmail(user.getEmail(), code);
        } catch (Exception ignored) {
            throw new RuntimeException("Không thể gửi mã xác thực email. Vui lòng thử lại.");
        }
    }

    private void enforceVerificationRateLimits(User user) {
        LocalDateTime now = LocalDateTime.now();
        emailVerificationTokenRepository.findTopByUserOrderByCreatedAtDesc(user).ifPresent(lastToken -> {
            if (lastToken.getCreatedAt() != null && lastToken.getCreatedAt().isAfter(now.minusMinutes(1))) {
                throw new RuntimeException("Vui lòng đợi 1 phút trước khi yêu cầu lại mã xác thực.");
            }
        });

        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        long todayCount = emailVerificationTokenRepository.countByUserAndCreatedAtBetween(user, startOfDay, now);
        if (todayCount >= 5) {
            throw new RuntimeException("Bạn đã yêu cầu mã xác thực quá 5 lần trong ngày.");
        }
    }

    private void sendPasswordResetEmail(String toEmail, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("TimTro - Ma dat lai mat khau");
        message.setText("""
                Xin chao,

                Ban vua yeu cau dat lai mat khau tai TimTro.
                Ma xac nhan cua ban la: %s

                Ma co hieu luc trong 15 phut.
                Neu ban khong thuc hien yeu cau nay, vui long bo qua email.
                """.formatted(code));
        mailSender.send(message);
    }

    private void sendEmailVerificationEmail(String toEmail, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("TimTro - Xac thuc email dang ky");
        message.setText("""
                Xin chao,

                Cam on ban da dang ky tai TimTro.
                Ma xac thuc email cua ban la: %s

                Ma co hieu luc trong 15 phut.
                Neu ban khong thuc hien yeu cau nay, vui long bo qua email.
                """.formatted(code));
        mailSender.send(message);
    }
}