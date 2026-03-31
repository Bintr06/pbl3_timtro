import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Cropper, { type Area } from 'react-easy-crop';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { del, get, getAuthToken, post, postFormData, put, putFormData } from './apiClient';
import Header from './components/Header';
import AdminDashboardPage from './pages/AdminDashboardPage';

type Room = {
  id: number;
  title: string;
  description?: string;
  price: number;
  createdAt?: string;
  area?: number;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  streetDetail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  amenityNames?: string[];
  amenities?: string[];
  amenityIds?: number[];
  favorite?: boolean;
  imageUrls?: string[];
  isFavorite?: boolean;
};

type RoomWithDistance = Room & {
  distanceKm?: number;
};

type ViewedHistoryItem = {
  room: Room;
  viewedAt: string;
};

type AmenityOption = {
  id: number;
  name: string;
  icon?: string | null;
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

type ChatContact = {
  id: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  unreadCount?: number;
};

type ChatMessage = {
  id: number;
  senderId: number;
  senderName?: string;
  recipientId: number;
  content: string;
  timestamp: string;
};

type UserProfile = {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  bio?: string | null;
  address?: string | null;
  nickname?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  role?: string | null;
  isVerified?: boolean;
  createdAt?: string | null;
};

type PublicUserProfile = UserProfile;

type UserProfileRating = {
  id: number;
  raterId: number;
  raterName: string;
  raterAvatar?: string | null;
  stars: number;
  comment: string;
  imageUrl?: string | null;
  createdAt: string;
};

type District = {
  code: number;
  name: string;
  wards?: Ward[];
};

type Province = {
  code: number;
  name: string;
  districts: District[];
};

type Ward = {
  code: number;
  name: string;
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImageBlob = async (imageSrc: string, cropArea: Area): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
  }

  canvas.width = cropArea.width;
  canvas.height = cropArea.height;

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không thể tạo ảnh đã cắt.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
};

type DistrictDetail = {
  code: number;
  name: string;
  wards: Ward[];
};

const PRICE_OPTIONS = [
  { value: 'all', label: 'Tất cả mức giá' },
  { value: 'under-2m', label: 'Dưới 2 triệu' },
  { value: '2m-5m', label: '2 - 5 triệu' },
  { value: 'over-5m', label: 'Trên 5 triệu' },
];

const DEFAULT_AMENITY_OPTIONS = ['Wifi', 'Điều hòa', 'Chỗ để xe', 'Nóng lạnh', 'Gác lửng'];

const LISTING_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'AVAILABLE' },
  { value: 'RENTED', label: 'RENTED' },
  { value: 'HIDE', label: 'HIDE' },
] as const;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeLocation = (value: string) =>
  normalize(value)
    .replace(/\b(thanh pho|tp\.?|tinh|quan|huyen|thi xa|thi tran|phuong|xa)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatPostedTime = (value?: string) => {
  if (!value) {
    return 'Vừa đăng';
  }
  const postedAt = new Date(value);
  if (Number.isNaN(postedAt.getTime())) {
    return 'Vừa đăng';
  }
  const now = new Date();
  const diffMs = now.getTime() - postedAt.getTime();
  if (diffMs < 60_000) return 'Vừa đăng';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  const years = Math.floor(months / 12);
  return `${years} năm trước`;
};

const formatPricePerMonth = (price: number) => {
  const inMillion = price / 1_000_000;
  const formatted = Number.isInteger(inMillion)
    ? inMillion.toLocaleString('vi-VN')
    : inMillion.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${formatted} triệu/tháng`;
};

const getRoomAmenityNames = (room: Room) => {
  if (room.amenityNames && room.amenityNames.length > 0) {
    return room.amenityNames;
  }
  return room.amenities ?? [];
};

const normalizeRoom = (room: Room): Room => ({
  ...room,
  amenityNames: room.amenityNames ?? room.amenities ?? [],
  isFavorite: typeof room.isFavorite === 'boolean' ? room.isFavorite : Boolean(room.favorite),
});

const formatDistanceKm = (distanceKm?: number) => {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) {
    return 'Không rõ khoảng cách';
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

const IMAGE_URL_REGEX = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s]*)?)$/i;
const CLOUDINARY_IMAGE_REGEX = /(https?:\/\/res\.cloudinary\.com\/[^\s]+\/image\/upload\/[^\s]+)/i;
const VIEW_HISTORY_STORAGE_KEY = 'timtro_view_history_v1';
const VIEW_HISTORY_MAX_ITEMS = 100;

const normalizeChatMessageContent = (content: string) => {
  if (typeof content !== 'string') {
    return '';
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  // Some chat APIs may return raw JSON-string content (e.g. "hello").
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed;
    }
  } catch {
    // keep fallback handling below
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return content;
};

const isImageMessage = (content: string) => IMAGE_URL_REGEX.test(content) || CLOUDINARY_IMAGE_REGEX.test(content);

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const loadViewedHistory = (): ViewedHistoryItem[] => {
  try {
    const raw = localStorage.getItem(VIEW_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ViewedHistoryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === 'object' && item.room && typeof item.room.id === 'number')
      .map((item) => ({ ...item, room: normalizeRoom(item.room) }));
  } catch {
    return [];
  }
};

const saveViewedHistory = (items: ViewedHistoryItem[]) => {
  localStorage.setItem(VIEW_HISTORY_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('room-view-history-updated'));
};

const addRoomToViewedHistory = (room: Room) => {
  const normalized = normalizeRoom(room);
  const previous = loadViewedHistory().filter((item) => item.room.id !== normalized.id);
  const next: ViewedHistoryItem[] = [{ room: normalized, viewedAt: new Date().toISOString() }, ...previous].slice(
    0,
    VIEW_HISTORY_MAX_ITEMS
  );
  saveViewedHistory(next);
};

const buildRoomMarkerIcon = (imageUrl?: string) => {
  const fallback = 'https://placehold.co/96x70?text=Timtro';
  const safeImageUrl = (imageUrl || fallback).replace(/"/g, '&quot;');

  return L.divIcon({
    className: 'timtro-room-marker',
    html: `
      <div class="timtro-marker-root">
        <div class="timtro-marker-thumb">
          <img src="${safeImageUrl}" alt="Room" />
        </div>
        <div class="timtro-marker-pin"></div>
      </div>
    `,
    iconSize: [90, 92],
    iconAnchor: [45, 86],
    popupAnchor: [0, -84],
  });
};

function EditMapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getAuthToken()));
  const [isAuthResolved, setIsAuthResolved] = useState(!getAuthToken());
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomReloadTick, setRoomReloadTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
  const [selectedWardCode, setSelectedWardCode] = useState<number | null>(null);
  const [priceFilter, setPriceFilter] = useState('all');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedProvinceName, setAppliedProvinceName] = useState('');
  const [appliedDistrictName, setAppliedDistrictName] = useState('');
  const [appliedWardName, setAppliedWardName] = useState('');
  const [appliedPriceFilter, setAppliedPriceFilter] = useState('all');
  const [appliedAmenities, setAppliedAmenities] = useState<string[]>([]);
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const isChatRoute = location.pathname.startsWith('/chat');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdmin = (currentUserRole ?? '').toUpperCase() === 'ADMIN';

  const openChatWithUser = (userId?: number | null, displayName?: string | null) => {
    if (!getAuthToken()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }
    if (!userId) {
      navigate('/chat');
      return;
    }
    const name = encodeURIComponent(displayName ?? 'Chủ trọ');
    navigate(`/chat?userId=${userId}&name=${name}`);
  };

  const openUserProfile = (userId?: number | null) => {
    if (!userId) {
      return;
    }
    navigate(`/profile/${userId}`);
  };

  const openRoomDetail = (room: Room) => {
    navigate(`/rooms/${room.id}`);
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await get<ApiResponse<Room[]>>('/api/rooms/public/all');
        setRooms((res.data ?? []).map(normalizeRoom));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể tải danh sách phòng');
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [roomReloadTick]);

  useEffect(() => {
    const handleRoomPosted = () => setRoomReloadTick((prev) => prev + 1);
    window.addEventListener('room-posted', handleRoomPosted);
    return () => window.removeEventListener('room-posted', handleRoomPosted);
  }, []);

  useEffect(() => {
    const reloadRoomsByAuth = () => setRoomReloadTick((prev) => prev + 1);
    const syncAuthState = () => setIsLoggedIn(Boolean(getAuthToken()));

    const handleAuthEvent = () => {
      syncAuthState();
      reloadRoomsByAuth();
    };

    const handleStorage = () => {
      syncAuthState();
      reloadRoomsByAuth();
    };

    syncAuthState();
    window.addEventListener('auth-state-changed', handleAuthEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncRole = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setIsLoggedIn(false);
          setCurrentUserRole(null);
          setIsAuthResolved(true);
        }
        return;
      }

      if (!cancelled) {
        setIsAuthResolved(false);
      }

      try {
        const me = await get<UserProfile>('/api/users/me');
        if (!cancelled) {
          setIsLoggedIn(true);
          setCurrentUserRole(me.role ?? null);
          setIsAuthResolved(true);
        }
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
          setCurrentUserRole(null);
          setIsAuthResolved(true);
        }
      }
    };

    const handleAuthChanged = () => {
      void syncRole();
    };

    void syncRole();
    window.addEventListener('auth-state-changed', handleAuthChanged);
    window.addEventListener('storage', handleAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('auth-state-changed', handleAuthChanged);
      window.removeEventListener('storage', handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const response = await axios.get<Province[]>('https://provinces.open-api.vn/api/?depth=3');
        const data = response.data ?? [];
        setProvinces(data);
      } catch (fetchError) {
        console.error('Không thể tải tỉnh/thành:', fetchError);
      }
    };

    fetchProvinces();
  }, []);

  useEffect(() => {
    const loadWards = async () => {
      if (!selectedDistrictCode) {
        setWards([]);
        setSelectedWardCode(null);
        return;
      }

      const district = districts.find((item) => item.code === selectedDistrictCode);
      const localWards = district?.wards ?? [];
      if (localWards.length > 0) {
        setWards(localWards);
        return;
      }

      try {
        const response = await axios.get<DistrictDetail>(
          `https://provinces.open-api.vn/api/d/${selectedDistrictCode}?depth=2`
        );
        setWards(response.data.wards ?? []);
      } catch (fetchError) {
        console.error('Không thể tải phường/xã:', fetchError);
        setWards([]);
      }
    };

    loadWards();
  }, [selectedDistrictCode, districts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedProvinceName, appliedDistrictName, appliedWardName, appliedPriceFilter, appliedAmenities, appliedSearchKeyword]);

  const amenityOptions = useMemo(() => {
    const dynamicAmenities = rooms.flatMap(getRoomAmenityNames);
    return Array.from(new Set([...DEFAULT_AMENITY_OPTIONS, ...dynamicAmenities])).filter(Boolean);
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const normalizedAppliedProvince = normalizeLocation(appliedProvinceName);
    const normalizedAppliedDistrict = normalizeLocation(appliedDistrictName);
    const normalizedAppliedWard = normalizeLocation(appliedWardName);
    const normalizedAppliedKeyword = normalize(appliedSearchKeyword.trim());

    return rooms.filter((room) => {
      const fullAddress = normalizeLocation(
        `${room.address ?? ''} ${room.ward ?? ''} ${room.district ?? ''} ${room.province ?? ''}`
      );
      const amenityText = normalize(`${getRoomAmenityNames(room).join(' ')} ${room.description ?? ''}`);
      const roomPrice = room.price ?? 0;
      const roomTitle = normalize(room.title ?? '');

      const matchProvince = !normalizedAppliedProvince || fullAddress.includes(normalizedAppliedProvince);
      const matchDistrict = !normalizedAppliedDistrict || fullAddress.includes(normalizedAppliedDistrict);
      const matchWard = !normalizedAppliedWard || fullAddress.includes(normalizedAppliedWard);
      const matchAmenity =
        appliedAmenities.length === 0 ||
        appliedAmenities.every((amenity) => amenityText.includes(normalize(amenity)));
      let matchPrice = true;

      if (appliedPriceFilter === 'under-2m') {
        matchPrice = roomPrice < 2_000_000;
      } else if (appliedPriceFilter === '2m-5m') {
        matchPrice = roomPrice >= 2_000_000 && roomPrice <= 5_000_000;
      } else if (appliedPriceFilter === 'over-5m') {
        matchPrice = roomPrice > 5_000_000;
      }

      const matchTitle = normalizedAppliedKeyword.length === 0 || roomTitle.includes(normalizedAppliedKeyword);

      return matchProvince && matchDistrict && matchWard && matchAmenity && matchPrice && matchTitle;
    });
  }, [
    rooms,
    appliedProvinceName,
    appliedDistrictName,
    appliedWardName,
    appliedAmenities,
    appliedPriceFilter,
    appliedSearchKeyword,
  ]);

  const applyFilters = () => {
    const provinceName = provinces.find((province) => province.code === selectedProvinceCode)?.name ?? '';
    const districtName = districts.find((district) => district.code === selectedDistrictCode)?.name ?? '';
    const wardName = wards.find((ward) => ward.code === selectedWardCode)?.name ?? '';

    setAppliedProvinceName(provinceName);
    setAppliedDistrictName(districtName);
    setAppliedWardName(wardName);
    setAppliedPriceFilter(priceFilter);
    setAppliedAmenities([...selectedAmenities]);
    setAppliedSearchKeyword(searchKeyword);
    setRoomReloadTick((prev) => prev + 1);
  };

  const resetFilters = () => {
    setSelectedProvinceCode(null);
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setDistricts([]);
    setWards([]);
    setPriceFilter('all');
    setSelectedAmenities([]);
    setSearchKeyword('');

    setAppliedProvinceName('');
    setAppliedDistrictName('');
    setAppliedWardName('');
    setAppliedPriceFilter('all');
    setAppliedAmenities([]);
    setAppliedSearchKeyword('');

    setCurrentPage(1);
    setRoomReloadTick((prev) => prev + 1);
  };

  const toggleFavorite = async (roomId: number) => {
    if (!getAuthToken()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }
    try {
      await post<ApiResponse<null>>(`/api/favorites/${roomId}`);
      setRooms((prev) =>
        prev.map((room) => (room.id === roomId ? { ...room, isFavorite: !room.isFavorite } : room))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật yêu thích.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / pageSize));
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, currentPage]);

  const adminRouteElement = (() => {
    if (!isLoggedIn) {
      return <Navigate to="/" replace />;
    }

    if (!isAuthResolved) {
      return (
        <section className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
            Đang xác thực quyền truy cập quản trị...
          </div>
        </section>
      );
    }

    return isAdmin ? <AdminDashboardPage /> : <Navigate to="/" replace />;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-slate-50 to-slate-100 font-sans text-neutral-900">
      <Header />
      <main
        className={
          isChatRoute || isAdminRoute ? 'w-full px-0 py-0' : 'mx-auto w-full max-w-[1400px] px-4 py-6'
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              <RoomListPage
                rooms={paginatedRooms}
                loading={loading}
                error={error}
                provinces={provinces}
                districts={districts}
                wards={wards}
                selectedProvinceCode={selectedProvinceCode}
                selectedDistrictCode={selectedDistrictCode}
                selectedWardCode={selectedWardCode}
                priceFilter={priceFilter}
                selectedAmenities={selectedAmenities}
                amenityOptions={amenityOptions}
                searchKeyword={searchKeyword}
                currentPage={currentPage}
                totalPages={totalPages}
                totalResults={filteredRooms.length}
                onChangeProvince={(code) => {
                  setSelectedProvinceCode(code);
                  const nextDistricts = provinces.find((province) => province.code === code)?.districts ?? [];
                  setDistricts(nextDistricts);
                  setSelectedDistrictCode(null);
                  setSelectedWardCode(null);
                  setWards([]);
                }}
                onChangeDistrict={(code) => {
                  setSelectedDistrictCode(code);
                  setSelectedWardCode(null);
                }}
                onChangeWard={setSelectedWardCode}
                onChangePrice={setPriceFilter}
                onToggleAmenity={(amenity) => {
                  setSelectedAmenities((prev) =>
                    prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity]
                  );
                }}
                onChangeSearch={setSearchKeyword}
                onApplyFilters={applyFilters}
                onResetFilters={resetFilters}
                onToggleFavorite={toggleFavorite}
                onOpenChat={openChatWithUser}
                onOpenProfile={openUserProfile}
                onViewRoom={openRoomDetail}
                onPageChange={setCurrentPage}
              />
            }
          />
          <Route path="/chat" element={isLoggedIn ? <ChatPage /> : <Navigate to="/" replace />} />
          <Route path="/my-listings" element={isLoggedIn ? <MyListingsPage /> : <Navigate to="/" replace />} />
          <Route path="/rooms/:roomId" element={isLoggedIn ? <RoomDetailPage /> : <Navigate to="/" replace />} />
          <Route path="/history" element={isLoggedIn ? <ViewHistoryPage /> : <Navigate to="/" replace />} />
          <Route path="/profile/:userId" element={isLoggedIn ? <UserProfilePage /> : <Navigate to="/" replace />} />
          <Route path="/favorites" element={isLoggedIn ? <FavoriteRoomsPage /> : <Navigate to="/" replace />} />
          <Route path="/account" element={isLoggedIn ? <AccountSettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/admin" element={adminRouteElement} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function FavoriteRoomsPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!getAuthToken()) {
        setError('Vui lòng đăng nhập để xem danh sách yêu thích.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await get<ApiResponse<Room[]>>('/api/favorites/me');
        setFavorites((response.data ?? []).map((room) => ({ ...normalizeRoom(room), isFavorite: true })));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách yêu thích.');
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const removeFavorite = async (roomId: number) => {
    if (!getAuthToken()) {
      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }
    try {
      setUpdatingId(roomId);
      await post<ApiResponse<null>>(`/api/favorites/${roomId}`);
      setFavorites((prev) => prev.filter((room) => room.id !== roomId));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Không thể cập nhật danh sách yêu thích.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Yêu thích</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Danh sách phòng đã lưu</h1>
        </div>
        <Link
          to="/"
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          Quay lại trang chủ
        </Link>
      </div>

      {loading && (
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600">Đang tải dữ liệu...</div>
      )}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>}

      {!loading && !error && favorites.length === 0 && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
          Bạn chưa lưu phòng nào. Hãy nhấn biểu tượng trái tim ở trang chủ để thêm vào danh sách yêu thích.
        </div>
      )}

      {!loading && !error && favorites.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((room) => (
            <article
              key={room.id}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg"
            >
              <div className="relative">
                <img
                  src={room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                  alt={room.title}
                  className="h-40 w-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                  {formatPostedTime(room.createdAt)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-neutral-900">{room.title}</h3>
                <p className="mt-2 text-lg font-extrabold text-[#d0021b]">{formatPricePerMonth(room.price ?? 0)}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="line-clamp-1">📍 {room.province || 'Đang cập nhật'}</span>
                  <span className="text-neutral-300">•</span>
                  <span>{room.area ? `${room.area} m²` : 'Đang cập nhật DT'}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 flex-1 rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                  >
                    Xem phòng
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-300 bg-white text-rose-500 transition hover:bg-neutral-50 disabled:opacity-60"
                    onClick={() => removeFavorite(room.id)}
                    disabled={updatingId === room.id}
                    aria-label="Bỏ yêu thích"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path
                        d="M12 21s-7-4.8-9.2-8.2C.9 9.7 2.2 6 5.8 5.2A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.2-2.8c3.6.8 4.9 4.5 3 7.6C19 16.2 12 21 12 21Z"
                        fill="currentColor"
                        stroke="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MyListingsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionRoomId, setActionRoomId] = useState<number | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [amenityOptions, setAmenityOptions] = useState<AmenityOption[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [primaryImageKey, setPrimaryImageKey] = useState<string | null>(null);
  const [editProvinces, setEditProvinces] = useState<Province[]>([]);
  const [editDistricts, setEditDistricts] = useState<District[]>([]);
  const [editWards, setEditWards] = useState<Ward[]>([]);
  const [selectedEditProvinceCode, setSelectedEditProvinceCode] = useState<number | null>(null);
  const [selectedEditDistrictCode, setSelectedEditDistrictCode] = useState<number | null>(null);
  const [selectedEditWardCode, setSelectedEditWardCode] = useState<number | null>(null);
  const [isEditMapPickerOpen, setIsEditMapPickerOpen] = useState(false);
  const [editMapCenter, setEditMapCenter] = useState<[number, number]>([16.047079, 108.20623]);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    province: '',
    district: '',
    ward: '',
    streetDetail: '',
    latitude: '',
    longitude: '',
  });

  const newImagePreviews = useMemo(() => newImages.map((file) => URL.createObjectURL(file)), [newImages]);

  useEffect(() => {
    return () => {
      newImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newImagePreviews]);

  const loadMyListings = async () => {
    if (!getAuthToken()) {
      setError('Vui lòng đăng nhập để quản lý tin.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await get<ApiResponse<Room[]>>('/api/rooms/my');
      setRooms((response.data ?? []).map(normalizeRoom));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách tin của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMyListings();
  }, []);

  useEffect(() => {
    const loadAmenities = async () => {
      try {
        const response = await get<ApiResponse<AmenityOption[]>>('/api/rooms/public/amenities');
        setAmenityOptions(response.data ?? []);
      } catch {
        setAmenityOptions([]);
      }
    };

    void loadAmenities();
  }, []);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const response = await axios.get<Province[]>('https://provinces.open-api.vn/api/?depth=3');
        setEditProvinces(response.data ?? []);
      } catch {
        setEditProvinces([]);
      }
    };

    void loadProvinces();
  }, []);

  useEffect(() => {
    const loadWards = async () => {
      if (!selectedEditDistrictCode) {
        setEditWards([]);
        return;
      }

      const district = editDistricts.find((item) => item.code === selectedEditDistrictCode);
      const localWards = district?.wards ?? [];
      if (localWards.length > 0) {
        setEditWards(localWards);
        return;
      }

      try {
        const response = await axios.get<DistrictDetail>(
          `https://provinces.open-api.vn/api/d/${selectedEditDistrictCode}?depth=2`
        );
        setEditWards(response.data.wards ?? []);
      } catch {
        setEditWards([]);
      }
    };

    void loadWards();
  }, [selectedEditDistrictCode, editDistricts]);

  useEffect(() => {
    if (!editingRoom || editProvinces.length === 0 || selectedEditProvinceCode) {
      return;
    }

    const normalizedProvince = normalizeLocation(editingRoom.province ?? '');
    const matchedProvince = editProvinces.find((item) => normalizeLocation(item.name) === normalizedProvince) ?? null;
    const nextDistricts = matchedProvince?.districts ?? [];
    setSelectedEditProvinceCode(matchedProvince?.code ?? null);
    setEditDistricts(nextDistricts);

    const normalizedDistrict = normalizeLocation(editingRoom.district ?? '');
    const matchedDistrict = nextDistricts.find((item) => normalizeLocation(item.name) === normalizedDistrict) ?? null;
    setSelectedEditDistrictCode(matchedDistrict?.code ?? null);

    const nextWards = matchedDistrict?.wards ?? [];
    setEditWards(nextWards);

    const normalizedWard = normalizeLocation(editingRoom.ward ?? '');
    const matchedWard = nextWards.find((item) => normalizeLocation(item.name) === normalizedWard) ?? null;
    setSelectedEditWardCode(matchedWard?.code ?? null);
  }, [editingRoom, editProvinces, selectedEditProvinceCode]);

  const onDeleteListing = async (roomId: number) => {
    try {
      setActionRoomId(roomId);
      await del<string>(`/api/rooms/${roomId}`);
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa tin.');
    } finally {
      setActionRoomId(null);
    }
  };

  const onChangeListingStatus = async (roomId: number, nextStatus: 'AVAILABLE' | 'RENTED' | 'HIDE') => {
    try {
      setActionRoomId(roomId);
      await put<string>(`/api/rooms/${roomId}/status?status=${encodeURIComponent(nextStatus)}`);
      await loadMyListings();
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Không thể cập nhật trạng thái tin.');
    } finally {
      setActionRoomId(null);
    }
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setEditForm({
      title: room.title ?? '',
      description: room.description ?? '',
      price: String(room.price ?? ''),
      area: String(room.area ?? ''),
      province: room.province ?? '',
      district: room.district ?? '',
      ward: room.ward ?? '',
      streetDetail: room.streetDetail ?? '',
      latitude: room.latitude != null ? String(room.latitude) : '',
      longitude: room.longitude != null ? String(room.longitude) : '',
    });
    setSelectedAmenityIds(room.amenityIds ?? []);
    setExistingImageUrls(room.imageUrls ?? []);
    setNewImages([]);
    setPrimaryImageKey((room.imageUrls?.length ?? 0) > 0 ? 'existing-0' : null);
    const roomLat = typeof room.latitude === 'number' ? room.latitude : null;
    const roomLng = typeof room.longitude === 'number' ? room.longitude : null;
    if (roomLat != null && roomLng != null && !Number.isNaN(roomLat) && !Number.isNaN(roomLng)) {
      setEditMapCenter([roomLat, roomLng]);
    } else {
      setEditMapCenter([16.047079, 108.20623]);
    }

    const normalizedProvince = normalizeLocation(room.province ?? '');
    const matchedProvince = editProvinces.find((item) => normalizeLocation(item.name) === normalizedProvince) ?? null;
    const nextDistricts = matchedProvince?.districts ?? [];
    setSelectedEditProvinceCode(matchedProvince?.code ?? null);
    setEditDistricts(nextDistricts);

    const normalizedDistrict = normalizeLocation(room.district ?? '');
    const matchedDistrict = nextDistricts.find((item) => normalizeLocation(item.name) === normalizedDistrict) ?? null;
    setSelectedEditDistrictCode(matchedDistrict?.code ?? null);

    const nextWards = matchedDistrict?.wards ?? [];
    setEditWards(nextWards);

    const normalizedWard = normalizeLocation(room.ward ?? '');
    const matchedWard = nextWards.find((item) => normalizeLocation(item.name) === normalizedWard) ?? null;
    setSelectedEditWardCode(matchedWard?.code ?? null);
    setError(null);
  };

  const closeEditModal = () => {
    setEditingRoom(null);
    setIsSavingEdit(false);
    setExistingImageUrls([]);
    setNewImages([]);
    setPrimaryImageKey(null);
    setSelectedEditProvinceCode(null);
    setSelectedEditDistrictCode(null);
    setSelectedEditWardCode(null);
    setEditDistricts([]);
    setEditWards([]);
    setIsEditMapPickerOpen(false);
  };

  const toggleAmenity = (amenityId: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(amenityId) ? prev.filter((id) => id !== amenityId) : [...prev, amenityId]
    );
  };

  const removeExistingImage = (index: number) => {
    const removedKey = `existing-${index}`;
    setExistingImageUrls((prev) => prev.filter((_, idx) => idx !== index));
    setPrimaryImageKey((prev) => {
      if (prev === removedKey) {
        return existingImageUrls.length > 1 ? 'existing-0' : newImages.length > 0 ? 'new-0' : null;
      }
      return prev;
    });
  };

  const removeNewImage = (index: number) => {
    const removedKey = `new-${index}`;
    setNewImages((prev) => prev.filter((_, idx) => idx !== index));
    setPrimaryImageKey((prev) => {
      if (prev === removedKey) {
        return existingImageUrls.length > 0 ? 'existing-0' : newImages.length > 1 ? 'new-0' : null;
      }
      return prev;
    });
  };

  const saveListingEdit = async () => {
    if (!editingRoom) {
      return;
    }

    const price = Number(editForm.price);
    const area = Number(editForm.area);
    const latitude = Number(editForm.latitude);
    const longitude = Number(editForm.longitude);

    if (!editForm.title.trim() || Number.isNaN(price) || Number.isNaN(area)) {
      setError('Vui lòng điền tiêu đề, giá và diện tích hợp lệ.');
      return;
    }
    if (existingImageUrls.length + newImages.length === 0) {
      setError('Tin đăng phải có ít nhất 1 ảnh.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const fallbackLatitude =
        typeof editingRoom.latitude === 'number' && !Number.isNaN(editingRoom.latitude) ? editingRoom.latitude : 0;
      const fallbackLongitude =
        typeof editingRoom.longitude === 'number' && !Number.isNaN(editingRoom.longitude) ? editingRoom.longitude : 0;
      const mergedImageCount = existingImageUrls.length + newImages.length;
      let computedPrimaryIndex = 0;
      if (primaryImageKey?.startsWith('existing-')) {
        const idx = Number(primaryImageKey.replace('existing-', ''));
        if (!Number.isNaN(idx) && idx >= 0 && idx < existingImageUrls.length) {
          computedPrimaryIndex = idx;
        }
      } else if (primaryImageKey?.startsWith('new-')) {
        const idx = Number(primaryImageKey.replace('new-', ''));
        if (!Number.isNaN(idx) && idx >= 0 && idx < newImages.length) {
          computedPrimaryIndex = existingImageUrls.length + idx;
        }
      }
      if (computedPrimaryIndex >= mergedImageCount) {
        computedPrimaryIndex = 0;
      }

      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price,
        area,
        province: editForm.province.trim(),
        district: editForm.district.trim(),
        ward: editForm.ward.trim(),
        streetDetail: editForm.streetDetail.trim(),
        latitude: Number.isNaN(latitude) ? fallbackLatitude : latitude,
        longitude: Number.isNaN(longitude) ? fallbackLongitude : longitude,
        amenityIds: selectedAmenityIds,
        remainingImageUrls: existingImageUrls,
        primaryImageIndex: computedPrimaryIndex,
      };

      const formData = new FormData();
      formData.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      newImages.forEach((file) => {
        formData.append('files', file);
      });
      await putFormData<string>(`/api/rooms/${editingRoom.id}`, formData);

      closeEditModal();
      await loadMyListings();
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật tin.');
      setIsSavingEdit(false);
    }
  };

  const currentEditLatitude = Number(editForm.latitude);
  const currentEditLongitude = Number(editForm.longitude);
  const hasPickedEditCoordinates =
    !Number.isNaN(currentEditLatitude) && !Number.isNaN(currentEditLongitude) && editForm.latitude !== '' && editForm.longitude !== '';

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Quản lý tin</p>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Tin của tôi</h1>
      </div>

      {loading && <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Đang tải dữ liệu...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!loading && !error && rooms.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Bạn chưa có tin nào.</div>
      )}

      {!loading && !error && rooms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article key={room.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <img
                src={room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                alt={room.title}
                className="h-40 w-full object-cover"
              />
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold text-neutral-900">{room.title}</h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700">
                    {room.status === 'HIDDEN' ? 'HIDE' : room.status || 'UNKNOWN'}
                  </span>
                </div>
                <p className="text-base font-extrabold text-[#d0021b]">{formatPricePerMonth(room.price ?? 0)}</p>
                <p className="line-clamp-1 text-xs text-neutral-600">📍 {room.province || 'Đang cập nhật'}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    onClick={() => openEditModal(room)}
                    disabled={actionRoomId === room.id}
                  >
                    Sửa tin
                  </button>
                  <select
                    className="h-9 rounded-xl border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-700 outline-none"
                    value={room.status === 'HIDDEN' ? 'HIDE' : room.status || 'AVAILABLE'}
                    onChange={(event) =>
                      onChangeListingStatus(room.id, event.target.value as 'AVAILABLE' | 'RENTED' | 'HIDE')
                    }
                    disabled={actionRoomId === room.id}
                  >
                    {LISTING_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-red-300 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    onClick={() => onDeleteListing(room.id)}
                    disabled={actionRoomId === room.id}
                  >
                    Xóa tin
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editingRoom && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-[2px]">
          <div className="w-full max-h-[92vh] max-w-4xl overflow-y-auto rounded-3xl border border-orange-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 via-amber-50 to-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Chỉnh sửa tin</p>
                <h2 className="mt-1 text-xl font-bold text-neutral-900">Cập nhật thông tin phòng</h2>
                <p className="text-sm text-neutral-600">Điều chỉnh thông tin, ảnh và vị trí rồi lưu cập nhật.</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                onClick={closeEditModal}
                aria-label="Đóng popup sửa tin"
              >
                ✕
              </button>
            </div>

            <div className="px-5 pb-2 pt-3 sm:px-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-orange-100">
                  Ảnh hiện có: {existingImageUrls.length}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-orange-100">
                  Ảnh mới: {newImages.length}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    hasPickedEditCoordinates
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-amber-100'
                  }`}
                >
                  {hasPickedEditCoordinates ? 'Đã chọn vị trí map' : 'Chưa chọn vị trí map'}
                </span>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4 sm:px-6">
              <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Thông tin cơ bản</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold text-neutral-600">Tiêu đề</span>
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      value={editForm.title}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-600">Giá (VNĐ)</span>
                    <input
                      type="number"
                      min="0"
                      className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      value={editForm.price}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-600">Diện tích (m²)</span>
                    <input
                      type="number"
                      min="1"
                      className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      value={editForm.area}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, area: event.target.value }))}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold text-neutral-600">Mô tả</span>
                    <textarea
                      className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      value={editForm.description}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Địa chỉ</h3>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Tỉnh/Thành</span>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    value={selectedEditProvinceCode ?? ''}
                    onChange={(event) => {
                      const code = event.target.value ? Number(event.target.value) : null;
                      const province = editProvinces.find((item) => item.code === code) ?? null;
                      const districts = province?.districts ?? [];
                      setSelectedEditProvinceCode(code);
                      setEditDistricts(districts);
                      setEditWards([]);
                      setSelectedEditDistrictCode(null);
                      setSelectedEditWardCode(null);
                      setEditForm((prev) => ({
                        ...prev,
                        province: province?.name ?? '',
                        district: '',
                        ward: '',
                      }));
                    }}
                  >
                    <option value="">Tỉnh/Thành</option>
                    {editProvinces.map((province) => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Quận/Huyện</span>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    value={selectedEditDistrictCode ?? ''}
                    onChange={(event) => {
                      const code = event.target.value ? Number(event.target.value) : null;
                      const district = editDistricts.find((item) => item.code === code) ?? null;
                      setSelectedEditDistrictCode(code);
                      setSelectedEditWardCode(null);
                      setEditForm((prev) => ({
                        ...prev,
                        district: district?.name ?? '',
                        ward: '',
                      }));
                    }}
                    disabled={!selectedEditProvinceCode}
                  >
                    <option value="">Quận/Huyện</option>
                    {editDistricts.map((district) => (
                      <option key={district.code} value={district.code}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Phường/Xã</span>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    value={selectedEditWardCode ?? ''}
                    onChange={(event) => {
                      const code = event.target.value ? Number(event.target.value) : null;
                      const ward = editWards.find((item) => item.code === code) ?? null;
                      setSelectedEditWardCode(code);
                      setEditForm((prev) => ({
                        ...prev,
                        ward: ward?.name ?? '',
                      }));
                    }}
                    disabled={!selectedEditDistrictCode}
                  >
                    <option value="">Phường/Xã</option>
                    {editWards.map((ward) => (
                      <option key={ward.code} value={ward.code}>
                        {ward.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-1">
                <label className="block sm:col-span-1">
                  <span className="text-xs font-semibold text-neutral-600">Số nhà / đường</span>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    value={editForm.streetDetail}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, streetDetail: event.target.value }))}
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-neutral-700">Vị trí trên bản đồ</p>
                    <p className="text-xs text-neutral-500">Tọa độ được ẩn, chỉ chọn bằng cách click trên map.</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-orange-300 bg-white px-3 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                    onClick={() => setIsEditMapPickerOpen(true)}
                  >
                    Chọn trên map
                  </button>
                </div>
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  {hasPickedEditCoordinates
                    ? `Đã chọn: ${currentEditLatitude.toFixed(6)}, ${currentEditLongitude.toFixed(6)}`
                    : 'Chưa chọn vị trí'}
                </p>
              </div>
              </section>

              <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold text-neutral-600">Tiện ích</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => {
                    const active = selectedAmenityIds.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-orange-500 bg-orange-500 text-white'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {amenity.name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold text-neutral-600">Ảnh hiện có (chọn ảnh đại diện)</span>
                {existingImageUrls.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-500">Không còn ảnh hiện có.</p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {existingImageUrls.map((url, index) => {
                      const key = `existing-${index}`;
                      const isPrimary = primaryImageKey === key;
                      return (
                        <div key={key} className="relative overflow-hidden rounded-xl border border-neutral-200">
                          <img src={url} alt={`Existing ${index + 1}`} className="h-24 w-full object-cover" />
                          <div className="absolute inset-x-1 top-1 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isPrimary ? 'bg-orange-500 text-white' : 'bg-white/90 text-neutral-700'
                              }`}
                              onClick={() => setPrimaryImageKey(key)}
                            >
                              Đại diện
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white"
                              onClick={() => removeExistingImage(index)}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-orange-100 bg-gradient-to-b from-orange-50/50 to-white p-4">
                <span className="text-xs font-semibold text-neutral-600">Thêm ảnh mới (có thể chọn đại diện)</span>
                <label className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-sm font-semibold text-neutral-700 hover:bg-neutral-100">
                  Chọn ảnh mới
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (files.length === 0) {
                        return;
                      }
                      setNewImages((prev) => [...prev, ...files]);
                      if (!primaryImageKey && existingImageUrls.length === 0) {
                        setPrimaryImageKey('new-0');
                      }
                    }}
                  />
                </label>

                {newImagePreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {newImagePreviews.map((url, index) => {
                      const key = `new-${index}`;
                      const isPrimary = primaryImageKey === key;
                      return (
                        <div key={key} className="relative overflow-hidden rounded-xl border border-neutral-200">
                          <img src={url} alt={`New ${index + 1}`} className="h-24 w-full object-cover" />
                          <div className="absolute inset-x-1 top-1 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isPrimary ? 'bg-orange-500 text-white' : 'bg-white/90 text-neutral-700'
                              }`}
                              onClick={() => setPrimaryImageKey(key)}
                            >
                              Đại diện
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white"
                              onClick={() => removeNewImage(index)}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 mt-5 flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={closeEditModal}
              >
                Hủy
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                onClick={saveListingEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRoom && isEditMapPickerOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/55 px-3">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Chọn vị trí trên bản đồ</p>
                <p className="text-xs text-neutral-500">Click trực tiếp lên bản đồ để đặt tọa độ cho tin</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                onClick={() => setIsEditMapPickerOpen(false)}
                aria-label="Đóng chọn vị trí"
              >
                ✕
              </button>
            </div>

            <MapContainer center={editMapCenter} zoom={15} scrollWheelZoom className="h-[520px] w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <EditMapClickHandler
                onPick={(lat, lng) => {
                  setEditForm((prev) => ({
                    ...prev,
                    latitude: String(lat),
                    longitude: String(lng),
                  }));
                  setEditMapCenter([lat, lng]);
                }}
              />
              {hasPickedEditCoordinates && (
                <Marker position={[currentEditLatitude, currentEditLongitude]} icon={buildRoomMarkerIcon(existingImageUrls[0])}>
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold">Vị trí đã chọn</p>
                      <p className="mt-1">
                        {currentEditLatitude.toFixed(6)}, {currentEditLongitude.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            <div className="flex items-center justify-end border-t border-neutral-200 px-4 py-3">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
                onClick={() => setIsEditMapPickerOpen(false)}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function UserProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [ratings, setRatings] = useState<UserProfileRating[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomStatusFilter, setRoomStatusFilter] = useState<'AVAILABLE' | 'RENTED'>('AVAILABLE');
  const [roomPage, setRoomPage] = useState(1);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingImage, setRatingImage] = useState<File | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [reportImage, setReportImage] = useState<File | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const roomPageSize = 6;

  const normalizeSocialUrl = (value?: string | null) => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!getAuthToken()) {
        setError('Vui lòng đăng nhập để xem trang cá nhân.');
        setLoading(false);
        return;
      }
      if (!userId || Number.isNaN(Number(userId))) {
        setError('Người dùng không hợp lệ.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [currentUser, response] = await Promise.all([
          get<PublicUserProfile>('/api/users/me'),
          get<PublicUserProfile>(`/api/users/${userId}`),
        ]);
        setViewerId(currentUser.id ?? null);
        setProfile(response);

        setLoadingRooms(true);
        const roomResponse = await get<ApiResponse<Room[]>>(`/api/users/${userId}/rooms`);
        const filtered = (roomResponse.data ?? [])
          .map(normalizeRoom)
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
        setPublicRooms(filtered);
        setRoomPage(1);

        if (currentUser.id && response.id && currentUser.id !== response.id) {
          setLoadingRatings(true);
          const ratingResponse = await get<ApiResponse<UserProfileRating[]>>(`/api/user-ratings/user/${response.id}`);
          setRatings(ratingResponse.data ?? []);
        } else {
          setRatings([]);
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải trang cá nhân.');
      } finally {
        setLoadingRatings(false);
        setLoadingRooms(false);
        setLoading(false);
      }
    };

    void loadProfile();
  }, [userId]);

  const openChat = () => {
    if (!profile?.id) {
      return;
    }
    const name = encodeURIComponent(profile.displayName || profile.username || 'Người dùng');
    navigate(`/chat?userId=${profile.id}&name=${name}`);
  };

  const submitReport = async () => {
    if (!profile?.id) {
      return;
    }

    const description = reportDescription.trim();
    if (!description) {
      setReportError('Vui lòng nhập mô tả tố cáo.');
      return;
    }

    try {
      setIsSubmittingReport(true);
      setReportError(null);
      setReportMessage(null);

      const form = new FormData();
      form.append('reportedUserId', String(profile.id));
      form.append('description', description);
      if (reportImage) {
        form.append('image', reportImage);
      }

      const response = await postFormData<ApiResponse<null>>('/api/reports/users', form);
      setReportMessage(response.message || 'Đã gửi tố cáo thành công.');
      setReportDescription('');
      setReportImage(null);
      window.setTimeout(() => {
        setIsReportOpen(false);
        setReportMessage(null);
      }, 1200);
    } catch (submitError) {
      setReportError(submitError instanceof Error ? submitError.message : 'Không thể gửi tố cáo lúc này.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const submitRating = async () => {
    if (!profile?.id) {
      return;
    }

    const comment = ratingComment.trim();
    if (!comment) {
      setRatingError('Vui lòng nhập bình luận đánh giá.');
      return;
    }

    try {
      setSubmittingRating(true);
      setRatingError(null);
      setRatingMessage(null);

      const form = new FormData();
      form.append('ratedUserId', String(profile.id));
      form.append('stars', String(ratingStars));
      form.append('comment', comment);
      if (ratingImage) {
        form.append('image', ratingImage);
      }

      const response = await postFormData<ApiResponse<null>>('/api/user-ratings', form);
      setRatingMessage(response.message || 'Đã gửi đánh giá thành công.');
      const ratingResponse = await get<ApiResponse<UserProfileRating[]>>(`/api/user-ratings/user/${profile.id}`);
      setRatings(ratingResponse.data ?? []);
      setRatingComment('');
      setRatingImage(null);
      setRatingStars(5);
      window.setTimeout(() => {
        setIsRatingModalOpen(false);
        setRatingMessage(null);
      }, 1000);
    } catch (submitError) {
      setRatingError(submitError instanceof Error ? submitError.message : 'Không thể gửi đánh giá lúc này.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const availableRoomsCount = useMemo(
    () => publicRooms.filter((room) => room.status === 'AVAILABLE').length,
    [publicRooms]
  );
  const rentedRoomsCount = useMemo(
    () => publicRooms.filter((room) => room.status === 'RENTED').length,
    [publicRooms]
  );
  const filteredPublicRooms = useMemo(
    () => publicRooms.filter((room) => room.status === roomStatusFilter),
    [publicRooms, roomStatusFilter]
  );
  const totalRoomPages = Math.max(1, Math.ceil(filteredPublicRooms.length / roomPageSize));
  const paginatedPublicRooms = useMemo(() => {
    const start = (roomPage - 1) * roomPageSize;
    return filteredPublicRooms.slice(start, start + roomPageSize);
  }, [filteredPublicRooms, roomPage]);
  useEffect(() => {
    setRoomPage(1);
  }, [roomStatusFilter]);
  const averageStars = useMemo(() => {
    if (ratings.length === 0) {
      return 0;
    }
    const total = ratings.reduce((sum, item) => sum + item.stars, 0);
    return Math.round((total / ratings.length) * 10) / 10;
  }, [ratings]);
  const isOwnProfile = Boolean(profile?.id && viewerId && profile.id === viewerId);

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-neutral-600">Đang tải trang cá nhân...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : profile ? (
          <>
            <div className="rounded-3xl bg-gradient-to-r from-orange-50 to-amber-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || profile.username || 'U')}&background=ffedd5&color=ea580c&bold=true`}
                    alt={profile.displayName || profile.username || 'Người dùng'}
                    className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-sm"
                  />
                  <div>
                    <h1 className="text-2xl font-bold text-neutral-900">{profile.displayName || profile.username}</h1>
                    {isOwnProfile && <p className="text-sm text-neutral-500">@{profile.username}</p>}
                    <p className="mt-2 text-sm text-neutral-700">{profile.bio || 'Chưa có mô tả hồ sơ.'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!isOwnProfile && (
                    <>
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600"
                        onClick={openChat}
                      >
                        Nhắn tin
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-300 bg-white px-5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                        onClick={() => {
                          setRatingError(null);
                          setRatingMessage(null);
                          setIsRatingModalOpen(true);
                        }}
                      >
                        Đánh giá
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-300 bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        onClick={() => {
                          setReportError(null);
                          setReportMessage(null);
                          setIsReportOpen(true);
                        }}
                      >
                        Tố cáo
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <p className="text-neutral-500">Số điện thoại</p>
                <p className="mt-1 font-semibold text-neutral-800">{profile.phone || 'Chưa cập nhật'}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <p className="text-neutral-500">Địa chỉ</p>
                <p className="mt-1 font-semibold text-neutral-800">{profile.address || 'Chưa cập nhật'}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <p className="text-neutral-500">Ngày tham gia</p>
                <p className="mt-1 font-semibold text-neutral-800">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN') : 'Chưa xác định'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">Liên kết mạng xã hội</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {normalizeSocialUrl(profile.facebook) && (
                  <a
                    href={normalizeSocialUrl(profile.facebook) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Facebook
                  </a>
                )}
                {normalizeSocialUrl(profile.instagram) && (
                  <a
                    href={normalizeSocialUrl(profile.instagram) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-pink-200 bg-pink-50 px-4 text-sm font-semibold text-pink-700 hover:bg-pink-100"
                  >
                    Instagram
                  </a>
                )}
                {normalizeSocialUrl(profile.linkedin) && (
                  <a
                    href={normalizeSocialUrl(profile.linkedin) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    LinkedIn
                  </a>
                )}
                {!normalizeSocialUrl(profile.facebook) &&
                  !normalizeSocialUrl(profile.instagram) &&
                  !normalizeSocialUrl(profile.linkedin) && (
                    <p className="text-sm text-neutral-500">Người dùng chưa thêm liên kết mạng xã hội.</p>
                  )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">Tất cả tin đăng</h2>
                <span className="text-sm font-semibold text-neutral-700">{publicRooms.length} tin</span>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition ${
                    roomStatusFilter === 'AVAILABLE'
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => setRoomStatusFilter('AVAILABLE')}
                >
                  Tin đang hoạt động ({availableRoomsCount})
                </button>
                <button
                  type="button"
                  className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition ${
                    roomStatusFilter === 'RENTED'
                      ? 'border-neutral-700 bg-neutral-700 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => setRoomStatusFilter('RENTED')}
                >
                  Đã cho thuê ({rentedRoomsCount})
                </button>
              </div>

              {loadingRooms ? (
                <p className="text-sm text-neutral-500">Đang tải danh sách phòng...</p>
              ) : filteredPublicRooms.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {roomStatusFilter === 'AVAILABLE'
                    ? 'Chưa có tin đang hoạt động.'
                    : 'Chưa có tin nào đã cho thuê.'}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {paginatedPublicRooms.map((room) => (
                      <article
                        key={`profile-room-${room.id}`}
                        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
                      >
                        <img
                          src={room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                          alt={room.title}
                          className="h-36 w-full object-cover"
                        />
                        <div className="space-y-1 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold ${
                                room.status === 'RENTED'
                                  ? 'bg-neutral-200 text-neutral-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {room.status === 'RENTED' ? 'Đã cho thuê' : 'Đang trống'}
                            </span>
                          </div>
                          <h3 className="line-clamp-2 text-sm font-semibold text-neutral-900">{room.title}</h3>
                          <p className="text-base font-extrabold text-[#d0021b]">{formatPricePerMonth(room.price ?? 0)}</p>
                          <p className="line-clamp-1 text-xs text-neutral-600">📍 {room.province || 'Đang cập nhật'}</p>
                          <button
                            type="button"
                            className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                            onClick={() => navigate(`/rooms/${room.id}`)}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {totalRoomPages > 1 && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={roomPage <= 1}
                        className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setRoomPage((prev) => Math.max(1, prev - 1))}
                      >
                        Trước
                      </button>
                      {Array.from({ length: totalRoomPages }, (_, index) => index + 1).map((page) => (
                        <button
                          key={`profile-room-page-${page}`}
                          type="button"
                          className={`h-9 rounded-xl border px-3 text-sm transition ${
                            roomPage === page
                              ? 'border-orange-500 bg-orange-500 text-white'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                          }`}
                          onClick={() => setRoomPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={roomPage >= totalRoomPages}
                        className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setRoomPage((prev) => Math.min(totalRoomPages, prev + 1))}
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isOwnProfile && (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">Đánh giá người dùng</h2>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                    <span>{averageStars > 0 ? averageStars.toFixed(1) : '0.0'}</span>
                    <span>★</span>
                    <span className="text-xs text-amber-600">({ratings.length} đánh giá)</span>
                  </div>
                </div>

                {loadingRatings ? (
                  <p className="text-sm text-neutral-500">Đang tải đánh giá...</p>
                ) : ratings.length === 0 ? (
                  <p className="text-sm text-neutral-500">Chưa có đánh giá nào cho người dùng này.</p>
                ) : (
                  <div className="space-y-3">
                    {ratings.map((rating) => (
                      <article key={`profile-rating-${rating.id}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                rating.raterAvatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(rating.raterName || 'U')}&background=fef3c7&color=b45309&bold=true`
                              }
                              alt={rating.raterName}
                              className="h-10 w-10 rounded-full border border-amber-200 object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">{rating.raterName}</p>
                              <p className="text-xs text-neutral-500">
                                {rating.createdAt ? new Date(rating.createdAt).toLocaleDateString('vi-VN') : 'Không rõ thời gian'}
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                            {'★'.repeat(Math.max(1, Math.min(5, rating.stars)))}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-neutral-700">{rating.comment}</p>
                        {rating.imageUrl && (
                          <a href={rating.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                            <img src={rating.imageUrl} alt="Minh chứng đánh giá" className="h-36 w-full rounded-xl object-cover" />
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {isRatingModalOpen && !isOwnProfile && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-amber-100 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-neutral-900">Đánh giá người dùng</h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                onClick={() => {
                  if (submittingRating) {
                    return;
                  }
                  setIsRatingModalOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-neutral-600">
              Bạn chỉ có thể đánh giá người dùng khi hai bên đã từng nhắn tin qua lại với nhau.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-neutral-700">Số sao</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={`rating-star-${value}`}
                      type="button"
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-lg font-bold transition ${
                        ratingStars >= value
                          ? 'border-amber-400 bg-amber-100 text-amber-700'
                          : 'border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50'
                      }`}
                      onClick={() => setRatingStars(value)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={ratingComment}
                onChange={(event) => setRatingComment(event.target.value)}
                placeholder="Nhập nhận xét của bạn..."
                className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-300"
              />

              <label className="block text-sm font-semibold text-neutral-700">Ảnh minh chứng (không bắt buộc)</label>
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setRatingImage(file);
                }}
              />
              {ratingImage && <p className="text-xs text-neutral-500">Đã chọn: {ratingImage.name}</p>}
            </div>

            {ratingError && <p className="mt-3 text-sm font-semibold text-red-600">{ratingError}</p>}
            {ratingMessage && <p className="mt-3 text-sm font-semibold text-emerald-600">{ratingMessage}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() => setIsRatingModalOpen(false)}
                disabled={submittingRating}
              >
                Hủy
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                onClick={() => void submitRating()}
                disabled={submittingRating}
              >
                {submittingRating ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isReportOpen && !isOwnProfile && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-neutral-900">Tố cáo người dùng</h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                onClick={() => {
                  if (isSubmittingReport) {
                    return;
                  }
                  setIsReportOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-neutral-600">
              Báo cáo sẽ được gửi vào hệ thống để admin xem xét. Bạn chỉ có thể tố cáo người đã từng nhắn tin với mình.
            </p>

            <div className="mt-4 space-y-3">
              <textarea
                value={reportDescription}
                onChange={(event) => setReportDescription(event.target.value)}
                placeholder="Mô tả nội dung tố cáo..."
                className="min-h-[130px] w-full rounded-2xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-300"
              />
              <label className="block text-sm font-semibold text-neutral-700">Ảnh minh chứng (không bắt buộc)</label>
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setReportImage(file);
                }}
              />
              {reportImage && <p className="text-xs text-neutral-500">Đã chọn: {reportImage.name}</p>}
            </div>

            {reportError && <p className="mt-3 text-sm font-semibold text-red-600">{reportError}</p>}
            {reportMessage && <p className="mt-3 text-sm font-semibold text-emerald-600">{reportMessage}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() => setIsReportOpen(false)}
                disabled={isSubmittingReport}
              >
                Hủy
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                onClick={() => void submitReport()}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? 'Đang gửi...' : 'Gửi tố cáo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactPreviews, setContactPreviews] = useState<Record<number, { text: string; time: string }>>({});
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactProfile, setSelectedContactProfile] = useState<PublicUserProfile | null>(null);
  const [isMediaPanelOpen, setIsMediaPanelOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingText, setSendingText] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialUserId = query.get('userId') ? Number(query.get('userId')) : null;
  const initialName = query.get('name') || 'Chủ trọ';

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const filteredContacts = useMemo(() => {
    const key = contactSearch.trim().toLowerCase();
    if (!key) {
      return contacts;
    }
    return contacts.filter((contact) => {
      const name = (contact.displayName || contact.username || '').toLowerCase();
      return name.includes(key);
    });
  }, [contacts, contactSearch]);

  const mediaMessages = useMemo(
    () =>
      messages
        .filter((msg) => isImageMessage(normalizeChatMessageContent(msg.content)))
        .slice()
        .reverse(),
    [messages]
  );

  const fileMessages = useMemo(
    () =>
      messages
        .filter((msg) => {
          const normalized = normalizeChatMessageContent(msg.content);
          return /^https?:\/\//i.test(normalized) && !isImageMessage(normalized);
        })
        .slice()
        .reverse(),
    [messages]
  );

  const formatPreviewTime = (timestamp?: string) => {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const now = new Date();
    const sameDay =
      date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return sameDay
      ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const toPreviewText = (content: string) => {
    const normalized = normalizeChatMessageContent(content);
    if (isImageMessage(normalized)) {
      return 'Da gui anh';
    }
    if (/^https?:\/\//i.test(normalized)) {
      return 'Da gui lien ket';
    }
    return normalized;
  };

  const fetchHistory = async (otherUserId: number, silent = false, markRead = false) => {
    if (!silent) {
      setLoadingMessages(true);
    }
    try {
      if (markRead) {
        await put<string>(`/api/chat/read/${otherUserId}`);
        setContacts((prev) =>
          prev.map((contact) => (contact.id === otherUserId ? { ...contact, unreadCount: 0 } : contact))
        );
      }

      const data = await get<ChatMessage[]>(`/api/chat/history/${otherUserId}`);
      setMessages(data ?? []);
      const last = data && data.length > 0 ? data[data.length - 1] : null;
      setContactPreviews((prev) => ({
        ...prev,
        [otherUserId]: {
          text: last ? toPreviewText(last.content) : 'Chua co tin nhan',
          time: last ? formatPreviewTime(last.timestamp) : '',
        },
      }));
      setChatError(null);
    } catch (error) {
      if (!silent) {
        setChatError(error instanceof Error ? error.message : 'Không thể tải lịch sử chat.');
      }
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  };

  useEffect(() => {
    const loadChatData = async () => {
      if (!getAuthToken()) {
        setChatError('Vui lòng đăng nhập để sử dụng nhắn tin.');
        setLoadingContacts(false);
        return;
      }
      try {
        setLoadingContacts(true);
        const [currentUser, contactData] = await Promise.all([
          get<UserProfile>('/api/users/me'),
          get<ChatContact[]>('/api/chat/contacts'),
        ]);

        setMe(currentUser);

        const dedupContacts = new Map<number, ChatContact>();
        (contactData ?? []).forEach((contact) => dedupContacts.set(contact.id, contact));

        if (initialUserId && !dedupContacts.has(initialUserId) && (!currentUser || initialUserId !== currentUser.id)) {
          dedupContacts.set(initialUserId, {
            id: initialUserId,
            displayName: initialName,
            username: initialName,
            avatarUrl: null,
          });
        }

        const nextContacts = Array.from(dedupContacts.values());
        setContacts(nextContacts);
        const previewResults = await Promise.all(
          nextContacts.map(async (contact) => {
            try {
              const history = await get<ChatMessage[]>(`/api/chat/history/${contact.id}`);
              const last = history && history.length > 0 ? history[history.length - 1] : null;
              return {
                id: contact.id,
                text: last ? toPreviewText(last.content) : 'Chua co tin nhan',
                time: last ? formatPreviewTime(last.timestamp) : '',
              };
            } catch {
              return {
                id: contact.id,
                text: 'Chua co tin nhan',
                time: '',
              };
            }
          })
        );
        setContactPreviews(
          previewResults.reduce<Record<number, { text: string; time: string }>>((acc, item) => {
            acc[item.id] = { text: item.text, time: item.time };
            return acc;
          }, {})
        );
        if (initialUserId && dedupContacts.has(initialUserId)) {
          setSelectedContactId(initialUserId);
          await fetchHistory(initialUserId, false, true);
        }
        setChatError(null);
      } catch (error) {
        setChatError(error instanceof Error ? error.message : 'Không thể tải dữ liệu nhắn tin.');
      } finally {
        setLoadingContacts(false);
      }
    };

    loadChatData();
  }, [initialUserId, initialName]);

  useEffect(() => {
    if (!selectedContactId) {
      return;
    }

    const loadProfile = async () => {
      try {
        const profile = await get<PublicUserProfile>(`/api/users/${selectedContactId}`);
        setSelectedContactProfile(profile);
      } catch {
        setSelectedContactProfile(null);
      }
    };

    void loadProfile();

    const timer = window.setInterval(() => {
      void fetchHistory(selectedContactId, true, true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [selectedContactId]);

  useEffect(() => {
    if (!getAuthToken()) {
      return;
    }

    const refreshContactUnread = async () => {
      try {
        const latestContacts = await get<ChatContact[]>('/api/chat/contacts');
        setContacts((prev) => {
          const latestById = new Map((latestContacts ?? []).map((item) => [item.id, item]));
          return prev.map((contact) => {
            const latest = latestById.get(contact.id);
            if (!latest) {
              return contact;
            }
            return {
              ...contact,
              unreadCount: latest.unreadCount ?? 0,
            };
          });
        });
      } catch {
        // no-op
      }
    };

    const timer = window.setInterval(() => {
      void refreshContactUnread();
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsMediaPanelOpen(false);
    setPendingImageFile(null);
    setPendingImagePreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedContactId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (pendingImagePreviewUrl) {
        URL.revokeObjectURL(pendingImagePreviewUrl);
      }
    };
  }, [pendingImagePreviewUrl]);

  useEffect(() => {
    if (!lightboxImageUrl) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxImageUrl(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImageUrl]);

  const openImageLightbox = (imageUrl: string) => {
    setLightboxImageUrl(imageUrl);
  };

  const closeImageLightbox = () => {
    setLightboxImageUrl(null);
  };

  const onSendText = async () => {
    if (!selectedContactId || !messageInput.trim()) {
      return;
    }
    try {
      setSendingText(true);
      await post<string, string>(`/api/chat/send?toUserId=${selectedContactId}`, messageInput.trim());
      setMessageInput('');
      await fetchHistory(selectedContactId, true);
      setChatError(null);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSendingText(false);
    }
  };

  const onSendImage = async (file?: File) => {
    if (!selectedContactId || !file) {
      return;
    }
    try {
      setSendingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      await postFormData<string>(`/api/chat/send-image?toUserId=${selectedContactId}`, formData);
      await fetchHistory(selectedContactId, true);
      setChatError(null);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Không thể gửi ảnh.');
    } finally {
      setSendingImage(false);
      setPendingImageFile(null);
      setPendingImagePreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="h-[calc(100vh-145px)] overflow-hidden border-y border-neutral-200 bg-white shadow-sm">
      <div className={`grid h-full min-h-0 grid-cols-1 md:grid-cols-[320px_1fr] ${selectedContactId ? 'xl:grid-cols-[320px_1fr_320px]' : 'xl:grid-cols-[320px_1fr]'}`}>
        <aside className={`border-r border-neutral-200 bg-[#f6f8fb] ${selectedContactId ? 'hidden md:block' : 'block'}`}>
          <div className="border-b border-neutral-200 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Nhắn tin</p>
            <h2 className="mt-2 text-xl font-bold text-neutral-900">Tin nhắn của bạn</h2>
            <input
              className="mt-3 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none"
              placeholder="Tìm kiếm cuộc trò chuyện"
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
            />
          </div>
          <div className="h-[calc(100%-76px)] overflow-y-auto px-2 py-2">
            {loadingContacts ? (
              <p className="px-3 py-4 text-sm text-neutral-500">Đang tải danh bạ...</p>
            ) : filteredContacts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-neutral-500">Chưa có cuộc trò chuyện nào.</p>
            ) : (
              filteredContacts.map((contact) => {
                const active = contact.id === selectedContactId;
                const preview = contactPreviews[contact.id];
                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      active ? 'bg-orange-100' : 'hover:bg-neutral-100'
                    }`}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      void fetchHistory(contact.id, false, true);
                    }}
                  >
                    <img
                      src={contact.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.displayName || contact.username || 'U')}&background=ffedd5&color=ea580c&bold=true`}
                      alt={contact.displayName || contact.username || 'Người dùng'}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {contact.displayName || contact.username || `Người dùng #${contact.id}`}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {preview?.time && <span className="shrink-0 text-[11px] text-neutral-400">{preview.time}</span>}
                          {!!contact.unreadCount && contact.unreadCount > 0 && (
                            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">
                              {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="truncate text-xs text-neutral-500">{preview?.text || 'Chua co tin nhan'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className={`h-full min-h-0 flex-col bg-[#f1f4f8] ${selectedContactId ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 md:hidden"
              onClick={() => setSelectedContactId(null)}
              aria-label="Quay lại danh sách chat"
            >
              ←
            </button>
            {selectedContact ? (
              <>
                <img
                  src={selectedContact.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.displayName || selectedContact.username || 'U')}&background=ffedd5&color=ea580c&bold=true`}
                  alt={selectedContact.displayName || selectedContact.username || 'Người dùng'}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {selectedContact.displayName || selectedContact.username || `Người dùng #${selectedContact.id}`}
                  </p>
                  <p className="text-xs text-neutral-500">Trò chuyện trực tiếp</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-500">Chọn một cuộc trò chuyện để bắt đầu.</p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loadingMessages ? (
              <p className="text-sm text-neutral-500">Đang tải tin nhắn...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-neutral-500">Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.</p>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => {
                  const mine = me && msg.senderId === me.id;
                  const normalizedContent = normalizeChatMessageContent(msg.content);
                  const image = isImageMessage(normalizedContent);
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          mine ? 'bg-orange-500 text-white' : 'bg-white text-neutral-800'
                        }`}
                      >
                        {image ? (
                          <button
                            type="button"
                            className="block"
                            onClick={() => openImageLightbox(normalizedContent)}
                            title="Nhấn để xem ảnh lớn"
                          >
                            <img src={normalizedContent} alt="Ảnh chat" className="max-h-56 w-full rounded-xl object-cover" />
                          </button>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{normalizedContent}</p>
                        )}
                        <p className={`mt-1 text-[11px] ${mine ? 'text-orange-100' : 'text-neutral-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3">
            {chatError && <p className="mb-2 text-sm text-red-600">{chatError}</p>}
            {pendingImagePreviewUrl && (
              <div className="mb-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Xem trước ảnh</p>
                <div className="flex flex-wrap items-end gap-3">
                  <img src={pendingImagePreviewUrl} alt="Preview trước khi gửi" className="h-24 w-24 rounded-xl object-cover" />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                      disabled={sendingImage || !selectedContactId || !pendingImageFile}
                      onClick={() => void onSendImage(pendingImageFile ?? undefined)}
                    >
                      {sendingImage ? 'Đang gửi...' : 'Gửi ảnh này'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                      disabled={sendingImage}
                      onClick={() => {
                        setPendingImageFile(null);
                        setPendingImagePreviewUrl((prev) => {
                          if (prev) {
                            URL.revokeObjectURL(prev);
                          }
                          return null;
                        });
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Hủy ảnh
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setPendingImageFile(file);
                    setPendingImagePreviewUrl((prev) => {
                      if (prev) {
                        URL.revokeObjectURL(prev);
                      }
                      return URL.createObjectURL(file);
                    });
                  }
                }}
              />
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-300 text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedContactId || sendingImage}
                title="Gửi ảnh"
              >
                {sendingImage ? '...' : '📷'}
              </button>
              <textarea
                rows={1}
                className="max-h-36 min-h-[44px] flex-1 resize-y rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                placeholder={selectedContactId ? 'Nhập tin nhắn...' : 'Chọn cuộc trò chuyện để bắt đầu'}
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void onSendText();
                  }
                }}
                disabled={!selectedContactId || sendingText}
              />
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                onClick={() => void onSendText()}
                disabled={!selectedContactId || sendingText || !messageInput.trim()}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>

        {selectedContactId && (
        <aside className="hidden border-l border-neutral-200 bg-[#f8fafc] xl:flex xl:flex-col">
          <div className="border-b border-neutral-200 px-5 py-5 text-center">
            <img
              src={
                selectedContactProfile?.avatarUrl ||
                selectedContact?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  selectedContactProfile?.displayName ||
                    selectedContact?.displayName ||
                    selectedContact?.username ||
                    'U'
                )}&background=ffedd5&color=ea580c&bold=true`
              }
              alt={selectedContactProfile?.displayName || selectedContact?.displayName || 'Người dùng'}
              className="mx-auto h-20 w-20 rounded-full object-cover"
            />
            <p className="mt-3 text-lg font-bold text-neutral-900">
              {selectedContactProfile?.displayName || selectedContact?.displayName || selectedContact?.username || 'Chưa chọn'}
            </p>
            <button
              type="button"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
              disabled={!selectedContactId}
              onClick={() => {
                if (selectedContactId) {
                  navigate(`/profile/${selectedContactId}`);
                }
              }}
            >
              Trang cá nhân
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left"
                onClick={() => setIsMediaPanelOpen((prev) => !prev)}
              >
                <span className="text-sm font-semibold text-neutral-900">File phương tiện & File</span>
                <span className="text-xs text-neutral-500">{isMediaPanelOpen ? 'Thu gọn' : 'Mở'}</span>
              </button>

              {isMediaPanelOpen && (
                <div className="mt-3">
                  {mediaMessages.length === 0 && fileMessages.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-500">Chưa có ảnh hoặc file trong cuộc trò chuyện này.</p>
                  ) : (
                    <>
                      {mediaMessages.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Ảnh</p>
                          <div className="grid grid-cols-3 gap-2">
                            {mediaMessages.slice(0, 12).map((msg) => {
                              const normalizedContent = normalizeChatMessageContent(msg.content);
                              return (
                                <button
                                  key={`media-${msg.id}`}
                                  type="button"
                                  className="block"
                                  onClick={() => openImageLightbox(normalizedContent)}
                                  title="Nhấn để xem ảnh lớn"
                                >
                                  <img src={normalizedContent} alt="Ảnh chat" className="h-20 w-full rounded-lg object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {fileMessages.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">File</p>
                          <div className="space-y-2">
                            {fileMessages.slice(0, 10).map((msg) => {
                              const normalizedContent = normalizeChatMessageContent(msg.content);
                              return (
                                <a
                                  key={`file-${msg.id}`}
                                  href={normalizedContent}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block truncate rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-blue-600 hover:bg-neutral-50"
                                >
                                  {normalizedContent}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
        )}
      </div>

      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
          onClick={closeImageLightbox}
        >
          <div className="relative flex h-full w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="absolute right-2 top-2 z-10 h-10 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
              onClick={closeImageLightbox}
            >
              Đóng
            </button>

            <div className="h-[90vh] w-[92vw] overflow-hidden rounded-2xl bg-transparent p-2 text-center">
              <img
                src={lightboxImageUrl}
                alt="Ảnh chat phóng to"
                className="h-full w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type RoomListPageProps = {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  provinces: Province[];
  districts: District[];
  wards: Ward[];
  selectedProvinceCode: number | null;
  selectedDistrictCode: number | null;
  selectedWardCode: number | null;
  priceFilter: string;
  selectedAmenities: string[];
  amenityOptions: string[];
  searchKeyword: string;
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onChangeProvince: (value: number | null) => void;
  onChangeDistrict: (value: number | null) => void;
  onChangeWard: (value: number | null) => void;
  onChangePrice: (value: string) => void;
  onToggleAmenity: (value: string) => void;
  onChangeSearch: (value: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onToggleFavorite: (roomId: number) => void;
  onOpenChat: (userId?: number | null, displayName?: string | null) => void;
  onOpenProfile: (userId?: number | null) => void;
  onViewRoom: (room: Room) => void;
  onPageChange: (value: number) => void;
};

function RoomListPage({
  rooms,
  loading,
  error,
  provinces,
  districts,
  wards,
  selectedProvinceCode,
  selectedDistrictCode,
  selectedWardCode,
  priceFilter,
  selectedAmenities,
  amenityOptions,
  searchKeyword,
  currentPage,
  totalPages,
  totalResults,
  onChangeProvince,
  onChangeDistrict,
  onChangeWard,
  onChangePrice,
  onToggleAmenity,
  onChangeSearch,
  onApplyFilters,
  onResetFilters,
  onToggleFavorite,
  onOpenChat,
  onOpenProfile,
  onViewRoom,
  onPageChange,
}: RoomListPageProps) {
  const [showAuthPrompt, setShowAuthPrompt] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getAuthToken()));
  const [openFilterPanel, setOpenFilterPanel] = useState<'location' | 'price' | 'amenity' | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyIndex, setNearbyIndex] = useState(0);
  const filterGroupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncAuthState = () => setIsLoggedIn(Boolean(getAuthToken()));
    const onAuthStateChanged = () => syncAuthState();

    window.addEventListener('auth-state-changed', onAuthStateChanged);
    window.addEventListener('storage', syncAuthState);
    return () => {
      window.removeEventListener('auth-state-changed', onAuthStateChanged);
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setUserCoords(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!filterGroupRef.current) {
        return;
      }
      if (!filterGroupRef.current.contains(event.target as Node)) {
        setOpenFilterPanel(null);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedProvinceName = provinces.find((item) => item.code === selectedProvinceCode)?.name;
  const selectedDistrictName = districts.find((item) => item.code === selectedDistrictCode)?.name;
  const selectedWardName = wards.find((item) => item.code === selectedWardCode)?.name;
  const selectedLocationLabel = [selectedWardName, selectedDistrictName, selectedProvinceName]
    .filter(Boolean)
    .join(' - ');
  const selectedPriceLabel = PRICE_OPTIONS.find((item) => item.value === priceFilter)?.label ?? 'Tất cả mức giá';
  const selectedAmenityLabel =
    selectedAmenities.length === 0 ? 'Tất cả tiện ích' : `${selectedAmenities.length} tiện ích`;

  const nearbyRooms = useMemo<RoomWithDistance[]>(() => {
    const roomsWithCoords = rooms.filter(
      (room) =>
        typeof room.latitude === 'number' &&
        typeof room.longitude === 'number' &&
        !Number.isNaN(room.latitude) &&
        !Number.isNaN(room.longitude)
    );
    if (roomsWithCoords.length === 0) {
      return [] as RoomWithDistance[];
    }
    if (!userCoords) {
      return roomsWithCoords.slice(0, 20).map((room) => ({ ...room }));
    }
    return [...roomsWithCoords]
      .map((room) => ({
        ...room,
        distanceKm: distanceInKm(userCoords.lat, userCoords.lng, room.latitude as number, room.longitude as number),
      }))
      .filter((room) => typeof room.distanceKm === 'number' && room.distanceKm <= 5)
      .sort((a, b) => {
        const dA = a.distanceKm as number;
        const dB = b.distanceKm as number;
        return dA - dB;
      })
      .slice(0, 20);
  }, [rooms, userCoords]);

  const nearbyPageSize = 5;
  const nearbyTotalPages = Math.max(1, Math.ceil(nearbyRooms.length / nearbyPageSize));
  const nearbyVisibleRooms = useMemo<RoomWithDistance[]>(() => {
    const start = nearbyIndex * nearbyPageSize;
    return nearbyRooms.slice(start, start + nearbyPageSize);
  }, [nearbyRooms, nearbyIndex]);

  useEffect(() => {
    setNearbyIndex(0);
  }, [nearbyRooms.length]);

  return (
    <section className="space-y-4">
      <header className="mx-auto w-full max-w-[1240px] overflow-visible rounded-[34px] bg-gradient-to-r from-orange-500 via-orange-500 to-orange-400 shadow-xl text-white">
        <div className="relative flex flex-col justify-center overflow-visible px-5 py-7 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-4xl text-center text-white">
            <p className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              Giá tốt, gần bạn, chốt nhanh!
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 sm:text-sm">
              TimTro · Tìm phòng trọ · Nhà thuê
            </p>
          </div>

          <div className="mx-auto mt-5 w-full rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur-xl lg:max-w-[1060px]">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
              <input
                value={searchKeyword}
                onChange={(event) => onChangeSearch(event.target.value)}
                placeholder="Tìm theo tiêu đề phòng..."
                className="h-12 w-full rounded-[22px] border border-neutral-200 bg-white px-4 text-sm text-slate-900 outline-none shadow-sm"
              />
              <button
                type="button"
                onClick={onApplyFilters}
                className="inline-flex h-12 items-center justify-center rounded-[22px] bg-orange-500 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Tìm kiếm
              </button>
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex h-12 items-center justify-center rounded-[22px] border border-neutral-300 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-neutral-50"
              >
                Đặt lại
              </button>
            </div>
            <div ref={filterGroupRef} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilterPanel((prev) => (prev === 'location' ? null : 'location'))}
                  className={`w-full rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    openFilterPanel === 'location'
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                  }`}
                >
                  📍 {selectedLocationLabel || 'Địa điểm'}
                </button>
                {openFilterPanel === 'location' && (
                  <div className="absolute left-1/2 top-full z-50 mt-3 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-[28px] border border-neutral-200 bg-white p-4 shadow-2xl">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        value={selectedProvinceCode ?? ''}
                        onChange={(event) => onChangeProvince(event.target.value ? Number(event.target.value) : null)}
                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">Tỉnh/Thành</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.code} style={{ color: '#1f2937' }}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedDistrictCode ?? ''}
                        onChange={(event) => onChangeDistrict(event.target.value ? Number(event.target.value) : null)}
                        disabled={!selectedProvinceCode}
                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">{selectedProvinceCode ? 'Quận/Huyện' : 'Chọn Tỉnh/Thành trước'}</option>
                        {districts.map((district) => (
                          <option key={district.code} value={district.code} style={{ color: '#1f2937' }}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedWardCode ?? ''}
                        onChange={(event) => onChangeWard(event.target.value ? Number(event.target.value) : null)}
                        disabled={!selectedDistrictCode}
                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">{selectedDistrictCode ? 'Phường/Xã' : 'Chọn Quận/Huyện trước'}</option>
                        {wards.map((ward) => (
                          <option key={ward.code} value={ward.code} style={{ color: '#1f2937' }}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilterPanel((prev) => (prev === 'price' ? null : 'price'))}
                  className={`w-full rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    openFilterPanel === 'price'
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                  }`}
                >
                  💸 {selectedPriceLabel}
                </button>
                {openFilterPanel === 'price' && (
                  <div className="absolute left-1/2 top-full z-50 mt-3 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-[24px] border border-neutral-200 bg-white p-4 shadow-2xl">
                    <p className="mb-2 text-sm font-semibold text-slate-700">Khoảng giá</p>
                    <div className="flex flex-wrap gap-2">
                      {PRICE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onChangePrice(option.value)}
                          className={`rounded-2xl border px-4 py-2 text-sm transition ${
                            priceFilter === option.value
                              ? 'border-orange-500 bg-orange-500 text-white'
                              : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative sm:col-span-2 lg:col-span-1">
                <button
                  type="button"
                  onClick={() => setOpenFilterPanel((prev) => (prev === 'amenity' ? null : 'amenity'))}
                  className={`w-full rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    openFilterPanel === 'amenity'
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                  }`}
                >
                  🧩 {selectedAmenityLabel}
                </button>
                {openFilterPanel === 'amenity' && (
                  <div className="absolute left-1/2 top-full z-50 mt-3 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-[24px] border border-neutral-200 bg-white p-4 shadow-2xl">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">Tiện ích</p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                        onClick={() => setOpenFilterPanel(null)}
                      >
                        Xong
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {amenityOptions.map((amenity) => {
                        const checked = selectedAmenities.includes(amenity);
                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => onToggleAmenity(amenity)}
                            className={`rounded-xl border px-3 py-2 text-sm transition ${
                              checked
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-neutral-300 bg-white text-slate-700 hover:bg-neutral-50'
                            }`}
                          >
                            {amenity}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1240px] space-y-6">
        <section className="rounded-3xl border border-orange-100 bg-gradient-to-b from-orange-50/70 via-white to-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 pb-3">
            <div className="relative">
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl opacity-15">🔥</span>
              <h2 className="relative text-xl font-extrabold tracking-tight text-neutral-900">Tin đăng mới nhất</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-neutral-600 shadow-sm">
              {totalResults} kết quả
            </span>
          </div>

        {loading && <p className="text-sm text-neutral-600">Đang tải dữ liệu...</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {!loading && !error && rooms.length === 0 && (
          <p className="text-sm text-neutral-600">Hiện chưa có phòng trọ phù hợp.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {rooms.map((room) => (
            <article
              key={room.id}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl"
            >
              <div className="relative overflow-hidden">
                <img
                  src={room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                  alt={room.title}
                  className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {formatPostedTime(room.createdAt)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3.5">
                <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-neutral-900">{room.title}</h3>
                <p className="mt-2 text-lg font-extrabold text-[#d0021b]">{formatPricePerMonth(room.price ?? 0)}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="line-clamp-1">📍 {room.province || 'Đang cập nhật'}</span>
                  <span className="text-neutral-300">•</span>
                  <span>{room.area ? `${room.area} m²` : 'Đang cập nhật DT'}</span>
                </div>
                <button
                  type="button"
                  className="mt-2 w-fit rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                  onClick={() => onOpenProfile(room.ownerId)}
                >
                  Người đăng: {room.ownerName || 'Đang cập nhật'}
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 flex-1 rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
                    onClick={() => onViewRoom(room)}
                  >
                    Xem phòng
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-white transition hover:bg-neutral-50 ${
                      room.isFavorite
                        ? 'border-rose-300 text-rose-500'
                        : 'border-neutral-300 text-neutral-700'
                    }`}
                    onClick={() => onToggleFavorite(room.id)}
                    aria-label="Yêu thích"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path
                        d="M12 21s-7-4.8-9.2-8.2C.9 9.7 2.2 6 5.8 5.2A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.2-2.8c3.6.8 4.9 4.5 3 7.6C19 16.2 12 21 12 21Z"
                        fill={room.isFavorite ? 'currentColor' : 'none'}
                        stroke="currentColor"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
                    onClick={() => onOpenChat(room.ownerId, room.ownerName)}
                    aria-label="Nhắn tin"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3v-7A8.5 8.5 0 1 1 21 11.5Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            Trước
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={`h-9 rounded-xl border px-3 text-sm transition ${
                currentPage === page
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            Sau
          </button>
        </div>
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-neutral-900">Phòng trọ gần bạn</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-600 shadow-sm">
              {userCoords ? 'Hiển thị các phòng trong bán kính 5 km' : 'Bật vị trí để xem phòng trong bán kính 5 km'}
            </span>
          </div>
          <div className="relative rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            {nearbyRooms.length === 0 ? (
              <p className="text-sm text-neutral-600">
                {userCoords
                  ? 'Chưa có phòng trọ trong bán kính 5 km từ vị trí của bạn.'
                  : 'Chưa thể lấy vị trí của bạn. Hãy bật quyền định vị để xem phòng gần bạn.'}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="absolute -left-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-2xl font-bold text-neutral-700 shadow-md transition hover:bg-neutral-50 disabled:opacity-40"
                  onClick={() => setNearbyIndex((prev) => Math.max(0, prev - 1))}
                  disabled={nearbyIndex === 0}
                  aria-label="Xem nhóm phòng gần trước"
                >
                  &lt;
                </button>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {nearbyVisibleRooms.map((room) => (
                    <article
                      key={`nearby-${room.id}`}
                      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"
                    >
                      <div className="relative overflow-hidden">
                        <img
                          src={room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                          alt={room.title}
                          className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                          {formatPostedTime(room.createdAt)}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <h4 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-neutral-900">
                          {room.title}
                        </h4>
                        <p className="mt-2 text-lg font-extrabold text-[#d0021b]">{formatPricePerMonth(room.price ?? 0)}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                          <span className="line-clamp-1">📍 {room.province || 'Đang cập nhật'}</span>
                          <span className="text-neutral-300">•</span>
                          <span>{room.area ? `${room.area} m²` : 'Đang cập nhật DT'}</span>
                        </div>
                        <button
                          type="button"
                          className="mt-2 w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          onClick={() => onOpenProfile(room.ownerId)}
                        >
                          Người đăng: {room.ownerName || 'Đang cập nhật'}
                        </button>
                        <p className="mt-1 text-xs font-semibold text-emerald-700">Cách bạn: {formatDistanceKm(room.distanceKm)}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            className="h-8 flex-1 rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
                            onClick={() => onViewRoom(room)}
                          >
                            Xem phòng
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-white transition hover:bg-neutral-50 ${
                              room.isFavorite ? 'border-rose-300 text-rose-500' : 'border-neutral-300 text-neutral-700'
                            }`}
                            onClick={() => onToggleFavorite(room.id)}
                            aria-label="Yêu thích"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path
                                d="M12 21s-7-4.8-9.2-8.2C.9 9.7 2.2 6 5.8 5.2A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.2-2.8c3.6.8 4.9 4.5 3 7.6C19 16.2 12 21 12 21Z"
                                fill={room.isFavorite ? 'currentColor' : 'none'}
                                stroke="currentColor"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
                            onClick={() => onOpenChat(room.ownerId, room.ownerName)}
                            aria-label="Nhắn tin"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3v-7A8.5 8.5 0 1 1 21 11.5Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="absolute -right-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-2xl font-bold text-neutral-700 shadow-md transition hover:bg-neutral-50 disabled:opacity-40"
                  onClick={() => setNearbyIndex((prev) => Math.min(nearbyTotalPages - 1, prev + 1))}
                  disabled={nearbyIndex >= nearbyTotalPages - 1}
                  aria-label="Xem nhóm phòng gần tiếp theo"
                >
                  &gt;
                </button>
              </>
            )}
          </div>
        </section>

        <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden rounded-none border-0 bg-gradient-to-br from-[#ff9f1c] via-[#ff8f1f] to-[#ff7a1a] py-10 text-white shadow-[0_20px_60px_rgba(249,115,22,0.35)] sm:py-12 lg:py-14">
          <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-14 h-52 w-52 rounded-full bg-amber-200/25 blur-2xl" />
          <div className="pointer-events-none absolute right-10 top-8 rotate-12 text-6xl opacity-20">🏠</div>

          <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/85">Giới thiệu TimTro</p>
              <h3 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
                Cầu nối nhanh giữa người tìm trọ và chủ trọ thật
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
                TimTro giúp bạn tìm phòng rõ thông tin, xem vị trí trực quan và kết nối trực tiếp với người đăng.
                Hệ thống ưu tiên tin mới, bộ lọc dễ dùng và nhắn tin ngay trong ứng dụng để chốt phòng nhanh hơn.
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-white/45 bg-white/15 px-3 py-1.5 text-xs font-semibold">
                  Tin mới cập nhật liên tục
                </span>
                <span className="rounded-full border border-white/45 bg-white/15 px-3 py-1.5 text-xs font-semibold">
                  Lọc khu vực theo nhu cầu
                </span>
                <span className="rounded-full border border-white/45 bg-white/15 px-3 py-1.5 text-xs font-semibold">
                  Chat trực tiếp với chủ trọ
                </span>
              </div>
            </div>

            <div className="relative rounded-3xl border border-white/35 bg-white/14 p-4 backdrop-blur-sm sm:p-5">
              <div className="absolute -right-2 -top-2 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-orange-600 shadow-sm">
                Liên hệ
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Hỗ trợ nhanh</p>
              <div className="mt-3 space-y-2.5">
                <p className="rounded-2xl border border-white/35 bg-black/10 px-3 py-2 text-sm font-semibold">
                  Zalo: 0398445947
                </p>
                <p className="rounded-2xl border border-white/35 bg-black/10 px-3 py-2 text-sm font-semibold break-all">
                  Email: bintran2008a@gmail.com
                </p>
              </div>
              <p className="mt-3 text-xs leading-6 text-white/85">
                Nếu bạn cần hỗ trợ đăng tin, lọc phòng theo khu vực hoặc xử lý tài khoản, hãy nhắn Zalo hoặc gửi email.
              </p>
            </div>
            </div>
          </div>
        </section>
      </div>

      {showAuthPrompt && !isLoggedIn && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-lg">
          <button
            type="button"
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-orange-700 transition hover:bg-orange-100"
            onClick={() => setShowAuthPrompt(false)}
            aria-label="Đóng gợi ý đăng nhập"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <p className="text-sm font-semibold text-orange-800">Đăng nhập để mở đầy đủ tính năng</p>
              <p className="text-xs text-orange-700">
                Bạn có thể lưu phòng yêu thích, nhắn tin với chủ trọ và đăng tin sau khi đăng nhập.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }))}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'register' } }))
                }
              >
                Đăng ký
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RoomDetailPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId || Number.isNaN(Number(roomId))) {
        setError('Tin đăng không hợp lệ.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await get<ApiResponse<Room[]>>('/api/rooms/public/all');
        const found = (response.data ?? []).map(normalizeRoom).find((item) => item.id === Number(roomId)) ?? null;
        if (!found) {
          setError('Không tìm thấy tin đăng này.');
          setRoom(null);
          return;
        }
        setRoom(found);
        setActiveImage(0);
        addRoomToViewedHistory(found);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải chi tiết tin đăng.');
      } finally {
        setLoading(false);
      }
    };

    void loadRoom();
  }, [roomId]);

  const galleryImages = useMemo(() => {
    if (!room?.imageUrls || room.imageUrls.length === 0) {
      return ['https://placehold.co/1200x700?text=Timtro'];
    }
    return room.imageUrls;
  }, [room]);

  const hasCoordinates =
    !!room &&
    typeof room.latitude === 'number' &&
    typeof room.longitude === 'number' &&
    !Number.isNaN(room.latitude) &&
    !Number.isNaN(room.longitude);

  const locationLabel = [room?.streetDetail, room?.ward, room?.district, room?.province].filter(Boolean).join(', ');
  const amenityNames = room ? getRoomAmenityNames(room) : [];
  const displayedStatus = room?.status === 'HIDDEN' ? 'HIDE' : room?.status || 'UNKNOWN';
  const fullAddress = [room?.streetDetail, room?.ward, room?.district, room?.province]
    .filter(Boolean)
    .join(', ');
  const roomMarkerIcon = useMemo(() => buildRoomMarkerIcon(galleryImages[0]), [galleryImages]);

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-50 via-amber-50 to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Chi tiết tin</p>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Thông tin phòng trọ</h1>
            <p className="mt-1 text-sm text-neutral-600">Xem thông tin đầy đủ và vị trí thực tế của phòng trên bản đồ.</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            onClick={() => navigate(-1)}
          >
            Quay lại
          </button>
        </div>
      </div>

      {loading && <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Đang tải dữ liệu...</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>}

      {!loading && !error && room && (
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <article className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200">
              <img
                src={galleryImages[Math.min(activeImage, galleryImages.length - 1)]}
                alt={room.title}
                className="h-[340px] w-full object-cover sm:h-[420px]"
              />
              <div className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                {formatPostedTime(room.createdAt)}
              </div>
            </div>

            {galleryImages.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {galleryImages.map((url, index) => {
                  const isActive = index === activeImage;
                  return (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      className={`overflow-hidden rounded-xl border transition ${
                        isActive
                          ? 'border-orange-500 ring-2 ring-orange-200'
                          : 'border-neutral-200 hover:border-orange-300'
                      }`}
                      onClick={() => setActiveImage(index)}
                    >
                      <img src={url} alt={`${room.title} ${index + 1}`} className="h-16 w-full object-cover sm:h-20" />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <h2 className="text-xl font-bold text-neutral-900">{room.title}</h2>
              <p className="mt-2 text-2xl font-extrabold text-[#d0021b]">{formatPricePerMonth(room.price ?? 0)}</p>
              <div className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
                <p>🆔 Mã tin: #{room.id}</p>
                <p>🏷️ Trạng thái: {displayedStatus}</p>
                <p>💰 Giá: {formatPricePerMonth(room.price ?? 0)}</p>
                <p>📐 Diện tích: {room.area ? `${room.area} m²` : 'Đang cập nhật'}</p>
                <p>👤 Người đăng: {room.ownerName || 'Đang cập nhật'}</p>
                <p>📞 Liên hệ: {room.ownerPhone || 'Đang cập nhật'}</p>
                <p>🕒 Đăng lúc: {room.createdAt ? new Date(room.createdAt).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
                <p>⏱️ Hiển thị: {formatPostedTime(room.createdAt)}</p>
                <p className="sm:col-span-2">📍 Địa chỉ đầy đủ: {fullAddress || 'Đang cập nhật địa chỉ'}</p>
                <p>Tỉnh/Thành: {room.province || 'Đang cập nhật'}</p>
                <p>Quận/Huyện: {room.district || 'Đang cập nhật'}</p>
                <p>Phường/Xã: {room.ward || 'Đang cập nhật'}</p>
                <p>Số nhà/đường: {room.streetDetail || 'Đang cập nhật'}</p>
              </div>

              <div className="mt-4 border-t border-neutral-200 pt-3">
                <p className="text-sm font-semibold text-neutral-800">Tiện ích</p>
                {amenityNames.length === 0 ? (
                  <p className="mt-1 text-sm text-neutral-600">Chưa có thông tin tiện ích.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {amenityNames.map((amenity) => (
                      <span
                        key={`detail-amenity-${amenity}`}
                        className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-neutral-200 pt-3">
                <p className="text-sm font-semibold text-neutral-800">Mô tả chi tiết</p>
                <p className="mt-1 text-sm leading-7 text-neutral-700">{room.description || 'Người đăng chưa thêm mô tả.'}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
                  onClick={() => {
                    if (!room.ownerId) {
                      return;
                    }
                    const name = encodeURIComponent(room.ownerName || 'Người đăng');
                    navigate(`/chat?userId=${room.ownerId}&name=${name}`);
                  }}
                >
                  Nhắn tin
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    if (!room.ownerId) {
                      return;
                    }
                    navigate(`/profile/${room.ownerId}`);
                  }}
                >
                  Xem người đăng
                </button>
              </div>
            </div>
          </article>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-neutral-900">Vị trí phòng trên bản đồ</p>
              <p className="mt-1 text-xs text-neutral-500">Leaflet map với marker vị trí của phòng trọ.</p>

              {hasCoordinates ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200">
                  <MapContainer
                    center={[room.latitude as number, room.longitude as number]}
                    zoom={16}
                    scrollWheelZoom
                    className="h-[460px] w-full md:h-[520px]"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[room.latitude as number, room.longitude as number]} icon={roomMarkerIcon}>
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">{room.title}</p>
                          <p className="mt-1">{locationLabel || 'Địa chỉ đang cập nhật'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Tin đăng này chưa có tọa độ, chưa thể hiển thị marker trên bản đồ.
                </div>
              )}

              {hasCoordinates && (
                <a
                  className="mt-3 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
                  href={`https://www.openstreetmap.org/?mlat=${room.latitude}&mlon=${room.longitude}#map=17/${room.latitude}/${room.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở trên OpenStreetMap
                </a>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function ViewHistoryPage() {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<ViewedHistoryItem[]>([]);

  useEffect(() => {
    const sync = () => setHistoryItems(loadViewedHistory());
    sync();
    window.addEventListener('room-view-history-updated', sync);
    return () => window.removeEventListener('room-view-history-updated', sync);
  }, []);

  const removeItem = (roomId: number) => {
    const next = historyItems.filter((item) => item.room.id !== roomId);
    setHistoryItems(next);
    saveViewedHistory(next);
  };

  const clearAll = () => {
    setHistoryItems([]);
    saveViewedHistory([]);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Lịch sử xem tin</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Các tin bạn đã xem</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            onClick={() => navigate('/')}
          >
            Về trang chủ
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={clearAll}
            disabled={historyItems.length === 0}
          >
            Xóa toàn bộ
          </button>
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
          Bạn chưa xem tin nào. Hãy bấm "Xem phòng" để bắt đầu lưu lịch sử.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {historyItems.map((item) => (
            <article
              key={`history-${item.room.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <img
                src={item.room.imageUrls?.[0] || 'https://placehold.co/600x350?text=Timtro'}
                alt={item.room.title}
                className="h-40 w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-neutral-900">{item.room.title}</h3>
                <p className="mt-2 text-lg font-extrabold text-[#d0021b]">{formatPricePerMonth(item.room.price ?? 0)}</p>
                <p className="mt-1 line-clamp-1 text-xs text-neutral-600">📍 {item.room.province || 'Đang cập nhật'}</p>
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Đã xem: {new Date(item.viewedAt).toLocaleString('vi-VN')}
                </p>
                <p className="mt-1 text-xs text-neutral-600">Người đăng: {item.room.ownerName || 'Đang cập nhật'}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="h-8 flex-1 rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white hover:bg-orange-600"
                    onClick={() => navigate(`/rooms/${item.room.id}`)}
                  >
                    Xem lại
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-xl border border-red-300 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                    onClick={() => removeItem(item.room.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'social' | 'security'>('profile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarCropSource, setAvatarCropSource] = useState<string | null>(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarCroppedAreaPixels, setAvatarCroppedAreaPixels] = useState<Area | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
  });
  const [socialForm, setSocialForm] = useState({
    facebook: '',
    instagram: '',
    linkedin: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!getAuthToken()) {
        setError('Vui lòng đăng nhập để truy cập cài đặt tài khoản.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const profile = await get<UserProfile>('/api/users/me');
        setUser(profile);
        setProfileForm((prev) => ({
          ...prev,
          displayName: profile.displayName ?? profile.username ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          address: profile.address ?? '',
          bio: profile.bio ?? '',
        }));
        setSocialForm({
          facebook: profile.facebook ?? '',
          instagram: profile.instagram ?? '',
          linkedin: profile.linkedin ?? '',
        });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải thông tin tài khoản.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);


  const updateProfile = async () => {
    setSavingProfile(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await put<UserProfile>('/api/users/profile', {
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
        bio: profileForm.bio.trim(),
        facebook: socialForm.facebook.trim(),
        instagram: socialForm.instagram.trim(),
        linkedin: socialForm.linkedin.trim(),
      });
      setUser(updated);
      setMessage('Cập nhật thông tin cá nhân thành công.');
      setProfileForm((prev) => ({
        ...prev,
        displayName: updated.displayName ?? prev.displayName,
        email: updated.email ?? prev.email,
        phone: updated.phone ?? prev.phone,
        address: updated.address ?? prev.address,
        bio: updated.bio ?? prev.bio,
      }));
      setSocialForm({
        facebook: updated.facebook ?? '',
        instagram: updated.instagram ?? '',
        linkedin: updated.linkedin ?? '',
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSocialLinks = async () => {
    setSavingProfile(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await put<UserProfile>('/api/users/profile', {
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
        bio: profileForm.bio.trim(),
        facebook: socialForm.facebook.trim(),
        instagram: socialForm.instagram.trim(),
        linkedin: socialForm.linkedin.trim(),
      });
      setUser(updated);
      setMessage('Liên kết mạng xã hội đã được lưu.');
      setSocialForm({
        facebook: updated.facebook ?? '',
        instagram: updated.instagram ?? '',
        linkedin: updated.linkedin ?? '',
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu liên kết mạng xã hội.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setAvatarFile(null);
      return;
    }

    if (!selected.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ (jpg, png, webp...).');
      setAvatarFile(null);
      event.target.value = '';
      return;
    }

    const maxSizeMb = 5;
    if (selected.size > maxSizeMb * 1024 * 1024) {
      setError('Ảnh đại diện tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      setAvatarFile(null);
      event.target.value = '';
      return;
    }

    setError(null);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) {
        setError('Không thể đọc file ảnh. Vui lòng thử lại.');
        return;
      }
      setAvatarCropSource(result);
      setAvatarCrop({ x: 0, y: 0 });
      setAvatarZoom(1);
      setAvatarCroppedAreaPixels(null);
      setAvatarCropOpen(true);
    };
    reader.onerror = () => {
      setError('Không thể đọc file ảnh. Vui lòng thử lại.');
    };
    reader.readAsDataURL(selected);
  };

  const closeAvatarCrop = () => {
    setAvatarCropOpen(false);
    setAvatarCropSource(null);
    setAvatarZoom(1);
    setAvatarCroppedAreaPixels(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const applyAvatarCrop = async () => {
    if (!avatarCropSource || !avatarCroppedAreaPixels) {
      setError('Vui lòng chọn vùng cắt ảnh.');
      return;
    }
    try {
      setError(null);
      const croppedBlob = await getCroppedImageBlob(avatarCropSource, avatarCroppedAreaPixels);
      const croppedFile = new File([croppedBlob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }

      setAvatarFile(croppedFile);
      setAvatarPreviewUrl(URL.createObjectURL(croppedBlob));
      setAvatarCropOpen(false);
      setAvatarCropSource(null);
      setAvatarZoom(1);
      setAvatarCroppedAreaPixels(null);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : 'Không thể cắt ảnh.');
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) {
      setError('Vui lòng chọn ảnh trước khi tải lên.');
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', avatarFile);
      const avatarUrl = await postFormData<string>('/api/users/avatar', formData);

      setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
      setAvatarFile(null);
      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      setAvatarPreviewUrl(null);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      setMessage('Cập nhật ảnh đại diện thành công.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Vui lòng điền đầy đủ thông tin đổi mật khẩu.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới và xác nhận không khớp.');
      return;
    }
    setChangingPassword(true);
    try {
      const response = await post<ApiResponse<null>>('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setMessage(response.message || 'Đổi mật khẩu thành công.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (passwordChangeError) {
      setPasswordError(passwordChangeError instanceof Error ? passwordChangeError.message : 'Không thể đổi mật khẩu.');
    } finally {
      setChangingPassword(false);
    }
  };

  const tabClass = (tab: string) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
      activeTab === tab ? 'bg-orange-500 text-white shadow' : 'bg-white text-neutral-700 hover:bg-neutral-50'
    }`;

  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-6 rounded-3xl bg-orange-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Thiết lập hồ sơ</p>
          <h2 className="mt-3 text-lg font-bold text-neutral-900">Hồ sơ cá nhân</h2>
          <p className="mt-2 text-sm text-neutral-600">Quản lý thông tin và bảo mật tài khoản.</p>
        </div>
        <div className="space-y-2">
          <button type="button" className={tabClass('profile')} onClick={() => setActiveTab('profile')}>
            <span>Thông tin cá nhân</span>
          </button>
          <button type="button" className={tabClass('social')} onClick={() => setActiveTab('social')}>
            <span>Liên kết mạng xã hội</span>
          </button>
          <button type="button" className={tabClass('security')} onClick={() => setActiveTab('security')}>
            <span>Cài đặt tài khoản</span>
          </button>
        </div>
      </aside>

      <div className="space-y-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                {activeTab === 'profile'
                  ? 'Thông tin cá nhân'
                  : activeTab === 'social'
                  ? 'Liên kết mạng xã hội'
                  : 'Cài đặt tài khoản'}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-neutral-900">
                {activeTab === 'profile'
                  ? 'Thông tin hồ sơ'
                  : activeTab === 'social'
                  ? 'Liên kết mạng xã hội'
                  : 'Đổi mật khẩu'}
              </h1>
            </div>
            {user && (
              <div className="rounded-3xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">{user.displayName ?? user.username}</p>
                <p>{user.email}</p>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
            Đang tải dữ liệu...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm font-semibold text-neutral-800">Ảnh đại diện</p>
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <img
                      src={
                        avatarPreviewUrl ||
                        user?.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.username || 'U')}&background=ffedd5&color=ea580c&bold=true`
                      }
                      alt={user?.displayName || user?.username || 'Avatar'}
                      className="h-20 w-20 rounded-full border border-neutral-200 object-cover"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        Chọn ảnh
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                        onClick={uploadAvatar}
                        disabled={!avatarFile || uploadingAvatar}
                      >
                        {uploadingAvatar ? 'Đang tải lên...' : 'Cập nhật ảnh'}
                      </button>
                      {avatarFile && (
                        <span className="text-xs text-neutral-500">Sẵn sàng upload: {avatarFile.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Tên hiển thị *</span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={profileForm.displayName}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Thêm số điện thoại *</span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Email</span>
                    <input
                      type="email"
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-500 outline-none"
                      value={profileForm.email}
                      disabled
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Địa chỉ</span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={profileForm.address}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))}
                      placeholder="Nhập địa chỉ"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-neutral-700">Giới thiệu về trang</span>
                  <textarea
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                    value={profileForm.bio}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
                    placeholder="Giới thiệu về bạn hoặc trang của bạn"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                    onClick={updateProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                  {message && <p className="text-sm text-emerald-600">{message}</p>}
                </div>
              </div>
            )}

            {activeTab === 'social' && (
              <div className="space-y-6">
                <p className="text-sm text-neutral-600">Thêm liên kết mạng xã hội để hiển thị trong hồ sơ.</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Facebook</span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={socialForm.facebook}
                      onChange={(event) => setSocialForm((prev) => ({ ...prev, facebook: event.target.value }))}
                      placeholder="https://facebook.com/tenban"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Instagram</span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={socialForm.instagram}
                      onChange={(event) => setSocialForm((prev) => ({ ...prev, instagram: event.target.value }))}
                      placeholder="https://instagram.com/tenban"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-neutral-700">LinkedIn</span>
                  <input
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                    value={socialForm.linkedin}
                    onChange={(event) => setSocialForm((prev) => ({ ...prev, linkedin: event.target.value }))}
                    placeholder="https://linkedin.com/in/tenban"
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600"
                  onClick={saveSocialLinks}
                >
                  Lưu liên kết
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Mật khẩu hiện tại</span>
                    <input
                      type="password"
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Mật khẩu mới</span>
                    <input
                      type="password"
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Xác nhận mật khẩu mới</span>
                    <input
                      type="password"
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    />
                  </label>
                </div>
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                  onClick={changePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      {avatarCropOpen && avatarCropSource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Chỉnh ảnh đại diện</p>
                <p className="mt-1 text-sm text-neutral-700">Kéo để căn giữa khuôn mặt, dùng zoom nếu cần.</p>
              </div>
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                onClick={closeAvatarCrop}
              >
                Đóng
              </button>
            </div>

            <div className="relative mt-4 h-72 overflow-hidden rounded-2xl bg-neutral-900">
              <Cropper
                image={avatarCropSource}
                crop={avatarCrop}
                zoom={avatarZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setAvatarCrop}
                onZoomChange={setAvatarZoom}
                onCropComplete={(_, croppedAreaPixels) => setAvatarCroppedAreaPixels(croppedAreaPixels)}
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={avatarZoom}
                onChange={(event) => setAvatarZoom(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                onClick={closeAvatarCrop}
              >
                Hủy
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
                onClick={() => void applyAvatarCrop()}
              >
                Dùng ảnh này
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default App;
