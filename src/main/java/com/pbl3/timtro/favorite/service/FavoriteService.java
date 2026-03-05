package com.pbl3.timtro.favorite.service;

import com.pbl3.timtro.favorite.entity.Favorite;
import com.pbl3.timtro.favorite.repository.FavoriteRepository;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.room.service.RoomService;
import com.pbl3.timtro.user.entity.User;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepository;
    private final RoomRepository roomRepository;
    private final RoomService roomService; // Inject để dùng hàm mapToResponse

    @Transactional
    public void toggleFavorite(Long roomId, User user) {
        favoriteRepository.findByUserIdAndRoomId(user.getId(), roomId)
                .ifPresentOrElse(
                        favoriteRepository::delete, // Nếu tìm thấy -> Xóa (Bỏ thích)
                        () -> { // Nếu không thấy -> Thêm mới (Thích)
                            Room room = roomRepository.findById(roomId)
                                    .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));
                            favoriteRepository.save(Favorite.builder()
                                    .user(user)
                                    .room(room)
                                    .build());
                        }
                );
    }

    public List<RoomResponse> getMyFavorites(User user) {
        return favoriteRepository.findAllByUserId(user.getId()).stream()
                .map(fav -> {

                    return roomService.mapToResponse(fav.getRoom(), user);
                })
                .toList();
    }
}