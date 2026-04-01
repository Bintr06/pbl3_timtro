package com.pbl3.timtro.auth.controller;

import com.pbl3.timtro.auth.dto.request.ChangePasswordRequest;
import com.pbl3.timtro.auth.dto.request.ForgotPasswordRequest;
import com.pbl3.timtro.auth.dto.request.GoogleLoginRequest;
import com.pbl3.timtro.auth.dto.request.LoginRequest;
import com.pbl3.timtro.auth.dto.request.ResendVerificationRequest;
import com.pbl3.timtro.auth.dto.request.RegisterRequest;
import com.pbl3.timtro.auth.dto.request.ResetPasswordRequest;
import com.pbl3.timtro.auth.dto.request.VerifyEmailRequest;
import com.pbl3.timtro.auth.dto.response.AuthResponse;
import com.pbl3.timtro.auth.service.AuthService;
import com.pbl3.timtro.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.pbl3.timtro.user.entity.User;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(
                ApiResponse.<AuthResponse>builder()
                        .status(200)
                        .message("Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản")
                        .data(authService.register(request))
                        .build()
        );
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request,
                                                           HttpServletRequest servletRequest) {
        return ResponseEntity.ok(
                ApiResponse.<AuthResponse>builder()
                        .status(200)
                        .message("Đăng nhập thành công")
                        .data(authService.login(request, servletRequest))
                        .build()
        );
    }

        @PostMapping("/google")
        public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
                return ResponseEntity.ok(
                                ApiResponse.<AuthResponse>builder()
                                                .status(200)
                                                .message("Đăng nhập Google thành công")
                                                .data(authService.loginWithGoogle(request))
                                                .build()
                );
        }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(currentUser, request);
        return ResponseEntity.ok(
                new ApiResponse<>(200, "Đổi mật khẩu thành công", null)
        );
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        authService.requestPasswordReset(request);
        return ResponseEntity.ok(
                new ApiResponse<>(200, "Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi", null)
        );
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        authService.resetPassword(request);
        return ResponseEntity.ok(
                new ApiResponse<>(200, "Đặt lại mật khẩu thành công", null)
        );
    }

    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<String>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request
    ) {
        authService.verifyEmail(request);
        return ResponseEntity.ok(
                new ApiResponse<>(200, "Xác thực email thành công. Bạn có thể đăng nhập.", null)
        );
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<String>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request
    ) {
        authService.resendVerificationEmail(request);
        return ResponseEntity.ok(
                new ApiResponse<>(200, "Đã gửi lại mã xác thực email.", null)
        );
    }
}