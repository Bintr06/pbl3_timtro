package com.pbl3.timtro.payment.dto.response;

import com.pbl3.timtro.payment.enums.PurchaseStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TurnPurchaseResponse {
    private Long id;
    private Long userId;
    private String username;
    private Long packageId;
    private Integer turns;
    private Double amount;
    private String transferContent;
    private PurchaseStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime approvedAt;
    private String approvedByUsername;
    private String rejectionReason;
}
