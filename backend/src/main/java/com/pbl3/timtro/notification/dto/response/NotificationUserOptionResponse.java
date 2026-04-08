package com.pbl3.timtro.notification.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class NotificationUserOptionResponse {
    private Long id;
    private String username;
    private String displayName;
}
