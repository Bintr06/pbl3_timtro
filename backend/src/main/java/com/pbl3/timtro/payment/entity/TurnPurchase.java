package com.pbl3.timtro.payment.entity;

import com.pbl3.timtro.payment.enums.PurchaseStatus;
import com.pbl3.timtro.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "turn_purchases")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TurnPurchase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_id", nullable = false)
    private TurnPackage package_info;

    @Column(nullable = false)
    private Integer turns;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false, unique = true, length = 6)
    private String transferContent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PurchaseStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;
}
