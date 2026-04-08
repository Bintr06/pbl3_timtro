package com.pbl3.timtro.chat.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ChatContactResponse {
    private Long id;
    private String username;
    private String displayName;
    private String avatarUrl;
    private Long unreadCount;
}
