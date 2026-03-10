package com.pbl3.timtro.chat.controller;

import com.pbl3.timtro.chat.entity.ChatMessage;
import com.pbl3.timtro.chat.service.ChatService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    @GetMapping("/history/{otherUserId}")
    public ResponseEntity<List<ChatMessage>> getHistory(@AuthenticationPrincipal User user,
                                                        @PathVariable Long otherUserId) {
        return ResponseEntity.ok(chatService.getHistory(user.getId(), otherUserId));
    }
    @GetMapping("/contacts")
    public ResponseEntity<List<User>> getContacts(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(chatService.getMyContacts(user));
    }
}
