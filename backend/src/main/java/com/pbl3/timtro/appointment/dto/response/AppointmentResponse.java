package com.pbl3.timtro.appointment.dto.response;

import com.pbl3.timtro.appointment.enums.AppointmentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AppointmentResponse {
    private Long id;
    private Long roomId;
    private Long tenantId;
    private String tenantUsername;
    private Long landlordId;
    private LocalDateTime appointmentTime;
    private String note;
    private AppointmentStatus status;
    private LocalDateTime createdAt;
    private String rejectionReason;
}

