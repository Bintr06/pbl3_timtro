package com.pbl3.timtro.room.repository;

import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.enums.RoomStatus;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
        @Query("SELECT DISTINCT r FROM Room r " +
                        "LEFT JOIN FETCH r.images " +
                        "LEFT JOIN FETCH r.amenities " +
                        "ORDER BY r.createdAt DESC")
        List<Room> findAllWithImagesAndAmenitiesForAdmin();

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.status = 'AVAILABLE' " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllAvailableWithImagesAndAmenities();

    @Query("SELECT ri.imageUrl FROM RoomImage ri WHERE ri.room.id = :roomId")
    List<String> findAllUrlsByRoomId(@Param("roomId") Long roomId);
    List<Room> findByDistrict(String district);
    List<Room> findByProvince(String province);

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.status = :status " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllByStatus(@Param("status") RoomStatus status);

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.owner.id = :ownerId " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllByOwnerId(@Param("ownerId") Long ownerId);

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.owner.id = :ownerId AND r.status IN :statuses " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllByOwnerIdAndStatuses(@Param("ownerId") Long ownerId, @Param("statuses") Set<RoomStatus> statuses);

        @Modifying
        @Query("UPDATE Room r SET r.status = :status WHERE r.owner.id = :ownerId")
        int updateStatusByOwnerId(@Param("ownerId") Long ownerId, @Param("status") RoomStatus status);

        @Modifying
        @Query(value = "UPDATE rooms SET status = 'AVAILABLE' WHERE status = 'PENDING'", nativeQuery = true)
        int migratePendingToAvailable();

    long countByCreatedAtBetween(java.time.LocalDateTime startDate, java.time.LocalDateTime endDate);
}