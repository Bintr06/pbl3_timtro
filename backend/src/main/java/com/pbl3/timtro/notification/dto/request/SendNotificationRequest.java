package com.pbl3.timtro.notification.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class SendNotificationRequest {
    private String title;
    private String content;
    private String targetType; // ALL | USERS
    private List<Long> recipientUserIds;
}
