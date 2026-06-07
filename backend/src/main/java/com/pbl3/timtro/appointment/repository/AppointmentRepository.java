package com.pbl3.timtro.appointment.repository;

import com.pbl3.timtro.appointment.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    List<Appointment> findByTenantIdOrderByCreatedAtDesc(Long tenantId);

    List<Appointment> findByLandlordIdOrderByCreatedAtDesc(Long landlordId);
}

