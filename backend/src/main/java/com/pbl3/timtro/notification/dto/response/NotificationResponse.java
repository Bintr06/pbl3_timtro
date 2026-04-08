package com.pbl3.timtro.notification.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class NotificationResponse {
    private Long id;
    private String title;
    private String content;
    private boolean read;
    private LocalDateTime createdAt;
    private String senderName;
}
