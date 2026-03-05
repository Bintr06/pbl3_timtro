package com.pbl3.timtro.room.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class RoomUpdateRequest {
    private String title;
    private String description;
    private Double price;
    private Double area;
    private String address;
    private List<Long> amenityIds;
    private List<String> remainingImageUrls; // Danh sách các link ảnh cũ mà người dùng muốn giữ lại
    private Integer primaryImageIndex; // Index của ảnh đại diện mới (nếu có)
}