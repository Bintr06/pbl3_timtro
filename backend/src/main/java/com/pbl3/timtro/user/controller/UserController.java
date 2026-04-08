package com.pbl3.timtro.user.controller;

import com.pbl3.timtro.user.dto.request.UserUpdateRequest;
import com.pbl3.timtro.user.dto.response.UserResponse;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.service.RoomService;
import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final RoomService roomService;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMyProfile(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(userService.mapToResponse(currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserProfile(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getProfileById(id));
    }

    @GetMapping("/{id}/rooms")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getUserProfileRooms(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getProfileRooms(id, currentUser)));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal User currentUser,
            @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(currentUser, request));
    }

    @PostMapping("/avatar")
    public ResponseEntity<String> uploadAvatar(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("file") MultipartFile file) {
        String avatarUrl = userService.updateAvatar(currentUser, file);
        return ResponseEntity.ok(avatarUrl);
    }
}
