package com.pbl3.timtro.room.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

@Data
public class RoomRequest {
    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;
    @Size(max = 2000)
    private String description;
    private Integer primaryImageIndex;
    @NotNull(message = "Giá phòng là bắt buộc")
    @Min(value = 0, message = "Giá phòng không được nhỏ hơn 0")
    private Double price;
    @NotNull(message = "Diện tích là bắt buộc")
    private Double area;
    private String address;
    private String province; //tinh,tp
    private String district; //quan,huyen
    private String ward;     //phuong,xa
    private String streetDetail; //so nha, ten duong
    private Double latitude;
    private Double longitude;
    private Set<Long> amenityIds;
}