package com.pbl3.timtro.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pbl3.timtro.chat.dto.response.ChatResponse;
import com.pbl3.timtro.chat.dto.response.ChatContactResponse;
import com.pbl3.timtro.chat.entity.ChatMessage;
import com.pbl3.timtro.chat.repository.ChatMessageRepository;
import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String normalizeMessageContent(String content) {
        if (content == null) {
            return "";
        }

        String trimmed = content.trim();
        if (trimmed.isEmpty()) {
            return "";
        }

        try {
            String parsed = objectMapper.readValue(trimmed, String.class);
            if (parsed != null) {
                return parsed;
            }
        } catch (Exception ignored) {
        }

        if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
                (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.substring(1, trimmed.length() - 1);
        }

        return content;
    }

    @Transactional
    public void sendMessage(User sender, Long recipientId, String content) {
        User recipient = userRepository.findById(recipientId).orElseThrow();

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .recipient(recipient)
                .content(normalizeMessageContent(content))
                .isRead(false)
                .timestamp(LocalDateTime.now())
                .build();

        chatMessageRepository.save(message);
    }

    @Transactional
    public void sendImageMessage(User sender, Long recipientId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Ảnh gửi lên không hợp lệ.");
        }
        String imageUrl = cloudinaryService.uploadFile(file, "chat");
        sendMessage(sender, recipientId, imageUrl);
    }

    public List<ChatResponse> getHistory(Long userId1, Long userId2) {
        return chatMessageRepository.findChatHistory(userId1, userId2)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markConversationAsRead(Long userId, Long otherUserId) {
        chatMessageRepository.markConversationAsRead(userId, otherUserId);
    }

    public long getUnreadCount(Long userId) {
        return chatMessageRepository.countByRecipientIdAndIsReadFalse(userId);
    }

    public List<ChatContactResponse> getMyContacts(User currentUser) {
        List<Long> contactIds = chatMessageRepository.findContactIds(currentUser.getId());
        Map<Long, Long> unreadBySender = new HashMap<>();
        chatMessageRepository.countUnreadBySenderForRecipient(currentUser.getId()).forEach(row -> {
            Long senderId = (Long) row[0];
            Long unreadCount = (Long) row[1];
            unreadBySender.put(senderId, unreadCount);
        });

        return userRepository.findAllById(contactIds).stream()
                .map(user -> ChatContactResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .displayName(user.getDisplayName())
                        .avatarUrl(user.getAvatarUrl())
                .unreadCount(unreadBySender.getOrDefault(user.getId(), 0L))
                        .build())
                .collect(Collectors.toList());
    }

    private ChatResponse mapToResponse(ChatMessage msg) {
        return ChatResponse.builder()
                .id(msg.getId())
                .senderId(msg.getSender().getId())
                .senderName(msg.getSender().getDisplayName())
                .recipientId(msg.getRecipient().getId())
                .content(normalizeMessageContent(msg.getContent()))
                .timestamp(msg.getTimestamp())
                .build();
    }
}