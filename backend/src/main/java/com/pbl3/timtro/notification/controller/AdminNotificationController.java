package com.pbl3.timtro.notification.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.notification.dto.request.SendNotificationRequest;
import com.pbl3.timtro.notification.dto.response.NotificationUserOptionResponse;
import com.pbl3.timtro.notification.service.NotificationService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {

    private final NotificationService notificationService;

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<NotificationUserOptionResponse>>> getRecipients() {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", notificationService.getUserRecipientsForAdmin()));
    }

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> sendNotification(
            @AuthenticationPrincipal User admin,
            @RequestBody SendNotificationRequest request
    ) {
        int count = notificationService.sendByAdmin(admin, request);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã gửi thông báo thành công.", Map.of("sentCount", count)));
    }
}
