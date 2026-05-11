package com.pbl3.timtro.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RejectPurchaseRequest {
    @NotNull(message = "purchaseId không được null")
    @Positive(message = "purchaseId phải lớn hơn 0")
    private Long purchaseId;

    @NotBlank(message = "Lý do từ chối không được trống")
    private String rejectionReason;
}
