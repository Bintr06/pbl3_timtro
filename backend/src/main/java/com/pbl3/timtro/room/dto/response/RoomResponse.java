package com.pbl3.timtro.room.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

@Data
@Builder
public class RoomResponse {
    private Long id;
    private String title;
    private String description;
    private Double price;
    private Double area;
    private String address;
    private String province;
    private String district;
    private String ward;
    private String streetDetail;
    private Double latitude;
    private Double longitude;
    private String status;
    private Long ownerId;
    private String ownerName;
    private String ownerPhone;
    private List<String> imageUrls;
    private Set<String> amenities;
    private Set<Long> amenityIds;
    private OffsetDateTime createdAt;
    private boolean isFavorite;
}