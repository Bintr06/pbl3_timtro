package com.pbl3.timtro.rating.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RatingResponse {
    private Long id;
    private String userName;
    private String userAvatar;
    private int stars;
    private String comment;
    private LocalDateTime createdAt;
    private Double averageStars;
}