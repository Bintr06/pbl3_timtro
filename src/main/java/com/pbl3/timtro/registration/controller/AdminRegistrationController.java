package com.pbl3.timtro.registration.controller;

import com.pbl3.timtro.registration.dto.response.RegistrationResponse;
import com.pbl3.timtro.registration.dto.response.RegistrationStatsResponse;
import com.pbl3.timtro.registration.entity.OwnerRegistration;
import com.pbl3.timtro.registration.enums.RegistrationStatus;
import com.pbl3.timtro.registration.repository.RegistrationRepository;
import com.pbl3.timtro.registration.service.RegistrationService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/registrations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminRegistrationController {
    private final RegistrationService registrationService;
    @GetMapping("/pending")
    public ResponseEntity<List<RegistrationResponse>> getPendingList() {
        return ResponseEntity.ok(registrationService.getPendingRegistrations());
    }
    @GetMapping("/{id}")
    public ResponseEntity<RegistrationResponse> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(registrationService.getRegistrationDetail(id));
    }
    @PatchMapping("/{id}/approve")
    public ResponseEntity<String> approve(@PathVariable Long id) {
        registrationService.approveRegistration(id);
        return ResponseEntity.ok("Đã duyệt người dùng này lên làm Chủ trọ!");
    }
    @PatchMapping("/{id}/reject")
    public ResponseEntity<String> reject(
            @PathVariable Long id,
            @RequestParam String reason) {
        registrationService.rejectRegistration(id, reason);
        return ResponseEntity.ok("Đã từ chối yêu cầu đăng ký.");
    }
    @GetMapping("/all")
    public ResponseEntity<List<RegistrationResponse>> getAllRegistrations(
            @RequestParam(required = false) RegistrationStatus status) {
        return ResponseEntity.ok(registrationService.getRegistrations(status));
    }
    @GetMapping("/stats")
    public ResponseEntity<RegistrationStatsResponse> getStats() {
        return ResponseEntity.ok(registrationService.getStats());
    }
}
