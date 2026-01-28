package com.pbl3.timtro.auth.dto.request;

import lombok.Data;

@Data
public class LoginRequest {
    private String username;
    private String password;
}
