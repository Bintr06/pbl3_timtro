import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { del, get, post, put } from '../apiClient';
import PurchaseManagementTab from '../components/PurchaseManagementTab';

type Room = {
  id: number;
  title: string;
  price: number;
  createdAt?: string;
  province?: string | null;
  status?: string | null;
  ownerName?: string | null;
  amenities?: string[];
  amenityNames?: string[];
  favorite?: boolean;
  isFavorite?: boolean;
  imageUrls?: string[];
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

type UserReportItem = {
  id: number;
  reporterId: number;
  reporterName: string;
  reporterUsername: string;
  reportedUserId: number;
  reportedUserName: string;
  reportedUserUsername: string;
  description: string;
  evidenceImageUrl?: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
};

type AdminProfile = {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type DailyStats = {
  date: string;
  count: number;
};

type OverviewStats = {
  totalUsers: number;
  availableRooms: number;
  pendingReports: number;
  averageRating: number;
  newUsersByDay: DailyStats[];
  newRoomsByDay: DailyStats[];
};

type RatingItem = {
  id: number;
  raterId: number;
  rater: {
    id: number;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  ratedUserId: number;
  ratedUser: {
    id: number;
    username: string;
    displayName?: string | null;
  };
  stars: number;
  comment: string;
  imageUrl?: string | null;
  createdAt: string;
};

type LowRatedUser = {
  userId: number;
  username: string;
  displayName: string;
  avgRating: number;
  ratingCount: number;
};

type LowRatedUserRow = [number, string, string, number | string, number | string];

type NotificationUserOption = {
  id: number;
  username: string;
  displayName?: string | null;
};

type RoomDeletePayload = {
  reason?: string;
  notifyOwner?: boolean;
};

type AdminUser = {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  email: string;
  phone?: string | null;
  role?: string | { name?: string; value?: string } | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  reportCount: number;
  averageRating?: number | null;
};

type StatsRange = 7 | 30 | 90;

const sectionItems = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'accounts', label: 'Quản lí người dùng', icon: '👤' },
  { key: 'rooms', label: 'Quản lí tin đăng', icon: '🏠' },
  { key: 'purchases', label: 'Quản lí mua lượt', icon: '💳' },
  { key: 'notifications', label: 'Thông báo', icon: '📣' },
  { key: 'reports', label: 'Báo cáo vi phạm', icon: '🚩' },
  { key: 'ratings', label: 'Quản lý đánh giá', icon: '⭐' },
  { key: 'stats', label: 'Thống kê', icon: '📈' },
] as const;

const extractRoleText = (role: AdminUser['role']) => {
  if (typeof role === 'string') {
    return role;
  }
  if (role && typeof role === 'object') {
    if (typeof role.name === 'string') {
      return role.name;
    }
    if (typeof role.value === 'string') {
      return role.value;
    }
  }
  return '';
};

const isAdminRole = (role: AdminUser['role']) => {
  const normalized = extractRoleText(role).toUpperCase();
  return normalized === 'ADMIN' || normalized === 'ROLE_ADMIN' || normalized.endsWith('_ADMIN');
};

const isUserRole = (role: AdminUser['role']) => {
  const normalized = extractRoleText(role).toUpperCase();
  if (!normalized) {
    return true;
  }
  return normalized === 'USER' || normalized === 'ROLE_USER' || normalized.endsWith('_USER');
};

const LISTING_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'AVAILABLE' },
  { value: 'RENTED', label: 'RENTED' },
  { value: 'HIDE', label: 'HIDDEN' },
  { value: 'REJECT', label: 'REJECTED' },
] as const;

const normalizeRoom = (room: Room): Room => ({
  ...room,
  amenityNames: room.amenityNames ?? room.amenities ?? [],
  isFavorite: typeof room.isFavorite === 'boolean' ? room.isFavorite : Boolean(room.favorite),
});

const formatPricePerMonth = (price: number) => {
  const inMillion = price / 1_000_000;
  const formatted = Number.isInteger(inMillion)
    ? inMillion.toLocaleString('vi-VN')
    : inMillion.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${formatted} triệu/tháng`;
};

const formatUsersError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Không thể tải danh sách người dùng.';
  }

  const raw = (error.message || '').trim();
  if (!raw) {
    return 'Không thể tải danh sách người dùng.';
  }

  try {
    const parsed = JSON.parse(raw) as { status?: number; message?: string | null; error?: string | null };
    if (parsed && typeof parsed === 'object') {
      const msg = parsed.message || parsed.error;
      if (msg) {
        return msg;
      }
      if (parsed.status === 400) {
        return 'Yeu cau tai danh sach nguoi dung khong hop le (400). Vui long thu Reload users.';
      }
    }
  } catch {
  }

  return raw;
};

const STATS_RANGE_OPTIONS: Array<{ value: StatsRange; label: string }> = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];

const getDateKey = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDailyTrend = (dates: Array<string | undefined>, days: StatsRange) => {
  const labels: string[] = [];
  const countsByDate = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = getDateKey(day.toISOString());
    labels.push(key);
    countsByDate.set(key, 0);
  }

  dates.forEach((value) => {
    const key = getDateKey(value);
    if (key && countsByDate.has(key)) {
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }
  });

  return labels.map((key) => ({ date: key, count: countsByDate.get(key) ?? 0 }));
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'rooms' | 'accounts' | 'notifications' | 'reports' | 'ratings' | 'purchases' | 'stats'>('overview');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'AVAILABLE' | 'RENTED' | 'REJECTED' | 'HIDDEN'>('ALL');
  const [roomTimeFilter, setRoomTimeFilter] = useState<'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'>('ALL');
  const [roomSortBy, setRoomSortBy] = useState<'newest' | 'oldest'>('newest');
  const [roomPage, setRoomPage] = useState(1);
  const [actionRoomId, setActionRoomId] = useState<number | null>(null);
  const [rejectRoomId, setRejectRoomId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [userReports, setUserReports] = useState<UserReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportActionId, setReportActionId] = useState<number | null>(null);
  const [reportStatusFilter, setReportStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'REJECTED'>('ALL');
  const [reportTimeSort, setReportTimeSort] = useState<'newest' | 'oldest'>('newest');
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingSearchUsername, setRatingSearchUsername] = useState('');
  const [deletingRatingId, setDeletingRatingId] = useState<number | null>(null);
  const [lowRatedUsers, setLowRatedUsers] = useState<LowRatedUser[]>([]);
  const [lowRatedMaxStars, setLowRatedMaxStars] = useState(3);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [lockingUserId, setLockingUserId] = useState<number | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL');
  const [userSortBy, setUserSortBy] = useState<'newest' | 'name'>('newest');
  const [notificationUsers, setNotificationUsers] = useState<NotificationUserOption[]>([]);
  const [loadingNotificationUsers, setLoadingNotificationUsers] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationTargetType, setNotificationTargetType] = useState<'ALL' | 'USERS'>('ALL');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationContent, setNotificationContent] = useState('');
  const [notificationRecipientSearch, setNotificationRecipientSearch] = useState('');
  const [selectedNotificationRecipientIds, setSelectedNotificationRecipientIds] = useState<number[]>([]);
  const [statsRange, setStatsRange] = useState<StatsRange>(7);

  const loadAdminRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await get<ApiResponse<Room[]>>('/api/admin/rooms/all');
      setRooms((response.data ?? []).map(normalizeRoom));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Không thể tải dữ liệu dashboard admin.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    try {
      setLoadingOverview(true);
      setOverviewError(null);
      const response = await get<OverviewStats>('/api/admin/statistics/overview');
      setOverviewStats(response);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Không thể tải thông tin thống kê.';
      setOverviewError(message);
      setOverviewStats(null);
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadRatings = async (username: string) => {
    if (!username.trim()) {
      setRatings([]);
      return;
    }
    try {
      setLoadingRatings(true);
      const response = await get<RatingItem[]>(`/api/admin/ratings/from-user?username=${encodeURIComponent(username)}`);
      setRatings(response);
    } catch {
      setRatings([]);
    } finally {
      setLoadingRatings(false);
    }
  };

  const loadLowRatedUsers = useCallback(async () => {
    try {
      const response = await get<LowRatedUserRow[]>(`/api/admin/ratings/low-rated-users?maxStars=${lowRatedMaxStars}`);
      const formatted: LowRatedUser[] = response.map((item) => ({
        userId: item[0],
        username: item[1],
        displayName: item[2],
        avgRating: Number(item[3]),
        ratingCount: Number(item[4]),
      }));
      setLowRatedUsers(formatted);
    } catch {
      setLowRatedUsers([]);
    }
  }, [lowRatedMaxStars]);

  const deleteRating = async (ratingId: number) => {
    const ok = window.confirm('Xóa đánh giá này?');
    if (!ok) {
      return;
    }

    try {
      setDeletingRatingId(ratingId);
      await del<void>(`/api/admin/ratings/${ratingId}`);
      await loadRatings(ratingSearchUsername);
    } catch {
    } finally {
      setDeletingRatingId(null);
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      setUsersError(null);
      const response = await get<AdminUser[] | ApiResponse<AdminUser[]>>('/api/admin/users/all');
      const users = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      setAllUsers(users);
    } catch (fetchError) {
      setAllUsers([]);
      setUsersError(formatUsersError(fetchError));
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUserLock = async (userId: number, shouldLock: boolean) => {
    const ok = window.confirm(shouldLock ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?');
    if (!ok) return;

    try {
      setLockingUserId(userId);
      const endpoint = shouldLock ? `/api/admin/users/${userId}/lock` : `/api/admin/users/${userId}/unlock`;
      await put<void>(endpoint);

      await loadAllUsers();
    } catch {
    } finally {
      setLockingUserId(null);
    }
  };

  const loadNotificationUsers = async () => {
    try {
      setLoadingNotificationUsers(true);
      const response = await get<ApiResponse<NotificationUserOption[]>>('/api/admin/notifications/users');
      setNotificationUsers(response.data ?? []);
    } catch {
      setNotificationUsers([]);
    } finally {
      setLoadingNotificationUsers(false);
    }
  };

  const toggleNotificationRecipient = (userId: number) => {
    setSelectedNotificationRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const sendAdminNotification = async () => {
    const title = notificationTitle.trim();
    const content = notificationContent.trim();
    if (!title || !content) {
      setNotificationError('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.');
      setNotificationMessage(null);
      return;
    }
    if (notificationTargetType === 'USERS' && selectedNotificationRecipientIds.length === 0) {
      setNotificationError('Vui lòng chọn ít nhất 1 người dùng để gửi thông báo.');
      setNotificationMessage(null);
      return;
    }

    try {
      setSendingNotification(true);
      setNotificationError(null);
      setNotificationMessage(null);
      const response = await post<ApiResponse<{ sentCount: number }>, {
        title: string;
        content: string;
        targetType: 'ALL' | 'USERS';
        recipientUserIds?: number[];
      }>('/api/admin/notifications/send', {
        title,
        content,
        targetType: notificationTargetType,
        recipientUserIds: notificationTargetType === 'USERS' ? selectedNotificationRecipientIds : undefined,
      });
      const sentCount = response.data?.sentCount ?? 0;
      setNotificationMessage(`Đã gửi thông báo thành công tới ${sentCount} người dùng.`);
      setNotificationTitle('');
      setNotificationContent('');
      setSelectedNotificationRecipientIds([]);
      setNotificationRecipientSearch('');
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Gửi thông báo thất bại.';
      setNotificationError(message);
      setNotificationMessage(null);
    } finally {
      setSendingNotification(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'overview') {
      void loadOverviewStats();
      return;
    }
    if (activeSection === 'ratings') {
      void loadLowRatedUsers();
      return;
    }
    if (activeSection === 'accounts') {
      void loadAllUsers();
      return;
    }
    if (activeSection === 'notifications') {
      void loadNotificationUsers();
      return;
    }
    if (activeSection === 'reports') {
      void loadUserReports();
      return;
    }
    if (activeSection === 'stats') {
      void Promise.all([
        loadAdminRooms(),
        loadAllUsers(),
        loadUserReports(),
        loadOverviewStats(),
      ]);
      return;
    }
    if (activeSection === 'rooms') {
      void loadAdminRooms();
    }
  }, [activeSection, loadLowRatedUsers]);

  useEffect(() => {
    if (activeSection === 'ratings') {
      void loadLowRatedUsers();
    }
  }, [activeSection, loadLowRatedUsers]);

  useEffect(() => {
    const loadAdminProfile = async () => {
      try {
        const response = await get<AdminProfile>('/api/users/me');
        setAdminProfile(response);
      } catch {
        setAdminProfile(null);
      }
    };

    void loadAdminProfile();
  }, []);

  const filteredRooms = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const next = rooms.filter((room) => {
      const normalizedStatus = (room.status || '').toUpperCase();
      if (statusFilter !== 'ALL' && normalizedStatus !== statusFilter) {
        return false;
      }

      if (roomTimeFilter === 'ALL') {
        return true;
      }

      const createdTime = room.createdAt ? new Date(room.createdAt).getTime() : 0;
      if (!Number.isFinite(createdTime) || createdTime <= 0) {
        return false;
      }

      if (roomTimeFilter === 'TODAY') {
        return createdTime >= startOfToday;
      }

      const days = roomTimeFilter === 'LAST_7_DAYS' ? 7 : 30;
      return createdTime >= now.getTime() - days * 24 * 60 * 60 * 1000;
    });

    next.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return roomSortBy === 'newest' ? bTime - aTime : aTime - bTime;
    });

    return next;
  }, [rooms, statusFilter, roomTimeFilter, roomSortBy]);

  const roomsPerPage = 25;
  const totalRoomPages = useMemo(() => Math.max(1, Math.ceil(filteredRooms.length / roomsPerPage)), [filteredRooms.length]);
  const paginatedRooms = useMemo(() => {
    const start = (roomPage - 1) * roomsPerPage;
    return filteredRooms.slice(start, start + roomsPerPage);
  }, [filteredRooms, roomPage]);
  const roomPageItems = useMemo(() => {
    if (totalRoomPages <= 7) {
      return Array.from({ length: totalRoomPages }, (_, index) => index + 1) as Array<number | string>;
    }

    const items: Array<number | string> = [1];
    const start = Math.max(2, roomPage - 1);
    const end = Math.min(totalRoomPages - 1, roomPage + 1);

    if (start > 2) {
      items.push('...');
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < totalRoomPages - 1) {
      items.push('...');
    }

    items.push(totalRoomPages);
    return items;
  }, [roomPage, totalRoomPages]);

  const statusSummary = useMemo(() => {
    return {
      total: rooms.length,
      pending: rooms.filter((room) => room.status === 'PENDING').length,
      available: rooms.filter((room) => room.status === 'AVAILABLE').length,
      rented: rooms.filter((room) => room.status === 'RENTED').length,
      rejected: rooms.filter((room) => room.status === 'REJECTED').length,
      hidden: rooms.filter((room) => room.status === 'HIDDEN').length,
    };
  }, [rooms]);

  useEffect(() => {
    setRoomPage(1);
  }, [statusFilter, roomTimeFilter, roomSortBy]);

  useEffect(() => {
    if (roomPage > totalRoomPages) {
      setRoomPage(totalRoomPages);
    }
  }, [roomPage, totalRoomPages]);

  const onChangeStatus = async (roomId: number, nextStatus: 'AVAILABLE' | 'RENTED' | 'HIDE' | 'REJECT', rejectionReason?: string) => {
    try {
      setActionRoomId(roomId);
      const params = new URLSearchParams({ status: nextStatus });
      if (nextStatus === 'REJECT') {
        params.set('rejectionReason', rejectionReason || '');
      }
      await put<string>(`/api/rooms/${roomId}/status?${params.toString()}`);
      await loadAdminRooms();
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (changeError) {
      const message = changeError instanceof Error ? changeError.message : 'Không thể cập nhật trạng thái tin.';
      setError(message);
    } finally {
      setActionRoomId(null);
    }
  };

  const openRejectRoomModal = (roomId: number) => {
    setRejectRoomId(roomId);
    setRejectReason('');
    setRejectReasonError(null);
  };

  const closeRejectRoomModal = () => {
    setRejectRoomId(null);
    setRejectReason('');
    setRejectReasonError(null);
  };

  const confirmRejectRoom = async () => {
    if (!rejectRoomId) {
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      setRejectReasonError('Vui lòng nhập lý do từ chối tin.');
      return;
    }

    setRejectReasonError(null);
    await onChangeStatus(rejectRoomId, 'REJECT', reason);
    closeRejectRoomModal();
  };

  const onDeleteRoom = async (roomId: number) => {
    const ok = window.confirm('Xóa tin này khỏi hệ thống? Thao tác này không thể hoàn tác.');
    if (!ok) {
      return;
    }

    const reasonInput = window.prompt('Nhập lý do xóa (có thể bỏ trống để bỏ qua):', '');
    if (reasonInput === null) {
      return;
    }

    const reason = reasonInput.trim();
    const notifyOwner =
      reason.length > 0
        ? window.confirm('Bạn có muốn gửi thông báo lý do này cho người đăng không?')
        : false;

    try {
      setActionRoomId(roomId);
      const payload: RoomDeletePayload = {
        reason: reason || undefined,
        notifyOwner,
      };
      await del<string, RoomDeletePayload>(`/api/rooms/${roomId}`, payload);
      await loadAdminRooms();
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Không thể xóa tin đăng.';
      setError(message);
    } finally {
      setActionRoomId(null);
    }
  };

  const loadUserReports = async () => {
    try {
      setLoadingReports(true);
      const response = await get<ApiResponse<UserReportItem[]>>('/api/admin/reports/users');
      setUserReports(response.data ?? []);
    } catch {
      setUserReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const updateReportStatus = async (reportId: number, status: 'RESOLVED' | 'REJECTED') => {
    try {
      setReportActionId(reportId);
      await put<string>(`/api/admin/reports/users/${reportId}/status?status=${status}`);
      await loadUserReports();
    } catch {
    } finally {
      setReportActionId(null);
    }
  };

  const dashboardStats = useMemo(() => {
    const total = statusSummary.total || 1;
    const pendingRatio = Math.round((statusSummary.pending / total) * 100);
    const availableRatio = Math.round((statusSummary.available / total) * 100);
    const rentedRatio = Math.round((statusSummary.rented / total) * 100);
    const rejectedRatio = Math.round((statusSummary.rejected / total) * 100);
    const hiddenRatio = Math.round((statusSummary.hidden / total) * 100);
    return { pendingRatio, availableRatio, rentedRatio, rejectedRatio, hiddenRatio };
  }, [statusSummary]);

  const reportSummary = useMemo(() => {
    return {
      total: userReports.length,
      pending: userReports.filter((item) => item.status === 'PENDING').length,
      resolved: userReports.filter((item) => item.status === 'RESOLVED').length,
      rejected: userReports.filter((item) => item.status === 'REJECTED').length,
    };
  }, [userReports]);

  const userSystemSummary = useMemo(() => {
    const usersOnly = allUsers.filter((user) => isUserRole(user.role));
    const total = usersOnly.length;
    const active = usersOnly.filter((user) => user.enabled).length;
    const locked = usersOnly.filter((user) => !user.enabled).length;
    const ratedUsers = usersOnly.filter((user) => typeof user.averageRating === 'number');
    const avgRating = ratedUsers.length
      ? ratedUsers.reduce((sum, user) => sum + (user.averageRating ?? 0), 0) / ratedUsers.length
      : 0;

    return {
      total,
      active,
      locked,
      lockRate: total > 0 ? Math.round((locked / total) * 100) : 0,
      avgRating,
    };
  }, [allUsers]);

  const topProvinces = useMemo(() => {
    const counts = new Map<string, number>();
    rooms.forEach((room) => {
      const province = (room.province || 'Chưa cập nhật').trim() || 'Chưa cập nhật';
      counts.set(province, (counts.get(province) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [rooms]);

  const usersTrend = useMemo(() => {
    return buildDailyTrend(allUsers.filter((user) => isUserRole(user.role)).map((user) => user.createdAt), statsRange);
  }, [allUsers, statsRange]);

  const roomsTrend = useMemo(() => {
    return buildDailyTrend(rooms.map((room) => room.createdAt), statsRange);
  }, [rooms, statsRange]);

  const reportsTrend = useMemo(() => {
    return buildDailyTrend(userReports.map((report) => report.createdAt), statsRange);
  }, [userReports, statsRange]);

  const periodSummary = useMemo(() => {
    const users = usersTrend.reduce((sum, item) => sum + item.count, 0);
    const roomsCount = roomsTrend.reduce((sum, item) => sum + item.count, 0);
    const reportsCount = reportsTrend.reduce((sum, item) => sum + item.count, 0);
    return { users, rooms: roomsCount, reports: reportsCount };
  }, [usersTrend, roomsTrend, reportsTrend]);

  const statsBusy = loading || loadingUsers || loadingReports || loadingOverview;

  const filteredReports = useMemo(() => {
    const next =
      reportStatusFilter === 'ALL'
        ? [...userReports]
        : userReports.filter((item) => item.status === reportStatusFilter);

    next.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return reportTimeSort === 'newest' ? bTime - aTime : aTime - bTime;
    });

    return next;
  }, [userReports, reportStatusFilter, reportTimeSort]);

  const filteredAllUsers = useMemo(() => {
    const normalizedSearch = userSearchTerm.trim().toLowerCase();
    const next = allUsers.filter((user) => {
      const roleMatch = !isAdminRole(user.role) && isUserRole(user.role);
      const statusMatch =
        userStatusFilter === 'ALL' ||
        (userStatusFilter === 'ACTIVE' && user.enabled) ||
        (userStatusFilter === 'LOCKED' && !user.enabled);

      if (!normalizedSearch) {
        return roleMatch && statusMatch;
      }

      const text = `${user.username} ${user.displayName ?? ''} ${user.email} ${user.phone ?? ''}`.toLowerCase();
      return roleMatch && statusMatch && text.includes(normalizedSearch);
    });

    if (userSortBy === 'name') {
      return [...next].sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username));
    }
    return [...next].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allUsers, userSearchTerm, userStatusFilter, userSortBy]);

  const accountSummary = useMemo(() => {
    const usersOnly = allUsers.filter((user) => isUserRole(user.role));
    return {
      total: usersOnly.length,
      active: usersOnly.filter((user) => user.enabled).length,
      locked: usersOnly.filter((user) => !user.enabled).length,
    };
  }, [allUsers]);
  const filteredNotificationUsers = useMemo(() => {
    const keyword = notificationRecipientSearch.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return notificationUsers.filter((user) => {
      const display = user.displayName || '';
      const value = `${display} ${user.username}`.toLowerCase();
      return value.includes(keyword);
    });
  }, [notificationUsers, notificationRecipientSearch]);

  const trendPeak = useMemo(() => {
    return Math.max(
      1,
      ...usersTrend.map((item) => item.count),
      ...roomsTrend.map((item) => item.count),
      ...reportsTrend.map((item) => item.count)
    );
  }, [usersTrend, roomsTrend, reportsTrend]);

  const trendYAxisTicks = useMemo(() => {
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(trendPeak * ratio));
  }, [trendPeak]);

  const refreshActiveSection = () => {
    if (activeSection === 'overview') {
      void loadOverviewStats();
      return;
    }
    if (activeSection === 'accounts') {
      void loadAllUsers();
      return;
    }
    if (activeSection === 'reports') {
      void loadUserReports();
      return;
    }
    if (activeSection === 'ratings') {
      void loadLowRatedUsers();
      if (ratingSearchUsername.trim()) {
        void loadRatings(ratingSearchUsername);
      }
      return;
    }
    if (activeSection === 'stats') {
      void Promise.all([
        loadAdminRooms(),
        loadAllUsers(),
        loadUserReports(),
        loadOverviewStats(),
      ]);
      return;
    }
    void loadAdminRooms();
  };

  const currentSectionTitle =
    sectionItems.find((item) => item.key === activeSection)?.label ?? 'Dashboard quản trị';


  return (
    <section className="relative min-h-[calc(100vh-76px)] w-full overflow-x-hidden bg-[radial-gradient(circle_at_10%_20%,#fff7ed_0%,#f8fafc_45%,#eef2ff_100%)]">
      <div className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-slate-200/80 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-2xl lg:h-[calc(100vh-76px)] lg:overflow-y-auto">
          <div className="flex flex-col items-center rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
            <img
              src={
                adminProfile?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  adminProfile?.displayName || adminProfile?.username || 'A'
                )}&background=1f2937&color=fde68a&bold=true`
              }
              alt="Admin avatar"
              className="h-24 w-24 rounded-full border-4 border-amber-200/40 object-cover shadow-lg"
            />
            <p className="mt-3 text-sm font-extrabold tracking-wide text-white">
              {adminProfile?.displayName || adminProfile?.username || 'Admin'}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">Administration</p>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.24em] text-amber-300">GENERAL</p>
            <div className="border-t border-white/20" />
            {sectionItems.map((item) => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-white/5 text-slate-100 hover:bg-white/15 hover:text-white'
                  }`}
                  onClick={() => setActiveSection(item.key as 'overview' | 'rooms' | 'accounts' | 'notifications' | 'reports' | 'ratings' | 'purchases' | 'stats')}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-5 p-4 sm:p-5 lg:p-7">
          <div className="sticky top-0 z-10 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Admin</p>
                <h1 className="mt-2 text-2xl font-bold text-neutral-900">{currentSectionTitle}</h1>
              </div>
              <div className="flex items-center gap-2">
                {activeSection === 'stats' && (
                  <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1">
                    {STATS_RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`h-8 rounded-lg px-3 text-xs font-bold transition ${
                          statsRange === option.value
                            ? 'bg-neutral-900 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                        onClick={() => setStatsRange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-50"
                  onClick={refreshActiveSection}
                  disabled={loading || loadingUsers || loadingOverview || loadingReports || loadingRatings || loadingNotificationUsers || sendingNotification}
                >
                  Làm mới
                </button>
              </div>
            </div>
          </div>

          {activeSection === 'overview' && (
            <div className="space-y-4">
              {loadingOverview ? (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-600">
                  Đang tải thống kê...
                </div>
              ) : overviewError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">Lỗi tải thống kê:</p>
                  <p className="mt-1">{overviewError}</p>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-red-300 bg-white px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                    onClick={() => void loadOverviewStats()}
                  >
                    Thử lại
                  </button>
                </div>
              ) : overviewStats ? (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-blue-600">Tổng tài khoản</p>
                      <p className="mt-2 text-3xl font-extrabold text-blue-800">{overviewStats.totalUsers}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-emerald-600">Tin đang đăng</p>
                      <p className="mt-2 text-3xl font-extrabold text-emerald-800">{overviewStats.availableRooms}</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-red-600">Báo cáo chưa xử lí</p>
                      <p className="mt-2 text-3xl font-extrabold text-red-800">{overviewStats.pendingReports}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-amber-600">Rating trung bình</p>
                      <p className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-amber-800">{overviewStats.averageRating.toFixed(1)}</span>
                        <span className="text-lg text-amber-600">★</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-neutral-900">Người dùng mới (7 ngày)</h3>
                      <div className="mt-4 flex h-40 items-end justify-center gap-1">
                        {overviewStats.newUsersByDay.map((stat, idx) => {
                          const maxCount = Math.max(...overviewStats.newUsersByDay.map((s) => s.count), 1);
                          const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
                          return (
                            <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                              <div
                                className="w-full rounded-t bg-blue-500 transition"
                                style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                              />
                              <span className="text-[10px] text-neutral-500">{stat.count}</span>
                              <span className="text-[10px] text-neutral-400">{stat.date.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-neutral-900">Bài đăng mới (7 ngày)</h3>
                      <div className="mt-4 flex h-40 items-end justify-center gap-1">
                        {overviewStats.newRoomsByDay.map((stat, idx) => {
                          const maxCount = Math.max(...overviewStats.newRoomsByDay.map((s) => s.count), 1);
                          const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
                          return (
                            <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                              <div
                                className="w-full rounded-t bg-emerald-500 transition"
                                style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                              />
                              <span className="text-[10px] text-neutral-500">{stat.count}</span>
                              <span className="text-[10px] text-neutral-400">{stat.date.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-600">
                  Không thể tải thông tin thống kê.
                </div>
              )}
            </div>
          )}

          {activeSection === 'rooms' && (
            <div className="space-y-5">
              {/* Status Summary */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-cyan-50/30 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-blue-700">📦 Tổng tin</p>
                  <p className="mt-1 text-xl font-extrabold text-blue-900">{statusSummary.total}</p>
                </div>
                <div className="rounded-2xl border border-orange-200/50 bg-gradient-to-br from-orange-50 to-amber-50/30 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-orange-700">⏳ PENDING</p>
                  <p className="mt-1 text-xl font-extrabold text-orange-700">{statusSummary.pending}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-green-50/30 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-emerald-700">✅ AVAILABLE</p>
                  <p className="mt-1 text-xl font-extrabold text-emerald-700">{statusSummary.available}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-yellow-50/30 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-amber-700">🔓 RENTED</p>
                  <p className="mt-1 text-xl font-extrabold text-amber-700">{statusSummary.rented}</p>
                </div>
                <div className="rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50 to-pink-50/30 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-rose-700">❌ REJECTED</p>
                  <p className="mt-1 text-xl font-extrabold text-rose-700">{statusSummary.rejected}</p>
                </div>
                <div className="rounded-2xl border border-slate-300/50 bg-gradient-to-br from-slate-100 to-slate-50/30 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-slate-700">🙈 HIDDEN</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-700">{statusSummary.hidden}</p>
                </div>
              </div>

              {/* Filter Section */}
              <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-2 text-xs font-bold text-neutral-700">🔍 Trạng thái</p>
                    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                      {(['ALL', 'PENDING', 'AVAILABLE', 'RENTED', 'REJECTED', 'HIDDEN'] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`h-9 shrink-0 rounded-xl border px-3 text-xs font-bold transition ${
                            statusFilter === item
                              ? 'border-orange-500 bg-orange-500 text-white'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                          }`}
                          onClick={() => setStatusFilter(item)}
                        >
                          {item === 'ALL' ? 'Tất cả' : item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-neutral-700">🕒 Thời gian đăng</p>
                    <select
                      value={roomTimeFilter}
                      onChange={(event) => setRoomTimeFilter(event.target.value as 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS')}
                      className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-700 outline-none"
                    >
                      <option value="ALL">Tất cả thời gian</option>
                      <option value="TODAY">Hôm nay</option>
                      <option value="LAST_7_DAYS">7 ngày gần nhất</option>
                      <option value="LAST_30_DAYS">30 ngày gần nhất</option>
                    </select>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-neutral-700">↕ Sắp xếp</p>
                    <select
                      value={roomSortBy}
                      onChange={(event) => setRoomSortBy(event.target.value as 'newest' | 'oldest')}
                      className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-700 outline-none"
                    >
                      <option value="newest">Mới nhất</option>
                      <option value="oldest">Cũ nhất</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Loading and Error States */}
              {loading && (
                <div className="rounded-3xl border border-blue-200/30 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 text-center">
                  <p className="text-sm font-semibold text-blue-900">⏳ Đang tải dữ liệu...</p>
                </div>
              )}
              {error && (
                <div className="rounded-3xl border border-red-300 bg-gradient-to-br from-red-50 to-orange-50/30 p-6 text-sm text-red-700 font-semibold">
                  ⚠️ {error}
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && filteredRooms.length === 0 && (
                <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-neutral-100/50 p-8 text-center">
                  <p className="text-sm font-medium text-neutral-700">😔 Không có tin phù hợp bộ lọc.</p>
                </div>
              )}

              {/* Rooms Grid */}
              {!loading && !error && paginatedRooms.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-neutral-900 px-1">📋 Danh sách tin đăng ({filteredRooms.length})</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {paginatedRooms.map((room) => (
                      <article key={room.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
                        <div className="relative">
                          <img
                            src={room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                            alt={room.title}
                            className="h-20 w-full object-cover"
                          />
                          <div className="absolute right-1 top-1 rounded-lg bg-white/95 px-2 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm">
                            {room.status === 'PENDING' && '⏳ Chờ duyệt'}
                            {room.status === 'AVAILABLE' && '✅ Sẵn sàng'}
                            {room.status === 'RENTED' && '🔓 Cho thuê'}
                            {room.status === 'REJECTED' && '❌ Từ chối'}
                            {room.status === 'HIDDEN' && '🙈 Ẩn'}
                            {!room.status && '❓ Không xác định'}
                          </div>
                        </div>
                        <div className="space-y-1.5 p-2">
                          <div>
                            <h3 className="line-clamp-2 text-xs font-bold text-neutral-900">{room.title}</h3>
                            <p className="text-sm font-extrabold text-orange-600">{formatPricePerMonth(room.price ?? 0)}</p>
                          </div>
                          
                          <div className="space-y-1 text-[11px]">
                            <p className="flex items-center gap-1 text-neutral-700">
                              <span>👤</span>
                              <span className="line-clamp-1 font-semibold">{room.ownerName || 'N/A'}</span>
                            </p>
                            <p className="flex items-center gap-1 text-neutral-700">
                              <span>📍</span>
                              <span className="line-clamp-1">{room.province || 'Đang cập nhật'}</span>
                            </p>
                            <p className="flex items-center gap-1 text-neutral-700">
                              <span>🗓️</span>
                              <span>
                                {room.createdAt
                                  ? new Date(room.createdAt).toLocaleString('vi-VN')
                                  : 'Không rõ thời gian'}
                              </span>
                            </p>
                          </div>

                          <div className="grid grid-cols-4 gap-1 pt-1">
                            <button
                              type="button"
                              className="inline-flex h-7 items-center justify-center rounded-lg border border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100/50 px-1 text-[10px] font-bold text-blue-600"
                              onClick={() => navigate(`/rooms/${room.id}`)}
                            >
                              Chi tiết
                            </button>
                            {room.status === 'PENDING' ? (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex h-7 items-center justify-center rounded-lg border border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-1 text-[10px] font-bold text-emerald-700 disabled:opacity-60"
                                  onClick={() => void onChangeStatus(room.id, 'AVAILABLE')}
                                  disabled={actionRoomId === room.id}
                                >
                                  Đồng ý
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-7 items-center justify-center rounded-lg border border-red-300 bg-gradient-to-r from-red-50 to-red-100/50 px-1 text-[10px] font-bold text-red-700 disabled:opacity-60"
                                  onClick={() => openRejectRoomModal(room.id)}
                                  disabled={actionRoomId === room.id}
                                >
                                  Từ chối
                                </button>
                              </>
                            ) : (
                              <select
                                className="col-span-2 h-7 w-full rounded-lg border border-neutral-300 bg-white px-1 text-[10px] font-bold text-neutral-700 outline-none"
                                value={room.status === 'HIDDEN' ? 'HIDE' : room.status === 'REJECTED' ? 'REJECT' : room.status || 'AVAILABLE'}
                                onChange={(event) => {
                                  const nextStatus = event.target.value as 'AVAILABLE' | 'RENTED' | 'HIDE' | 'REJECT';
                                  if (nextStatus === 'REJECT') {
                                    openRejectRoomModal(room.id);
                                    return;
                                  }
                                  void onChangeStatus(room.id, nextStatus);
                                }}
                                disabled={actionRoomId === room.id}
                              >
                                {LISTING_STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {room.status !== 'PENDING' && (
                              <button
                                type="button"
                                className="inline-flex h-7 items-center justify-center rounded-lg border border-red-300 bg-gradient-to-r from-red-50 to-red-100/50 px-1 text-[10px] font-bold text-red-600 disabled:opacity-60"
                                onClick={() => void onDeleteRoom(room.id)}
                                disabled={actionRoomId === room.id}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-2">
                    <p className="text-xs text-neutral-600">
                      Trang {roomPage}/{totalRoomPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-8 rounded-lg border border-neutral-300 px-2 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                        onClick={() => setRoomPage((prev) => Math.max(1, prev - 1))}
                        disabled={roomPage === 1}
                      >
                        Trước
                      </button>
                      {roomPageItems.map((item, index) => (
                        typeof item === 'number' ? (
                          <button
                            key={`room-page-${item}`}
                            type="button"
                            className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold ${
                              roomPage === item
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                            onClick={() => setRoomPage(item)}
                          >
                            {item}
                          </button>
                        ) : (
                          <span key={`room-page-gap-${index}`} className="px-1 text-xs text-neutral-500">
                            ...
                          </span>
                        )
                      ))}
                      <button
                        type="button"
                        className="h-8 rounded-lg border border-neutral-300 px-2 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                        onClick={() => setRoomPage((prev) => Math.min(totalRoomPages, prev + 1))}
                        disabled={roomPage === totalRoomPages}
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'accounts' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-sm">
                  <p className="text-xs text-neutral-500">Tổng tài khoản USER</p>
                  <p className="mt-2 text-2xl font-extrabold text-neutral-900">{accountSummary.total}</p>
                </div>
                <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                  <p className="text-xs text-neutral-500">Đang hoạt động</p>
                  <p className="mt-2 text-2xl font-extrabold text-emerald-700">{accountSummary.active}</p>
                </div>
                <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
                  <p className="text-xs text-neutral-500">Đã khóa</p>
                  <p className="mt-2 text-2xl font-extrabold text-red-700">{accountSummary.locked}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(event) => setUserSearchTerm(event.target.value)}
                    placeholder="Tìm theo tên, @username, email, số điện thoại"
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 md:col-span-2"
                  />
                  <select
                    value={userStatusFilter}
                    onChange={(event) => setUserStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'LOCKED')}
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-2 text-sm outline-none"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="LOCKED">Đã khóa</option>
                  </select>
                  <select
                    value={userSortBy}
                    onChange={(event) => setUserSortBy(event.target.value as 'newest' | 'name')}
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-2 text-sm outline-none"
                  >
                    <option value="newest">Mới tham gia</option>
                    <option value="name">Theo tên A-Z</option>
                  </select>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void loadAllUsers()}
                    disabled={loadingUsers}
                    className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                  >
                    {loadingUsers ? 'Dang reload...' : 'Reload users'}
                  </button>
                </div>
              </div>

              {loadingUsers ? (
                <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-600">
                  Đang tải danh sách người dùng...
                </div>
              ) : usersError ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                  {usersError}
                </div>
              ) : filteredAllUsers.length === 0 ? (
                <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-600">
                  Không có tài khoản USER phù hợp.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {filteredAllUsers.map((user) => {
                    const avatar =
                      user.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.username)}&background=fef3c7&color=b45309&bold=true`;

                    return (
                      <article
                        key={user.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/profile/${user.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/profile/${user.id}`);
                          }
                        }}
                        className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt={user.displayName || user.username}
                            className="h-14 w-14 rounded-full border border-amber-200 object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-neutral-900">{user.displayName || user.username}</p>
                            <p className="truncate text-xs font-semibold text-amber-700">@{user.username}</p>
                            <p className="truncate text-xs text-neutral-500">{user.email}</p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                              user.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.enabled ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                          <p className="text-[11px] text-neutral-500">
                            Tham gia: {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                          <button
                            type="button"
                            className={`h-9 rounded-xl border px-3 text-xs font-semibold transition ${
                              user.enabled
                                ? 'border-red-300 bg-white text-red-600 hover:bg-red-50'
                                : 'border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-50'
                            } disabled:opacity-60`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleUserLock(user.id, user.enabled);
                            }}
                            disabled={lockingUserId === user.id}
                          >
                            {user.enabled ? 'Khóa tài khoản' : 'Mở khóa'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSection === 'reports' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-500">Pending</p>
                  <p className="mt-2 text-2xl font-extrabold text-red-700">
                    {userReports.filter((item) => item.status === 'PENDING').length}
                  </p>
                </div>
                <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Resolved</p>
                  <p className="mt-2 text-2xl font-extrabold text-amber-700">
                    {userReports.filter((item) => item.status === 'RESOLVED').length}
                  </p>
                </div>
                <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Rejected</p>
                  <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                    {userReports.filter((item) => item.status === 'REJECTED').length}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={reportStatusFilter}
                    onChange={(event) => setReportStatusFilter(event.target.value as 'ALL' | 'PENDING' | 'RESOLVED' | 'REJECTED')}
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING">PENDING</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <select
                    value={reportTimeSort}
                    onChange={(event) => setReportTimeSort(event.target.value as 'newest' | 'oldest')}
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none"
                  >
                    <option value="newest">Thời gian: Mới nhất</option>
                    <option value="oldest">Thời gian: Cũ nhất</option>
                  </select>
                </div>
                {loadingReports ? (
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 text-sm text-neutral-600">Đang tải danh sách báo cáo vi phạm...</div>
                ) : filteredReports.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 text-sm text-neutral-600">Không có báo cáo phù hợp bộ lọc.</div>
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((report) => (
                      <article key={report.id} className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-neutral-900">
                            #{report.id} · {report.reporterName} <span className="text-xs text-amber-600">@{report.reporterUsername}</span> báo cáo {report.reportedUserName} <span className="text-xs text-amber-600">@{report.reportedUserUsername}</span>
                          </p>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              report.status === 'PENDING'
                                ? 'bg-red-50 text-red-700'
                                : report.status === 'RESOLVED'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {report.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-neutral-700">{report.description}</p>
                        {report.evidenceImageUrl && (
                          <a
                            href={report.evidenceImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-100"
                          >
                            Xem ảnh minh chứng
                          </a>
                        )}
                        <p className="mt-2 text-[11px] text-neutral-500">
                          {new Date(report.createdAt).toLocaleString('vi-VN')}
                        </p>
                        {report.status === 'PENDING' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                              onClick={() => void updateReportStatus(report.id, 'RESOLVED')}
                              disabled={reportActionId === report.id}
                            >
                              Đánh dấu đã xử lý
                            </button>
                            <button
                              type="button"
                              className="h-8 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                              onClick={() => void updateReportStatus(report.id, 'REJECTED')}
                              disabled={reportActionId === report.id}
                            >
                              Từ chối báo cáo
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
                <p className="text-sm font-bold text-sky-900">📣 Gửi thông báo hệ thống</p>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold text-neutral-700">Kiểu người nhận</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`h-9 rounded-xl border px-3 text-xs font-semibold ${
                          notificationTargetType === 'ALL'
                            ? 'border-orange-500 bg-orange-500 text-white'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                        onClick={() => {
                          setNotificationTargetType('ALL');
                          setSelectedNotificationRecipientIds([]);
                        }}
                      >
                        Tất cả người dùng
                      </button>
                      <button
                        type="button"
                        className={`h-9 rounded-xl border px-3 text-xs font-semibold ${
                          notificationTargetType === 'USERS'
                            ? 'border-orange-500 bg-orange-500 text-white'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                        onClick={() => setNotificationTargetType('USERS')}
                      >
                        Chọn người dùng
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-neutral-700">Đã chọn</p>
                    {notificationTargetType === 'ALL' ? (
                      <div className="flex h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700">
                        Tất cả người dùng
                      </div>
                    ) : (
                      <div className="flex h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700">
                        {selectedNotificationRecipientIds.length} người dùng
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    value={notificationTitle}
                    onChange={(event) => setNotificationTitle(event.target.value)}
                    placeholder="Tiêu đề thông báo"
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                  <textarea
                    value={notificationContent}
                    onChange={(event) => setNotificationContent(event.target.value)}
                    placeholder="Nội dung thông báo"
                    rows={4}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                {notificationTargetType === 'USERS' && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                    <input
                      type="text"
                      value={notificationRecipientSearch}
                      onChange={(event) => setNotificationRecipientSearch(event.target.value)}
                      placeholder="Tìm user theo tên hoặc username"
                      className="h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-xs outline-none"
                    />

                    {loadingNotificationUsers ? (
                      <p className="mt-3 text-xs text-neutral-600">Đang tải danh sách người dùng...</p>
                    ) : !notificationRecipientSearch.trim() ? (
                      <p className="mt-3 text-xs text-neutral-600">Nhập tên hoặc username để hiển thị người dùng.</p>
                    ) : filteredNotificationUsers.length === 0 ? (
                      <p className="mt-3 text-xs text-neutral-600">Không có người dùng phù hợp.</p>
                    ) : (
                      <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
                        {filteredNotificationUsers.map((user) => {
                          const checked = selectedNotificationRecipientIds.includes(user.id);
                          return (
                            <label
                              key={user.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                                checked
                                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleNotificationRecipient(user.id)}
                                className="h-3.5 w-3.5"
                              />
                              <span className="truncate font-semibold">{user.displayName || user.username}</span>
                              <span className="truncate text-neutral-500">@{user.username}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {notificationMessage && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {notificationMessage}
                  </div>
                )}
                {notificationError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {notificationError}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-sm font-bold text-white disabled:opacity-60"
                    onClick={() => void sendAdminNotification()}
                    disabled={sendingNotification}
                  >
                    {sendingNotification ? 'Đang gửi...' : 'Gửi thông báo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'purchases' && (
            <PurchaseManagementTab isOpen={activeSection === 'purchases'} />
          )}

          {activeSection === 'stats' && (
            <div className="space-y-4">
              {statsBusy ? (
                <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
                  Đang tải dữ liệu thống kê toàn hệ thống...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-indigo-600">Tổng người dùng</p>
                      <p className="mt-2 text-2xl font-extrabold text-indigo-900">{userSystemSummary.total}</p>
                    </div>
                    <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-blue-600">Tổng tin đăng</p>
                      <p className="mt-2 text-2xl font-extrabold text-blue-900">{statusSummary.total}</p>
                    </div>
                    <div className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-red-600">Báo cáo vi phạm</p>
                      <p className="mt-2 text-2xl font-extrabold text-red-800">{reportSummary.total}</p>
                    </div>
                    <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-amber-600">Rating trung bình</p>
                      <p className="mt-2 text-2xl font-extrabold text-amber-800">
                        {(overviewStats?.averageRating ?? userSystemSummary.avgRating).toFixed(1)} ★
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-neutral-900">Phân bố trạng thái tin đăng</p>
                      <div className="mt-3 space-y-2">
                        {[
                          { label: 'PENDING', value: dashboardStats.pendingRatio, color: 'bg-orange-500' },
                          { label: 'AVAILABLE', value: dashboardStats.availableRatio, color: 'bg-emerald-500' },
                          { label: 'RENTED', value: dashboardStats.rentedRatio, color: 'bg-amber-500' },
                          { label: 'REJECTED', value: dashboardStats.rejectedRatio, color: 'bg-rose-500' },
                          { label: 'HIDDEN', value: dashboardStats.hiddenRatio, color: 'bg-slate-500' },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-semibold text-neutral-700">{item.label}</span>
                              <span className="text-neutral-500">{item.value}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-neutral-100">
                              <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-neutral-900">Tình trạng người dùng</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                          <p className="text-xs text-emerald-700">Đang hoạt động</p>
                          <p className="mt-1 text-xl font-extrabold text-emerald-800">{userSystemSummary.active}</p>
                        </div>
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                          <p className="text-xs text-red-700">Đã khóa</p>
                          <p className="mt-1 text-xl font-extrabold text-red-800">{userSystemSummary.locked}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <p className="text-xs text-neutral-600">Tỷ lệ tài khoản bị khóa</p>
                        <p className="mt-1 text-lg font-bold text-neutral-900">{userSystemSummary.lockRate}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-neutral-900">Xu hướng {statsRange} ngày gần nhất</p>
                        <p className="text-xs text-neutral-500">
                          +{periodSummary.users} người dùng | +{periodSummary.rooms} tin đăng | +{periodSummary.reports} báo cáo
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" /> Người dùng mới
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                          <span className="h-2 w-2 rounded-full bg-blue-500" /> Tin đăng mới
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                          <span className="h-2 w-2 rounded-full bg-rose-500" /> Báo cáo mới
                        </span>
                      </div>
                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 pb-2 pt-3">
                        <div className="grid grid-cols-[auto_1fr] gap-2">
                          <div className="flex h-52 flex-col justify-between pb-5 pr-2 text-[10px] font-semibold text-neutral-500">
                            {trendYAxisTicks.map((tick, index) => (
                              <span key={`tick-${index}`}>{tick}</span>
                            ))}
                          </div>
                          <div>
                            <div className="relative h-52">
                              <div className="absolute inset-0 flex flex-col justify-between">
                                {[0, 1, 2, 3, 4].map((line) => (
                                  <div key={`grid-${line}`} className="border-t border-dashed border-neutral-200" />
                                ))}
                              </div>
                              <div className="absolute inset-0 flex items-end gap-1">
                                {usersTrend.map((day, index) => {
                                  const userHeight = (day.count / trendPeak) * 100;
                                  const roomCount = roomsTrend[index]?.count ?? 0;
                                  const roomHeight = (roomCount / trendPeak) * 100;
                                  const reportCount = reportsTrend[index]?.count ?? 0;
                                  const reportHeight = (reportCount / trendPeak) * 100;

                                  return (
                                    <div key={`trend-${day.date}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                                      <div className="flex h-full w-full items-end justify-center gap-[3px]">
                                        <div
                                          className="w-[28%] rounded-t bg-indigo-500"
                                          style={{ height: `${Math.max(userHeight, day.count > 0 ? 3 : 0)}%` }}
                                          title={`${day.date} | Người dùng mới: ${day.count}`}
                                        />
                                        <div
                                          className="w-[28%] rounded-t bg-blue-500"
                                          style={{ height: `${Math.max(roomHeight, roomCount > 0 ? 3 : 0)}%` }}
                                          title={`${day.date} | Tin đăng mới: ${roomCount}`}
                                        />
                                        <div
                                          className="w-[28%] rounded-t bg-rose-500"
                                          style={{ height: `${Math.max(reportHeight, reportCount > 0 ? 3 : 0)}%` }}
                                          title={`${day.date} | Báo cáo mới: ${reportCount}`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="mt-2 flex gap-1 text-[10px] text-neutral-500">
                              {usersTrend.map((day, index) => (
                                <div key={`label-${day.date}`} className="min-w-0 flex-1 truncate text-center">
                                  {index % Math.ceil(usersTrend.length / 7 || 1) === 0 || index === usersTrend.length - 1
                                    ? day.date.slice(5)
                                    : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-neutral-900">Top khu vực có nhiều tin</p>
                      {topProvinces.length === 0 ? (
                        <p className="mt-3 text-sm text-neutral-500">Chưa có dữ liệu khu vực.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {topProvinces.map((item, index) => (
                            <div key={item.province} className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm">
                              <span className="truncate font-semibold text-neutral-800">#{index + 1} {item.province}</span>
                              <span className="ml-3 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-neutral-700">{item.count} tin</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-bold text-neutral-900">Thống kê xử lý báo cáo</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <p className="text-xs text-neutral-600">Tổng báo cáo</p>
                        <p className="mt-1 text-lg font-extrabold text-neutral-900">{reportSummary.total}</p>
                      </div>
                      <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                        <p className="text-xs text-red-600">Đang chờ</p>
                        <p className="mt-1 text-lg font-extrabold text-red-700">{reportSummary.pending}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                        <p className="text-xs text-amber-600">Đã xử lý</p>
                        <p className="mt-1 text-lg font-extrabold text-amber-700">{reportSummary.resolved}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-600">Từ chối</p>
                        <p className="mt-1 text-lg font-extrabold text-emerald-700">{reportSummary.rejected}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'ratings' && (
            <div className="space-y-5">
              {/* Search Section */}
              <div className="rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-sm">
                <label className="block text-sm font-bold text-amber-900 mb-3">🔍 Tìm đánh giá của người dùng</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={ratingSearchUsername}
                    onChange={(e) => setRatingSearchUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void loadRatings(ratingSearchUsername);
                      }
                    }}
                    placeholder="Nhập username..."
                    className="flex-1 rounded-2xl border border-amber-300 bg-white px-4 py-2.5 text-sm placeholder-neutral-500 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition"
                  />
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-500 px-6 text-sm font-bold text-white hover:shadow-lg transition"
                    onClick={() => void loadRatings(ratingSearchUsername)}
                  >
                    Tìm kiếm
                  </button>
                </div>
              </div>

              {loadingRatings ? (
                <div className="rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 text-center">
                  <p className="text-sm font-semibold text-amber-900">⏳ Đang tải danh sách đánh giá...</p>
                </div>
              ) : ratings.length === 0 && ratingSearchUsername ? (
                <div className="rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 text-center">
                  <p className="text-sm font-medium text-amber-800">😔 Không tìm thấy đánh giá nào từ người dùng này.</p>
                </div>
              ) : ratings.length === 0 ? (
                <div className="rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 text-center">
                  <p className="text-sm font-medium text-amber-800">💭 Nhập username để xem danh sách đánh giá.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-neutral-900 px-1">📋 Danh sách đánh giá ({ratings.length})</h3>
                  {ratings.map((rating) => (
                    <article key={rating.id} className="rounded-3xl border border-amber-200/50 bg-gradient-to-br from-white to-amber-50/30 p-5 shadow-sm hover:shadow-md transition">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-4 flex-1">
                          <img
                            src={
                              rating.rater.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(rating.rater.displayName || rating.rater.username || 'U')}&background=fef3c7&color=b45309&bold=true`
                            }
                            alt={rating.rater.username}
                            className="h-14 w-14 rounded-full border-2 border-amber-200 object-cover shadow-sm"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <p className="text-sm font-bold text-neutral-900">
                                {rating.rater.displayName || rating.rater.username}
                              </p>
                              <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">@{rating.rater.username}</span>
                            </div>
                            <p className="text-xs text-neutral-600 mb-2">
                              👤 đánh giá <span className="font-semibold text-neutral-900">{rating.ratedUser.displayName || rating.ratedUser.username}</span>
                              {' '}
                              <span className="text-amber-600 font-semibold">@{rating.ratedUser.username}</span>
                            </p>
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-300 to-yellow-200 px-3 py-1.5 text-sm font-bold text-yellow-900 shadow-sm">
                                {'⭐'.repeat(Math.max(1, Math.min(5, rating.stars)))}
                              </span>
                              <span className="text-xs text-neutral-500 font-medium">
                                📅 {new Date(rating.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-300 bg-gradient-to-r from-red-50 to-red-100/50 px-4 text-xs font-bold text-red-600 hover:shadow-md transition disabled:opacity-60"
                          onClick={() => void deleteRating(rating.id)}
                          disabled={deletingRatingId === rating.id}
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                      {rating.comment && (
                        <p className="mt-3 text-sm text-neutral-700 bg-white/50 rounded-2xl p-3 border border-neutral-200/50 italic">
                          💬 "{rating.comment}"
                        </p>
                      )}
                      {rating.imageUrl && (
                        <a href={rating.imageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
                          <img src={rating.imageUrl} alt="Minh chứng đánh giá" className="h-36 w-auto rounded-2xl border border-amber-200/50 shadow-sm" />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {/* Low Rated Users Section */}
              <div className="rounded-3xl border border-red-200/50 bg-gradient-to-br from-red-50 to-orange-50/30 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-red-900 mb-4">⚠️ Người dùng đánh giá thấp (≤ {lowRatedMaxStars} sao)</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[1, 2, 3].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`h-10 rounded-2xl border px-4 text-xs font-bold transition shadow-sm ${
                        lowRatedMaxStars === val
                          ? 'border-red-500 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                          : 'border-red-300/50 bg-white text-red-700 hover:bg-red-50'
                      }`}
                      onClick={() => {
                        setLowRatedMaxStars(val);
                      }}
                    >
                      ≤ {val} {'⭐'.repeat(val)}
                    </button>
                  ))}
                </div>

                {lowRatedUsers.length === 0 ? (
                  <p className="text-xs text-red-700 font-medium bg-red-100/50 rounded-2xl p-3">✅ Không có người dùng bị đánh giá thấp.</p>
                ) : (
                  <div className="space-y-2">
                    {lowRatedUsers.map((user) => (
                      <div key={user.userId} className="flex items-center justify-between rounded-2xl border border-red-200/50 bg-white/70 p-3 text-xs hover:shadow-md transition">
                        <span className="font-semibold text-neutral-900">
                          👤 {user.displayName || user.username} 
                          <span className="text-red-600 font-bold ml-2">{user.avgRating.toFixed(1)}⭐</span>
                          <span className="text-neutral-600 ml-1">({user.ratingCount} đánh giá)</span>
                        </span>
                        <button
                          type="button"
                          className="rounded-xl border border-neutral-300 bg-gradient-to-r from-blue-50 to-blue-100/50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:shadow-md transition"
                          onClick={() => navigate(`/users/${user.userId}`)}
                        >
                          👁️ Xem profile
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {rejectRoomId !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-neutral-900">Từ chối tin đăng</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {rooms.find((room) => room.id === rejectRoomId)?.title || 'Tin đăng này'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                    onClick={closeRejectRoomModal}
                  >
                    Đóng
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-neutral-700">Lý do từ chối</span>
                    <textarea
                      value={rejectReason}
                      onChange={(event) => {
                        setRejectReason(event.target.value);
                        if (rejectReasonError) {
                          setRejectReasonError(null);
                        }
                      }}
                      rows={4}
                      placeholder="Nhập lý do để gửi thông báo cho chủ tin..."
                      className="w-full rounded-2xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                  {rejectReasonError && <p className="text-xs font-semibold text-red-600">{rejectReasonError}</p>}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                    onClick={closeRejectRoomModal}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    onClick={() => void confirmRejectRoom()}
                    disabled={actionRoomId === rejectRoomId}
                  >
                    {actionRoomId === rejectRoomId ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
