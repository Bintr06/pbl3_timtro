package com.pbl3.timtro.userrating.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserRatingResponse {
    private Long id;
    private Long raterId;
    private String raterName;
    private String raterAvatar;
    private int stars;
    private String comment;
    private String imageUrl;
    private LocalDateTime createdAt;
}
