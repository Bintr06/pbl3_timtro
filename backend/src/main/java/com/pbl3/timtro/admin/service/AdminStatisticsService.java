package com.pbl3.timtro.admin.service;

import com.pbl3.timtro.admin.dto.DailyStatsDto;
import com.pbl3.timtro.admin.dto.OverviewStatsDto;
import com.pbl3.timtro.report.enums.UserReportStatus;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.report.repository.UserReportRepository;
import com.pbl3.timtro.user.repository.UserRepository;
import com.pbl3.timtro.userrating.repository.UserRatingRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

        dto.setAvailableRooms(roomRepository.countByStatus(RoomStatus.AVAILABLE));

        long pendingCount = userReportRepository.countByStatus(UserReportStatus.PENDING);
        dto.setPendingReports(pendingCount);

        Double avgRating = userRatingRepository.getAverageRating();
        dto.setAverageRating(avgRating != null ? avgRating : 0.0);

        dto.setNewUsersByDay(getNewUsersByDay(7));

        dto.setNewRoomsByDay(getNewRoomsByDay(7));

        return dto;
    }

    private List<DailyStatsDto> getNewUsersByDay(int days) {
        LocalDate today = LocalDate.now();
        LocalDateTime fromDateTime = today.minusDays(days - 1L).atStartOfDay();
        LocalDateTime toDateTime = today.plusDays(1L).atStartOfDay();
        List<Object[]> rows = userRepository.countUsersGroupedByDate(fromDateTime, toDateTime);
        return toDailyStats(days, today, rows);
    }

    private List<DailyStatsDto> getNewRoomsByDay(int days) {
        LocalDate today = LocalDate.now();
        LocalDateTime fromDateTime = today.minusDays(days - 1L).atStartOfDay();
        LocalDateTime toDateTime = today.plusDays(1L).atStartOfDay();
        List<Object[]> rows = roomRepository.countRoomsGroupedByDate(fromDateTime, toDateTime);
        return toDailyStats(days, today, rows);
    }

    private List<DailyStatsDto> toDailyStats(int days, LocalDate today, List<Object[]> rows) {
        List<DailyStatsDto> result = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<LocalDate, Long> countsByDate = new HashMap<>();

        for (Object[] row : rows) {
            Object dayRaw = row[0];
            LocalDate date;
            if (dayRaw instanceof java.sql.Date sqlDate) {
                date = sqlDate.toLocalDate();
            } else {
                date = LocalDate.parse(String.valueOf(dayRaw));
            }
            long count = ((Number) row[1]).longValue();
            countsByDate.put(date, count);
        }

        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long count = countsByDate.getOrDefault(day, 0L);
            result.add(new DailyStatsDto(day.format(formatter), count));
        }

        return result;
    }
}
