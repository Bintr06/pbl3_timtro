package com.pbl3.timtro.payment.dto.request;

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
public class CreatePurchaseRequest {
    @NotNull(message = "packageId không được null")
    @Positive(message = "packageId phải lớn hơn 0")
    private Long packageId;
}
