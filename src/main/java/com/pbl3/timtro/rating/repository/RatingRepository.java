package com.pbl3.timtro.rating.repository;

import com.pbl3.timtro.rating.entity.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {
    List<Rating> findAllByRoomIdOrderByCreatedAtDesc(Long roomId);

    boolean existsByUserIdAndRoomId(Long userId, Long roomId);

    @Query("SELECT AVG(r.stars) FROM Rating r WHERE r.room.id = :roomId")
    Double getAverageStars(Long roomId);
}