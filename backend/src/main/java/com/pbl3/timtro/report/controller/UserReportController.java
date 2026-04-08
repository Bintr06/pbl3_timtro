package com.pbl3.timtro.report.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.report.service.UserReportService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class UserReportController {

    private final UserReportService userReportService;

    @PostMapping("/users")
    public ResponseEntity<ApiResponse<String>> createUserReport(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("reportedUserId") Long reportedUserId,
            @RequestParam("description") String description,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        userReportService.createUserReport(currentUser, reportedUserId, description, image);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã gửi tố cáo thành công. Báo cáo đang chờ admin xem xét.", null));
    }
}
