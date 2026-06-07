package com.pbl3.timtro.appointment.dto.request;

import com.pbl3.timtro.appointment.enums.AppointmentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateAppointmentStatusRequest {
    @NotNull(message = "status is required")
    private AppointmentStatus status;
    private String reason;
}

