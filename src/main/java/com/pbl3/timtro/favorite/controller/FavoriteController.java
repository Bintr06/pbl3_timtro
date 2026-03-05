package com.pbl3.timtro.favorite.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.favorite.service.FavoriteService;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {
    private final FavoriteService favoriteService;

    // API: Bấm để thích hoặc bỏ thích
    @PostMapping("/{roomId}")
    public ResponseEntity<ApiResponse<String>> toggleFavorite(
            @PathVariable Long roomId,
            @AuthenticationPrincipal User user) {
        favoriteService.toggleFavorite(roomId, user);
        return ResponseEntity.ok(new ApiResponse<>(200, "Thực hiện thao tác thành công", null));
    }

    // API: Lấy danh sách các phòng tôi đã thích
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getMyFavorites(
            @AuthenticationPrincipal User user) {
        List<RoomResponse> favorites = favoriteService.getMyFavorites(user);
        return ResponseEntity.ok(new ApiResponse<>(200, "Lấy danh sách thành công", favorites));
    }
}