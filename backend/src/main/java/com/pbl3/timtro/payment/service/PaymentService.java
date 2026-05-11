package com.pbl3.timtro.payment.service;

import com.pbl3.timtro.payment.dto.request.ApprovePurchaseRequest;
import com.pbl3.timtro.payment.dto.request.CreatePurchaseRequest;
import com.pbl3.timtro.payment.dto.request.RejectPurchaseRequest;
import com.pbl3.timtro.payment.dto.response.CreatePurchaseResponse;
import com.pbl3.timtro.payment.dto.response.TurnPackageResponse;
import com.pbl3.timtro.payment.dto.response.TurnPurchaseResponse;
import com.pbl3.timtro.payment.entity.TurnPackage;
import com.pbl3.timtro.payment.entity.TurnPurchase;
import com.pbl3.timtro.payment.enums.PurchaseStatus;
import com.pbl3.timtro.payment.repository.TurnPackageRepository;
import com.pbl3.timtro.payment.repository.TurnPurchaseRepository;
import com.pbl3.timtro.notification.service.NotificationService;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {
    private final TurnPackageRepository turnPackageRepository;
    private final TurnPurchaseRepository turnPurchaseRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private static final ZoneId APP_ZONE_ID = ZoneId.of("Asia/Ho_Chi_Minh");
    private final String BANK_ACCOUNT = "525220082006";
    private final String BANK_NAME = "MB BANK";
    private final String ACCOUNT_NAME = "TRAN MANH QUYNH";

    public List<TurnPackageResponse> getAllPackages() {
        return turnPackageRepository.findByActiveTrueOrderByTurnsAsc()
                .stream()
                .map(this::convertToPackageResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CreatePurchaseResponse createPurchase(CreatePurchaseRequest request, User currentUser) {
        TurnPackage package_info = turnPackageRepository.findById(request.getPackageId())
                .orElseThrow(() -> new RuntimeException("Gói lượt không tồn tại"));

        if (!package_info.isActive()) {
            throw new RuntimeException("Gói lượt không khả dụng");
        }

        String transferContent = generateRandomTransferContent();
        
        // Đảm bảo transferContent là duy nhất
        while (turnPurchaseRepository.findByTransferContent(transferContent).isPresent()) {
            transferContent = generateRandomTransferContent();
        }

        TurnPurchase purchase = TurnPurchase.builder()
                .user(currentUser)
                .package_info(package_info)
                .turns(package_info.getTurns())
                .amount(package_info.getPrice())
                .transferContent(transferContent)
                .status(PurchaseStatus.PENDING)
                .build();

        turnPurchaseRepository.save(purchase);

        return CreatePurchaseResponse.builder()
                .purchaseId(purchase.getId())
                .turns(purchase.getTurns())
                .amount(purchase.getAmount())
                .transferContent(transferContent)
                .bankAccount(BANK_ACCOUNT)
                .bankName(BANK_NAME)
                .status(PurchaseStatus.PENDING)
                .createdAt(purchase.getCreatedAt())
                .build();
    }

    public List<TurnPurchaseResponse> getUserPurchaseHistory(User currentUser) {
        return turnPurchaseRepository.findByUserOrderByCreatedAtDesc(currentUser)
                .stream()
                .map(this::convertToPurchaseResponse)
                .collect(Collectors.toList());
    }

    public Page<TurnPurchaseResponse> getUserPurchaseHistoryPaged(User currentUser, Pageable pageable) {
        return turnPurchaseRepository.findByUserOrderByCreatedAtDesc(currentUser, pageable)
                .map(this::convertToPurchaseResponse);
    }

    public Page<TurnPurchaseResponse> getPendingPurchases(Pageable pageable) {
        return turnPurchaseRepository.findByStatus(PurchaseStatus.PENDING, pageable)
                .map(this::convertToPurchaseResponse);
    }

        public Page<TurnPurchaseResponse> getPendingPurchases(LocalDate fromDate, LocalDate toDate, Pageable pageable) {
        if (fromDate == null && toDate == null) {
            return getPendingPurchases(pageable);
        }

        LocalDateTime start = fromDate != null
            ? fromDate.atStartOfDay()
            : LocalDate.of(1970, 1, 1).atStartOfDay();
        LocalDateTime end = toDate != null
            ? toDate.plusDays(1).atStartOfDay()
            : LocalDateTime.now(APP_ZONE_ID).plusDays(1).withHour(0).withMinute(0).withSecond(0).withNano(0);

        return turnPurchaseRepository.findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
                PurchaseStatus.PENDING,
                start,
                end,
                pageable)
            .map(this::convertToPurchaseResponse);
        }

    public Page<TurnPurchaseResponse> getAllPurchases(Pageable pageable) {
        return turnPurchaseRepository.findAll(pageable)
                .map(this::convertToPurchaseResponse);
    }

        public Page<TurnPurchaseResponse> getAllPurchases(LocalDate fromDate, LocalDate toDate, Pageable pageable) {
        if (fromDate == null && toDate == null) {
            return getAllPurchases(pageable);
        }

        LocalDateTime start = fromDate != null
            ? fromDate.atStartOfDay()
            : LocalDate.of(1970, 1, 1).atStartOfDay();
        LocalDateTime end = toDate != null
            ? toDate.plusDays(1).atStartOfDay()
            : LocalDateTime.now(APP_ZONE_ID).plusDays(1).withHour(0).withMinute(0).withSecond(0).withNano(0);

        return turnPurchaseRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(start, end, pageable)
            .map(this::convertToPurchaseResponse);
        }

    @Transactional
    public TurnPurchaseResponse approvePurchase(ApprovePurchaseRequest request, User approverUser) {
        if (!"ADMIN".equals(approverUser.getRole().name())) {
            throw new RuntimeException("Chỉ admin có thể duyệt yêu cầu mua lượt");
        }

        TurnPurchase purchase = turnPurchaseRepository.findById(request.getPurchaseId())
                .orElseThrow(() -> new RuntimeException("Yêu cầu mua lượt không tồn tại"));

        if (purchase.getStatus() != PurchaseStatus.PENDING) {
            throw new RuntimeException("Chỉ có thể duyệt yêu cầu ở trạng thái PENDING");
        }

        purchase.setStatus(PurchaseStatus.APPROVED);
        purchase.setApprovedAt(LocalDateTime.now());
        purchase.setApprovedBy(approverUser);

        // Cộng lượt cho user
        User user = purchase.getUser();
        user.setPostCredits((user.getPostCredits() != null ? user.getPostCredits() : 0) + purchase.getTurns());
        userRepository.save(user);
        
        turnPurchaseRepository.save(purchase);

        return convertToPurchaseResponse(purchase);
    }

    @Transactional
    public TurnPurchaseResponse rejectPurchase(RejectPurchaseRequest request, User approverUser) {
        if (!"ADMIN".equals(approverUser.getRole().name())) {
            throw new RuntimeException("Chỉ admin có thể từ chối yêu cầu mua lượt");
        }

        TurnPurchase purchase = turnPurchaseRepository.findById(request.getPurchaseId())
                .orElseThrow(() -> new RuntimeException("Yêu cầu mua lượt không tồn tại"));

        if (purchase.getStatus() != PurchaseStatus.PENDING) {
            throw new RuntimeException("Chỉ có thể từ chối yêu cầu ở trạng thái PENDING");
        }

        purchase.setStatus(PurchaseStatus.REJECTED);
        String rejectionReason = request.getRejectionReason() == null ? "" : request.getRejectionReason().trim();
        if (rejectionReason.isBlank()) {
            throw new RuntimeException("Vui lòng nhập lý do từ chối yêu cầu mua lượt");
        }
        purchase.setRejectionReason(rejectionReason);
        purchase.setApprovedAt(LocalDateTime.now());
        purchase.setApprovedBy(approverUser);

        turnPurchaseRepository.save(purchase);

        String packageLabel = purchase.getPackage_info() != null
            ? purchase.getPackage_info().getTurns() + " lượt"
            : "đơn mua lượt";
        notificationService.sendSystemNotificationToUser(
            purchase.getUser(),
            "Yêu cầu mua lượt bị từ chối",
            "Yêu cầu mua " + packageLabel + " của bạn đã bị từ chối. Lý do: " + rejectionReason
        );

        return convertToPurchaseResponse(purchase);
    }

    private String generateRandomTransferContent() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private TurnPackageResponse convertToPackageResponse(TurnPackage turnPackage) {
        return new TurnPackageResponse(
                turnPackage.getId(),
                turnPackage.getTurns(),
                turnPackage.getPrice(),
                turnPackage.getDescription(),
                turnPackage.isActive()
        );
    }

    private TurnPurchaseResponse convertToPurchaseResponse(TurnPurchase purchase) {
        return TurnPurchaseResponse.builder()
                .id(purchase.getId())
                .userId(purchase.getUser().getId())
                .username(purchase.getUser().getUsername())
                .packageId(purchase.getPackage_info().getId())
                .turns(purchase.getTurns())
                .amount(purchase.getAmount())
                .transferContent(purchase.getTransferContent())
                .status(purchase.getStatus())
                .createdAt(purchase.getCreatedAt())
                .updatedAt(purchase.getUpdatedAt())
                .approvedAt(purchase.getApprovedAt())
                .approvedByUsername(purchase.getApprovedBy() != null ? purchase.getApprovedBy().getUsername() : null)
                .rejectionReason(purchase.getRejectionReason())
                .build();
    }
}
