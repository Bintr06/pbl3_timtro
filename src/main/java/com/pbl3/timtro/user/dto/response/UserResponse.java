package com.pbl3.timtro.user.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String displayName;
    private String avatarUrl;
    private String phone;
    private String bio;
    private String role;
    private boolean isVerified;
    private LocalDateTime createdAt;
}
