package com.pbl3.timtro.common.config;

import com.pbl3.timtro.room.entity.Amenity;
import com.pbl3.timtro.room.repository.AmenityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final AmenityRepository amenityRepository;

    @Override
    @Transactional
    public void run(String... args) {
        Map<String, String> requiredAmenities = new LinkedHashMap<>();
        requiredAmenities.put("Wifi", "wifi");
        requiredAmenities.put("Điều hòa", "ac_unit");
        requiredAmenities.put("Chỗ để xe", "local_parking");
        requiredAmenities.put("Nóng lạnh", "hot_tub");
        requiredAmenities.put("Gác lửng", "stairs");
        requiredAmenities.put("Máy giặt", "local_laundry_service");
        requiredAmenities.put("Giờ giấc tự do", "schedule");

        int createdCount = 0;

        Optional<Amenity> oldParking = amenityRepository.findByName("Bãi đỗ xe");
        Optional<Amenity> newParking = amenityRepository.findByName("Chỗ để xe");
        if (oldParking.isPresent() && newParking.isEmpty()) {
            Amenity amenity = oldParking.get();
            amenity.setName("Chỗ để xe");
            amenity.setIcon("local_parking");
            amenityRepository.save(amenity);
        }

        for (Map.Entry<String, String> entry : requiredAmenities.entrySet()) {
            String name = entry.getKey();
            String icon = entry.getValue();
            if (amenityRepository.findByName(name).isEmpty()) {
                amenityRepository.save(Amenity.builder().name(name).icon(icon).build());
                createdCount++;
            }
        }

        if (createdCount > 0) {
            System.out.println(">> Đã thêm " + createdCount + " tiện ích còn thiếu để đồng bộ frontend/backend.");
        }
    }
}