package com.pbl3.timtro.report.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.report.dto.response.UserReportResponse;
import com.pbl3.timtro.report.service.UserReportService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/reports/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserReportController {

    private final UserReportService userReportService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserReportResponse>>> getReports(@AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", userReportService.getAllReportsForAdmin(admin)));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<String>> updateStatus(
            @AuthenticationPrincipal User admin,
            @PathVariable("id") Long reportId,
            @RequestParam("status") String status
    ) {
        userReportService.updateReportStatus(admin, reportId, status);
        return ResponseEntity.ok(new ApiResponse<>(200, "Cập nhật trạng thái tố cáo thành công.", null));
    }
}
