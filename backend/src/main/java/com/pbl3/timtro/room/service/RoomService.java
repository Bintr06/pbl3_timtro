package com.pbl3.timtro.room.service;

import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.favorite.repository.FavoriteRepository;
import com.pbl3.timtro.notification.service.NotificationService;
import com.pbl3.timtro.room.dto.request.RoomDeleteRequest;
import com.pbl3.timtro.room.dto.request.RoomRequest;
import com.pbl3.timtro.room.dto.request.RoomUpdateRequest;
import com.pbl3.timtro.room.dto.response.AmenityResponse;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.entity.Amenity;
import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.entity.RoomImage;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.room.repository.AmenityRepository;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.user.entity.User;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {
    private final RoomRepository roomRepository;
    private final AmenityRepository amenityRepository;
    private final CloudinaryService cloudinaryService;
    private final FavoriteRepository favoriteRepository;
    private final NotificationService notificationService;

    public List<AmenityResponse> getAllAmenitiesForPublic() {
        return amenityRepository.findAll().stream()
                .sorted(Comparator.comparing(Amenity::getId))
                .map(a -> new AmenityResponse(a.getId(), a.getName(), a.getIcon()))
                .toList();
    }

    @Transactional
    public void createRoom(RoomRequest request, List<MultipartFile> files, User owner) {
        Room room = Room.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .price(request.getPrice())
                .area(request.getArea())
                .address(request.getAddress())
                .province(request.getProvince())
                .district(request.getDistrict())
                .ward(request.getWard())
                .streetDetail(request.getStreetDetail())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .status(RoomStatus.AVAILABLE)
                .owner(owner)
                .build();

        if (request.getAmenityIds() != null && !request.getAmenityIds().isEmpty()) {
            Set<Amenity> amenities = new HashSet<>(amenityRepository.findAllById(request.getAmenityIds()));
            room.setAmenities(amenities);
        }

        if (files != null && !files.isEmpty()) {
            List<MultipartFile> validFiles = files.stream()
                    .filter(f -> !f.isEmpty())
                    .toList();

            int primaryIndex = (request.getPrimaryImageIndex() != null) ? request.getPrimaryImageIndex() : 0;
            if (primaryIndex >= validFiles.size()) primaryIndex = 0;

            for (int i = 0; i < validFiles.size(); i++) {
                String url = cloudinaryService.uploadFile(validFiles.get(i), "rooms");
                RoomImage img = RoomImage.builder()
                        .imageUrl(url)
                        .primary(i == primaryIndex)
                        .build();
                room.addImage(img);
            }
        }
        roomRepository.save(room);
    }
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }

    public List<RoomResponse> getAllRooms() {
        User currentUser = getCurrentUser();
        List<Room> rooms = roomRepository.findAllAvailableWithImagesAndAmenities().stream()
                .distinct()
                .toList();
        return mapRoomsToResponses(rooms, currentUser);
    }

    public List<RoomResponse> getAllRoomsForAdmin() {
        User currentUser = getCurrentUser();
        List<Room> rooms = roomRepository.findAllWithImagesAndAmenitiesForAdmin().stream()
                .distinct()
                .toList();
        return mapRoomsToResponses(rooms, currentUser);
    }

    private List<RoomResponse> mapRoomsToResponses(List<Room> rooms, User currentUser) {
        List<Long> roomIds = rooms.stream().map(Room::getId).toList();

        Set<Long> favoriteRoomIds = new HashSet<>();
        if (currentUser != null && !roomIds.isEmpty()) {
            favoriteRoomIds = new HashSet<>(favoriteRepository.findFavoriteRoomIdsByUserIdAndRoomIds(currentUser.getId(), roomIds));
        }

        Set<Long> finalFavoriteRoomIds = favoriteRoomIds;
        return rooms.stream()
                .map(room -> mapToResponse(room, currentUser, finalFavoriteRoomIds))
                .collect(Collectors.toList());
    }

    public RoomResponse mapToResponse(Room room, User currentUser) {
        return mapToResponse(room, currentUser, Set.of());
    }

    private RoomResponse mapToResponse(Room room, User currentUser, Set<Long> favoriteRoomIds) {
        boolean isFav = currentUser != null && favoriteRoomIds.contains(room.getId());
        List<RoomImage> orderedImages = room.getImages().stream()
            .sorted(Comparator
                .comparing(RoomImage::isPrimary, Comparator.reverseOrder())
                .thenComparing(RoomImage::getId, Comparator.nullsLast(Long::compareTo)))
            .toList();

        return RoomResponse.builder()
                .id(room.getId())
                .title(room.getTitle())
                .description(room.getDescription())
                .price(room.getPrice())
                .area(room.getArea())
                .address(room.getAddress())
                .province(room.getProvince())
                .district(room.getDistrict())
                .ward(room.getWard())
                .streetDetail(room.getStreetDetail())
                .latitude(room.getLatitude())
                .longitude(room.getLongitude())
                .status(room.getStatus() != null ? room.getStatus().name() : null)
                .ownerId(room.getOwner() != null ? room.getOwner().getId() : null)
                .ownerName(room.getOwner() != null ? room.getOwner().getDisplayName() : "N/A")
                .ownerPhone(room.getOwner() != null ? room.getOwner().getPhone() : "N/A")
                .imageUrls(orderedImages.stream()
                        .map(RoomImage::getImageUrl)
                        .distinct()
                        .toList())
                .amenities(room.getAmenities().stream()
                        .map(Amenity::getName)
                        .collect(Collectors.toSet()))
                .amenityIds(room.getAmenities().stream()
                        .map(Amenity::getId)
                        .collect(Collectors.toSet()))
                .createdAt(
                    room.getCreatedAt() == null
                        ? null
                        : room.getCreatedAt()
                            .atOffset(ZoneOffset.UTC)
                            .atZoneSameInstant(ZoneId.of("Asia/Ho_Chi_Minh"))
                            .toOffsetDateTime()
                )
                .isFavorite(isFav)
                .build();
    }

    public List<RoomResponse> getRoomsByStatus(RoomStatus status) {
        User currentUser = getCurrentUser();
        List<Room> rooms = roomRepository.findAllByStatus(status).stream()
                .distinct()
                .toList();
        return mapRoomsToResponses(rooms, currentUser);
    }

    public List<RoomResponse> getMyRooms(User currentUser) {
        List<Room> rooms = roomRepository.findAllByOwnerId(currentUser.getId()).stream()
                .distinct()
                .toList();
        return mapRoomsToResponses(rooms, currentUser);
    }

    public List<RoomResponse> getProfileRooms(Long ownerId, User currentUser) {
        List<Room> rooms = roomRepository.findAllByOwnerIdAndStatuses(
                ownerId,
                EnumSet.of(RoomStatus.AVAILABLE, RoomStatus.RENTED)
        ).stream().distinct().toList();
        return mapRoomsToResponses(rooms, currentUser);
    }

    @Transactional
    public void deleteRoom(Long roomId, User currentUser, RoomDeleteRequest deleteRequest) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        boolean isOwner = room.getOwner().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isOwner && !isAdmin) {
            throw new RuntimeException("Bạn không có quyền xóa phòng này!");
        }

        String reason = deleteRequest == null || deleteRequest.getReason() == null
                ? ""
                : deleteRequest.getReason().trim();
        boolean shouldNotifyOwner = isAdmin
                && deleteRequest != null
                && Boolean.TRUE.equals(deleteRequest.getNotifyOwner())
                && !reason.isBlank();

        if (shouldNotifyOwner && room.getOwner() != null) {
            String roomTitle = room.getTitle() == null || room.getTitle().isBlank() ? "#" + room.getId() : room.getTitle();
            String title = "Tin đăng đã bị xóa bởi quản trị viên";
            String content = "Tin đăng \"" + roomTitle + "\" đã bị xóa. Lý do: " + reason;
            notificationService.sendSystemNotificationToUser(room.getOwner(), title, content);
        }

        if (room.getImages() != null) {
            for (RoomImage img : room.getImages()) {
                cloudinaryService.deleteFile(img.getImageUrl());
            }
        }

        favoriteRepository.deleteAllByRoomId(roomId);

        roomRepository.delete(room);
    }

    @Transactional
    public void updateRoomStatus(Long roomId, String status, User currentUser) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        boolean isOwner = room.getOwner().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isOwner && !isAdmin) {
            throw new RuntimeException("Bạn không có quyền thay đổi trạng thái phòng này!");
        }

        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        RoomStatus nextStatus;
        switch (normalizedStatus) {
            case "AVAILABLE" -> nextStatus = RoomStatus.AVAILABLE;
            case "RENTED" -> nextStatus = RoomStatus.RENTED;
            case "HIDE", "HIDDEN" -> nextStatus = RoomStatus.HIDDEN;
            default -> throw new RuntimeException("Trạng thái không hợp lệ. Chỉ chấp nhận AVAILABLE, RENTED hoặc HIDE.");
        }

        room.setStatus(nextStatus);
        roomRepository.save(room);
    }

    @Transactional
    public void updateRoom(Long roomId, RoomUpdateRequest request, List<MultipartFile> newFiles, User currentUser) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        if (!room.getOwner().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Bạn không có quyền sửa phòng này!");
        }

        room.setTitle(request.getTitle());
        room.setDescription(request.getDescription());
        room.setPrice(request.getPrice());
        room.setArea(request.getArea());
        room.setAddress(request.getAddress());
        room.setProvince(request.getProvince()); 
        room.setDistrict(request.getDistrict()); 
        room.setWard(request.getWard());         
        
        room.setLatitude(request.getLatitude());
        room.setLongitude(request.getLongitude()); 
        room.setStatus(RoomStatus.AVAILABLE);

        if (request.getAmenityIds() != null) {
            Set<Amenity> amenities = new HashSet<>(amenityRepository.findAllById(request.getAmenityIds()));
            room.setAmenities(amenities);
        }
        List<RoomImage> imagesToRemove = room.getImages().stream()
                .filter(img -> request.getRemainingImageUrls() == null ||
                        !request.getRemainingImageUrls().contains(img.getImageUrl()))
                .toList();

        for (RoomImage img : imagesToRemove) {
            cloudinaryService.deleteFile(img.getImageUrl());
            room.removeImage(img);
        }
        List<String> uploadedNewUrls = new java.util.ArrayList<>();
        if (newFiles != null && !newFiles.isEmpty()) {
            for (MultipartFile file : newFiles) {
                if (!file.isEmpty()) {
                    String url = cloudinaryService.uploadFile(file, "rooms");
                    room.addImage(RoomImage.builder().imageUrl(url).primary(false).build());
                    uploadedNewUrls.add(url);
                }
            }
        }

        if (room.getImages() != null && !room.getImages().isEmpty()) {
            Map<String, Integer> existingOrder = new HashMap<>();
            if (request.getRemainingImageUrls() != null) {
                for (int i = 0; i < request.getRemainingImageUrls().size(); i++) {
                    existingOrder.put(request.getRemainingImageUrls().get(i), i);
                }
            }
            Map<String, Integer> newOrder = new HashMap<>();
            for (int i = 0; i < uploadedNewUrls.size(); i++) {
                newOrder.put(uploadedNewUrls.get(i), i);
            }

            List<RoomImage> orderedImages = room.getImages().stream()
                    .sorted(Comparator
                            .comparingInt((RoomImage img) -> {
                                Integer oldPos = existingOrder.get(img.getImageUrl());
                                if (oldPos != null) {
                                    return oldPos;
                                }
                                Integer newPos = newOrder.get(img.getImageUrl());
                                if (newPos != null) {
                                    return existingOrder.size() + newPos;
                                }
                                return Integer.MAX_VALUE;
                            })
                            .thenComparing(RoomImage::getId, Comparator.nullsLast(Long::compareTo)))
                    .toList();

            int primaryIndex = request.getPrimaryImageIndex() != null ? request.getPrimaryImageIndex() : 0;
            if (primaryIndex < 0 || primaryIndex >= orderedImages.size()) {
                primaryIndex = 0;
            }

            for (int i = 0; i < orderedImages.size(); i++) {
                orderedImages.get(i).setPrimary(i == primaryIndex);
            }
        }

        roomRepository.save(room);
    }
}