package com.pbl3.timtro.report.service;

import com.pbl3.timtro.chat.repository.ChatMessageRepository;
import com.pbl3.timtro.common.service.CloudinaryService;
import com.pbl3.timtro.notification.service.NotificationService;
import com.pbl3.timtro.report.dto.response.UserReportResponse;
import com.pbl3.timtro.report.entity.UserReport;
import com.pbl3.timtro.report.enums.UserReportStatus;
import com.pbl3.timtro.report.repository.UserReportRepository;
import com.pbl3.timtro.user.entity.User;
import com.pbl3.timtro.user.enums.Role;
import com.pbl3.timtro.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserReportService {

    private static final int MIN_DESCRIPTION_LENGTH = 30;
    private static final int MAX_REPORTS_PER_DAY = 5;
    private static final int DUPLICATE_COOLDOWN_HOURS = 12;

    private final UserReportRepository userReportRepository;
    private final UserRepository userRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final CloudinaryService cloudinaryService;
    private final NotificationService notificationService;

    @Transactional
    public void createUserReport(User reporter, Long reportedUserId, String description, MultipartFile image) {
        if (reporter == null || reporter.getId() == null) {
            throw new RuntimeException("Bạn cần đăng nhập để gửi tố cáo.");
        }

        if (reportedUserId == null) {
            throw new RuntimeException("Người dùng bị tố cáo không hợp lệ.");
        }

        if (reporter.getId().equals(reportedUserId)) {
            throw new RuntimeException("Bạn không thể tố cáo chính mình.");
        }

        User reportedUser = userRepository.findById(reportedUserId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng bị tố cáo."));

        String normalizedDescription = description == null ? "" : description.trim();
        if (normalizedDescription.isEmpty()) {
            throw new RuntimeException("Vui lòng nhập mô tả tố cáo.");
        }
        if (normalizedDescription.length() < MIN_DESCRIPTION_LENGTH) {
            throw new RuntimeException("Mô tả tố cáo phải có ít nhất 30 ký tự.");
        }

        boolean hasConversation = chatMessageRepository.existsConversationBetweenUsers(reporter.getId(), reportedUserId);
        if (!hasConversation) {
            throw new RuntimeException("Bạn chỉ có thể tố cáo người dùng đã từng nhắn tin với mình.");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime sameTargetCooldownFrom = now.minusHours(DUPLICATE_COOLDOWN_HOURS);
        boolean isDuplicateInCooldown = userReportRepository
                .existsByReporterAndReportedUserAndCreatedAtAfter(reporter, reportedUser, sameTargetCooldownFrom);
        if (isDuplicateInCooldown) {
            throw new RuntimeException("Bạn đã gửi tố cáo người dùng này gần đây. Vui lòng thử lại sau 12 giờ.");
        }

        LocalDateTime dailyWindowFrom = now.minusDays(1);
        long reportsInLast24Hours = userReportRepository.countByReporterAndCreatedAtAfter(reporter, dailyWindowFrom);
        if (reportsInLast24Hours >= MAX_REPORTS_PER_DAY) {
            throw new RuntimeException("Bạn đã đạt giới hạn 5 lần tố cáo trong 24 giờ qua.");
        }

        String evidenceImageUrl = null;
        if (image != null && !image.isEmpty()) {
            evidenceImageUrl = cloudinaryService.uploadFile(image, "user-reports");
        }

        UserReport report = UserReport.builder()
                .reporter(reporter)
                .reportedUser(reportedUser)
                .description(normalizedDescription)
                .evidenceImageUrl(evidenceImageUrl)
                .status(UserReportStatus.PENDING)
                .build();

        userReportRepository.save(report);
    }

    @Transactional(readOnly = true)
    public List<UserReportResponse> getAllReportsForAdmin(User admin) {
        if (admin == null || admin.getRole() != Role.ADMIN) {
            throw new RuntimeException("Bạn không có quyền xem danh sách tố cáo.");
        }

        return userReportRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public void updateReportStatus(User admin, Long reportId, String status) {
        if (admin == null || admin.getRole() != Role.ADMIN) {
            throw new RuntimeException("Bạn không có quyền cập nhật tố cáo.");
        }

        if (reportId == null) {
            throw new RuntimeException("Mã tố cáo không hợp lệ.");
        }

        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        UserReportStatus nextStatus;
        try {
            nextStatus = UserReportStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("Trạng thái tố cáo không hợp lệ.");
        }

        UserReport report = userReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tố cáo."));

        UserReportStatus previousStatus = report.getStatus();
        report.setStatus(nextStatus);
        userReportRepository.save(report);

        if (previousStatus != nextStatus && (nextStatus == UserReportStatus.RESOLVED || nextStatus == UserReportStatus.REJECTED)) {
            String title = "Cap nhat xu ly bao cao";
            String content = nextStatus == UserReportStatus.RESOLVED
                    ? "Bao cao #" + report.getId() + " da duoc admin tiep nhan va xu ly." 
                    : "Bao cao #" + report.getId() + " da bi tu choi xu ly.";
            notificationService.sendSystemNotificationToUser(report.getReporter(), title, content);
        }
    }

    private UserReportResponse mapToResponse(UserReport report) {
        String reporterName = report.getReporter().getDisplayName();
        if (reporterName == null || reporterName.isBlank()) {
            reporterName = report.getReporter().getUsername();
        }

        String reportedName = report.getReportedUser().getDisplayName();
        if (reportedName == null || reportedName.isBlank()) {
            reportedName = report.getReportedUser().getUsername();
        }

        return UserReportResponse.builder()
                .id(report.getId())
                .reporterId(report.getReporter().getId())
                .reporterName(reporterName)
                .reporterUsername(report.getReporter().getUsername())
                .reportedUserId(report.getReportedUser().getId())
                .reportedUserName(reportedName)
                .reportedUserUsername(report.getReportedUser().getUsername())
                .description(report.getDescription())
                .evidenceImageUrl(report.getEvidenceImageUrl())
                .status(report.getStatus().name())
                .createdAt(report.getCreatedAt())
                .build();
    }
}
