package com.pbl3.timtro.admin.controller;

import com.pbl3.timtro.admin.dto.AdminUserResponse;
import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.report.repository.UserReportRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import com.pbl3.timtro.userrating.repository.UserRatingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserRepository userRepository;
    private final UserReportRepository userReportRepository;
    private final UserRatingRepository userRatingRepository;
        private final RoomRepository roomRepository;

    @GetMapping("/all")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        List<User> users = userRepository.findAll();

        List<AdminUserResponse> responses = users.stream()
                .map(u -> {
                    Long reportCount = userReportRepository.countByReportedUser(u);
                    Double avgRating = userRatingRepository.getAverageRatingForUser(u.getId());

                    return AdminUserResponse.builder()
                            .id(u.getId())
                            .username(u.getUsername())
                            .displayName(u.getDisplayName())
                            .avatarUrl(u.getAvatarUrl())
                            .email(u.getEmail())
                            .phone(u.getPhone())
                            .role(u.getRole())
                            .enabled(u.isEnabled())
                            .isVerified(u.isVerified())
                            .createdAt(u.getCreatedAt())
                            .updatedAt(u.getUpdatedAt())
                            .reportCount(Math.toIntExact(reportCount))
                            .averageRating(avgRating != null && avgRating > 0
                                    ? Math.round((float) (avgRating * 10)) / 10
                                    : null)
                            .build();
                })
                .sorted((a, b) -> b.getReportCount().compareTo(a.getReportCount()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @PutMapping("/{id}/lock")
        @Transactional
    public ResponseEntity<ApiResponse<String>> lockUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setEnabled(false);
        userRepository.save(user);

                roomRepository.updateStatusByOwnerId(id, RoomStatus.HIDDEN);
        
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã khóa tài khoản người dùng.", null));
    }

    @PutMapping("/{id}/unlock")
    public ResponseEntity<ApiResponse<String>> unlockUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setEnabled(true);
        userRepository.save(user);
        
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã mở khóa tài khoản người dùng.", null));
    }
}
