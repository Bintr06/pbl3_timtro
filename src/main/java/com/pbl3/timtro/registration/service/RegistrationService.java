package com.pbl3.timtro.registration.service;

import com.pbl3.timtro.registration.dto.request.RegistrationRequest;
import com.pbl3.timtro.registration.dto.response.RegistrationResponse;
import com.pbl3.timtro.registration.dto.response.RegistrationStatsResponse;
import com.pbl3.timtro.registration.entity.OwnerRegistration;
import com.pbl3.timtro.registration.enums.RegistrationStatus;
import com.pbl3.timtro.registration.repository.RegistrationRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import com.pbl3.timtro.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RegistrationService {
    private final RegistrationRepository registrationRepository;
    private final UserRepository userRepository;

    @Transactional
    public void createRegistration(RegistrationRequest request, User user) {
        if (user.getRole() == Role.OWNER) {
            throw new RuntimeException("Bạn đã là chủ trọ rồi!");
        }
        Optional<OwnerRegistration> oldRegOpt = registrationRepository.findByUser(user);
        if (oldRegOpt.isPresent()) {
            OwnerRegistration reg = oldRegOpt.get();
            if (reg.getStatus() == RegistrationStatus.PENDING) {
                throw new RuntimeException("Yêu cầu của bạn đang được xử lý, vui lòng chờ!");
            }
            reg.setFullName(request.getFullName());
            reg.setIdCardNumber(request.getIdCardNumber());
            reg.setPhoneNumber(request.getPhoneNumber());
            reg.setAddress(request.getAddress());
            reg.setStatus(RegistrationStatus.PENDING);
            reg.setRejectReason(null);
            reg.setUpdatedAt(LocalDateTime.now());

            registrationRepository.save(reg);
        } else {
            OwnerRegistration newReg = OwnerRegistration.builder()
                    .user(user)
                    .fullName(request.getFullName())
                    .idCardNumber(request.getIdCardNumber())
                    .phoneNumber(request.getPhoneNumber())
                    .address(request.getAddress())
                    .status(RegistrationStatus.PENDING)
                    .createdAt(LocalDateTime.now())
                    .build();
            registrationRepository.save(newReg);
        }
    }

    @Transactional
    public void approveRegistration(Long regId) {
        OwnerRegistration reg = registrationRepository.findById(regId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu!"));
        if (reg.getStatus() != RegistrationStatus.PENDING) {
            throw new RuntimeException("Đơn đăng ký này đã được xử lý trước đó!");
        }

        reg.setStatus(RegistrationStatus.APPROVED);

        User user = reg.getUser();
        user.setRole(Role.OWNER);

        userRepository.save(user);
        registrationRepository.save(reg);
    }
    @Transactional
    public void rejectRegistration(Long regId, String reason) {
        OwnerRegistration reg = registrationRepository.findById(regId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu!"));

        if (reg.getStatus() != RegistrationStatus.PENDING) {
            throw new RuntimeException("Chỉ có thể từ chối các yêu cầu đang chờ xử lý!");
        }

        reg.setStatus(RegistrationStatus.REJECTED);
        reg.setRejectReason(reason);
        reg.setUpdatedAt(LocalDateTime.now());

        registrationRepository.save(reg);
    }
    public RegistrationResponse getRegistrationDetail(Long id) {
        OwnerRegistration reg = registrationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn đăng ký!"));
        return mapToResponse(reg); // Trả về DTO đã được lọc thông tin
    }
    public List<RegistrationResponse> getPendingRegistrations() {
        List<OwnerRegistration> entities = registrationRepository.findAllByStatusOrderByCreatedAtDesc(RegistrationStatus.PENDING);

        return entities.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // Đảm bảo bạn đã có hàm helper này ở phía dưới trong RegistrationService
    private RegistrationResponse mapToResponse(OwnerRegistration reg) {
        return RegistrationResponse.builder()
                .id(reg.getId())
                .userId(reg.getUser().getId())
                .userEmail(reg.getUser().getEmail())
                .fullName(reg.getFullName())
                .idCardNumber(reg.getIdCardNumber())
                .phoneNumber(reg.getPhoneNumber())
                .address(reg.getAddress())
                .status(reg.getStatus().name())
                .rejectReason(reg.getRejectReason())
                .createdAt(reg.getCreatedAt())
                .build();
    }
    public RegistrationResponse getMyRegistration(User user) {
        return registrationRepository.findByUser(user)
                .map(this::mapToResponse)
                .orElse(null);
    }
    public RegistrationStatsResponse getStats() {
        return RegistrationStatsResponse.builder()
                .totalPending(registrationRepository.countByStatus(RegistrationStatus.PENDING))
                .totalApproved(registrationRepository.countByStatus(RegistrationStatus.APPROVED))
                .totalRejected(registrationRepository.countByStatus(RegistrationStatus.REJECTED))
                .totalRegistrations(registrationRepository.count())
                .build();
    }
    public List<RegistrationResponse> getRegistrations(RegistrationStatus status) {
        List<OwnerRegistration> list;

        if (status != null) {
            list = registrationRepository.findAllByStatusOrderByCreatedAtDesc(status);
        } else {
            list = registrationRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        return list.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
}