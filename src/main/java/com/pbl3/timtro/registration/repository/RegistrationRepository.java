package com.pbl3.timtro.registration.repository;

import com.pbl3.timtro.registration.entity.OwnerRegistration;
import com.pbl3.timtro.registration.enums.RegistrationStatus;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RegistrationRepository extends JpaRepository<OwnerRegistration, Long> {
    Optional<OwnerRegistration> findByUser(User user);
    List<OwnerRegistration> findAllByStatus(RegistrationStatus status);
    boolean existsByUserAndStatus(User user, RegistrationStatus status);
    List<OwnerRegistration> findAllByStatusOrderByCreatedAtDesc(RegistrationStatus status);
    long countByStatus(RegistrationStatus status);

}