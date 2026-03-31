package com.pbl3.timtro.room.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RoomUpdateRequest {
    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;

    @Size(max = 2000, message = "Mô tả tối đa 2000 ký tự")
    private String description;

    @NotNull(message = "Giá phòng là bắt buộc")
    @Min(value = 0, message = "Giá phòng không được nhỏ hơn 0")
    private Double price;

    @NotNull(message = "Diện tích là bắt buộc")
    @Min(value = 1, message = "Diện tích phải lớn hơn 0")
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