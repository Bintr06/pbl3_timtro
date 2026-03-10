package com.pbl3.timtro.registration.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RegistrationStatsResponse {
    private long totalPending;
    private long totalApproved;
    private long totalRejected;
    private long totalRegistrations;
}
