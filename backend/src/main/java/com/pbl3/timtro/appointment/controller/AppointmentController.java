package com.pbl3.timtro.appointment.controller;

import com.pbl3.timtro.appointment.dto.request.CreateAppointmentRequest;
import com.pbl3.timtro.appointment.dto.request.UpdateAppointmentStatusRequest;
import com.pbl3.timtro.appointment.dto.response.AppointmentResponse;
import com.pbl3.timtro.appointment.service.AppointmentService;
import com.pbl3.timtro.common.dto.ApiResponse;
import com.pbl3.timtro.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController {
    private final AppointmentService appointmentService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AppointmentResponse>> createAppointment(
            @Valid @RequestBody CreateAppointmentRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        AppointmentResponse response = appointmentService.createAppointment(request, currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Appointment created", response));
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<AppointmentResponse>>> getMyAppointments(
            @AuthenticationPrincipal User currentUser
    ) {
        List<AppointmentResponse> responses = appointmentService.getAppointmentsForTenant(currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", responses));
    }

    @GetMapping("/landlord")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<AppointmentResponse>>> getLandlordAppointments(
            @AuthenticationPrincipal User currentUser
    ) {
        List<AppointmentResponse> responses = appointmentService.getAppointmentsForLandlord(currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Success", responses));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AppointmentResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAppointmentStatusRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        AppointmentResponse response = appointmentService.updateStatus(id, request, currentUser);
        return ResponseEntity.ok(new ApiResponse<>(200, "Status updated", response));
    }
}

