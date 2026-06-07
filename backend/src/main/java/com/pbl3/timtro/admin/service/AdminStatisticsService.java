package com.pbl3.timtro.admin.service;

import com.pbl3.timtro.admin.dto.DailyStatsDto;
import com.pbl3.timtro.admin.dto.OverviewStatsDto;
import com.pbl3.timtro.report.enums.UserReportStatus;
import com.pbl3.timtro.room.repository.RoomRepository;
import com.pbl3.timtro.room.enums.RoomStatus;
import com.pbl3.timtro.report.repository.UserReportRepository;
import com.pbl3.timtro.payment.repository.TurnPurchaseRepository; // Import thêm repo mua lượt
import com.pbl3.timtro.payment.enums.PurchaseStatus;
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
    private final TurnPurchaseRepository turnPurchaseRepository; // Khai báo thêm

    // Cập nhật Constructor để tiêm TurnPurchaseRepository
    public AdminStatisticsService(
            UserRepository userRepository,
            RoomRepository roomRepository,
            UserReportRepository userReportRepository,
            UserRatingRepository userRatingRepository,
            TurnPurchaseRepository turnPurchaseRepository) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.userReportRepository = userReportRepository;
        this.userRatingRepository = userRatingRepository;
        this.turnPurchaseRepository = turnPurchaseRepository;
    }

    public OverviewStatsDto getOverviewStats() {
        long totalUsers = userRepository.count();
        long availableRooms = roomRepository.countByStatus(RoomStatus.AVAILABLE);
        long pendingReports = userReportRepository.countByStatus(UserReportStatus.PENDING);
        Double avgRating = userRatingRepository.getAverageRatingAllLandlords();
        double averageRating = (avgRating != null) ? Math.round(avgRating * 10.0) / 10.0 : 0.0;

        // 1. Tính toán các thông số mua lượt cước phí mới
        long totalPurchases = turnPurchaseRepository.countByStatus(PurchaseStatus.APPROVED);
        Double totalRevRaw = turnPurchaseRepository.sumAmountByStatus(PurchaseStatus.APPROVED);
        double totalRevenue = (totalRevRaw != null) ? totalRevRaw : 0.0;

        // 2. Lấy danh sách thống kê 7 ngày gần nhất
        List<DailyStatsDto> newUsersByDay = getNewUsersByDay(7);
        List<DailyStatsDto> newRoomsByDay = getNewRoomsByDay(7);
        List<DailyStatsDto> newPurchasesByDay = getNewPurchasesByDay(7); // Hàm mới cho lượt mua

        // 3. Đóng gói toàn bộ vào DTO trả về cho Controller
        return new OverviewStatsDto(
                totalUsers,
                availableRooms,
                pendingReports,
                averageRating,
                totalPurchases,
                totalRevenue,
                newPurchasesByDay,
                newUsersByDay,
                newRoomsByDay
        );
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

    // --- HÀM MỚI: Thống kê số lượng đơn thanh toán thành công theo ngày ---
    private List<DailyStatsDto> getNewPurchasesByDay(int days) {
        LocalDate today = LocalDate.now();
        LocalDateTime fromDateTime = today.minusDays(days - 1L).atStartOfDay();
        LocalDateTime toDateTime = today.plusDays(1L).atStartOfDay();
        List<Object[]> rows = turnPurchaseRepository.countPurchasesGroupedByDate(fromDateTime, toDateTime);
        return toDailyStats(days, today, rows);
    }

    private List<DailyStatsDto> toDailyStats(int days, LocalDate today, List<Object[]> rows) {
        List<DailyStatsDto> result = new ArrayList<>();
        Map<LocalDate, Long> countsByDate = new HashMap<>();

        for (Object[] row : rows) {
            if (row[0] == null) continue;
            Object dayRaw = row[0];
            LocalDate date;
            if (dayRaw instanceof java.sql.Date sqlDate) {
                date = sqlDate.toLocalDate();
            } else if (dayRaw instanceof java.time.LocalDate localDate) {
                date = localDate;
            } else {
                date = LocalDate.parse(String.valueOf(dayRaw).substring(0, 10));
            }
            long count = ((Number) row[1]).longValue();
            countsByDate.put(date, count);
        }

        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long count = countsByDate.getOrDefault(day, 0L);
            result.add(new DailyStatsDto(day.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")), count));
        }
        return result;
    }
}