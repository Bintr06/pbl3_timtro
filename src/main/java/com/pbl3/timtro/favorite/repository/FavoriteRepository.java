package com.pbl3.timtro.favorite.repository;

import com.pbl3.timtro.favorite.entity.Favorite;
import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    Optional<Favorite> findByUserIdAndRoomId(Long userId, Long roomId);
    List<Favorite> findAllByUserId(Long userId);
    boolean existsByUserIdAndRoomId(Long userId, Long roomId);
}