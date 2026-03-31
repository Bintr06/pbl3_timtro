package com.pbl3.timtro.notification.repository;

import com.pbl3.timtro.notification.entity.Notification;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientOrderByCreatedAtDesc(User recipient);

    long countByRecipientAndIsReadFalse(User recipient);

    List<Notification> findByRecipientAndIsReadFalse(User recipient);

    Optional<Notification> findByIdAndRecipient(Long id, User recipient);

    long deleteByRecipient(User recipient);
}
