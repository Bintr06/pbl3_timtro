package com.pbl3.timtro.chat.repository;

import com.pbl3.timtro.chat.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    boolean existsBySenderIdAndRecipientId(Long senderId, Long recipientId);

    @Query("SELECT CASE WHEN COUNT(m) > 0 THEN true ELSE false END FROM ChatMessage m " +
            "WHERE (m.sender.id = :u1 AND m.recipient.id = :u2) OR (m.sender.id = :u2 AND m.recipient.id = :u1)")
    boolean existsConversationBetweenUsers(Long u1, Long u2);

        long countByRecipientIdAndIsReadFalse(Long recipientId);

        @Modifying
        @Query("UPDATE ChatMessage m SET m.isRead = true WHERE m.recipient.id = :recipientId AND m.sender.id = :senderId AND m.isRead = false")
        int markConversationAsRead(Long recipientId, Long senderId);

        @Query("SELECT m.sender.id, COUNT(m) FROM ChatMessage m WHERE m.recipient.id = :recipientId AND m.isRead = false GROUP BY m.sender.id")
        List<Object[]> countUnreadBySenderForRecipient(Long recipientId);
}
