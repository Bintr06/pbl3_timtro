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
public class CreatePurchaseResponse {
    private Long purchaseId;
    private Integer turns;
    private Double amount;
    private String transferContent;
    private String bankAccount;
    private String bankName;
    private PurchaseStatus status;
    private LocalDateTime createdAt;
}
