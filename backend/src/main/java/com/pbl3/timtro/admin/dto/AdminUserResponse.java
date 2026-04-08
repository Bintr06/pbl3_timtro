package com.pbl3.timtro.admin.dto;

import com.pbl3.timtro.user.enums.Role;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminUserResponse {
    private Long id;
    private String username;
    private String displayName;
    private String avatarUrl;
    private String email;
    private String phone;
    private Role role;
    private boolean enabled;
    private boolean isVerified;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer reportCount;
    private Double averageRating;
}
