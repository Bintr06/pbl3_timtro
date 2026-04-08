package com.pbl3.timtro.report.repository;

import com.pbl3.timtro.report.entity.UserReport;
import com.pbl3.timtro.report.enums.UserReportStatus;
import com.pbl3.timtro.user.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface UserReportRepository extends JpaRepository<UserReport, Long> {

    @EntityGraph(attributePaths = {"reporter", "reportedUser"})
    List<UserReport> findAllByOrderByCreatedAtDesc();

    boolean existsByReporterAndReportedUserAndCreatedAtAfter(User reporter, User reportedUser, LocalDateTime after);

    long countByReporterAndCreatedAtAfter(User reporter, LocalDateTime after);

    long countByStatus(UserReportStatus status);

    long countByReportedUser(User reportedUser);
}
