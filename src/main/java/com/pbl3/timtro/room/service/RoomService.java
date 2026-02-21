package com.pbl3.timtro.room.service;

import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.room.dto.request.RoomRequest;
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
    @Transactional
    public void approveRoom(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng trọ!"));
        room.setStatus(RoomStatus.AVAILABLE);
        roomRepository.save(room);
    }
    public List<RoomResponse> getAllRooms() {
        return roomRepository.findAllWithImagesAndAmenities().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    public List<RoomResponse> searchRooms(String keyword, String district, Double minPrice, Double maxPrice, Double minArea) {
        return roomRepository.searchRooms(keyword, district, minPrice, maxPrice, minArea)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private RoomResponse mapToResponse(Room room) {
        String thumbnail = room.getImages().stream()
                .filter(RoomImage::isPrimary)
                .map(RoomImage::getImageUrl)
                .findFirst()
                .orElse(room.getImages().isEmpty() ? null : room.getImages().get(0).getImageUrl());

        return RoomResponse.builder()
                .id(room.getId())
                .title(room.getTitle())
                .price(room.getPrice())
                .area(room.getArea())
                .address(room.getAddress())
                .district(room.getDistrict())
                .ownerName(room.getOwner() != null ? room.getOwner().getDisplayName() : "N/A")
                .imageUrls(room.getImages().stream().map(RoomImage::getImageUrl).toList())
                .amenities(room.getAmenities().stream().map(Amenity::getName).collect(Collectors.toSet()))
                .createdAt(room.getCreatedAt())
                .build();
    }
    public List<RoomResponse> getRoomsByStatus(RoomStatus status) {
        return roomRepository.findAllByStatus(status).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    @Transactional
    public void rejectRoom(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));
        room.setStatus(RoomStatus.REJECT);
        roomRepository.save(room);
    }
}