package com.pbl3.timtro.appointment.service;

import com.pbl3.timtro.appointment.dto.request.CreateAppointmentRequest;
import com.pbl3.timtro.appointment.dto.request.UpdateAppointmentStatusRequest;
import com.pbl3.timtro.appointment.dto.response.AppointmentResponse;
import com.pbl3.timtro.appointment.entity.Appointment;
import com.pbl3.timtro.appointment.enums.AppointmentStatus;
import com.pbl3.timtro.appointment.repository.AppointmentRepository;
import com.pbl3.timtro.room.entity.Room;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.pbl3.timtro.notification.service.NotificationService;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AppointmentService {
    private final AppointmentRepository appointmentRepository;
    private final RoomRepository roomRepository;
    private final NotificationService notificationService;

    @Transactional
    public AppointmentResponse createAppointment(CreateAppointmentRequest request, User tenant) {
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Room not found"));
        User landlord = room.getOwner();
        if (landlord == null) {
            throw new RuntimeException("Room owner not found");
        }
        if (tenant.getId().equals(landlord.getId())) {
            throw new RuntimeException("Cannot book your own room");
        }

        Appointment appointment = Appointment.builder()
                .room(room)
                .tenant(tenant)
                .landlord(landlord)
                .appointmentTime(request.getAppointmentDate())
                .note(request.getNote())
                .status(AppointmentStatus.PENDING)
                .build();

        Appointment saved = appointmentRepository.save(appointment);
        String titleForLandlord = "Lịch hẹn xem phòng mới";
        String contentForLandlord = "Bạn có yêu cầu đặt lịch xem phòng mới từ người dùng: " + appointment.getTenant().getUsername();

        notificationService.sendSystemNotificationToUser(landlord, titleForLandlord, contentForLandlord);
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getAppointmentsForTenant(User tenant) {
        return appointmentRepository.findByTenantIdOrderByCreatedAtDesc(tenant.getId()).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getAppointmentsForLandlord(User landlord) {
        return appointmentRepository.findByLandlordIdOrderByCreatedAtDesc(landlord.getId()).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public AppointmentResponse updateStatus(Long appointmentId, UpdateAppointmentStatusRequest request, User landlord) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (!appointment.getLandlord().getId().equals(landlord.getId())) {
            throw new RuntimeException("Not allowed to update this appointment");
        }

        AppointmentStatus status = request.getStatus();
        if (status == null) {
            throw new RuntimeException("Status is required");
        }

        appointment.setStatus(status);
        String reasonText = "";
        if (request.getStatus().toString().equals("REJECTED") && request.getReason() != null) {
            appointment.setRejectionReason(request.getReason());
            reasonText = " (Lý do: " + request.getReason() + ")";
        } else {
            appointment.setRejectionReason(null);
        }
        Appointment saved = appointmentRepository.save(appointment);

        String statusVietnamese = request.getStatus().toString().equals("APPROVED") ? "ĐÃ DUYỆT" : "BỊ TỪ CHỐI";
        String titleForTenant = "Kết quả đặt lịch xem phòng";
        String contentForTenant = "Yêu cầu đặt lịch xem phòng #" + appointment.getId() + " của bạn đã " + statusVietnamese;
        notificationService.sendSystemNotificationToUser(appointment.getTenant(), titleForTenant, contentForTenant);
        return mapToResponse(saved);
    }

    private AppointmentResponse mapToResponse(Appointment appointment) {
        return AppointmentResponse.builder()
                .id(appointment.getId())
                .roomId(appointment.getRoom().getId())
                .tenantId(appointment.getTenant().getId())
                .tenantUsername(appointment.getTenant().getUsername())
                .landlordId(appointment.getLandlord().getId())
                .appointmentTime(appointment.getAppointmentTime())
                .note(appointment.getNote())
                .status(appointment.getStatus())
                .createdAt(appointment.getCreatedAt())
                .build();
    }
}

