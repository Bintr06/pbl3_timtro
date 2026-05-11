package com.pbl3.timtro.payment.controller;

import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.payment.dto.request.ApprovePurchaseRequest;
import com.pbl3.timtro.payment.dto.request.CreatePurchaseRequest;
import com.pbl3.timtro.payment.dto.request.RejectPurchaseRequest;
import com.pbl3.timtro.payment.dto.response.CreatePurchaseResponse;
import com.pbl3.timtro.payment.dto.response.TurnPackageResponse;
import com.pbl3.timtro.payment.dto.response.TurnPurchaseResponse;
import com.pbl3.timtro.payment.service.PaymentService;
import com.pbl3.timtro.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping("/packages")
    public ResponseEntity<ApiResponse<List<TurnPackageResponse>>> getPackages() {
        List<TurnPackageResponse> packages = paymentService.getAllPackages();
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", packages));
    }

    @PostMapping("/purchase")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<CreatePurchaseResponse>> createPurchase(
            @Valid @RequestBody CreatePurchaseRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            CreatePurchaseResponse response = paymentService.createPurchase(request, currentUser);
            return ResponseEntity.ok(new ApiResponse<>(200, "Tạo yêu cầu mua lượt thành công", response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ApiResponse<>(400, e.getMessage(), null));
        }
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<TurnPurchaseResponse>>> getPurchaseHistory(
            @AuthenticationPrincipal User currentUser
    ) {
        List<TurnPurchaseResponse> history = paymentService.getUserPurchaseHistory(currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", history));
    }

    @GetMapping("/history/paged")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<TurnPurchaseResponse>>> getPurchaseHistoryPaged(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<TurnPurchaseResponse> history = paymentService.getUserPurchaseHistoryPaged(currentUser, pageable);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", history));
    }

    // Admin endpoints
    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<TurnPurchaseResponse>>> getPendingPurchases(
            @RequestParam(defaultValue = "DESC") String sortOrder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Sort.Direction direction = Sort.Direction.fromString(sortOrder);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, "createdAt"));
        Page<TurnPurchaseResponse> pending = paymentService.getPendingPurchases(pageable);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", pending));
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<TurnPurchaseResponse>>> getAllPurchases(
            @RequestParam(defaultValue = "DESC") String sortOrder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Sort.Direction direction = Sort.Direction.fromString(sortOrder);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, "createdAt"));
        Page<TurnPurchaseResponse> all = paymentService.getAllPurchases(pageable);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", all));
    }

    @PostMapping("/admin/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<TurnPurchaseResponse>> approvePurchase(
            @Valid @RequestBody ApprovePurchaseRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            TurnPurchaseResponse response = paymentService.approvePurchase(request, currentUser);
            return ResponseEntity.ok(new ApiResponse<>(200, "Duyệt yêu cầu mua lượt thành công", response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ApiResponse<>(400, e.getMessage(), null));
        }
    }

    @PostMapping("/admin/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<TurnPurchaseResponse>> rejectPurchase(
            @Valid @RequestBody RejectPurchaseRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            TurnPurchaseResponse response = paymentService.rejectPurchase(request, currentUser);
            return ResponseEntity.ok(new ApiResponse<>(200, "Từ chối yêu cầu mua lượt thành công", response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ApiResponse<>(400, e.getMessage(), null));
        }
    }
}
