package com.pbl3.timtro.user.entity;
import com.pbl3.timtro.user.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true,nullable = false,length = 50)
    private  String username;

    @Column(nullable = false)
    private String hashedPassword;

    private String displayName;

    @Column(unique = true, nullable = false)
    private String email;

    private String avatarUrl;

    private String bio;

    @Column(length = 10)
    private String phone;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Enumerated(EnumType.STRING)
    private Role role;
    @Builder.Default
    @Column(nullable = false)
    private boolean enabled = true;
    @Builder.Default
    private boolean isPendingOwner = false;
}
