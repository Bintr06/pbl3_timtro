package com.pbl3.timtro.userrating.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.userrating.dto.response.UserRatingResponse;
import com.pbl3.timtro.userrating.service.UserRatingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/user-ratings")
@RequiredArgsConstructor
public class UserRatingController {

    private final UserRatingService userRatingService;

    @PostMapping
    public ResponseEntity<ApiResponse<String>> createRating(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("ratedUserId") Long ratedUserId,
            @RequestParam("stars") Integer stars,
            @RequestParam("comment") String comment,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        userRatingService.createUserRating(currentUser, ratedUserId, stars, comment, image);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã gửi đánh giá thành công.", null));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<UserRatingResponse>>> getRatings(
            @AuthenticationPrincipal User currentUser,
            @PathVariable("userId") Long userId
    ) {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", userRatingService.getRatingsForUser(currentUser, userId)));
    }
}
