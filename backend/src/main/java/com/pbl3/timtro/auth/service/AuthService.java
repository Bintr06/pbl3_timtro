package com.pbl3.timtro.auth.service;
import com.pbl3.timtro.auth.dto.request.ChangePasswordRequest;
import com.pbl3.timtro.auth.dto.request.ForgotPasswordRequest;
import com.pbl3.timtro.auth.dto.request.LoginRequest;
import com.pbl3.timtro.auth.dto.request.RegisterRequest;
import com.pbl3.timtro.auth.dto.request.ResetPasswordRequest;
import com.pbl3.timtro.auth.dto.response.AuthResponse;
import com.pbl3.timtro.auth.entity.PasswordResetToken;
import com.pbl3.timtro.auth.repository.PasswordResetTokenRepository;
import com.pbl3.timtro.common.config.security.JwtService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import com.pbl3.timtro.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;

import java.time.LocalDateTime;
import java.util.Random;
import java.util.List;
import java.util.Locale;
@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final JavaMailSender mailSender;
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

        // QUAN TRỌNG: Gán lại user để lấy id và createdAt từ Database
        user = userRepository.save(user);

        // Lúc này user.getCreatedAt() đã có giá trị (nếu đã bật @EnableJpaAuditing)
        String token = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(token)
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
        String token = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
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
                // Không làm lộ trạng thái email; API vẫn trả thông điệp chung.
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

    private String generateSixDigitCode() {
        Random random = new Random();
        String code;
        do {
            code = String.format("%06d", random.nextInt(1_000_000));
        } while (passwordResetTokenRepository.existsByToken(code));
        return code;
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
}