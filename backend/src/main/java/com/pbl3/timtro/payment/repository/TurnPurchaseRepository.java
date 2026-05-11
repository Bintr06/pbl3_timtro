package com.pbl3.timtro.payment.repository;

import com.pbl3.timtro.payment.entity.TurnPurchase;
import com.pbl3.timtro.payment.enums.PurchaseStatus;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TurnPurchaseRepository extends JpaRepository<TurnPurchase, Long> {
    List<TurnPurchase> findByUserOrderByCreatedAtDesc(User user);
    
    Page<TurnPurchase> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);
    
    Page<TurnPurchase> findByStatusOrderByCreatedAtDesc(PurchaseStatus status, Pageable pageable);

    Page<TurnPurchase> findByStatus(PurchaseStatus status, Pageable pageable);

        Page<TurnPurchase> findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
            PurchaseStatus status,
            LocalDateTime start,
            LocalDateTime end,
            Pageable pageable
        );
    
    Page<TurnPurchase> findAllByOrderByCreatedAtDesc(Pageable pageable);

        Page<TurnPurchase> findByCreatedAtBetweenOrderByCreatedAtDesc(
            LocalDateTime start,
            LocalDateTime end,
            Pageable pageable
        );
    
    Optional<TurnPurchase> findByTransferContent(String transferContent);
    
    List<TurnPurchase> findByStatus(PurchaseStatus status);
}
