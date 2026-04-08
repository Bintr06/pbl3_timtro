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

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;
    @Transactional
    public String updateAvatar(User currentUser, MultipartFile file){
        String oldAvatarUrl = currentUser.getAvatarUrl();
        String url = cloudinaryService.uploadFile(file, "avatars");
        currentUser.setAvatarUrl(url);
        userRepository.save(currentUser);
        if (oldAvatarUrl != null && !oldAvatarUrl.isBlank() && !oldAvatarUrl.equals(url)) {
            cloudinaryService.deleteFile(oldAvatarUrl);
        }

        return url;
    }
    @Transactional
    public UserResponse updateProfile(User currentUser, UserUpdateRequest request) {
        if (request.getDisplayName() != null) currentUser.setDisplayName(request.getDisplayName().trim());
        if (request.getPhone() != null) currentUser.setPhone(request.getPhone());
        if (request.getEmail() != null) {
            String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
            if (!normalizedEmail.equalsIgnoreCase(currentUser.getEmail())
                    && userRepository.existsByEmailIgnoreCaseAndIdNot(normalizedEmail, currentUser.getId())) {
                throw new RuntimeException("Email đã được sử dụng!");
            }
            currentUser.setEmail(normalizedEmail);
        }
        if (request.getBio() != null) currentUser.setBio(request.getBio());
        if (request.getAddress() != null) currentUser.setAddress(request.getAddress());
        if (request.getNickname() != null) currentUser.setNickname(request.getNickname());
        if (request.getFacebook() != null) currentUser.setFacebook(request.getFacebook());
        if (request.getInstagram() != null) currentUser.setInstagram(request.getInstagram());
        if (request.getLinkedin() != null) currentUser.setLinkedin(request.getLinkedin());

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
                .address(user.getAddress())
                .nickname(user.getNickname())
                .facebook(user.getFacebook())
                .instagram(user.getInstagram())
                .linkedin(user.getLinkedin())
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .build();
    }
    public UserResponse getProfileById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));
        return mapToResponse(user);
    }
}
