package com.pbl3.timtro.chat.controller;

import com.pbl3.timtro.chat.dto.response.ChatContactResponse;
import com.pbl3.timtro.chat.dto.response.ChatResponse;
import com.pbl3.timtro.chat.service.ChatService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService chatService;

    @PostMapping("/send")
    public ResponseEntity<String> send(@AuthenticationPrincipal User sender,
                                       @RequestParam Long toUserId,
                                       @RequestBody String content) {
        chatService.sendMessage(sender, toUserId, content);
        return ResponseEntity.ok("Sent");
    }

    @PostMapping("/send-image")
    public ResponseEntity<String> sendImage(@AuthenticationPrincipal User sender,
                                            @RequestParam Long toUserId,
                                            @RequestParam("file") MultipartFile file) {
        chatService.sendImageMessage(sender, toUserId, file);
        return ResponseEntity.ok("Sent");
    }
    @GetMapping("/history/{otherUserId}")
    public ResponseEntity<List<ChatResponse>> getHistory(@AuthenticationPrincipal User user,
                                                        @PathVariable Long otherUserId) {
        return ResponseEntity.ok(chatService.getHistory(user.getId(), otherUserId));
    }
    @GetMapping("/contacts")
    public ResponseEntity<List<ChatContactResponse>> getContacts(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(chatService.getMyContacts(user));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@AuthenticationPrincipal User user) {
        long count = chatService.getUnreadCount(user.getId());
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PutMapping("/read/{otherUserId}")
    public ResponseEntity<String> markConversationAsRead(
            @AuthenticationPrincipal User user,
            @PathVariable Long otherUserId
    ) {
        chatService.markConversationAsRead(user.getId(), otherUserId);
        return ResponseEntity.ok("Đã đánh dấu cuộc trò chuyện là đã đọc.");
    }
}
