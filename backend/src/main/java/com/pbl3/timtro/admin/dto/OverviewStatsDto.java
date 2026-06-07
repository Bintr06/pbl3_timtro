package com.pbl3.timtro.admin.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class OverviewStatsDto {
    private long totalUsers;
    private long availableRooms;
    private long pendingReports;
    private double averageRating;

    private long totalPurchases;
    private double totalRevenue;

    private List<DailyStatsDto> newPurchasesByDay;
    private List<DailyStatsDto> newUsersByDay;
    private List<DailyStatsDto> newRoomsByDay;
}
