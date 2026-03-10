package com.pbl3.timtro.room.service;

import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.favorite.repository.FavoriteRepository;
import com.pbl3.timtro.rating.repository.RatingRepository;
import com.pbl3.timtro.room.dto.request.RoomRequest;
import com.pbl3.timtro.room.dto.request.RoomUpdateRequest;
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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {
    private final RoomRepository roomRepository;
    private final AmenityRepository amenityRepository;
    private final CloudinaryService cloudinaryService;
    private final FavoriteRepository favoriteRepository;
    private final RatingRepository ratingRepository;

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
                .status(RoomStatus.PENDING)
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
    @Transactional
    public void approveRoom(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng trọ!"));
        room.setStatus(RoomStatus.AVAILABLE);
        roomRepository.save(room);
    }
    public List<RoomResponse> getAllRooms() {
        User currentUser = getCurrentUser();
        return roomRepository.findAllWithImagesAndAmenities().stream()
                .distinct()
                .map(room -> mapToResponse(room, currentUser))
                .collect(Collectors.toList());
    }

    public List<RoomResponse> searchRooms(String keyword, String district, Double minPrice, Double maxPrice, Double minArea) {
        User currentUser = getCurrentUser();
        return roomRepository.searchRooms(keyword, district, minPrice, maxPrice, minArea)
                .stream()
                .distinct()
                .map(room -> mapToResponse(room, currentUser))
                .collect(Collectors.toList());
    }
    public RoomResponse mapToResponse(Room room, User currentUser) {
        boolean isFav = false;
        if (currentUser != null) {
            isFav = favoriteRepository.existsByUserIdAndRoomId(currentUser.getId(), room.getId());
        }
        Double avgStars = ratingRepository.getAverageStars(room.getId());

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
                .ownerName(room.getOwner() != null ? room.getOwner().getDisplayName() : "N/A")
                .ownerPhone(room.getOwner() != null ? room.getOwner().getPhone() : "N/A")
                .imageUrls(room.getImages().stream()
                        .map(RoomImage::getImageUrl)
                        .distinct()
                        .toList())
                .amenities(room.getAmenities().stream()
                        .map(Amenity::getName)
                        .collect(Collectors.toSet()))
                .createdAt(room.getCreatedAt())
                .isFavorite(isFav)
                .averageStars(avgStars != null ? Math.round(avgStars * 10.0) / 10.0 : 0.0)
                .build();
    }

    public List<RoomResponse> getRoomsByStatus(RoomStatus status) {
        User currentUser = getCurrentUser();
        return roomRepository.findAllByStatus(status).stream()
                .distinct()
                .map(room -> mapToResponse(room, currentUser))
                .collect(Collectors.toList());
    }

    public List<RoomResponse> getMyRooms(User currentUser) {
        return roomRepository.findAllByOwnerId(currentUser.getId()).stream()
                .distinct()
                .map(room -> mapToResponse(room, currentUser))
                .collect(Collectors.toList());
    }

    @Transactional
    public void rejectRoom(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));
        room.setStatus(RoomStatus.REJECT);
        roomRepository.save(room);
    }

    @Transactional
    public void deleteRoom(Long roomId, User currentUser) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        boolean isOwner = room.getOwner().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isOwner && !isAdmin) {
            throw new RuntimeException("Bạn không có quyền xóa phòng này!");
        }

        if (room.getImages() != null) {
            for (RoomImage img : room.getImages()) {
                cloudinaryService.deleteFile(img.getImageUrl());
            }
        }
        roomRepository.delete(room);
    }

    @Transactional
    public void toggleRentStatus(Long roomId, User currentUser) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        if (!room.getOwner().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Bạn không có quyền thay đổi trạng thái phòng này!");
        }

        room.setStatus(room.getStatus() == RoomStatus.AVAILABLE ? RoomStatus.RENTED : RoomStatus.AVAILABLE);
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
        room.setProvince(request.getProvince()); // Thêm cái này
        room.setDistrict(request.getDistrict()); // Thêm cái này
        room.setWard(request.getWard());         // Thêm cái này
        room.setLatitude(request.getLatitude());   // Cực kỳ quan trọng
        room.setLongitude(request.getLongitude()); // Cực kỳ quan trọng
        room.setStatus(RoomStatus.PENDING);

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
        if (newFiles != null && !newFiles.isEmpty()) {
            for (MultipartFile file : newFiles) {
                if (!file.isEmpty()) {
                    String url = cloudinaryService.uploadFile(file, "rooms");
                    room.addImage(RoomImage.builder().imageUrl(url).primary(false).build());
                }
            }
        }
        roomRepository.save(room);
    }
}