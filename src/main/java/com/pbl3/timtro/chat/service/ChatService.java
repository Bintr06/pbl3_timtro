package com.pbl3.timtro.chat.service;

import com.pbl3.timtro.chat.dto.response.ChatResponse;
import com.pbl3.timtro.chat.entity.ChatMessage;
import com.pbl3.timtro.chat.repository.ChatMessageRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;

    @Transactional
    public void sendMessage(User sender, Long recipientId, String content) {
        User recipient = userRepository.findById(recipientId).orElseThrow();

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .recipient(recipient)
                .content(content)
                .timestamp(LocalDateTime.now())
                .build();

        chatMessageRepository.save(message);
    }

    public List<ChatMessage> getHistory(Long userId1, Long userId2) {
        return chatMessageRepository.findChatHistory(userId1, userId2);
    }
    public List<User> getMyContacts(User currentUser) {
        List<Long> contactIds = chatMessageRepository.findContactIds(currentUser.getId());
        return userRepository.findAllById(contactIds);
    }

    private ChatResponse mapToResponse(ChatMessage msg) {
        return ChatResponse.builder()
                .id(msg.getId())
                .senderId(msg.getSender().getId())
                .senderName(msg.getSender().getDisplayName())
                .recipientId(msg.getRecipient().getId())
                .content(msg.getContent())
                .timestamp(msg.getTimestamp())
                .build();
    }
}