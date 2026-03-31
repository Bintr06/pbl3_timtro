package com.pbl3.timtro.admin.controller;

import com.pbl3.timtro.admin.dto.OverviewStatsDto;
import com.pbl3.timtro.admin.service.AdminStatisticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/statistics")
@PreAuthorize("hasRole('ADMIN')")
public class AdminStatisticsController {
    private final AdminStatisticsService adminStatisticsService;

    public AdminStatisticsController(AdminStatisticsService adminStatisticsService) {
        this.adminStatisticsService = adminStatisticsService;
    }

    @GetMapping("/overview")
    public ResponseEntity<OverviewStatsDto> getOverview() {
        OverviewStatsDto stats = adminStatisticsService.getOverviewStats();
        return ResponseEntity.ok(stats);
    }
}
