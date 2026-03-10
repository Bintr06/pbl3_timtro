package com.pbl3.timtro.registration.entity;

import com.pbl3.timtro.registration.enums.RegistrationStatus;
import com.pbl3.timtro.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data @Builder
@NoArgsConstructor @AllArgsConstructor
public class OwnerRegistration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    private String fullName;
    private String idCardNumber; // Số CCCD
    private String phoneNumber;
    private String address;

    @Enumerated(EnumType.STRING)
    private RegistrationStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String rejectReason;
}
