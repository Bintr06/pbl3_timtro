package com.pbl3.timtro.user.service;

import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.user.dto.request.UserUpdateRequest;
import com.pbl3.timtro.user.dto.response.UserResponse;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;
    @Transactional
    public String updateAvatar(User currentUser, MultipartFile file){
        String url = cloudinaryService.uploadFile(file, "avatars");
        currentUser.setAvatarUrl(url);
        userRepository.save(currentUser);
        return url;
    }
    @Transactional
    public UserResponse updateProfile(User currentUser, UserUpdateRequest request) {
        if (request.getDisplayName() != null) currentUser.setDisplayName(request.getDisplayName());
        if (request.getPhone() != null) currentUser.setPhone(request.getPhone());
        if (request.getEmail() != null) currentUser.setEmail(request.getEmail());
        if (request.getBio() != null) currentUser.setBio(request.getBio());

        User savedUser = userRepository.save(currentUser);
        return mapToResponse(savedUser);
    }

    public UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
