package com.pbl3.timtro.room.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.room.dto.request.RoomRequest;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.service.RoomService;
import com.pbl3.timtro.user.entity.User;
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

    // Đăng tin: Chỉ dành cho chủ trọ (OWNER/HOST)
    @PostMapping(consumes = {"multipart/form-data"})
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<ApiResponse<String>> createRoom(
            @RequestPart("room") RoomRequest request,
            @RequestPart("files") List<MultipartFile> files,
            @AuthenticationPrincipal User currentUser
    ) {
        roomService.createRoom(request, files, currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đăng tin thành công!", null));
    }

    // Lấy tất cả: Công khai
    @GetMapping("/public/all")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getAllRooms()));
    }

    // Tìm kiếm: Công khai
    @GetMapping("/public/search")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> searchRooms(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) Double minArea
    ) {
        var result = roomService.searchRooms(keyword, district, minPrice, maxPrice, minArea);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", result));
    }
}