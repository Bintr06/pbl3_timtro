package com.pbl3.timtro.room.repository;

import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.enums.RoomStatus;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
        @Query("SELECT DISTINCT r FROM Room r " +
                        "LEFT JOIN FETCH r.owner " +
                        "LEFT JOIN FETCH r.images " +
                        "LEFT JOIN FETCH r.amenities " +
                        "WHERE r.deleted = false " +
                        "ORDER BY r.createdAt DESC")
        List<Room> findAllWithImagesAndAmenitiesForAdmin();

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.owner " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.deleted = false AND r.status = 'AVAILABLE' " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllAvailableWithImagesAndAmenities();

    @Query("SELECT ri.imageUrl FROM RoomImage ri WHERE ri.room.id = :roomId")
    List<String> findAllUrlsByRoomId(@Param("roomId") Long roomId);
    List<Room> findByDistrict(String district);
    List<Room> findByProvince(String province);

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.owner " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.deleted = false AND r.status = :status " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllByStatus(@Param("status") RoomStatus status);

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.owner " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.deleted = false AND r.owner.id = :ownerId " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllByOwnerId(@Param("ownerId") Long ownerId);

    @Query("SELECT DISTINCT r FROM Room r " +
            "LEFT JOIN FETCH r.owner " +
            "LEFT JOIN FETCH r.images " +
            "LEFT JOIN FETCH r.amenities " +
            "WHERE r.deleted = false AND r.owner.id = :ownerId AND r.status IN :statuses " +
            "ORDER BY r.createdAt DESC")
    List<Room> findAllByOwnerIdAndStatuses(@Param("ownerId") Long ownerId, @Param("statuses") Set<RoomStatus> statuses);

    Optional<Room> findByIdAndDeletedFalse(Long roomId);

        long countByOwnerIdAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndStatusNot(
                        Long ownerId,
                        LocalDateTime fromDateTime,
                        LocalDateTime toDateTime,
                        RoomStatus excludedStatus
        );

        @Query("SELECT DISTINCT r FROM Room r " +
                        "LEFT JOIN FETCH r.owner " +
                        "LEFT JOIN FETCH r.images " +
                        "LEFT JOIN FETCH r.amenities " +
                        "WHERE r.id = :roomId AND r.deleted = false")
        Optional<Room> findByIdWithImagesAndAmenities(@Param("roomId") Long roomId);

        @Modifying
        @Query("UPDATE Room r SET r.status = :status WHERE r.owner.id = :ownerId")
        int updateStatusByOwnerId(@Param("ownerId") Long ownerId, @Param("status") RoomStatus status);

    long countByCreatedAtBetween(java.time.LocalDateTime startDate, java.time.LocalDateTime endDate);
        long countByStatus(RoomStatus status);

        @Query(value = "SELECT DATE(r.created_at) AS day, COUNT(*) AS cnt FROM rooms r " +
                        "WHERE r.created_at >= :fromDateTime AND r.created_at < :toDateTime " +
                        "GROUP BY DATE(r.created_at)", nativeQuery = true)
        List<Object[]> countRoomsGroupedByDate(@Param("fromDateTime") LocalDateTime fromDateTime,
                                                                                   @Param("toDateTime") LocalDateTime toDateTime);
}