package com.pbl3.timtro.room.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.room.dto.request.RoomRequest;
import com.pbl3.timtro.room.dto.request.RoomDeleteRequest;
import com.pbl3.timtro.room.dto.request.RoomUpdateRequest;
import com.pbl3.timtro.room.dto.response.AmenityResponse;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.service.RoomService;
import com.pbl3.timtro.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @PostMapping(consumes = {"multipart/form-data"})
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<String>> createRoom(
            @Valid @RequestPart("room") RoomRequest request,
            @RequestPart("files") List<MultipartFile> files,
            @AuthenticationPrincipal User currentUser
    ) {
        roomService.createRoom(request, files, currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đăng tin thành công, vui lòng chờ duyệt!", null));
    }

    @GetMapping("/public/all")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getAllRooms()));
    }

    @GetMapping("/public/amenities")
    public ResponseEntity<ApiResponse<List<AmenityResponse>>> getPublicAmenities() {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getAllAmenitiesForPublic()));
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getMyRooms(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getMyRooms(currentUser)));
    }

    @GetMapping("/{id:\\d+}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<RoomResponse>> getRoomDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getRoomDetail(id, currentUser)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteRoom(
            @PathVariable Long id,
            @RequestBody(required = false) RoomDeleteRequest deleteRequest,
            @AuthenticationPrincipal User currentUser
    ) {
        roomService.deleteRoom(id, currentUser, deleteRequest);
        return ResponseEntity.ok("Xóa phòng trọ và toàn bộ ảnh liên quan thành công!");
    }
    @PutMapping("/{id}")
    public ResponseEntity<String> updateRoom(
            @PathVariable Long id,
            @Valid @RequestPart("request") RoomUpdateRequest request,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal User currentUser
    ) {
        roomService.updateRoom(id, request, files, currentUser);
        return ResponseEntity.ok("Cập nhật phòng trọ thành công, vui lòng chờ duyệt lại!");
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<String> updateRoomStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @AuthenticationPrincipal User currentUser
    ) {
        roomService.updateRoomStatus(id, status, currentUser);
        return ResponseEntity.ok("Cập nhật trạng thái phòng thành công!");
    }
}