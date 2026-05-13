package com.grabgiasu.backend.dto;

public record AuthResponse(
        String token,
        String type,
        String email
) {
}
