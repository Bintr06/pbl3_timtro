package com.pbl3.timtro.registration.controller;

import com.pbl3.timtro.registration.dto.request.RegistrationRequest;
import com.pbl3.timtro.registration.dto.response.RegistrationResponse;
import com.pbl3.timtro.registration.service.RegistrationService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/registrations")
@RequiredArgsConstructor
public class RegistrationController {
    private final RegistrationService registrationService;

    @PostMapping
    public ResponseEntity<String> register(@RequestBody RegistrationRequest request,
                                           @AuthenticationPrincipal User user) {
        registrationService.createRegistration(request, user);
        return ResponseEntity.ok("Gửi yêu cầu thành công, vui lòng chờ Admin duyệt!");
    }
    @GetMapping("/me")
    public ResponseEntity<RegistrationResponse> getMyRegistration(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(registrationService.getMyRegistration(user));
    }
}
