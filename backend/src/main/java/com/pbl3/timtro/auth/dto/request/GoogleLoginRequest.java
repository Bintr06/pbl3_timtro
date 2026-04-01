package com.pbl3.timtro.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GoogleLoginRequest {

    @NotBlank(message = "Google token không được để trống")
    private String idToken;
}
