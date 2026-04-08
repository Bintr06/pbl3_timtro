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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
        Map<Long, Integer> reportsByUserId = new HashMap<>();
        userReportRepository.countReportsGroupedByReportedUserId().forEach(row -> {
            Long userId = ((Number) row[0]).longValue();
            Integer count = ((Number) row[1]).intValue();
            reportsByUserId.put(userId, count);
        });

        Map<Long, Double> avgRatingsByUserId = new HashMap<>();
        userRatingRepository.getAverageRatingGroupedByRatedUserId().forEach(row -> {
            Long userId = ((Number) row[0]).longValue();
            Double avg = row[1] == null ? null : ((Number) row[1]).doubleValue();
            avgRatingsByUserId.put(userId, avg);
        });

        List<AdminUserResponse> responses = users.stream()
                .map(u -> {
                    int reportCount = reportsByUserId.getOrDefault(u.getId(), 0);
                    Double avgRating = avgRatingsByUserId.get(u.getId());

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
                                .reportCount(reportCount)
                            .averageRating(avgRating != null && avgRating > 0
                                    ? Math.round(avgRating * 10.0) / 10.0
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
