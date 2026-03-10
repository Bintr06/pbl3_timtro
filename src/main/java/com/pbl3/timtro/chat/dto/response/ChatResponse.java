package com.pbl3.timtro.chat.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ChatResponse {
    private Long id;
    private Long senderId;
    private String senderName;
    private Long recipientId;
    private String content;
    private LocalDateTime timestamp;
}