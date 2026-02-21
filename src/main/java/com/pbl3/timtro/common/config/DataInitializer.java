package com.pbl3.timtro.common.config;

import com.pbl3.timtro.room.entity.Amenity;
import com.pbl3.timtro.room.repository.AmenityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final AmenityRepository amenityRepository;

    @Override
    public void run(String... args) {
        if (amenityRepository.count() == 0) {
            List<Amenity> defaultAmenities = Arrays.asList(
                    Amenity.builder().name("Wifi").icon("wifi").build(),
                    Amenity.builder().name("Điều hòa").icon("ac_unit").build(),
                    Amenity.builder().name("Máy giặt").icon("local_laundry_service").build(),
                    Amenity.builder().name("Bãi đỗ xe").icon("local_parking").build(),
                    Amenity.builder().name("Giờ giấc tự do").icon("schedule").build(),
                    Amenity.builder().name("Tủ lạnh").icon("kitchen").build()
            );
            amenityRepository.saveAll(defaultAmenities);
            System.out.println(">> Đã khởi tạo danh sách tiện ích mẫu.");
        }
    }
}