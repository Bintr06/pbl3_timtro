package com.pbl3.timtro.rating.controller;

import com.pbl3.timtro.rating.dto.response.RatingResponse;
import com.pbl3.timtro.rating.service.RatingService;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ratings")
@RequiredArgsConstructor
public class RatingController {
    private final RatingService ratingService;
    @PostMapping("/{roomId}")
    public ResponseEntity<String> rate(@AuthenticationPrincipal User user,
                                       @PathVariable Long roomId,
                                       @RequestParam int stars,
                                       @RequestBody String comment) {
        ratingService.createRating(user, roomId, stars, comment);
        return ResponseEntity.ok("Cảm ơn bạn đã đánh giá!");
    }
    @GetMapping("/{roomId}")
    public ResponseEntity<List<RatingResponse>> getRatings(@PathVariable Long roomId) {
        return ResponseEntity.ok(ratingService.getRoomRatings(roomId));
    }
    @DeleteMapping("/{ratingId}")
    public ResponseEntity<String> delete(@AuthenticationPrincipal User user,
                                         @PathVariable Long ratingId) {
        ratingService.deleteRating(ratingId, user);
        return ResponseEntity.ok("Đã xóa đánh giá thành công.");
    }
}