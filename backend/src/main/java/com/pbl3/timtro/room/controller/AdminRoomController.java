package com.pbl3.timtro.room.controller;
import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.room.dto.response.RoomResponse;
import com.pbl3.timtro.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/rooms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminRoomController {

    private final RoomService roomService;

    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRoomsForAdmin() {
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", roomService.getAllRoomsForAdmin()));
    }
}
