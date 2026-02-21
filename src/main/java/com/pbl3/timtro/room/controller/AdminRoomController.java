package com.pbl3.timtro.room.controller;
import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/rooms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')") // Khóa toàn bộ Controller này cho ADMIN
public class AdminRoomController {

    private final RoomService roomService;
    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getPendingRooms() {
        // Bạn có thể viết thêm query findByStatus(PENDING) trong Repository
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getRoomsByStatus(RoomStatus.PENDING)));
    }
    @PatchMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<String>> approveRoom(@PathVariable Long id) {
        roomService.approveRoom(id);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã duyệt tin đăng thành công!", null));
    }
    @PatchMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<String>> rejectRoom(@PathVariable Long id) {
        roomService.rejectRoom(id);
        return ResponseEntity.ok(new ApiResponse<>(200, "Đã từ chối tin đăng thành công!", null));
    }
}
