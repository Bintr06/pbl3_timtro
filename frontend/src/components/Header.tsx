import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { del, get, getAuthToken, post, postFormData, put, putFormData, setAuthToken, clearAuthToken } from '../apiClient';

type AuthMode = 'login' | 'register' | 'forgot';

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

type AuthResponse = {
  token: string;
  username: string;
  displayName?: string;
  role: string;
};

type RoomCreateResponse = {
  status: number;
  message: string;
  data: null;
};

type Ward = {
  code: number;
  name: string;
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

type AmenityOption = {
  id: number;
  name: string;
  icon?: string | null;
};

type ManageRoomItem = {
  id: number;
  title: string;
  description?: string;
  price: number;
  area?: number;
  address?: string | null;
  streetDetail?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  amenityIds?: number[];
  status?: string | null;
  createdAt?: string;
  imageUrls?: string[];
};

const AUTH_USER_NAME_KEY = 'auth_user_name';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIMPLE_PASSWORD_REGEX = /^.{6,}$/;
const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Đã có lỗi xảy ra.';
  }
  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed?.message === 'string') {
      return parsed.message;
    }
  } catch {
    // keep raw error message
  }
  return error.message || 'Đã có lỗi xảy ra.';
};

type MapClickHandlerProps = {
  onPick: (lat: number, lng: number) => void;
};

function MapClickHandler({ onPick }: MapClickHandlerProps) {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

type MapFlyToProps = {
  center: [number, number];
  zoom: number;
};

function MapFlyTo({ center, zoom }: MapFlyToProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

function Header() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getAuthToken()));
  const [displayName, setDisplayName] = useState(localStorage.getItem(AUTH_USER_NAME_KEY) ?? '');
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [forgotForm, setForgotForm] = useState({ email: '', code: '', newPassword: '' });
  const [codeSent, setCodeSent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const registerEmailInvalid = registerForm.email.length > 0 && !EMAIL_REGEX.test(registerForm.email);
  const [isPostRoomOpen, setIsPostRoomOpen] = useState(false);
  const [isPostingRoom, setIsPostingRoom] = useState(false);
  const [postRoomError, setPostRoomError] = useState<string | null>(null);
  const [postRoomMessage, setPostRoomMessage] = useState<string | null>(null);
  const [postRoomForm, setPostRoomForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    address: '',
    streetDetail: '',
  });
  const [roomImages, setRoomImages] = useState<File[]>([]);
  const [amenities, setAmenities] = useState<AmenityOption[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
  const [selectedWardCode, setSelectedWardCode] = useState<number | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string>('');
  const [mapSearchKeyword, setMapSearchKeyword] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([16.047079, 108.20623]);
  const [mapZoom, setMapZoom] = useState(13);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapSearchError, setMapSearchError] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isManageRoomsOpen, setIsManageRoomsOpen] = useState(false);
  const [myRooms, setMyRooms] = useState<ManageRoomItem[]>([]);
  const [selectedManageRoom, setSelectedManageRoom] = useState<ManageRoomItem | null>(null);
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
  const [isEditMapPickerOpen, setIsEditMapPickerOpen] = useState(false);
  const [isSavingRoomEdit, setIsSavingRoomEdit] = useState(false);
  const [editRoomError, setEditRoomError] = useState<string | null>(null);
  const [editRoomMessage, setEditRoomMessage] = useState<string | null>(null);
  const [editLocationLabel, setEditLocationLabel] = useState('');
  const [editMapSearchKeyword, setEditMapSearchKeyword] = useState('');
  const [isEditMapSearching, setIsEditMapSearching] = useState(false);
  const [isEditReverseGeocoding, setIsEditReverseGeocoding] = useState(false);
  const [editMapSearchError, setEditMapSearchError] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    address: '',
    streetDetail: '',
  });
  const [editRoomProvinceCode, setEditRoomProvinceCode] = useState<number | null>(null);
  const [editRoomDistrictCode, setEditRoomDistrictCode] = useState<number | null>(null);
  const [editRoomWardCode, setEditRoomWardCode] = useState<number | null>(null);
  const [editRoomCoordinates, setEditRoomCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editRoomRemainingImageUrls, setEditRoomRemainingImageUrls] = useState<string[]>([]);
  const [editRoomNewImages, setEditRoomNewImages] = useState<File[]>([]);
  const [editRoomSelectedAmenityIds, setEditRoomSelectedAmenityIds] = useState<number[]>([]);
  const [isLoadingMyRooms, setIsLoadingMyRooms] = useState(false);
  const [isManagingRoomAction, setIsManagingRoomAction] = useState(false);
  const [manageRoomsError, setManageRoomsError] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const roomImagePreviews = useMemo(() => roomImages.map((file) => URL.createObjectURL(file)), [roomImages]);
  const editRoomImagePreviews = useMemo(() => editRoomNewImages.map((file) => URL.createObjectURL(file)), [editRoomNewImages]);

  const openAuthModal = (nextMode: AuthMode) => {
    setMode(nextMode);
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthOpen(true);
    setIsAccountMenuOpen(false);
  };

  useEffect(() => {
    const openFromAnywhere = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: AuthMode }>;
      openAuthModal(customEvent.detail?.mode ?? 'login');
    };
    window.addEventListener('open-auth-modal', openFromAnywhere);
    return () => window.removeEventListener('open-auth-modal', openFromAnywhere);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isAccountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const response = await axios.get<Province[]>('https://provinces.open-api.vn/api/?depth=3');
        setProvinces(response.data ?? []);
      } catch {
        setProvinces([]);
      }
    };
    fetchProvinces();
  }, []);

  useEffect(() => {
    const selectedProvince = provinces.find((item) => item.code === selectedProvinceCode);
    const nextDistricts = selectedProvince?.districts ?? [];
    setDistricts(nextDistricts);
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setWards([]);
  }, [selectedProvinceCode, provinces]);

  useEffect(() => {
    const selectedDistrict = districts.find((item) => item.code === selectedDistrictCode);
    const nextWards = selectedDistrict?.wards ?? [];
    setWards(nextWards);
    setSelectedWardCode(null);
  }, [selectedDistrictCode, districts]);

  useEffect(() => {
    return () => {
      roomImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [roomImagePreviews]);

  useEffect(() => {
    return () => {
      editRoomImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editRoomImagePreviews]);

  useEffect(() => {
    if (!isPostRoomOpen) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await get<ApiResponse<AmenityOption[]>>('/api/rooms/public/amenities');
        if (!cancelled) {
          setAmenities(res.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setAmenities([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPostRoomOpen]);

  const submitLogin = async () => {
    if (!loginForm.identifier.trim() || !loginForm.password.trim()) {
      setAuthError('Vui lòng nhập đầy đủ tên đăng nhập/email và mật khẩu.');
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const res = await post<ApiResponse<AuthResponse>, { identifier: string; password: string }>(
        '/api/auth/login',
        loginForm
      );
      setAuthToken(res.data.token);
      const name = res.data.displayName || res.data.username;
      localStorage.setItem(AUTH_USER_NAME_KEY, name);
      setDisplayName(name);
      setIsLoggedIn(true);
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { loggedIn: true } }));
      setAuthMessage('Đăng nhập thành công.');
      setTimeout(() => setIsAuthOpen(false), 500);
    } catch (error) {
      setAuthError(parseErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async () => {
    if (
      !registerForm.username.trim() ||
      !registerForm.displayName.trim() ||
      !registerForm.email.trim() ||
      !registerForm.password.trim() ||
      !registerForm.confirmPassword.trim()
    ) {
      setAuthError('Vui lòng nhập đầy đủ thông tin đăng ký.');
      return;
    }
    if (!EMAIL_REGEX.test(registerForm.email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (!SIMPLE_PASSWORD_REGEX.test(registerForm.password)) {
      setAuthError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Mật khẩu nhập lại không khớp.');
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const res = await post<
        ApiResponse<AuthResponse>,
        { username: string; displayName: string; email: string; password: string }
      >('/api/auth/register', {
        username: registerForm.username,
        displayName: registerForm.displayName,
        email: registerForm.email,
        password: registerForm.password,
      });
      setAuthToken(res.data.token);
      const name = res.data.displayName || res.data.username;
      localStorage.setItem(AUTH_USER_NAME_KEY, name);
      setDisplayName(name);
      setIsLoggedIn(true);
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { loggedIn: true } }));
      setAuthMessage('Đăng ký thành công.');
      setTimeout(() => setIsAuthOpen(false), 500);
    } catch (error) {
      setAuthError(parseErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitForgotPassword = async () => {
    if (!EMAIL_REGEX.test(forgotForm.email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (codeSent && forgotForm.code.length !== 6) {
      setAuthError('Mã xác thực phải gồm đúng 6 chữ số.');
      return;
    }
    if (codeSent && !SIMPLE_PASSWORD_REGEX.test(forgotForm.newPassword)) {
      setAuthError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);
      if (!codeSent) {
        const res = await post<ApiResponse<null>, { email: string }>('/api/auth/forgot-password', {
          email: forgotForm.email,
        });
        setCodeSent(true);
        setAuthMessage(res.message || 'Mã xác thực đã được gửi nếu email tồn tại.');
      } else {
        const res = await post<ApiResponse<null>, { token: string; newPassword: string }>(
          '/api/auth/reset-password',
          {
            token: forgotForm.code,
            newPassword: forgotForm.newPassword,
          }
        );
        setAuthMessage(res.message || 'Đặt lại mật khẩu thành công.');
        setTimeout(() => {
          setMode('login');
          setCodeSent(false);
          setForgotForm({ email: '', code: '', newPassword: '' });
        }, 600);
      }
    } catch (error) {
      setAuthError(parseErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    localStorage.removeItem(AUTH_USER_NAME_KEY);
    setDisplayName('');
    setIsLoggedIn(false);
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { loggedIn: false } }));
  };

  const openPostRoomModal = () => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    setPostRoomError(null);
    setPostRoomMessage(null);
    setSelectedAmenityIds([]);
    setIsPostRoomOpen(true);
  };

  const openManageRooms = async () => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    setIsManageRoomsOpen(true);
    setManageRoomsError(null);
    try {
      setIsLoadingMyRooms(true);
      const res = await get<ApiResponse<ManageRoomItem[]>>('/api/rooms/my');
      setMyRooms(res.data ?? []);
    } catch (error) {
      setManageRoomsError(parseErrorMessage(error));
      setMyRooms([]);
    } finally {
      setIsLoadingMyRooms(false);
    }
  };

  const ensureAmenitiesLoaded = async () => {
    if (amenities.length > 0) return;
    try {
      const res = await get<ApiResponse<AmenityOption[]>>('/api/rooms/public/amenities');
      setAmenities(res.data ?? []);
    } catch {
      setAmenities([]);
    }
  };

  const closeManageRooms = () => {
    setSelectedManageRoom(null);
    setIsManageRoomsOpen(false);
  };

  const refreshMyRooms = async () => {
    const res = await get<ApiResponse<ManageRoomItem[]>>('/api/rooms/my');
    const items = res.data ?? [];
    setMyRooms(items);
    if (selectedManageRoom) {
      const updated = items.find((item) => item.id === selectedManageRoom.id) ?? null;
      setSelectedManageRoom(updated);
    }
  };

  const getProvinceCodeByName = (name?: string | null) => {
    if (!name) return null;
    const target = normalizeText(name);
    const matched = provinces.find((province) => normalizeText(province.name) === target)
      ?? provinces.find((province) => normalizeText(province.name).includes(target) || target.includes(normalizeText(province.name)));
    return matched?.code ?? null;
  };

  const getDistrictCodeByName = (items: District[], name?: string | null) => {
    if (!name) return null;
    const target = normalizeText(name);
    const matched = items.find((district) => normalizeText(district.name) === target)
      ?? items.find((district) => normalizeText(district.name).includes(target) || target.includes(normalizeText(district.name)));
    return matched?.code ?? null;
  };

  const getWardCodeByName = (items: Ward[], name?: string | null) => {
    if (!name) return null;
    const target = normalizeText(name);
    const matched = items.find((ward) => normalizeText(ward.name) === target)
      ?? items.find((ward) => normalizeText(ward.name).includes(target) || target.includes(normalizeText(ward.name)));
    return matched?.code ?? null;
  };

  const openEditRoom = async (room: ManageRoomItem) => {
    await ensureAmenitiesLoaded();
    const provinceCode = getProvinceCodeByName(room.province);
    const province = provinces.find((item) => item.code === provinceCode);
    const districtOptions = province?.districts ?? [];
    const districtCode = getDistrictCodeByName(districtOptions, room.district);
    const district = districtOptions.find((item) => item.code === districtCode);
    const wardOptions = district?.wards ?? [];
    const wardCode = getWardCodeByName(wardOptions, room.ward);

    setEditRoomForm({
      title: room.title ?? '',
      description: room.description ?? '',
      price: room.price ? String(room.price) : '',
      area: typeof room.area === 'number' ? String(room.area) : '',
      address: room.address ?? '',
      streetDetail: room.streetDetail ?? '',
    });
    setEditRoomProvinceCode(provinceCode);
    setEditRoomDistrictCode(districtCode);
    setEditRoomWardCode(wardCode);
    if (typeof room.latitude === 'number' && typeof room.longitude === 'number') {
      setEditRoomCoordinates({ lat: room.latitude, lng: room.longitude });
      setMapCenter([room.latitude, room.longitude]);
      setMapZoom(16);
    } else {
      setEditRoomCoordinates(null);
    }
    setEditLocationLabel('');
    setEditMapSearchKeyword(
      [room.streetDetail, room.address, room.ward, room.district, room.province].filter(Boolean).join(', ')
    );
    setEditMapSearchError(null);
    setEditRoomRemainingImageUrls(room.imageUrls ?? []);
    setEditRoomNewImages([]);
    setEditRoomSelectedAmenityIds(room.amenityIds ?? []);
    setEditRoomError(null);
    setEditRoomMessage(null);
    setSelectedManageRoom(room);
    setIsEditRoomOpen(true);
  };

  const toggleEditAmenity = (id: number) => {
    setEditRoomSelectedAmenityIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const submitEditRoom = async () => {
    if (!selectedManageRoom) return;
    if (!editRoomForm.title.trim() || !editRoomForm.description.trim()) {
      setEditRoomError('Vui lòng nhập tiêu đề và mô tả.');
      return;
    }
    if (!editRoomForm.price || Number(editRoomForm.price) < 0) {
      setEditRoomError('Giá phòng không hợp lệ.');
      return;
    }
    if (!editRoomForm.area || Number(editRoomForm.area) <= 0) {
      setEditRoomError('Diện tích không hợp lệ.');
      return;
    }
    if (!editRoomCoordinates) {
      setEditRoomError('Vui lòng chọn tọa độ trước khi lưu.');
      return;
    }
    if (editRoomRemainingImageUrls.length + editRoomNewImages.length === 0) {
      setEditRoomError('Tin cần ít nhất một ảnh.');
      return;
    }

    const provinceName = provinces.find((item) => item.code === editRoomProvinceCode)?.name ?? '';
    const districtName = (provinces.find((item) => item.code === editRoomProvinceCode)?.districts ?? []).find(
      (item) => item.code === editRoomDistrictCode
    )?.name ?? '';
    const wardName = (
      (provinces.find((item) => item.code === editRoomProvinceCode)?.districts ?? []).find(
        (item) => item.code === editRoomDistrictCode
      )?.wards ?? []
    ).find((item) => item.code === editRoomWardCode)?.name ?? '';

    const payload = {
      title: editRoomForm.title.trim(),
      description: editRoomForm.description.trim(),
      price: Number(editRoomForm.price),
      area: Number(editRoomForm.area),
      address: editRoomForm.address.trim(),
      province: provinceName,
      district: districtName,
      ward: wardName,
      latitude: editRoomCoordinates.lat,
      longitude: editRoomCoordinates.lng,
      amenityIds: editRoomSelectedAmenityIds,
      remainingImageUrls: editRoomRemainingImageUrls,
      primaryImageIndex: 0,
    };

    try {
      setIsSavingRoomEdit(true);
      setEditRoomError(null);
      setEditRoomMessage(null);
      const formData = new FormData();
      formData.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      editRoomNewImages.forEach((file) => formData.append('files', file));
      await putFormData<string>(`/api/rooms/${selectedManageRoom.id}`, formData);
      setEditRoomMessage('Cập nhật tin thành công, vui lòng chờ duyệt lại.');
      await refreshMyRooms();
      window.dispatchEvent(new CustomEvent('room-posted'));
      setTimeout(() => setIsEditRoomOpen(false), 600);
    } catch (error) {
      setEditRoomError(parseErrorMessage(error));
    } finally {
      setIsSavingRoomEdit(false);
    }
  };

  const reverseGeocodeForEditCoordinates = async (lat: number, lng: number) => {
    try {
      setIsEditReverseGeocoding(true);
      const response = await axios.get<{ display_name?: string }>('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon: lng,
          format: 'jsonv2',
          zoom: 18,
          addressdetails: 1,
        },
      });
      setEditLocationLabel(response.data?.display_name ?? `(${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    } catch {
      setEditLocationLabel(`(${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    } finally {
      setIsEditReverseGeocoding(false);
    }
  };

  const jumpEditMapToSelectedAddress = async () => {
    type NominatimSearchItem = {
      lat: string;
      lon: string;
      display_name?: string;
      boundingbox?: [string, string, string, string];
    };
    const geocodeFirst = async (
      candidates: string[],
      extraParams?: Record<string, string | number>
    ): Promise<NominatimSearchItem | null> => {
      for (const candidate of candidates) {
        const response = await axios.get<NominatimSearchItem[]>('https://nominatim.openstreetmap.org/search', {
          params: {
            q: candidate,
            format: 'json',
            limit: 1,
            countrycodes: 'vn',
            addressdetails: 1,
            ...extraParams,
          },
        });
        if (response.data?.[0]) return response.data[0];
      }
      return null;
    };

    const selectedProvince = provinces.find((item) => item.code === editRoomProvinceCode)?.name ?? '';
    const selectedDistrict = (provinces.find((item) => item.code === editRoomProvinceCode)?.districts ?? []).find(
      (item) => item.code === editRoomDistrictCode
    )?.name ?? '';
    const selectedWard = (
      (provinces.find((item) => item.code === editRoomProvinceCode)?.districts ?? []).find(
        (item) => item.code === editRoomDistrictCode
      )?.wards ?? []
    ).find((item) => item.code === editRoomWardCode)?.name ?? '';

    const inputAddress = editMapSearchKeyword.trim();
    const fallbackAddress = [editRoomForm.streetDetail.trim(), editRoomForm.address.trim()].filter(Boolean).join(', ');
    const addressPart = inputAddress || fallbackAddress;
    const adminPart = [selectedWard, selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', ');
    const hasAnyAdmin = Boolean(selectedProvince || selectedDistrict || selectedWard);

    if (!addressPart && !hasAnyAdmin) {
      setEditMapSearchError('Vui lòng nhập địa chỉ hoặc chọn tỉnh/quận/phường để định vị.');
      return;
    }

    try {
      setIsEditMapSearching(true);
      setEditMapSearchError(null);
      const areaCandidates = [
        [selectedWard, selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
        [selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
        [selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
      ].filter(Boolean);
      const area = hasAnyAdmin ? await geocodeFirst(areaCandidates) : null;

      if (area) {
        const areaLat = Number(area.lat);
        const areaLng = Number(area.lon);
        if (!Number.isNaN(areaLat) && !Number.isNaN(areaLng)) {
          setMapCenter([areaLat, areaLng]);
          setMapZoom(selectedWard ? 15 : selectedDistrict ? 13 : 11);
        }
      }

      const detailCandidates = [
        [addressPart, adminPart].filter(Boolean).join(', '),
        inputAddress ? `${inputAddress}, Viet Nam` : '',
        adminPart,
      ].filter(Boolean);

      const bbox = area?.boundingbox;
      const detailInArea =
        bbox && bbox.length === 4
          ? await geocodeFirst(detailCandidates, {
              viewbox: `${bbox[2]},${bbox[0]},${bbox[3]},${bbox[1]}`,
              bounded: 1,
            })
          : null;
      const picked = detailInArea ?? (await geocodeFirst(detailCandidates)) ?? area;

      if (!picked) {
        setEditMapSearchError('Không tìm thấy vị trí phù hợp. Hãy click trực tiếp lên bản đồ.');
        return;
      }
      const lat = Number(picked.lat);
      const lng = Number(picked.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setEditMapSearchError('Không thể đọc tọa độ từ kết quả bản đồ.');
        return;
      }
      setMapCenter([lat, lng]);
      setMapZoom(detailInArea ? 16 : selectedWard ? 15 : selectedDistrict ? 13 : 11);
      setEditRoomCoordinates({ lat, lng });
      if (picked.display_name) setEditLocationLabel(picked.display_name);
    } catch {
      setEditMapSearchError('Không thể định vị khu vực lúc này. Vui lòng thử lại.');
    } finally {
      setIsEditMapSearching(false);
    }
  };

  const deleteManagedRoom = async (roomId: number) => {
    try {
      setIsManagingRoomAction(true);
      await del<string>(`/api/rooms/${roomId}`);
      await refreshMyRooms();
      setSelectedManageRoom(null);
      setManageRoomsError(null);
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (error) {
      setManageRoomsError(parseErrorMessage(error));
    } finally {
      setIsManagingRoomAction(false);
    }
  };

  const toggleManagedRoomStatus = async (roomId: number) => {
    try {
      setIsManagingRoomAction(true);
      await put<string>(`/api/rooms/${roomId}/toggle-rent-status`);
      await refreshMyRooms();
      setManageRoomsError(null);
      window.dispatchEvent(new CustomEvent('room-posted'));
    } catch (error) {
      setManageRoomsError(parseErrorMessage(error));
    } finally {
      setIsManagingRoomAction(false);
    }
  };

  const togglePostRoomAmenity = (id: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const submitPostRoom = async () => {
    if (!postRoomForm.title.trim() || !postRoomForm.description.trim()) {
      setPostRoomError('Vui lòng nhập tiêu đề và mô tả.');
      return;
    }
    if (!postRoomForm.price || Number(postRoomForm.price) < 0) {
      setPostRoomError('Giá phòng không hợp lệ.');
      return;
    }
    if (!postRoomForm.area || Number(postRoomForm.area) <= 0) {
      setPostRoomError('Diện tích không hợp lệ.');
      return;
    }
    if (!selectedProvinceCode || !selectedDistrictCode || !selectedWardCode) {
      setPostRoomError('Vui lòng chọn đầy đủ tỉnh/thành, quận/huyện và phường/xã.');
      return;
    }
    if (!selectedCoordinates) {
      setPostRoomError('Vui lòng chọn vị trí trên bản đồ trước khi đăng tin.');
      return;
    }
    if (roomImages.length === 0) {
      setPostRoomError('Vui lòng chọn ít nhất 1 ảnh phòng.');
      return;
    }

    try {
      setIsPostingRoom(true);
      setPostRoomError(null);
      setPostRoomMessage(null);
      const selectedProvince = provinces.find((item) => item.code === selectedProvinceCode);
      const selectedDistrict = districts.find((item) => item.code === selectedDistrictCode);
      const selectedWard = wards.find((item) => item.code === selectedWardCode);
      const roomPayload: Record<string, unknown> = {
        title: postRoomForm.title.trim(),
        description: postRoomForm.description.trim(),
        price: Number(postRoomForm.price),
        area: Number(postRoomForm.area),
        address: postRoomForm.address.trim(),
        province: selectedProvince?.name ?? '',
        district: selectedDistrict?.name ?? '',
        ward: selectedWard?.name ?? '',
        streetDetail: postRoomForm.streetDetail.trim(),
        primaryImageIndex: 0,
      };
      if (selectedCoordinates) {
        roomPayload.latitude = selectedCoordinates.lat;
        roomPayload.longitude = selectedCoordinates.lng;
      }
      if (selectedAmenityIds.length > 0) {
        roomPayload.amenityIds = selectedAmenityIds;
      }
      const formData = new FormData();
      formData.append('room', new Blob([JSON.stringify(roomPayload)], { type: 'application/json' }));
      roomImages.forEach((file) => formData.append('files', file));

      const res = await postFormData<RoomCreateResponse>('/api/rooms', formData);
      setPostRoomMessage(res.message || 'Đăng tin thành công.');
      setPostRoomForm({
        title: '',
        description: '',
        price: '',
        area: '',
        address: '',
        streetDetail: '',
      });
      setSelectedAmenityIds([]);
      setRoomImages([]);
      setSelectedProvinceCode(null);
      setSelectedDistrictCode(null);
      setSelectedWardCode(null);
      setSelectedCoordinates(null);
      setSelectedLocationLabel('');
      setIsMapPickerOpen(false);
      setMapCenter([16.047079, 108.20623]);
      setMapZoom(13);
      window.dispatchEvent(new CustomEvent('room-posted'));
      setTimeout(() => setIsPostRoomOpen(false), 700);
    } catch (error) {
      setPostRoomError(parseErrorMessage(error));
    } finally {
      setIsPostingRoom(false);
    }
  };

  const reverseGeocodeFromCoordinates = async (lat: number, lng: number) => {
    try {
      setIsReverseGeocoding(true);
      const response = await axios.get<{ display_name?: string }>('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon: lng,
          format: 'jsonv2',
          zoom: 18,
          addressdetails: 1,
        },
      });
      setSelectedLocationLabel(response.data?.display_name ?? `(${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    } catch {
      setSelectedLocationLabel(`(${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const jumpMapToSelectedAddress = async () => {
    type NominatimSearchItem = {
      lat: string;
      lon: string;
      display_name?: string;
      boundingbox?: [string, string, string, string];
    };

    const geocodeFirst = async (
      candidates: string[],
      extraParams?: Record<string, string | number>
    ): Promise<NominatimSearchItem | null> => {
      for (const candidate of candidates) {
        const response = await axios.get<NominatimSearchItem[]>('https://nominatim.openstreetmap.org/search', {
          params: {
            q: candidate,
            format: 'json',
            limit: 1,
            countrycodes: 'vn',
            addressdetails: 1,
            ...extraParams,
          },
        });
        if (response.data?.[0]) {
          return response.data[0];
        }
      }
      return null;
    };

    const selectedProvince = provinces.find((item) => item.code === selectedProvinceCode)?.name ?? '';
    const selectedDistrict = districts.find((item) => item.code === selectedDistrictCode)?.name ?? '';
    const selectedWard = wards.find((item) => item.code === selectedWardCode)?.name ?? '';
    const inputAddress = mapSearchKeyword.trim();
    const fallbackAddress = [postRoomForm.streetDetail.trim(), postRoomForm.address.trim()].filter(Boolean).join(', ');
    const addressPart = inputAddress || fallbackAddress;
    const adminPart = [selectedWard, selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', ');
    const hasAnyAdmin = Boolean(selectedProvince || selectedDistrict || selectedWard);

    if (!addressPart && !hasAnyAdmin) {
        setMapSearchError('Vui lòng nhập địa chỉ hoặc chọn tỉnh/quận/phường để định vị.');
      return;
    }

    try {
      setIsMapSearching(true);
      setMapSearchError(null);

      // B1: luôn tìm "tâm khu vực" trước để có fallback tốt.
      const areaCandidates = [
        [selectedWard, selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
        [selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
        [selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
      ].filter(Boolean);
      const area = hasAnyAdmin ? await geocodeFirst(areaCandidates) : null;

      let areaLat = area ? Number(area.lat) : Number.NaN;
      let areaLng = area ? Number(area.lon) : Number.NaN;
      if (area && !Number.isNaN(areaLat) && !Number.isNaN(areaLng)) {
        const areaZoom = selectedWard ? 15 : selectedDistrict ? 13 : 11;
        setMapCenter([areaLat, areaLng]);
        setMapZoom(areaZoom);
      }

      // B2: tìm địa chỉ chi tiết, ưu tiên trong bbox của khu vực.
      const detailCandidates = [
        [addressPart, adminPart].filter(Boolean).join(', '),
        inputAddress ? `${inputAddress}, Viet Nam` : '',
        adminPart,
        selectedDistrict ? [addressPart, selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', ') : '',
      ].filter(Boolean);

      const bbox = area?.boundingbox;
      const detailInArea =
        bbox && bbox.length === 4
          ? await geocodeFirst(detailCandidates, {
              viewbox: `${bbox[2]},${bbox[0]},${bbox[3]},${bbox[1]}`,
              bounded: 1,
            })
          : null;
      const detail = detailInArea ?? (await geocodeFirst(detailCandidates));

      const picked = detail ?? area;
      if (!picked) {
        setMapSearchError('Không tìm thấy vị trí phù hợp. Hãy click trực tiếp trên bản đồ để chọn.');
        return;
      }
      const lat = Number(picked.lat);
      const lng = Number(picked.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setMapSearchError('Không thể đọc tọa độ từ kết quả bản đồ.');
        return;
      }
      const isDetail = Boolean(detail);
      setMapCenter([lat, lng]);
      setMapZoom(isDetail ? 16 : selectedWard ? 15 : selectedDistrict ? 13 : 11);
      if (picked.display_name) {
        setSelectedLocationLabel(picked.display_name);
      }
      if (!isDetail) {
        setMapSearchError('Đã nhảy tới khu vực gần đúng, vui lòng click map để chốt chính xác.');
      }
    } catch {
      setMapSearchError('Không thể định vị khu vực lúc này. Vui lòng thử lại.');
    } finally {
      setIsMapSearching(false);
    }
  };

  const editProvince = provinces.find((item) => item.code === editRoomProvinceCode);
  const editDistrictOptions = editProvince?.districts ?? [];
  const editDistrict = editDistrictOptions.find((item) => item.code === editRoomDistrictCode);
  const editWardOptions = editDistrict?.wards ?? [];

  return (
    <div className="sticky top-0 z-50 w-full border-b border-orange-100/80 bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ffb300] to-[#ff9900] px-4 py-2 text-lg font-black uppercase tracking-tight text-white shadow-sm hover:shadow-md transition"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">T</span>
          <span className="leading-none">TìmTrọ</span>
        </Link>

        <div className="hidden flex-1 items-center justify-end gap-2 md:flex">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
            onClick={() => console.log('TODO favorite list')}
            aria-label="Yêu thích"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 21s-7-4.8-9.2-8.2C.9 9.7 2.2 6 5.8 5.2A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.2-2.8c3.6.8 4.9 4.5 3 7.6C19 16.2 12 21 12 21Z"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
            onClick={() => console.log('TODO chat inbox')}
            aria-label="Nhắn tin"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3v-7A8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
          </button>
          {!isLoggedIn && (
            <button
              type="button"
              className="h-9 rounded-full border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              onClick={() => openAuthModal('login')}
            >
              Đăng nhập
            </button>
          )}
          <button
            type="button"
            className="h-9 rounded-full bg-neutral-900 px-3 text-sm font-semibold text-white transition hover:bg-black"
            onClick={openPostRoomModal}
          >
            Đăng tin
          </button>
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-white"
              onClick={() => (isLoggedIn ? setIsAccountMenuOpen((prev) => !prev) : openAuthModal('login'))}
              aria-label="Quản lý tài khoản"
              title={
                isLoggedIn
                  ? `Xin chào ${displayName || 'bạn'}. Bấm để mở menu tài khoản`
                  : 'Đăng nhập để quản lý tài khoản'
              }
            >
              {isLoggedIn ? (
                <span className="text-xs font-bold text-orange-600">
                  {(displayName || 'U').slice(0, 1).toUpperCase()}
                </span>
              ) : (
                <img
                  src="https://placehold.co/64x64?text=U"
                  alt="Ảnh đại diện tài khoản"
                  className="h-full w-full object-cover"
                />
              )}
            </button>
            {isLoggedIn && isAccountMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-neutral-200 bg-white py-1 text-sm shadow-lg">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <p className="text-xs font-medium text-neutral-500">Tài khoản</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
                    {displayName || 'Người dùng'}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    console.log('TODO: Tin đăng đã lưu');
                    setIsAccountMenuOpen(false);
                  }}
                >
                  <span>Tin đăng đã lưu</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    console.log('TODO: Lịch sử xem tin');
                    setIsAccountMenuOpen(false);
                  }}
                >
                  <span>Lịch sử xem tin</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    navigate('/account');
                  }}
                >
                  <span>Cài đặt tài khoản</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    openManageRooms();
                  }}
                >
                  <span>Quản lý tin</span>
                </button>
                <div className="my-1 border-t border-neutral-100" />
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    logout();
                  }}
                >
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {isAuthOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-3">
          <div className="relative w-full max-w-md rounded-2xl border border-orange-100 bg-white p-5 shadow-xl">
            <button
              type="button"
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100"
              onClick={() => setIsAuthOpen(false)}
              aria-label="Đóng popup xác thực"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4 inline-flex rounded-xl bg-orange-50 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${mode === 'login' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-600'}`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${mode === 'register' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-600'}`}
              >
                Đăng ký
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${mode === 'forgot' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-600'}`}
              >
                Quên MK
              </button>
            </div>

            {mode === 'login' && (
              <div className="space-y-3">
                <p className="text-lg font-bold text-neutral-900">Đăng nhập tài khoản</p>
                <input
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Tên đăng nhập hoặc email"
                  value={loginForm.identifier}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, identifier: event.target.value }))}
                />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Mật khẩu"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                />
                <button
                  type="button"
                  className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                >
                  {showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </button>
                <button
                  type="button"
                  className="h-10 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                  disabled={isSubmitting}
                  onClick={submitLogin}
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-3">
                <p className="text-lg font-bold text-neutral-900">Tạo tài khoản mới</p>
                <input
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Tên đăng nhập"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, username: event.target.value }))}
                />
                <input
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Tên hiển thị"
                  value={registerForm.displayName}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, displayName: event.target.value }))}
                />
                <input
                  type="email"
                  className={`h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 ${
                    registerEmailInvalid
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                      : 'border-neutral-300 focus:border-orange-400 focus:ring-orange-100'
                  }`}
                  placeholder="Email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                {registerEmailInvalid && (
                  <p className="-mt-1 text-xs font-medium text-red-600">Email không đúng định dạng.</p>
                )}
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Mật khẩu (ít nhất 6 ký tự)"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                />
                <button
                  type="button"
                  className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                >
                  {showRegisterPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </button>
                <input
                  type={showRegisterConfirmPassword ? 'text' : 'password'}
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Nhập lại mật khẩu"
                  value={registerForm.confirmPassword}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
                <button
                  type="button"
                  className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700"
                  onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                >
                  {showRegisterConfirmPassword ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'}
                </button>
                <button
                  type="button"
                  className="h-10 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                  disabled={isSubmitting}
                  onClick={submitRegister}
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Đăng ký'}
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <div className="space-y-3">
                <p className="text-lg font-bold text-neutral-900">Quên mật khẩu</p>
                <input
                  type="email"
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Email tài khoản"
                  value={forgotForm.email}
                  onChange={(event) => setForgotForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                {codeSent && (
                  <>
                    <input
                      className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm tracking-[0.2em] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      placeholder="Mã xác thực 6 số"
                      maxLength={6}
                      value={forgotForm.code}
                      onChange={(event) =>
                        setForgotForm((prev) => ({
                          ...prev,
                          code: event.target.value.replace(/\D/g, '').slice(0, 6),
                        }))
                      }
                    />
                    <input
                      type={showForgotPassword ? 'text' : 'password'}
                      className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                      value={forgotForm.newPassword}
                      onChange={(event) => setForgotForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700"
                      onClick={() => setShowForgotPassword((prev) => !prev)}
                    >
                      {showForgotPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="h-10 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                  disabled={isSubmitting}
                  onClick={submitForgotPassword}
                >
                  {isSubmitting ? 'Đang xử lý...' : codeSent ? 'Xác nhận đổi mật khẩu' : 'Gửi mã xác thực'}
                </button>
              </div>
            )}

            {authError && <p className="mt-3 text-sm text-red-600">{authError}</p>}
            {authMessage && <p className="mt-3 text-sm text-emerald-600">{authMessage}</p>}
          </div>
        </div>
      )}
      {isPostRoomOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-3 py-6">
          <div className="relative flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-2xl">
            <div className="relative shrink-0 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-5 pb-5 pt-6 text-white">
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                onClick={() => setIsPostRoomOpen(false)}
                aria-label="Đóng popup đăng tin"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Đăng tin</p>
              <h2 className="mt-1 text-2xl font-bold">Cho thuê phòng trọ</h2>
              <p className="mt-1 max-w-lg text-sm text-white/90">
                Điền thông tin rõ ràng để người tìm trọ dễ lọc theo tiện ích và khu vực.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
              <div className="space-y-6">
                <section className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Thông tin cơ bản</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-neutral-600">Tiêu đề tin</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="Ví dụ: Phòng trọ mặt tiền, giá tốt"
                        value={postRoomForm.title}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Giá (VND/tháng)</span>
                      <input
                        type="number"
                        min={0}
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="3000000"
                        value={postRoomForm.price}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, price: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Diện tích (m²)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="25"
                        value={postRoomForm.area}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, area: event.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Địa chỉ</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-neutral-600">Địa chỉ đầy đủ</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="Số nhà, đường, khu vực..."
                        value={postRoomForm.address}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, address: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Tỉnh/Thành</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={selectedProvinceCode ?? ''}
                        onChange={(event) => setSelectedProvinceCode(event.target.value ? Number(event.target.value) : null)}
                      >
                        <option value="">Chọn Tỉnh/Thành</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.code}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Quận/Huyện</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={selectedDistrictCode ?? ''}
                        onChange={(event) =>
                          setSelectedDistrictCode(event.target.value ? Number(event.target.value) : null)
                        }
                      >
                        <option value="">Chọn Quận/Huyện</option>
                        {districts.map((district) => (
                          <option key={district.code} value={district.code}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Phường/Xã</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={selectedWardCode ?? ''}
                        onChange={(event) => setSelectedWardCode(event.target.value ? Number(event.target.value) : null)}
                      >
                        <option value="">Chọn Phường/Xã</option>
                        {wards.map((ward) => (
                          <option key={ward.code} value={ward.code}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Số nhà, tên đường</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="Tùy chọn"
                        value={postRoomForm.streetDetail}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, streetDetail: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        onClick={() => {
                          setIsMapPickerOpen(true);
                          setMapSearchError(null);
                          if (!mapSearchKeyword.trim()) {
                            const selectedProvince = provinces.find((item) => item.code === selectedProvinceCode)?.name ?? '';
                            const selectedDistrict = districts.find((item) => item.code === selectedDistrictCode)?.name ?? '';
                            const selectedWard = wards.find((item) => item.code === selectedWardCode)?.name ?? '';
                            const suggested = [
                              postRoomForm.streetDetail.trim(),
                              postRoomForm.address.trim(),
                              selectedWard,
                              selectedDistrict,
                              selectedProvince,
                            ]
                              .filter(Boolean)
                              .join(', ');
                            setMapSearchKeyword(suggested);
                          }
                        }}
                      >
                        Chọn vị trí trên bản đồ
                      </button>
                      {selectedCoordinates && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Đã chọn: {selectedCoordinates.lat.toFixed(6)}, {selectedCoordinates.lng.toFixed(6)}
                        </span>
                      )}
                      {isReverseGeocoding && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Đang lấy địa chỉ...
                        </span>
                      )}
                    </div>
                    {selectedLocationLabel && (
                      <p className="mt-2 text-xs text-neutral-600">Vị trí: {selectedLocationLabel}</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-amber-50/40 p-4">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-orange-800/90">Tiện ích</h3>
                      <p className="text-xs text-neutral-600">Chọn các tiện ích có trong phòng (có thể chọn nhiều).</p>
                    </div>
                    <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-orange-700 shadow-sm">
                      Đã chọn {selectedAmenityIds.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {amenities.length === 0 ? (
                      <p className="text-sm text-neutral-500">Đang tải danh sách tiện ích...</p>
                    ) : (
                      amenities.map((item) => {
                        const active = selectedAmenityIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => togglePostRoomAmenity(item.id)}
                            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                              active
                                ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200/50'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:border-orange-200 hover:bg-orange-50/80'
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Ảnh phòng</h3>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/30">
                    <span className="text-sm font-semibold text-neutral-800">Kéo thả hoặc bấm để chọn ảnh</span>
                    <span className="mt-1 text-xs text-neutral-500">PNG, JPG — có thể chọn nhiều ảnh</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={(event) => setRoomImages(Array.from(event.target.files ?? []))}
                    />
                  </label>
                  <p className="mt-2 text-xs text-neutral-500">
                    {roomImages.length > 0 ? `Đã chọn ${roomImages.length} ảnh` : 'Chưa chọn ảnh'}
                  </p>
                  {roomImagePreviews.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {roomImagePreviews.map((previewUrl, index) => (
                        <img
                          key={`${previewUrl}-${index}`}
                          src={previewUrl}
                          alt={`Preview ${index + 1}`}
                          className="h-20 w-full rounded-lg border border-neutral-200 object-cover"
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Mô tả chi tiết</h3>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    placeholder="Mô tả phòng, điều kiện thuê, thời gian xem phòng..."
                    value={postRoomForm.description}
                    onChange={(event) => setPostRoomForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </section>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  className="h-10 min-w-[100px] rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  onClick={() => setIsPostRoomOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="h-10 min-w-[140px] rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
                  disabled={isPostingRoom || !selectedCoordinates}
                  onClick={submitPostRoom}
                >
                  {isPostingRoom ? 'Đang đăng...' : 'Đăng tin'}
                </button>
              </div>
              {postRoomError && <p className="mt-3 text-sm text-red-600">{postRoomError}</p>}
              {postRoomMessage && <p className="mt-3 text-sm text-emerald-600">{postRoomMessage}</p>}
            </div>
          </div>
        </div>
      )}
      {isPostRoomOpen && isMapPickerOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 px-3 py-6">
          <div className="relative flex h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-neutral-900">Chọn vị trí trên bản đồ</p>
                <p className="text-xs text-neutral-500">Bấm vào bản đồ để lấy tọa độ chính xác cho tin đăng</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                onClick={() => setIsMapPickerOpen(false)}
                aria-label="Đóng bản đồ chọn vị trí"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <input
                type="text"
                className="h-9 min-w-[240px] flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="Nhập địa chỉ (vd: Hải Châu, Đà Nẵng hoặc 26 Nguyễn Văn Linh...)"
                value={mapSearchKeyword}
                onChange={(event) => setMapSearchKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    jumpMapToSelectedAddress();
                  }
                }}
              />
              <button
                type="button"
                className="h-9 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                onClick={jumpMapToSelectedAddress}
                disabled={isMapSearching}
              >
                {isMapSearching ? 'Đang tìm...' : 'Tìm trên bản đồ'}
              </button>
              {selectedCoordinates && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selectedCoordinates.lat.toFixed(6)}, {selectedCoordinates.lng.toFixed(6)}
                </span>
              )}
              {selectedLocationLabel && <span className="text-xs text-neutral-600">{selectedLocationLabel}</span>}
            </div>
            {mapSearchError && (
              <p className="border-b border-neutral-100 px-4 py-2 text-xs font-medium text-red-600">{mapSearchError}</p>
            )}
            <div className="min-h-0 flex-1">
              <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapFlyTo center={mapCenter} zoom={mapZoom} />
                <MapClickHandler
                  onPick={(lat, lng) => {
                    setSelectedCoordinates({ lat, lng });
                    setMapCenter([lat, lng]);
                    setMapZoom(16);
                    setMapSearchError(null);
                    reverseGeocodeFromCoordinates(lat, lng);
                  }}
                />
                {selectedCoordinates && (
                  <CircleMarker
                    center={[selectedCoordinates.lat, selectedCoordinates.lng]}
                    radius={9}
                    pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="max-w-[260px] text-xs">
                        <p className="font-semibold text-neutral-800">Vị trí đã chọn</p>
                        <p className="mt-1 text-neutral-600">
                          {selectedLocationLabel ||
                            `${selectedCoordinates.lat.toFixed(6)}, ${selectedCoordinates.lng.toFixed(6)}`}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                )}
              </MapContainer>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3">
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() => setIsMapPickerOpen(false)}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
      {isManageRoomsOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-3 py-6">
          <div className="relative flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <p className="text-base font-bold text-neutral-900">Quản lý tin đăng</p>
                <p className="text-xs text-neutral-500">Chọn một tin để quản lý chi tiết</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                onClick={closeManageRooms}
                aria-label="Đóng danh sách quản lý tin"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {isLoadingMyRooms && <p className="text-sm text-neutral-600">Đang tải danh sách tin...</p>}
              {!isLoadingMyRooms && manageRoomsError && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {manageRoomsError}
                </p>
              )}
              {!isLoadingMyRooms && !manageRoomsError && myRooms.length === 0 && (
                <p className="text-sm text-neutral-600">Bạn chưa có tin đăng nào.</p>
              )}
              {!isLoadingMyRooms && !manageRoomsError && myRooms.length > 0 && (
                <div className="space-y-3">
                  {myRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:border-orange-300 hover:bg-orange-50/30"
                      onClick={() => setSelectedManageRoom(room)}
                    >
                      <img
                        src={room.imageUrls?.[0] || 'https://placehold.co/160x110?text=Room'}
                        alt={room.title}
                        className="h-20 w-28 rounded-lg border border-neutral-200 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold text-neutral-900">{room.title}</p>
                        <p className="mt-1 text-sm font-bold text-[#d0021b]">
                          {(Number(room.price || 0) / 1_000_000).toLocaleString('vi-VN')} triệu/tháng
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-neutral-600">
                          {[room.ward, room.district, room.province].filter(Boolean).join(', ') || 'Địa chỉ chưa cập nhật'}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
                            Trạng thái: {room.status || 'N/A'}
                          </span>
                          {typeof room.area === 'number' && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                              {room.area} m²
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-orange-600">Quản lý</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isManageRoomsOpen && selectedManageRoom && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-3 py-6">
          <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              onClick={() => setSelectedManageRoom(null)}
              aria-label="Đóng popup chi tiết quản lý tin"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-bold text-neutral-900">Quản lý tin #{selectedManageRoom.id}</h3>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-neutral-800">{selectedManageRoom.title}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <img
                src={selectedManageRoom.imageUrls?.[0] || 'https://placehold.co/300x200?text=Room'}
                alt={selectedManageRoom.title}
                className="h-36 w-full rounded-xl border border-neutral-200 object-cover"
              />
              <div className="space-y-2 text-sm text-neutral-700">
                <p>
                  <span className="font-semibold">Giá:</span>{' '}
                  {(Number(selectedManageRoom.price || 0) / 1_000_000).toLocaleString('vi-VN')} triệu/tháng
                </p>
                <p>
                  <span className="font-semibold">Diện tích:</span>{' '}
                  {typeof selectedManageRoom.area === 'number' ? `${selectedManageRoom.area} m²` : 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Trạng thái:</span> {selectedManageRoom.status || 'N/A'}
                </p>
                <p className="line-clamp-2">
                  <span className="font-semibold">Địa chỉ:</span>{' '}
                  {[selectedManageRoom.ward, selectedManageRoom.district, selectedManageRoom.province]
                    .filter(Boolean)
                    .join(', ') || 'Chưa cập nhật'}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() => openEditRoom(selectedManageRoom)}
              >
                Sửa tin
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                disabled={isManagingRoomAction}
                onClick={() => toggleManagedRoomStatus(selectedManageRoom.id)}
              >
                {isManagingRoomAction ? 'Đang xử lý...' : 'Đổi trạng thái còn phòng/đã thuê'}
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={isManagingRoomAction}
                onClick={() => {
                  if (window.confirm('Bạn có chắc muốn xóa tin này?')) {
                    deleteManagedRoom(selectedManageRoom.id);
                  }
                }}
              >
                Xóa tin
              </button>
            </div>
            {manageRoomsError && <p className="mt-3 text-sm text-red-600">{manageRoomsError}</p>}
          </div>
        </div>
      )}
      {isEditRoomOpen && selectedManageRoom && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 px-3 py-6">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-2xl">
            <div className="relative shrink-0 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-5 pb-5 pt-6 text-white">
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                onClick={() => setIsEditRoomOpen(false)}
                aria-label="Đóng popup sửa tin"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Quản lý tin</p>
              <h2 className="mt-1 text-2xl font-bold">Sửa tin #{selectedManageRoom.id}</h2>
              <p className="mt-1 max-w-lg text-sm text-white/90">Cập nhật nội dung theo giao diện chính của trang chủ.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
              <div className="space-y-6">
                <section className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Thông tin cơ bản</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-neutral-600">Tiêu đề tin</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomForm.title}
                        onChange={(event) => setEditRoomForm((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Giá (VND/tháng)</span>
                      <input
                        type="number"
                        min={0}
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomForm.price}
                        onChange={(event) => setEditRoomForm((prev) => ({ ...prev, price: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Diện tích (m²)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomForm.area}
                        onChange={(event) => setEditRoomForm((prev) => ({ ...prev, area: event.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Địa chỉ và tọa độ</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-neutral-600">Địa chỉ đầy đủ</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomForm.address}
                        onChange={(event) => setEditRoomForm((prev) => ({ ...prev, address: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Tỉnh/Thành</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomProvinceCode ?? ''}
                        onChange={(event) => {
                          const code = event.target.value ? Number(event.target.value) : null;
                          setEditRoomProvinceCode(code);
                          setEditRoomDistrictCode(null);
                          setEditRoomWardCode(null);
                        }}
                      >
                        <option value="">Chọn Tỉnh/Thành</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.code}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Quận/Huyện</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomDistrictCode ?? ''}
                        onChange={(event) => {
                          const code = event.target.value ? Number(event.target.value) : null;
                          setEditRoomDistrictCode(code);
                          setEditRoomWardCode(null);
                        }}
                      >
                        <option value="">Chọn Quận/Huyện</option>
                        {editDistrictOptions.map((district) => (
                          <option key={district.code} value={district.code}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Phường/Xã</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomWardCode ?? ''}
                        onChange={(event) => setEditRoomWardCode(event.target.value ? Number(event.target.value) : null)}
                      >
                        <option value="">Chọn Phường/Xã</option>
                        {editWardOptions.map((ward) => (
                          <option key={ward.code} value={ward.code}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Số nhà, tên đường</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomForm.streetDetail}
                        onChange={(event) => setEditRoomForm((prev) => ({ ...prev, streetDetail: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Vĩ độ</span>
                      <input
                        type="number"
                        step="0.000001"
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomCoordinates?.lat ?? ''}
                        onChange={(event) =>
                          setEditRoomCoordinates((prev) => ({
                            lat: Number(event.target.value),
                            lng: prev?.lng ?? 0,
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Kinh độ</span>
                      <input
                        type="number"
                        step="0.000001"
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={editRoomCoordinates?.lng ?? ''}
                        onChange={(event) =>
                          setEditRoomCoordinates((prev) => ({
                            lat: prev?.lat ?? 0,
                            lng: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        onClick={() => {
                          setIsEditMapPickerOpen(true);
                          setEditMapSearchError(null);
                        }}
                      >
                        Chọn tọa độ trên bản đồ
                      </button>
                      {editRoomCoordinates && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {editRoomCoordinates.lat.toFixed(6)}, {editRoomCoordinates.lng.toFixed(6)}
                        </span>
                      )}
                      {isEditReverseGeocoding && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Đang lấy địa chỉ...
                        </span>
                      )}
                    </div>
                    {editLocationLabel && <p className="mt-2 text-xs text-neutral-600">Vị trí: {editLocationLabel}</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-amber-50/40 p-4">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-orange-800/90">Tiện ích</h3>
                      <p className="text-xs text-neutral-600">Chọn tiện ích có trong phòng.</p>
                    </div>
                    <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-orange-700 shadow-sm">
                      Đã chọn {editRoomSelectedAmenityIds.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((item) => {
                      const active = editRoomSelectedAmenityIds.includes(item.id);
                      return (
                        <button
                          key={`edit-amenity-${item.id}`}
                          type="button"
                          onClick={() => toggleEditAmenity(item.id)}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            active
                              ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200/50'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:border-orange-200 hover:bg-orange-50/80'
                          }`}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Ảnh phòng</h3>
                  <p className="mb-2 text-xs text-neutral-600">Ảnh hiện tại (bấm để bỏ khỏi tin):</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {editRoomRemainingImageUrls.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() =>
                          setEditRoomRemainingImageUrls((prev) => prev.filter((item) => item !== url))
                        }
                        className="group relative overflow-hidden rounded-lg border border-neutral-200"
                        title="Bấm để bỏ ảnh này"
                      >
                        <img src={url} alt="Ảnh hiện tại" className="h-20 w-full object-cover" />
                        <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-xs font-semibold text-white group-hover:flex">
                          Bỏ ảnh
                        </span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4 py-6 text-center transition hover:border-orange-300 hover:bg-orange-50/30">
                    <span className="text-sm font-semibold text-neutral-800">Thêm ảnh mới</span>
                    <span className="mt-1 text-xs text-neutral-500">PNG, JPG — có thể chọn nhiều ảnh</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={(event) => setEditRoomNewImages(Array.from(event.target.files ?? []))}
                    />
                  </label>
                  {editRoomImagePreviews.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {editRoomImagePreviews.map((url, index) => (
                        <img
                          key={`${url}-${index}`}
                          src={url}
                          alt={`Ảnh mới ${index + 1}`}
                          className="h-20 w-full rounded-lg border border-neutral-200 object-cover"
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Mô tả chi tiết</h3>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    value={editRoomForm.description}
                    onChange={(event) => setEditRoomForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </section>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  className="h-10 min-w-[100px] rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  onClick={() => setIsEditRoomOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="h-10 min-w-[140px] rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
                  disabled={isSavingRoomEdit}
                  onClick={submitEditRoom}
                >
                  {isSavingRoomEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
              {editRoomError && <p className="mt-3 text-sm text-red-600">{editRoomError}</p>}
              {editRoomMessage && <p className="mt-3 text-sm text-emerald-600">{editRoomMessage}</p>}
            </div>
          </div>
        </div>
      )}
      {isEditRoomOpen && isEditMapPickerOpen && (
        <div className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 px-3 py-6">
          <div className="relative flex h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-neutral-900">Chọn tọa độ cho tin đang sửa</p>
                <p className="text-xs text-neutral-500">Nhập địa chỉ hoặc click trực tiếp lên bản đồ</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                onClick={() => setIsEditMapPickerOpen(false)}
                aria-label="Đóng bản đồ sửa tin"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <input
                type="text"
                className="h-9 min-w-[240px] flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="Nhập địa chỉ để tìm trên bản đồ..."
                value={editMapSearchKeyword}
                onChange={(event) => setEditMapSearchKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    jumpEditMapToSelectedAddress();
                  }
                }}
              />
              <button
                type="button"
                className="h-9 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                onClick={jumpEditMapToSelectedAddress}
                disabled={isEditMapSearching}
              >
                {isEditMapSearching ? 'Đang tìm...' : 'Tìm trên bản đồ'}
              </button>
            </div>
            {editMapSearchError && (
              <p className="border-b border-neutral-100 px-4 py-2 text-xs font-medium text-red-600">{editMapSearchError}</p>
            )}
            <div className="min-h-0 flex-1">
              <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapFlyTo center={mapCenter} zoom={mapZoom} />
                <MapClickHandler
                  onPick={(lat, lng) => {
                    setEditRoomCoordinates({ lat, lng });
                    setMapCenter([lat, lng]);
                    setMapZoom(16);
                    setEditMapSearchError(null);
                    reverseGeocodeForEditCoordinates(lat, lng);
                  }}
                />
                {editRoomCoordinates && (
                  <CircleMarker
                    center={[editRoomCoordinates.lat, editRoomCoordinates.lng]}
                    radius={9}
                    pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="max-w-[260px] text-xs">
                        <p className="font-semibold text-neutral-800">Tọa độ đang sửa</p>
                        <p className="mt-1 text-neutral-600">
                          {editLocationLabel ||
                            `${editRoomCoordinates.lat.toFixed(6)}, ${editRoomCoordinates.lng.toFixed(6)}`}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                )}
              </MapContainer>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3">
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                onClick={() => setIsEditMapPickerOpen(false)}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Header;

