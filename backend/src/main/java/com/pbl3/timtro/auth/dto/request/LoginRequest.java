package com.pbl3.timtro.auth.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank(message = "Tên đăng nhập hoặc email không được để trống!")
    @JsonAlias({"username", "email"})
    private String identifier;
    @NotBlank(message = "Mật khẩu không được để trống!")
    private String password;
}
