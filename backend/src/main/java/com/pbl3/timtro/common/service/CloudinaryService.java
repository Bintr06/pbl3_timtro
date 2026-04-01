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
                            "quality", "auto",     // Tự động nén ảnh mà không giảm chất lượng đáng kể
                            "fetch_format", "auto" // Tự động chuyển sang định dạng nhẹ như WebP nếu trình duyệt hỗ trợ
                    ));
            return uploadResult.get("secure_url").toString(); // Nên dùng secure_url (https) thay vì url (http)
        } catch (IOException e) {
            throw new RuntimeException("Upload ảnh thất bại: " + e.getMessage());
        }
    }
    public void deleteFile(String url) {
        if (url == null || url.isBlank()) {
            return;
        }

        // Only attempt delete for Cloudinary-hosted assets.
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