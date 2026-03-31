package com.pbl3.timtro.favorite.repository;

import com.pbl3.timtro.favorite.entity.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    Optional<Favorite> findByUserIdAndRoomId(Long userId, Long roomId);
    List<Favorite> findAllByUserId(Long userId);
    boolean existsByUserIdAndRoomId(Long userId, Long roomId);

    @Query("SELECT f.room.id FROM Favorite f WHERE f.user.id = :userId AND f.room.id IN :roomIds")
    List<Long> findFavoriteRoomIdsByUserIdAndRoomIds(Long userId, List<Long> roomIds);
}