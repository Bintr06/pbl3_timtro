package com.pbl3.timtro.admin.service;

import com.pbl3.timtro.admin.dto.DailyStatsDto;
import com.pbl3.timtro.admin.dto.OverviewStatsDto;
import com.pbl3.timtro.report.enums.UserReportStatus;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.report.repository.UserReportRepository;
import com.pbl3.timtro.user.repository.UserRepository;
import com.pbl3.timtro.userrating.repository.UserRatingRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AdminStatisticsService {
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final UserReportRepository userReportRepository;
    private final UserRatingRepository userRatingRepository;

    public AdminStatisticsService(
            UserRepository userRepository,
            RoomRepository roomRepository,
            UserReportRepository userReportRepository,
            UserRatingRepository userRatingRepository) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.userReportRepository = userReportRepository;
        this.userRatingRepository = userRatingRepository;
    }

    public OverviewStatsDto getOverviewStats() {
        OverviewStatsDto dto = new OverviewStatsDto();

        dto.setTotalUsers(userRepository.count());

        dto.setAvailableRooms(
                roomRepository.findAllByStatus(RoomStatus.AVAILABLE).size());

        long pendingCount = userReportRepository.countByStatus(UserReportStatus.PENDING);
        dto.setPendingReports(pendingCount);

        Double avgRating = userRatingRepository.getAverageRating();
        dto.setAverageRating(avgRating != null ? avgRating : 0.0);

        dto.setNewUsersByDay(getNewUsersByDay(7));

        dto.setNewRoomsByDay(getNewRoomsByDay(7));

        return dto;
    }

    private List<DailyStatsDto> getNewUsersByDay(int days) {
        List<DailyStatsDto> result = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        for (int i = days - 1; i >= 0; i--) {
            LocalDateTime endOfDay = LocalDateTime.now().minusDays(i).withHour(23).withMinute(59).withSecond(59);
            LocalDateTime startOfDay = endOfDay.withHour(0).withMinute(0).withSecond(0);

            long count = userRepository.countByCreatedAtBetween(startOfDay, endOfDay);
            result.add(new DailyStatsDto(startOfDay.toLocalDate().format(formatter), count));
        }

        return result;
    }

    private List<DailyStatsDto> getNewRoomsByDay(int days) {
        List<DailyStatsDto> result = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        for (int i = days - 1; i >= 0; i--) {
            LocalDateTime endOfDay = LocalDateTime.now().minusDays(i).withHour(23).withMinute(59).withSecond(59);
            LocalDateTime startOfDay = endOfDay.withHour(0).withMinute(0).withSecond(0);

            long count = roomRepository.countByCreatedAtBetween(startOfDay, endOfDay);
            result.add(new DailyStatsDto(startOfDay.toLocalDate().format(formatter), count));
        }

        return result;
    }
}
