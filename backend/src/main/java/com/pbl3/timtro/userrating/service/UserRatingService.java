package com.pbl3.timtro.userrating.service;

import com.pbl3.timtro.chat.repository.ChatMessageRepository;
import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.notification.service.NotificationService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import com.pbl3.timtro.userrating.dto.response.UserRatingResponse;
import com.pbl3.timtro.userrating.entity.UserRating;
import com.pbl3.timtro.userrating.repository.UserRatingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserRatingService {

    private final UserRatingRepository userRatingRepository;
    private final UserRepository userRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final CloudinaryService cloudinaryService;
    private final NotificationService notificationService;

    @Transactional
    public void createUserRating(User rater, Long ratedUserId, int stars, String comment, MultipartFile image) {
        if (rater == null || rater.getId() == null) {
            throw new RuntimeException("Bạn cần đăng nhập để đánh giá.");
        }

        if (ratedUserId == null) {
            throw new RuntimeException("Người dùng được đánh giá không hợp lệ.");
        }

        if (rater.getId().equals(ratedUserId)) {
            throw new RuntimeException("Bạn không thể tự đánh giá chính mình.");
        }

        if (stars < 1 || stars > 5) {
            throw new RuntimeException("Số sao phải từ 1 đến 5.");
        }

        String normalizedComment = comment == null ? "" : comment.trim();
        if (normalizedComment.isEmpty()) {
            throw new RuntimeException("Vui lòng nhập bình luận đánh giá.");
        }

        User ratedUser = userRepository.findById(ratedUserId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng được đánh giá."));

        boolean hasSent = chatMessageRepository.existsBySenderIdAndRecipientId(rater.getId(), ratedUserId);
        boolean hasReceived = chatMessageRepository.existsBySenderIdAndRecipientId(ratedUserId, rater.getId());
        if (!hasSent || !hasReceived) {
            throw new RuntimeException("Bạn phải có lịch sử nhắn tin 2 chiều với người này mới được đánh giá.");
        }

        if (userRatingRepository.existsByRaterIdAndRatedUserId(rater.getId(), ratedUserId)) {
            throw new RuntimeException("Bạn đã đánh giá người dùng này trước đó.");
        }

        String imageUrl = null;
        if (image != null && !image.isEmpty()) {
            imageUrl = cloudinaryService.uploadFile(image, "user-ratings");
        }

        UserRating rating = UserRating.builder()
                .rater(rater)
                .ratedUser(ratedUser)
                .stars(stars)
                .comment(normalizedComment)
                .imageUrl(imageUrl)
                .createdAt(LocalDateTime.now())
                .build();
        userRatingRepository.save(rating);

        String raterName = rater.getDisplayName();
        if (raterName == null || raterName.isBlank()) {
            raterName = rater.getUsername();
        }
        notificationService.sendSystemNotificationToUser(
                ratedUser,
                "Bạn có đánh giá mới",
                raterName + " vừa đánh giá bạn " + stars + " sao."
        );
    }

    @Transactional(readOnly = true)
    public List<UserRatingResponse> getRatingsForUser(User currentUser, Long ratedUserId) {
        if (currentUser != null && currentUser.getId() != null && currentUser.getId().equals(ratedUserId)) {
            throw new RuntimeException("Bạn không thể xem danh sách đánh giá của chính mình.");
        }

        return userRatingRepository.findAllByRatedUserIdOrderByCreatedAtDesc(ratedUserId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    private UserRatingResponse mapToResponse(UserRating rating) {
        String raterName = rating.getRater().getDisplayName();
        if (raterName == null || raterName.isBlank()) {
            raterName = rating.getRater().getUsername();
        }

        return UserRatingResponse.builder()
                .id(rating.getId())
                .raterId(rating.getRater().getId())
                .raterName(raterName)
                .raterAvatar(rating.getRater().getAvatarUrl())
                .stars(rating.getStars())
                .comment(rating.getComment())
                .imageUrl(rating.getImageUrl())
                .createdAt(rating.getCreatedAt())
                .build();
    }
}
