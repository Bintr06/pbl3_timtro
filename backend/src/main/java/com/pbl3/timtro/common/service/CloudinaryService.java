package com.pbl3.timtro.common.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
@RequiredArgsConstructor
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
        try {
            String searchKey = "/upload/";
            int startIndex = url.indexOf(searchKey) + searchKey.length();
            String remainingUrl = url.substring(startIndex);
            if (remainingUrl.startsWith("v")) {
                remainingUrl = remainingUrl.substring(remainingUrl.indexOf("/") + 1);
            }
            String publicId = remainingUrl.substring(0, remainingUrl.lastIndexOf("."));
            cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
        } catch (IOException e) {
            throw new RuntimeException("Xóa ảnh trên Cloudinary thất bại: " + e.getMessage());
        }
    }
}