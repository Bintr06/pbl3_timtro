package com.pbl3.timtro.payment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TurnPackageResponse {
    private Long id;
    private Integer turns;
    private Double price;
    private String description;
    private boolean active;
}
