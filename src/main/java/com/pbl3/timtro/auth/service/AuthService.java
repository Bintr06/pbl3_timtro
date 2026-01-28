package com.pbl3.timtro.auth.service;

import com.pbl3.timtro.auth.dto.request.LoginRequest;
import com.pbl3.timtro.auth.dto.request.RegisterRequest;
import com.pbl3.timtro.auth.dto.response.AuthResponse;
import com.pbl3.timtro.auth.security.JwtService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import com.pbl3.timtro.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public String register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            return "Lỗi: Username đã tồn tại!";
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            return "Lỗi: Email đã tồn tại!";
        }
        User user = User.builder()
                .username(request.getUsername())
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .email(request.getEmail())
                .displayName(request.getDisplayName())
                .phone(request.getPhone())
                .role(Role.USER)
                .enabled(true)
                .isPendingOwner(false)
                .build();
        userRepository.save(user);

        return "Đăng ký thành công tài khoản " + user.getUsername();
    }
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("Sai tên đăng nhập hoặc mật khẩu"));
        if (!user.isEnabled()) {
            throw new RuntimeException("Tài khoản của bạn đã bị khóa!");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getHashedPassword())) {
            throw new RuntimeException("Sai tên đăng nhập hoặc mật khẩu");
        }
        String token = jwtService.generateToken(user.getUsername());
        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .role(user.getRole().name())
                .build();
    }
}