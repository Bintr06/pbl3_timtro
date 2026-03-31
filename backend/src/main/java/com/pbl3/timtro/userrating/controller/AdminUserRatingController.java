package com.pbl3.timtro.userrating.controller;

import com.pbl3.timtro.userrating.entity.UserRating;
import com.pbl3.timtro.userrating.repository.UserRatingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/ratings")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserRatingController {
    private final UserRatingRepository userRatingRepository;

    public AdminUserRatingController(UserRatingRepository userRatingRepository) {
        this.userRatingRepository = userRatingRepository;
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRating(@PathVariable Long id) {
        if (userRatingRepository.existsById(id)) {
            userRatingRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/low-rated-users")
    public ResponseEntity<List<Object[]>> getLowRatedUsers(@RequestParam(defaultValue = "3") Integer maxStars) {
        List<Object[]> results = userRatingRepository.findLowRatedUsers(maxStars);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/from-user")
    public ResponseEntity<List<UserRating>> getRatingsFromUser(@RequestParam String username) {
        List<UserRating> ratings = userRatingRepository.findByRaterUsername(username);
        return ResponseEntity.ok(ratings);
    }
}
