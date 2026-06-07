package com.pbl3.timtro.payment.repository;

import com.pbl3.timtro.payment.entity.TurnPurchase;
import com.pbl3.timtro.payment.enums.PurchaseStatus;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TurnPurchaseRepository extends JpaRepository<TurnPurchase, Long> {

    // --- Các hàm nghiệp vụ ---
    Optional<TurnPurchase> findByTransferContent(String transferContent);

    List<TurnPurchase> findByUserOrderByCreatedAtDesc(User user);

    Page<TurnPurchase> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);

    Page<TurnPurchase> findByStatus(PurchaseStatus status, Pageable pageable);

    Page<TurnPurchase> findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
            PurchaseStatus status,
            LocalDateTime start,
            LocalDateTime end,
            Pageable pageable
    );

    Page<TurnPurchase> findByCreatedAtBetweenOrderByCreatedAtDesc(
            LocalDateTime start,
            LocalDateTime end,
            Pageable pageable
    );

    long countByStatus(PurchaseStatus status);

    @Query("SELECT SUM(p.amount) FROM TurnPurchase p WHERE p.status = :status")
    Double sumAmountByStatus(@Param("status") PurchaseStatus status);

    @Query("SELECT FUNCTION('DATE', p.createdAt), COUNT(p) FROM TurnPurchase p " +
            "WHERE p.status = 'APPROVED' AND p.createdAt BETWEEN :from AND :to " +
            "GROUP BY FUNCTION('DATE', p.createdAt)")
    List<Object[]> countPurchasesGroupedByDate(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}