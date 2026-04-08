package com.pbl3.timtro.notification.service;

import com.pbl3.timtro.notification.dto.request.SendNotificationRequest;
import com.pbl3.timtro.notification.dto.response.NotificationResponse;
import com.pbl3.timtro.notification.dto.response.NotificationUserOptionResponse;
import com.pbl3.timtro.notification.entity.Notification;
import com.pbl3.timtro.notification.repository.NotificationRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import com.pbl3.timtro.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional
    public int sendByAdmin(User admin, SendNotificationRequest request) {
        if (admin == null || admin.getRole() != Role.ADMIN) {
            throw new RuntimeException("Bạn không có quyền gửi thông báo.");
        }

        String title = request.getTitle() == null ? "" : request.getTitle().trim();
        String content = request.getContent() == null ? "" : request.getContent().trim();

        if (title.isEmpty()) {
            throw new RuntimeException("Tiêu đề thông báo không được để trống.");
        }
        if (content.isEmpty()) {
            throw new RuntimeException("Nội dung thông báo không được để trống.");
        }

        String targetType = request.getTargetType() == null ? "ALL" : request.getTargetType().trim().toUpperCase(Locale.ROOT);
        List<User> recipients;

        if ("ALL".equals(targetType)) {
            recipients = userRepository.findAllByRole(Role.USER);
        } else if ("USERS".equals(targetType)) {
            List<Long> ids = request.getRecipientUserIds();
            if (ids == null || ids.isEmpty()) {
                throw new RuntimeException("Vui lòng chọn ít nhất 1 người dùng nhận thông báo.");
            }
            Set<Long> uniqueIds = new LinkedHashSet<>(ids);
            recipients = userRepository.findAllById(uniqueIds).stream()
                    .filter(user -> user.getRole() == Role.USER)
                    .toList();
        } else {
            throw new RuntimeException("Loại người nhận không hợp lệ.");
        }

        if (recipients.isEmpty()) {
            throw new RuntimeException("Không tìm thấy người nhận hợp lệ.");
        }

        List<Notification> notifications = new ArrayList<>();
        for (User recipient : recipients) {
            notifications.add(Notification.builder()
                    .recipient(recipient)
                    .sender(null)
                    .title(title)
                    .content(content)
                    .isRead(false)
                    .build());
        }

        notificationRepository.saveAll(notifications);
        return notifications.size();
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(User currentUser) {
        return notificationRepository.findByRecipientOrderByCreatedAtDesc(currentUser).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markAsRead(User currentUser, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndRecipient(notificationId, currentUser)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông báo."));
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public int markAllAsRead(User currentUser) {
        List<Notification> notifications = notificationRepository.findByRecipientOrderByCreatedAtDesc(currentUser);
        int updated = 0;
        for (Notification item : notifications) {
            if (!item.isRead()) {
                item.setRead(true);
                updated++;
            }
        }
        if (updated > 0) {
            notificationRepository.saveAll(notifications);
        }
        return updated;
    }

    @Transactional(readOnly = true)
    public List<NotificationUserOptionResponse> getUserRecipientsForAdmin() {
        return userRepository.findAllByRole(Role.USER).stream()
                .sorted(Comparator.comparing(User::getId))
                .map(user -> NotificationUserOptionResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .displayName(user.getDisplayName())
                        .build())
                .toList();
    }

    @Transactional
    public void sendSystemNotificationToUser(User recipient, String title, String content) {
        if (recipient == null || recipient.getId() == null) {
            return;
        }

        String normalizedTitle = title == null ? "" : title.trim();
        String normalizedContent = content == null ? "" : content.trim();
        if (normalizedTitle.isEmpty() || normalizedContent.isEmpty()) {
            return;
        }

        Notification notification = Notification.builder()
                .recipient(recipient)
                .sender(null)
                .title(normalizedTitle)
                .content(normalizedContent)
                .isRead(false)
                .build();
        notificationRepository.save(notification);
    }

    @Transactional
    public void deleteNotification(User currentUser, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndRecipient(notificationId, currentUser)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông báo."));
        notificationRepository.delete(notification);
    }

    @Transactional
    public int deleteAllNotifications(User currentUser) {
        return Math.toIntExact(notificationRepository.deleteByRecipient(currentUser));
    }

    private NotificationResponse mapToResponse(Notification notification) {
        String senderName = null;
        if (notification.getSender() != null) {
            String displayName = notification.getSender().getDisplayName();
            senderName = (displayName == null || displayName.isBlank())
                    ? notification.getSender().getUsername()
                    : displayName;
        }

        return NotificationResponse.builder()
                .id(notification.getId())
                .title(notification.getTitle())
                .content(notification.getContent())
                .read(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .senderName(senderName)
                .build();
    }
}
