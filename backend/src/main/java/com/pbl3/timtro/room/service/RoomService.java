package com.pbl3.timtro.room.service;

import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.room.dto.response.QuotaResponse;
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
import com.pbl3.timtro.room.enums.CreditSource;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.room.repository.AmenityRepository;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.YearMonth;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {
    private static final ZoneId APP_ZONE_ID = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_POSTS_PER_MONTH = 3;

    private final RoomRepository roomRepository;
    private final AmenityRepository amenityRepository;
    private final CloudinaryService cloudinaryService;
    private final FavoriteRepository favoriteRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public List<AmenityResponse> getAllAmenitiesForPublic() {
        return amenityRepository.findAll().stream()
                .sorted(Comparator.comparing(Amenity::getId))
                .map(a -> new AmenityResponse(a.getId(), a.getName(), a.getIcon()))
                .toList();
    }

    @Transactional
    public void createRoom(RoomRequest request, List<MultipartFile> files, User owner) {
        User managedOwner = userRepository.findById(owner.getId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng!"));
        ensureMonthlyCreditsInitialized(managedOwner);
        CreditSource creditSource = consumeOneTurn(managedOwner);
        userRepository.save(managedOwner);

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
                .creditSource(creditSource)
                .owner(managedOwner)
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

    private void ensureMonthlyCreditsInitialized(User user) {
        String currentMonthKey = YearMonth.now(APP_ZONE_ID).toString();
        if (user.getMonthlyCredits() == null) {
            user.setMonthlyCredits(0);
        }
        if (user.getPostCredits() == null) {
            user.setPostCredits(0);
        }
        if (!currentMonthKey.equals(user.getMonthlyCreditsResetMonth())) {
            user.setMonthlyCredits(MAX_POSTS_PER_MONTH);
            user.setMonthlyCreditsResetMonth(currentMonthKey);
        }
    }

    private CreditSource consumeOneTurn(User user) {
        ensureMonthlyCreditsInitialized(user);
        if (user.getMonthlyCredits() > 0) {
            user.setMonthlyCredits(user.getMonthlyCredits() - 1);
            return CreditSource.MONTHLY;
        }
        if (user.getPostCredits() > 0) {
            user.setPostCredits(user.getPostCredits() - 1);
            return CreditSource.PERMANENT;
        }
        throw new RuntimeException("Bạn không đủ lượt để đăng tin. Hãy mua thêm lượt hoặc chờ lượt tháng mới.");
    }

    private void refundOneTurn(User user, CreditSource creditSource) {
        if (creditSource == null) {
            return;
        }
        if (creditSource == CreditSource.MONTHLY) {
            ensureMonthlyCreditsInitialized(user);
            user.setMonthlyCredits(Math.min(MAX_POSTS_PER_MONTH, user.getMonthlyCredits() + 1));
            return;
        }
        user.setPostCredits((user.getPostCredits() != null ? user.getPostCredits() : 0) + 1);
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

    public int getRemainingPostsForCurrentUser() {
        return getQuotaForCurrentUser().getTotalCreditsRemaining();
    }

    public QuotaResponse getQuotaForCurrentUser() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return QuotaResponse.builder()
                    .monthlyCreditsRemaining(MAX_POSTS_PER_MONTH)
                    .permanentCreditsRemaining(0)
                    .totalCreditsRemaining(MAX_POSTS_PER_MONTH)
                    .monthlyCreditsUsed(0)
                    .build();
        }

                User managedUser = userRepository.findById(currentUser.getId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng!"));
                ensureMonthlyCreditsInitialized(managedUser);
                userRepository.save(managedUser);

                int monthlyRemaining = managedUser.getMonthlyCredits();
                int permanentRemaining = managedUser.getPostCredits() != null ? managedUser.getPostCredits() : 0;
                int monthlyUsed = Math.max(0, MAX_POSTS_PER_MONTH - monthlyRemaining);
        int totalRemaining = monthlyRemaining + permanentRemaining;
        
        return QuotaResponse.builder()
                .monthlyCreditsRemaining(monthlyRemaining)
                .permanentCreditsRemaining(permanentRemaining)
                .totalCreditsRemaining(totalRemaining)
                .monthlyCreditsUsed(monthlyUsed)
                .build();
    }

        public RoomResponse getRoomDetail(Long roomId, User currentUser) {
        Room room = roomRepository.findByIdWithImagesAndAmenities(roomId)
            .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        boolean isAdmin = currentUser != null && currentUser.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean isOwner = currentUser != null
            && room.getOwner() != null
            && room.getOwner().getId().equals(currentUser.getId());
        boolean isPublicRoom = room.getStatus() == RoomStatus.AVAILABLE;

        if (!isPublicRoom && !isOwner && !isAdmin) {
            throw new RuntimeException("Bạn không có quyền xem tin đăng này!");
        }

        return mapToResponse(room, currentUser);
        }

    public RoomResponse getRoomDetailForAdmin(Long roomId) {
        User currentUser = getCurrentUser();
        Room room = roomRepository.findByIdWithImagesAndAmenities(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));
        return mapToResponse(room, currentUser);
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
                            .atZone(ZoneId.of("Asia/Ho_Chi_Minh"))
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
        Room room = roomRepository.findByIdAndDeletedFalse(roomId)
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
            List<RoomImage> images = new java.util.ArrayList<>(room.getImages());
            for (RoomImage img : images) {
                cloudinaryService.deleteFile(img.getImageUrl());
                room.removeImage(img);
            }
        }

        favoriteRepository.deleteAllByRoomId(roomId);

        room.setDeleted(true);
        roomRepository.save(room);
    }

    @Transactional
    public void updateRoomStatus(Long roomId, String status, String rejectionReason, User currentUser) {
        Room room = roomRepository.findByIdAndDeletedFalse(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        boolean isOwner = room.getOwner().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isOwner && !isAdmin) {
            throw new RuntimeException("Bạn không có quyền thay đổi trạng thái phòng này!");
        }

        RoomStatus previousStatus = room.getStatus();

        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        RoomStatus nextStatus;
        switch (normalizedStatus) {
            case "PENDING" -> nextStatus = RoomStatus.PENDING;
            case "AVAILABLE" -> nextStatus = RoomStatus.AVAILABLE;
            case "RENTED" -> nextStatus = RoomStatus.RENTED;
            case "REJECT", "REJECTED" -> nextStatus = RoomStatus.REJECTED;
            case "HIDE", "HIDDEN" -> nextStatus = RoomStatus.HIDDEN;
            default -> throw new RuntimeException("Trạng thái không hợp lệ. Chỉ chấp nhận PENDING, AVAILABLE, RENTED, REJECTED hoặc HIDE.");
        }

        if (!isAdmin) {
            if (nextStatus == RoomStatus.PENDING) {
                throw new RuntimeException("Bạn không thể đặt lại tin về trạng thái chờ duyệt.");
            }
            if (room.getStatus() == RoomStatus.PENDING && nextStatus != RoomStatus.PENDING) {
                throw new RuntimeException("Tin đăng đang chờ quản trị viên duyệt, bạn không thể tự cập nhật trạng thái.");
            }
        }

        room.setStatus(nextStatus);

        if (isAdmin && previousStatus == RoomStatus.PENDING && nextStatus == RoomStatus.REJECTED) {
            String reason = rejectionReason == null ? "" : rejectionReason.trim();
            if (reason.isBlank()) {
                throw new RuntimeException("Vui lòng nhập lý do từ chối tin.");
            }

            User owner = userRepository.findById(room.getOwner().getId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng!"));
            refundOneTurn(owner, room.getCreditSource());
            room.setCreditSource(null);
            userRepository.save(owner);

            String roomTitle = room.getTitle() == null || room.getTitle().isBlank() ? "#" + room.getId() : room.getTitle();
            notificationService.sendSystemNotificationToUser(
                    owner,
                    "Tin đăng đã bị từ chối",
                    "Tin đăng \"" + roomTitle + "\" đã bị từ chối. Lý do: " + reason
            );
                } else if (isAdmin && previousStatus == RoomStatus.PENDING && nextStatus == RoomStatus.AVAILABLE) {
                    User owner = userRepository.findById(room.getOwner().getId())
                        .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng!"));
                    String roomTitle = room.getTitle() == null || room.getTitle().isBlank() ? "#" + room.getId() : room.getTitle();
                    notificationService.sendSystemNotificationToUser(
                        owner,
                        "Tin đăng đã được duyệt",
                        "Tin đăng \"" + roomTitle + "\" đã được duyệt và đăng thành công trên hệ thống."
                    );
        } else if (room.getCreditSource() != null) {
            room.setCreditSource(null);
        }

        roomRepository.save(room);
    }

    @Transactional
    public void updateRoom(Long roomId, RoomUpdateRequest request, List<MultipartFile> newFiles, User currentUser) {
        Room room = roomRepository.findByIdAndDeletedFalse(roomId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        if (!room.getOwner().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Bạn không có quyền sửa phòng này!");
        }

        RoomStatus previousStatus = room.getStatus();
        User managedOwner = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng!"));

        if (previousStatus == RoomStatus.AVAILABLE || previousStatus == RoomStatus.RENTED || previousStatus == RoomStatus.HIDDEN) {
            ensureMonthlyCreditsInitialized(managedOwner);
            CreditSource creditSource = consumeOneTurn(managedOwner);
            room.setCreditSource(creditSource);
            userRepository.save(managedOwner);
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