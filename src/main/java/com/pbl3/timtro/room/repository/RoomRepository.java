package com.pbl3.timtro.room.repository;

import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.enums.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllWithImagesAndAmenities();

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.status = 'AVAILABLE' " +
            "AND (:keyword IS NULL OR LOWER(r.title) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "AND (:district IS NULL OR r.district = :district) " +
            "AND (:minPrice IS NULL OR r.price >= :minPrice) " +
            "AND (:maxPrice IS NULL OR r.price <= :maxPrice) " +
            "AND (:minArea IS NULL OR r.area >= :minArea) " +
            "ORDER BY r.createdAt DESC")
    List<Room> searchRooms(
            @Param("keyword") String keyword,
            @Param("district") String district,
            @Param("minPrice") Double minPrice,
            @Param("maxPrice") Double maxPrice,
            @Param("minArea") Double minArea
    );
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
}