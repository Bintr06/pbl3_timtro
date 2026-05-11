package com.pbl3.timtro.room.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuotaResponse {
    // Lượt trong tháng
    private Integer monthlyCreditsRemaining;
    
    // Lượt vĩnh viễn (mua thêm)
    private Integer permanentCreditsRemaining;
    
    // Tổng lượt còn lại
    private Integer totalCreditsRemaining;
    
    // Lượt đã sử dụng trong tháng
    private Integer monthlyCreditsUsed;
}
