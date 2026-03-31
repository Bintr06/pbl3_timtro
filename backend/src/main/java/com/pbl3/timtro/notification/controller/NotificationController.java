package com.pbl3.timtro.notification.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.notification.dto.response.NotificationResponse;
import com.pbl3.timtro.notification.service.NotificationService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getMyNotifications(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", notificationService.getMyNotifications(currentUser)));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<String>> markAsRead(
            @AuthenticationPrincipal User currentUser,
            @PathVariable("id") Long id
    ) {
        notificationService.markAsRead(currentUser, id);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã đánh dấu thông báo là đã đọc.", null));
    }

    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> markAllAsRead(@AuthenticationPrincipal User currentUser) {
        int updated = notificationService.markAllAsRead(currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã cập nhật trạng thái thông báo.", Map.of("updated", updated)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> deleteNotification(
            @AuthenticationPrincipal User currentUser,
            @PathVariable("id") Long id
    ) {
        notificationService.deleteNotification(currentUser, id);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã xóa thông báo.", null));
    }

    @DeleteMapping("/all")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> deleteAllNotifications(@AuthenticationPrincipal User currentUser) {
        int deleted = notificationService.deleteAllNotifications(currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã xóa tất cả thông báo.", Map.of("deleted", deleted)));
    }
}
