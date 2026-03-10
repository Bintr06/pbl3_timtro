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
    private String province;
    private String district;
    private String ward;
    private double latitude;
    private double longitude;
    private List<Long> amenityIds;
    private List<String> remainingImageUrls;
    private Integer primaryImageIndex;
}