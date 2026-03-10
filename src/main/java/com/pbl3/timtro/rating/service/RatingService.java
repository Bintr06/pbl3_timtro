package com.pbl3.timtro.rating.service;

import com.pbl3.timtro.chat.repository.ChatMessageRepository;
import com.pbl3.timtro.rating.dto.response.RatingResponse;
import com.pbl3.timtro.rating.entity.Rating;
import com.pbl3.timtro.rating.repository.RatingRepository;
import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RatingService {
    private final RatingRepository ratingRepository;
    private final RoomRepository roomRepository;
    private final ChatMessageRepository chatMessageRepository;
    @Transactional
    public void createRating(User user, Long roomId, int stars, String comment) {
        Room room = roomRepository.findById(roomId).orElseThrow();
        boolean hasChatted = chatMessageRepository.existsBySenderIdAndRecipientId(user.getId(), room.getOwner().getId())
                || chatMessageRepository.existsBySenderIdAndRecipientId(room.getOwner().getId(), user.getId());

        if (!hasChatted) {
            throw new RuntimeException("Bạn phải liên hệ với chủ trọ trước khi để lại đánh giá!");
        }
        if (ratingRepository.existsByUserIdAndRoomId(user.getId(), roomId)) {
            throw new RuntimeException("Mỗi phòng bạn chỉ được đánh giá một lần!");
        }

        Rating rating = Rating.builder()
                .user(user).room(room).stars(stars).comment(comment)
                .createdAt(LocalDateTime.now()).build();
        ratingRepository.save(rating);
    }

    public List<RatingResponse> getRoomRatings(Long roomId) {
        return ratingRepository.findAllByRoomIdOrderByCreatedAtDesc(roomId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    private RatingResponse mapToResponse(Rating rating) {
        return RatingResponse.builder()
                .id(rating.getId())
                .userName(rating.getUser().getDisplayName())
                .userAvatar(rating.getUser().getAvatarUrl())
                .stars(rating.getStars())
                .comment(rating.getComment())
                .createdAt(rating.getCreatedAt())
                .build();
    }
    @Transactional
    public void deleteRating(Long ratingId, User currentUser) {
        Rating rating = ratingRepository.findById(ratingId).orElseThrow();
        if (!rating.getUser().getId().equals(currentUser.getId())
                && currentUser.getRole() != Role.ADMIN) {
            throw new RuntimeException("Bạn không có quyền xóa đánh giá này!");
        }

        ratingRepository.delete(rating);
    }
}
