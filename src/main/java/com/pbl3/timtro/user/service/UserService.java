package com.pbl3.timtro.user.service;

import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;
    public String updateAvatar(Long userId, MultipartFile file){
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        String url = cloudinaryService.uploadFile(file,"avatars");
        user.setAvatarUrl(url);
        userRepository.save(user);
        return url;
    }
}
