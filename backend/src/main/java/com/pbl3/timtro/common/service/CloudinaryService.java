package com.pbl3.timtro.common.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CloudinaryService {
    private final Cloudinary cloudinary;
    public String uploadFile(MultipartFile file, String folderName) {
        try {
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", "pbl3_timtro/" + folderName,
                            "resource_type", "auto",
                            "quality", "auto",
                            "fetch_format", "auto"
                    ));
                    return uploadResult.get("secure_url").toString();
        } catch (IOException e) {
            throw new RuntimeException("Upload ảnh thất bại: " + e.getMessage());
        }
    }
    public void deleteFile(String url) {
        if (url == null || url.isBlank()) {
            return;
        }

<<<<<<< HEAD
        // Only attempt delete for Cloudinary-hosted assets.
=======
>>>>>>> chore/deploy-readiness-2026-04-01
        if (!url.contains("res.cloudinary.com")) {
            return;
        }

        try {
            String searchKey = "/upload/";
            int keyIndex = url.indexOf(searchKey);
            if (keyIndex < 0) {
                return;
            }

            int startIndex = keyIndex + searchKey.length();
            String remainingUrl = url.substring(startIndex);
            if (remainingUrl.startsWith("v") && remainingUrl.contains("/")) {
                remainingUrl = remainingUrl.substring(remainingUrl.indexOf("/") + 1);
            }

            int lastDot = remainingUrl.lastIndexOf(".");
            if (lastDot < 0) {
                return;
            }

            String publicId = remainingUrl.substring(0, lastDot);
            cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
        } catch (Exception e) {
            log.warn("Không thể xóa ảnh Cloudinary '{}': {}", url, e.getMessage());
        }
    }
}