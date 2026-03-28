import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import { get, getAuthToken, post, postFormData, put } from './apiClient';
import Header from './components/Header';

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
  latitude?: number | null;
  longitude?: number | null;
  amenityNames?: string[];
  imageUrls?: string[];
  isFavorite?: boolean;
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
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

function App() {
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await get<ApiResponse<Room[]>>('/api/rooms/public/all');
        setRooms(res.data ?? []);
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
        const wardMap = new Map<number, Ward>();
        districts.forEach((district) => {
          (district.wards ?? []).forEach((ward) => {
            wardMap.set(ward.code, ward);
          });
        });
        setWards(Array.from(wardMap.values()));
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
  }, [selectedProvinceCode, selectedDistrictCode, selectedWardCode, priceFilter, selectedAmenities, searchKeyword]);

  const amenityOptions = useMemo(() => {
    const dynamicAmenities = rooms.flatMap((room) => room.amenityNames ?? []);
    return Array.from(new Set([...DEFAULT_AMENITY_OPTIONS, ...dynamicAmenities])).filter(Boolean);
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const selectedProvince = provinces.find((province) => province.code === selectedProvinceCode);
    const selectedDistrict = districts.find((district) => district.code === selectedDistrictCode);
    const selectedWard = wards.find((ward) => ward.code === selectedWardCode);

    const selectedProvinceName = normalizeLocation(selectedProvince?.name ?? '');
    const selectedDistrictName = normalizeLocation(selectedDistrict?.name ?? '');
    const selectedWardName = normalizeLocation(selectedWard?.name ?? '');

    return rooms.filter((room) => {
      const fullAddress = normalizeLocation(
        `${room.address ?? ''} ${room.ward ?? ''} ${room.district ?? ''} ${room.province ?? ''}`
      );
      const amenityText = normalize(`${room.amenityNames?.join(' ') ?? ''} ${room.description ?? ''}`);
      const roomPrice = room.price ?? 0;
      const roomTitle = normalize(room.title ?? '');
      const normalizedKeyword = normalize(searchKeyword.trim());

      const matchProvince =
        !selectedProvinceCode || selectedProvinceName.length === 0 || fullAddress.includes(selectedProvinceName);
      const matchDistrict =
        !selectedDistrictCode || selectedDistrictName.length === 0 || fullAddress.includes(selectedDistrictName);
      const matchWard = !selectedWardCode || selectedWardName.length === 0 || fullAddress.includes(selectedWardName);
      const matchAmenity =
        selectedAmenities.length === 0 ||
        selectedAmenities.every((amenity) => amenityText.includes(normalize(amenity)));
      let matchPrice = true;

      if (priceFilter === 'under-2m') {
        matchPrice = roomPrice < 2_000_000;
      } else if (priceFilter === '2m-5m') {
        matchPrice = roomPrice >= 2_000_000 && roomPrice <= 5_000_000;
      } else if (priceFilter === 'over-5m') {
        matchPrice = roomPrice > 5_000_000;
      }

      const matchTitle = normalizedKeyword.length === 0 || roomTitle.includes(normalizedKeyword);

      return matchProvince && matchDistrict && matchWard && matchAmenity && matchPrice && matchTitle;
    });
  }, [
    rooms,
    provinces,
    districts,
    wards,
    selectedProvinceCode,
    selectedDistrictCode,
    selectedWardCode,
    selectedAmenities,
    priceFilter,
    searchKeyword,
  ]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-slate-50 to-slate-100 font-sans text-neutral-900">
      <Header />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6">
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
                  const wardMap = new Map<number, Ward>();
                  nextDistricts.forEach((district) => {
                    (district.wards ?? []).forEach((ward) => {
                      wardMap.set(ward.code, ward);
                    });
                  });
                  setWards(Array.from(wardMap.values()));
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
                onToggleFavorite={toggleFavorite}
                onPageChange={setCurrentPage}
              />
            }
          />
          <Route path="/account" element={<AccountSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
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
  onToggleFavorite: (roomId: number) => void;
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
  onToggleFavorite,
  onPageChange,
}: RoomListPageProps) {
  const [showAuthPrompt, setShowAuthPrompt] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getAuthToken()));
  const [openFilterPanel, setOpenFilterPanel] = useState<'location' | 'price' | 'amenity' | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyIndex, setNearbyIndex] = useState(0);

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

  const selectedProvinceName = provinces.find((item) => item.code === selectedProvinceCode)?.name;
  const selectedPriceLabel = PRICE_OPTIONS.find((item) => item.value === priceFilter)?.label ?? 'Tất cả mức giá';
  const selectedAmenityLabel =
    selectedAmenities.length === 0 ? 'Tất cả tiện ích' : `${selectedAmenities.length} tiện ích`;

  const nearbyRooms = useMemo(() => {
    const roomsWithCoords = rooms.filter(
      (room) =>
        typeof room.latitude === 'number' &&
        typeof room.longitude === 'number' &&
        !Number.isNaN(room.latitude) &&
        !Number.isNaN(room.longitude)
    );
    if (roomsWithCoords.length === 0) {
      return [] as Room[];
    }
    if (!userCoords) {
      return roomsWithCoords.slice(0, 20);
    }
    return [...roomsWithCoords]
      .sort((a, b) => {
        const dA = distanceInKm(userCoords.lat, userCoords.lng, a.latitude as number, a.longitude as number);
        const dB = distanceInKm(userCoords.lat, userCoords.lng, b.latitude as number, b.longitude as number);
        return dA - dB;
      })
      .slice(0, 20);
  }, [rooms, userCoords]);

  const nearbyPageSize = 5;
  const nearbyTotalPages = Math.max(1, Math.ceil(nearbyRooms.length / nearbyPageSize));
  const nearbyVisibleRooms = useMemo(() => {
    const start = nearbyIndex * nearbyPageSize;
    return nearbyRooms.slice(start, start + nearbyPageSize);
  }, [nearbyRooms, nearbyIndex]);

  useEffect(() => {
    setNearbyIndex(0);
  }, [nearbyRooms.length]);

  const filteredProvinces = useMemo(() => {
    if (!locationSearch.trim()) {
      return provinces;
    }
    const term = locationSearch.trim().toLowerCase();
    return provinces.filter((province) => province.name.toLowerCase().includes(term));
  }, [locationSearch, provinces]);

  const filteredDistricts = useMemo(() => {
    if (!locationSearch.trim()) {
      return districts;
    }
    const term = locationSearch.trim().toLowerCase();
    return districts.filter((district) => district.name.toLowerCase().includes(term));
  }, [locationSearch, districts]);

  const filteredWards = useMemo(() => {
    if (!locationSearch.trim()) {
      return wards;
    }
    const term = locationSearch.trim().toLowerCase();
    return wards.filter((ward) => ward.name.toLowerCase().includes(term));
  }, [locationSearch, wards]);

  return (
    <section className="space-y-4">
      <header className="w-full -mx-4 overflow-visible rounded-[40px] bg-gradient-to-r from-orange-500 via-orange-500 to-orange-400 shadow-xl text-white sm:-mx-6">
        <div className="relative flex flex-col justify-center overflow-visible px-6 py-12 sm:px-10 sm:py-16">
          <div className="mx-auto w-full max-w-4xl text-center text-white">
            <p className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Giá tốt, gần bạn, chốt nhanh!
            </p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em] text-white/90">
              TimTro · Tìm phòng trọ · Nhà thuê
            </p>
          </div>

          <div className="mx-auto mt-10 w-full max-w-[1200px] rounded-[40px] bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={searchKeyword}
                onChange={(event) => onChangeSearch(event.target.value)}
                placeholder="Tìm theo tiêu đề phòng..."
                className="h-14 w-full flex-1 rounded-[28px] border border-neutral-200 bg-white px-5 text-sm text-slate-900 outline-none shadow-sm"
              />
              <button
                type="button"
                className="inline-flex h-14 items-center justify-center rounded-[28px] bg-orange-500 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Tìm kiếm
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => {
                    setLocationSearch('');
                    setOpenFilterPanel((prev) => (prev === 'location' ? null : 'location'));
                  }}
                  className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    openFilterPanel === 'location'
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                  }`}
                >
                  📍 {selectedProvinceName ?? 'Địa điểm'}
                </button>
                {openFilterPanel === 'location' && (
                  <div className="absolute left-1/2 top-full z-50 mt-3 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-[28px] border border-neutral-200 bg-white p-4 shadow-2xl">
                    <input
                      value={locationSearch}
                      onChange={(event) => setLocationSearch(event.target.value)}
                      placeholder="Nhập tỉnh/quận/phường để tìm..."
                      className="mb-3 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        value={selectedProvinceCode ?? ''}
                        onChange={(event) => onChangeProvince(event.target.value ? Number(event.target.value) : null)}
                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">Tỉnh/Thành</option>
                        {filteredProvinces.map((province) => (
                          <option key={province.code} value={province.code}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedDistrictCode ?? ''}
                        onChange={(event) => onChangeDistrict(event.target.value ? Number(event.target.value) : null)}
                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">Quận/Huyện</option>
                        {filteredDistricts.map((district) => (
                          <option key={district.code} value={district.code}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedWardCode ?? ''}
                        onChange={(event) => onChangeWard(event.target.value ? Number(event.target.value) : null)}
                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">Phường/Xã</option>
                        {filteredWards.map((ward) => (
                          <option key={ward.code} value={ward.code}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenFilterPanel((prev) => (prev === 'price' ? null : 'price'))}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  openFilterPanel === 'price'
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                }`}
              >
                💸 {selectedPriceLabel}
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterPanel((prev) => (prev === 'amenity' ? null : 'amenity'))}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  openFilterPanel === 'amenity'
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50'
                }`}
              >
                🧩 {selectedAmenityLabel}
              </button>
            </div>

            {openFilterPanel === 'price' && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
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

            {openFilterPanel === 'amenity' && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Tiện ích</p>
                  </div>
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
      </header>


        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 className="text-lg font-semibold text-neutral-900">Tin đăng mới nhất 🔥</h2>
          <span className="text-sm text-neutral-500">{totalResults} kết quả</span>
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
                    onClick={() => console.log('TODO view room detail:', room.id)}
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
                    onClick={() => console.log('TODO chat with host:', room.id)}
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

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Phòng trọ gần bạn</h3>
            <span className="text-xs text-neutral-500">
              {userCoords ? 'Sắp xếp theo khoảng cách' : 'Bật vị trí để sắp xếp chính xác hơn'}
            </span>
          </div>
          <div className="relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            {nearbyRooms.length === 0 ? (
              <p className="text-sm text-neutral-600">Chưa có phòng có tọa độ để gợi ý gần bạn.</p>
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
                        <h4 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-neutral-900">
                          {room.title}
                        </h4>
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
                            onClick={() => console.log('TODO view room detail:', room.id)}
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

function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'social' | 'security'>('profile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    nickname: '',
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
          nickname: profile.nickname ?? '',
        }));
        setSocialForm({
          facebook: profile.facebook ?? '',
          instagram: profile.instagram ?? '',
          linkedin: profile.linkedin ?? '',
        });
        setAvatarPreviewUrl(profile.avatarUrl ?? null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải thông tin tài khoản.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

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
        nickname: profileForm.nickname.trim(),
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
        nickname: updated.nickname ?? prev.nickname,
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
        nickname: profileForm.nickname.trim(),
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

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const avatarUrl = await postFormData<string>('/api/users/avatar', formData);
      setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
      setAvatarPreviewUrl(avatarUrl);
      setMessage('Ảnh đại diện đã được cập nhật.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh đại diện.');
    } finally {
      setAvatarUploading(false);
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
                  : activeTab === 'security'
                  ? 'Cài đặt tài khoản'
                  : 'Lịch sử đăng nhập'}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-neutral-900">
                {activeTab === 'profile'
                  ? 'Thông tin hồ sơ'
                  : activeTab === 'social'
                  ? 'Liên kết mạng xã hội'
                  : activeTab === 'security'
                  ? 'Đổi mật khẩu'
                  : 'Lịch sử đăng nhập'}
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
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-orange-100">
                      {avatarPreviewUrl ? (
                        <img src={avatarPreviewUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-orange-800">Ảnh đại diện</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-neutral-900">Ảnh đại diện của bạn</p>
                      <p className="text-sm text-neutral-500">Tải lên ảnh mới để avatar hiển thị trên hồ sơ.</p>
                      <label className="inline-flex cursor-pointer items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm transition hover:bg-orange-50">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              uploadAvatar(file);
                            }
                          }}
                        />
                        {avatarUploading ? 'Đang tải...' : 'Chọn ảnh mới'}
                      </label>
                      <p className="text-xs text-neutral-400">Hỗ trợ JPG/PNG, tối đa 5MB.</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-neutral-700">Họ và tên *</span>
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
                    <div className="mt-2 flex gap-3">
                      <input
                        type="email"
                        className="w-full rounded-2xl border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-500 outline-none"
                        value={profileForm.email}
                        disabled
                      />
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-neutral-700 border border-neutral-300 hover:bg-neutral-50"
                      >
                        Thay đổi
                      </button>
                    </div>
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
                <label className="block">
                  <span className="text-sm font-medium text-neutral-700">Tên gợi nhớ</span>
                  <input
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none"
                    value={profileForm.nickname}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, nickname: event.target.value }))}
                    placeholder="Tên gợi nhớ"
                  />
                  <p className="mt-2 text-xs text-neutral-500">Tên này sẽ giúp người dùng dễ nhận diện bạn hơn.</p>
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
    </section>
  );
}

export default App;
