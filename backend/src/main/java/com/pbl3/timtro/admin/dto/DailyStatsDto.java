package com.pbl3.timtro.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DailyStatsDto {
    private String date; // yyyy-MM-dd
    private long count;
}
