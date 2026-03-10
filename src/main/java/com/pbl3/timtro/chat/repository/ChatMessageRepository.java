package com.pbl3.timtro.chat.repository;

import com.pbl3.timtro.chat.entity.ChatMessage;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    @Query("SELECT m FROM ChatMessage m WHERE " +
            "(m.sender.id = :u1 AND m.recipient.id = :u2) OR " +
            "(m.sender.id = :u2 AND m.recipient.id = :u1) " +
            "ORDER BY m.timestamp ASC")
    List<ChatMessage> findChatHistory(Long u1, Long u2);

    @Query("SELECT DISTINCT CASE WHEN m.sender.id = :userId THEN m.recipient.id ELSE m.sender.id END " +
            "FROM ChatMessage m WHERE m.sender.id = :userId OR m.recipient.id = :userId")
    List<Long> findContactIds(Long userId);
    boolean existsBySenderIdAndRecipientId(Long senderId, Long recipientId);}
