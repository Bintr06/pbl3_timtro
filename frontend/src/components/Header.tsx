import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { del, get, getAuthToken, post, postFormData, put, setAuthToken, clearAuthToken } from '../apiClient';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme?: string; size?: string; text?: string; shape?: string; width?: string | number }
          ) => void;
        };
      };
    };
  }
}

type AuthMode = 'login' | 'register' | 'forgot';

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

type AuthResponse = {
  token?: string | null;
  username: string;
  displayName?: string;
  role: string;
};

type CurrentUserProfile = {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
};

type RoomCreateResponse = {
  status: number;
  message: string;
  data: null;
};

type SystemNotification = {
  id: number;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  senderName?: string | null;
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

const AUTH_USER_NAME_KEY = 'auth_user_name';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIMPLE_PASSWORD_REGEX = /^.{6,}$/;
const FORGOT_OTP_RATE_LIMIT_SECONDS = 60;
const VERIFY_OTP_RATE_LIMIT_SECONDS = 60;
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
const GOOGLE_SCRIPT_ID = 'google-identity-services';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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
  const [forgotOtpCooldown, setForgotOtpCooldown] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ email: '', code: '' });
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [verifyOtpCooldown, setVerifyOtpCooldown] = useState(0);
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
    streetDetail: '',
  });
  const [roomImages, setRoomImages] = useState<File[]>([]);
  const [primaryPostImageIndex, setPrimaryPostImageIndex] = useState(0);
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
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<number | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const roomImagePreviews = useMemo(() => roomImages.map((file) => URL.createObjectURL(file)), [roomImages]);
  const fallbackAvatar = useMemo(() => {
    const name = (displayName || 'User').trim();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=fff3e0&color=f57c00&bold=true`;
  }, [displayName]);
  const unreadNotificationCount = useMemo(
    () => systemNotifications.filter((item) => !item.read).length,
    [systemNotifications]
  );
  const selectedNotification = useMemo(
    () => systemNotifications.find((item) => item.id === selectedNotificationId) ?? null,
    [systemNotifications, selectedNotificationId]
  );

  const loadNotifications = async (silent = true) => {
    if (!getAuthToken()) {
      return;
    }
    try {
      if (!silent) {
        setIsLoadingNotifications(true);
      }
      const response = await get<ApiResponse<SystemNotification[]>>('/api/notifications');
      setSystemNotifications(response.data ?? []);
    } catch {
      if (!silent) {
        setSystemNotifications([]);
      }
    } finally {
      if (!silent) {
        setIsLoadingNotifications(false);
      }
    }
  };

  const loadUnreadChatCount = async () => {
    if (!getAuthToken()) {
      setUnreadChatCount(0);
      return;
    }
    try {
      const response = await get<{ count: number }>('/api/chat/unread-count');
      setUnreadChatCount(Number(response?.count ?? 0));
    } catch {
      setUnreadChatCount(0);
    }
  };

  const markNotificationAsRead = async (id: number) => {
    try {
      await put<string>(`/api/notifications/${id}/read`);
      setSystemNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await put<{ updated: number }>('/api/notifications/read-all');
      setSystemNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch {
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await del<string>(`/api/notifications/${id}`);
      setSystemNotifications((prev) => prev.filter((item) => item.id !== id));
      setSelectedNotificationId(null);
    } catch {
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await del<{ deleted: number }>('/api/notifications/all');
      setSystemNotifications([]);
      setSelectedNotificationId(null);
    } catch {
    }
  };

  const openAuthModal = (nextMode: AuthMode) => {
    setMode(nextMode);
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthOpen(true);
    setIsAccountMenuOpen(false);
    setIsNotificationMenuOpen(false);
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
    if (!isLoggedIn) {
      setUnreadChatCount(0);
      return;
    }

    void loadUnreadChatCount();
    const timer = window.setInterval(() => {
      void loadUnreadChatCount();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAccountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (
        isNotificationMenuOpen &&
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setIsNotificationMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isAccountMenuOpen, isNotificationMenuOpen]);

  useEffect(() => {
    if (forgotOtpCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setForgotOtpCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [forgotOtpCooldown]);

  useEffect(() => {
    if (verifyOtpCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setVerifyOtpCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verifyOtpCooldown]);

  useEffect(() => {
    let cancelled = false;

    const syncCurrentUser = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setAvatarUrl(null);
          setIsLoggedIn(false);
          setSystemNotifications([]);
        }
        return;
      }

      try {
        const profile = await get<CurrentUserProfile>('/api/users/me');
        if (cancelled) {
          return;
        }
        const nextName = profile.displayName || profile.username || localStorage.getItem(AUTH_USER_NAME_KEY) || '';
        if (nextName) {
          localStorage.setItem(AUTH_USER_NAME_KEY, nextName);
          setDisplayName(nextName);
        }
        setCurrentUserId(profile.id ?? null);
        setAvatarUrl(profile.avatarUrl ?? null);
        setCurrentUserRole(profile.role ?? null);
        setIsLoggedIn(true);
        void loadNotifications();
      } catch {
        if (!cancelled) {
          setCurrentUserId(null);
          setAvatarUrl(null);
          setCurrentUserRole(null);
          setSystemNotifications([]);
        }
      }
    };

    syncCurrentUser();
    const handleAuthStateChanged = () => {
      void syncCurrentUser();
    };
    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn]);

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
      if (!res?.data?.token) {
        throw new Error('Không nhận được token đăng nhập từ máy chủ.');
      }
      setAuthToken(res.data.token);
      const name = res.data.displayName || res.data.username;
      localStorage.setItem(AUTH_USER_NAME_KEY, name);
      setDisplayName(name);
      setIsLoggedIn(true);
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { loggedIn: true } }));
      setAuthMessage('Đăng nhập thành công.');
      setTimeout(() => setIsAuthOpen(false), 500);
    } catch (error) {
      const message = parseErrorMessage(error);
      if (message.toLowerCase().includes('xác thực email') || message.toLowerCase().includes('chưa xác thực email')) {
        const email = loginForm.identifier.trim();
        if (EMAIL_REGEX.test(email)) {
          setVerifyForm({ email, code: '' });
          setVerifyCodeSent(true);
          setVerifyOtpCooldown(0);
          setMode('register');
          setAuthMessage(null);
        }
      }
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitGoogleCredential = async (credential: string) => {
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);
      const res = await post<ApiResponse<AuthResponse>, { idToken: string }>('/api/auth/google', { idToken: credential });
      if (!res?.data?.token) {
        throw new Error('Không nhận được token đăng nhập từ máy chủ.');
      }
      setAuthToken(res.data.token);
      const name = res.data.displayName || res.data.username;
      localStorage.setItem(AUTH_USER_NAME_KEY, name);
      setDisplayName(name);
      setIsLoggedIn(true);
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { loggedIn: true } }));
      setAuthMessage('Đăng nhập Google thành công.');
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
      setAuthMessage(null);
      const res = await post<
        ApiResponse<AuthResponse>,
        { username: string; displayName: string; email: string; password: string }
      >('/api/auth/register', {
        username: registerForm.username,
        displayName: registerForm.displayName,
        email: registerForm.email,
        password: registerForm.password,
      });
      setVerifyForm({ email: registerForm.email.trim(), code: '' });
      setVerifyCodeSent(true);
      setVerifyOtpCooldown(VERIFY_OTP_RATE_LIMIT_SECONDS);
      setMode('register');
      setAuthMessage(res.message || 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã xác thực.');
    } catch (error) {
      setAuthError(parseErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendVerificationCode = async () => {
    if (!EMAIL_REGEX.test(verifyForm.email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (verifyOtpCooldown > 0) {
      setAuthError(`Vui lòng đợi ${verifyOtpCooldown}s trước khi gửi lại mã.`);
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);
      const res = await post<ApiResponse<null>, { email: string }>('/api/auth/resend-verification', {
        email: verifyForm.email,
      });
      setVerifyCodeSent(true);
      setVerifyOtpCooldown(VERIFY_OTP_RATE_LIMIT_SECONDS);
      setAuthMessage(res.message || 'Đã gửi mã xác thực email.');
    } catch (error) {
      setAuthError(parseErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVerifyEmail = async () => {
    if (!EMAIL_REGEX.test(verifyForm.email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (verifyForm.code.trim().length !== 6) {
      setAuthError('Mã xác thực phải gồm đúng 6 chữ số.');
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);
      const res = await post<ApiResponse<null>, { email: string; token: string }>('/api/auth/verify-email', {
        email: verifyForm.email,
        token: verifyForm.code.trim(),
      });
      setAuthMessage(res.message || 'Xác thực email thành công. Vui lòng đăng nhập.');
      setMode('login');
      setLoginForm((prev) => ({ ...prev, identifier: verifyForm.email }));
      setVerifyCodeSent(false);
      setVerifyOtpCooldown(0);
      setVerifyForm({ email: '', code: '' });
    } catch (error) {
      setAuthError(parseErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendForgotPasswordCode = async () => {
    if (!EMAIL_REGEX.test(forgotForm.email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (forgotOtpCooldown > 0) {
      setAuthError(`Vui lòng đợi ${forgotOtpCooldown}s trước khi gửi lại mã.`);
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);
      const res = await post<ApiResponse<null>, { email: string }>('/api/auth/forgot-password', {
        email: forgotForm.email,
      });
      setCodeSent(true);
      setForgotOtpCooldown(FORGOT_OTP_RATE_LIMIT_SECONDS);
      setAuthMessage(res.message || 'Mã xác thực đã được gửi nếu email tồn tại.');
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
    if (!codeSent) {
      setAuthError('Vui lòng gửi mã xác thực trước khi đặt lại mật khẩu.');
      return;
    }
    if (forgotForm.code.length !== 6) {
      setAuthError('Mã xác thực phải gồm đúng 6 chữ số.');
      return;
    }
    if (!SIMPLE_PASSWORD_REGEX.test(forgotForm.newPassword)) {
      setAuthError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);
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
        setForgotOtpCooldown(0);
        setForgotForm({ email: '', code: '', newPassword: '' });
      }, 600);
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
    setAvatarUrl(null);
    setCurrentUserId(null);
    setCurrentUserRole(null);
    setIsLoggedIn(false);
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { loggedIn: false } }));
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!isAuthOpen || mode !== 'login') {
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response?.credential) {
            void submitGoogleCredential(response.credential);
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderGoogleButton, { once: true });

    return () => {
      script?.removeEventListener('load', renderGoogleButton);
    };
  }, [isAuthOpen, mode]);

  const openPostRoomModal = () => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    setPostRoomError(null);
    setPostRoomMessage(null);
    setSelectedAmenityIds([]);
    setPrimaryPostImageIndex(0);
    setIsPostRoomOpen(true);
  };

  const openManageRooms = async () => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    setIsAccountMenuOpen(false);
    navigate('/my-listings');
  };


  const togglePostRoomAmenity = (id: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const removePostRoomImage = (index: number) => {
    setRoomImages((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setPrimaryPostImageIndex((current) => {
        if (next.length === 0) {
          return 0;
        }
        if (current === index) {
          return 0;
        }
        if (current > index) {
          return current - 1;
        }
        return Math.min(current, next.length - 1);
      });
      return next;
    });
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
        province: selectedProvince?.name ?? '',
        district: selectedDistrict?.name ?? '',
        ward: selectedWard?.name ?? '',
        streetDetail: postRoomForm.streetDetail.trim(),
        primaryImageIndex: primaryPostImageIndex,
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
        streetDetail: '',
      });
      setSelectedAmenityIds([]);
      setRoomImages([]);
      setPrimaryPostImageIndex(0);
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
    const fallbackAddress = [postRoomForm.streetDetail.trim()].filter(Boolean).join(', ');
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

      const areaCandidates = [
        [selectedWard, selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
        [selectedDistrict, selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
        [selectedProvince, 'Viet Nam'].filter(Boolean).join(', '),
      ].filter(Boolean);
      const area = hasAnyAdmin ? await geocodeFirst(areaCandidates) : null;

      const areaLat = area ? Number(area.lat) : Number.NaN;
      const areaLng = area ? Number(area.lon) : Number.NaN;
      if (area && !Number.isNaN(areaLat) && !Number.isNaN(areaLng)) {
        const areaZoom = selectedWard ? 15 : selectedDistrict ? 13 : 11;
        setMapCenter([areaLat, areaLng]);
        setMapZoom(areaZoom);
      }

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

  return (
    <div className="w-full border-b border-orange-300 bg-gradient-to-r from-orange-500 via-orange-500 to-orange-400">
      <div className="flex w-full items-center gap-4 px-3 py-3 sm:px-5 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#ffb300] to-[#ff9900] px-6 py-2.5 text-xl font-black uppercase tracking-tight text-white shadow-sm transition hover:shadow-md"
        >
          <span className="-ml-1 mr-1 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-[2rem] leading-none">T</span>
          <span className="leading-none">TìmTrọ</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-2 lg:flex">
          <button
            type="button"
            className="h-10 rounded-full px-4 text-sm font-semibold text-white/95 transition hover:bg-white/15"
            onClick={() => {
              if (!isLoggedIn) {
                openAuthModal('login');
                return;
              }
              if (currentUserId) {
                navigate(`/profile/${currentUserId}`);
                return;
              }
              navigate('/account');
            }}
          >
            Trang cá nhân
          </button>
          <button
            type="button"
            className="h-10 rounded-full px-4 text-sm font-semibold text-white/95 transition hover:bg-white/15"
            onClick={() => navigate('/')}
          >
            Tìm trọ
          </button>
          <button
            type="button"
            className="h-10 rounded-full px-4 text-sm font-semibold text-white/95 transition hover:bg-white/15"
            onClick={() => {
              if (!isLoggedIn) {
                openAuthModal('login');
                return;
              }
              navigate('/favorites');
            }}
          >
            Tin đã lưu
          </button>
          <button
            type="button"
            className="h-10 rounded-full px-4 text-sm font-semibold text-white/95 transition hover:bg-white/15"
            onClick={() => {
              if (!isLoggedIn) {
                openAuthModal('login');
                return;
              }
              navigate('/history');
            }}
          >
            Lịch sử xem
          </button>
        </nav>

        <div className="ml-auto hidden items-center justify-end gap-2 md:flex">
          <div className="relative" ref={notificationMenuRef}>
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
              onClick={() => {
                if (!isLoggedIn) {
                  openAuthModal('login');
                  return;
                }
                if (!isNotificationMenuOpen) {
                  void loadNotifications(false);
                }
                setIsNotificationMenuOpen((prev) => !prev);
              }}
              aria-label="Thông báo"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
              </svg>
              {isLoggedIn && unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>
            {isLoggedIn && isNotificationMenuOpen && (
              <div className="absolute right-0 z-[1100] mt-2 w-80 rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-lg">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-neutral-900">Thông báo</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                      onClick={() => void markAllNotificationsAsRead()}
                      title="Đánh dấu đã đọc"
                    >
                      Đánh dấu đã đọc
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                      onClick={() => void deleteAllNotifications()}
                      title="Xóa tất cả thông báo"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                </div>
                {isLoadingNotifications ? (
                  <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">Đang tải thông báo...</p>
                ) : systemNotifications.length === 0 ? (
                  <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">Chưa có thông báo mới.</p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {systemNotifications.map((item) => (
                      <div key={item.id} className="relative">
                        <button
                          type="button"
                          className={`w-full rounded-lg border px-3 py-2 text-left transition hover:bg-neutral-50 ${
                            item.read ? 'border-neutral-200 bg-white' : 'border-orange-200 bg-orange-50/60'
                          }`}
                          onClick={() => {
                            setSelectedNotificationId(item.id);
                            if (!item.read) {
                              void markNotificationAsRead(item.id);
                            }
                          }}
                        >
                          <p className="text-xs font-semibold text-neutral-900">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{item.content}</p>
                          <p className="mt-1 text-[11px] text-neutral-500">
                            {'Hệ thống · '}
                            {new Date(item.createdAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </p>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
            onClick={() => {
              if (!isLoggedIn) {
                openAuthModal('login');
                return;
              }
              navigate('/favorites');
            }}
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
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:bg-neutral-50"
            onClick={() => {
              if (!isLoggedIn) {
                openAuthModal('login');
                return;
              }
              setUnreadChatCount(0);
              navigate('/chat');
            }}
            aria-label="Nhắn tin"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3v-7A8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
            {isLoggedIn && unreadChatCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
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
              className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-white"
              onClick={() => (isLoggedIn ? setIsAccountMenuOpen((prev) => !prev) : openAuthModal('login'))}
              aria-label="Quản lý tài khoản"
              title={
                isLoggedIn
                  ? `Xin chào ${displayName || 'bạn'}. Bấm để mở menu tài khoản`
                  : 'Đăng nhập để quản lý tài khoản'
              }
            >
              <img
                src={isLoggedIn ? avatarUrl || fallbackAvatar : 'https://placehold.co/64x64?text=U'}
                alt="Ảnh đại diện tài khoản"
                className="h-full w-full object-cover"
              />
            </button>
            {isLoggedIn && isAccountMenuOpen && (
              <div className="absolute right-0 z-[1100] mt-2 w-56 rounded-xl border border-neutral-200 bg-white py-1 text-sm shadow-lg">
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
                    setIsAccountMenuOpen(false);
                    navigate('/favorites');
                  }}
                >
                  <span>Tin đăng đã lưu</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                  disabled={!currentUserId}
                  onClick={() => {
                    if (!currentUserId) {
                      return;
                    }
                    setIsAccountMenuOpen(false);
                    navigate(`/profile/${currentUserId}`);
                  }}
                >
                  <span>Trang cá nhân</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    navigate('/history');
                  }}
                >
                  <span>Lịch sử xem tin</span>
                </button>
                {currentUserRole?.toUpperCase() === 'ADMIN' && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      navigate('/admin');
                    }}
                  >
                    <span>Dashboard admin</span>
                  </button>
                )}
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
      {selectedNotification && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 px-4"
          onClick={() => setSelectedNotificationId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-neutral-900">{selectedNotification.title}</h3>
              <button
                type="button"
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                onClick={() => setSelectedNotificationId(null)}
                aria-label="Đóng"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="mb-4 whitespace-pre-wrap text-sm text-neutral-700">{selectedNotification.content}</p>
            <p className="mb-4 text-xs text-neutral-500">
              {'Từ: Hệ thống'}
              {' · '}
              {new Date(selectedNotification.createdAt).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
            <button
              type="button"
              className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
              onClick={() => void deleteNotification(selectedNotification.id)}
            >
              Xóa thông báo này
            </button>
          </div>
        </div>
      )}
      {isAuthOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-md">
          <div className="relative w-full max-h-[92vh] max-w-5xl overflow-hidden rounded-[30px] border border-orange-100 bg-white/95 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-orange-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
            <button
              type="button"
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white/90 text-neutral-500 transition hover:bg-neutral-100"
              onClick={() => setIsAuthOpen(false)}
              aria-label="Đóng popup xác thực"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="grid lg:min-h-[600px] lg:grid-cols-[1fr_1.12fr]">
              <div className="relative hidden overflow-hidden border-r border-orange-100 bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 p-8 text-white lg:flex lg:flex-col lg:justify-between">
                <div>
                  <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    Timtro Portal
                  </p>
                  <h3 className="mt-5 text-4xl font-black leading-tight">Chào mừng bạn quay lại</h3>
                  <p className="mt-3 max-w-sm text-sm text-white/90">
                    Đăng nhập để quản lý tin đăng, trò chuyện trực tiếp với người thuê và theo dõi phòng yêu thích.
                  </p>
                </div>
                <div className="space-y-3 text-sm font-medium text-white/95">
                  <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">Đăng tin nhanh và cập nhật linh hoạt theo thời gian thực.</div>
                  <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">Lưu lịch sử xem phòng và theo dõi danh sách yêu thích.</div>
                </div>
                <div className="absolute -right-10 top-16 h-40 w-40 rounded-full border border-white/40" />
                <div className="absolute -left-12 bottom-12 h-36 w-36 rounded-full bg-white/20 blur-xl" />
              </div>

              <div className="relative overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
                <div className="mb-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Tài khoản</p>
                  <h2 className="text-2xl font-extrabold text-neutral-900">Truy cập hệ thống Timtro</h2>
                </div>

                <div className="mb-5 inline-flex rounded-2xl bg-orange-50 p-1.5 ring-1 ring-orange-100">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}
              >
                Đăng ký
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'forgot' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}
              >
                Quên mật khẩu
              </button>
            </div>

            {mode === 'login' && (
              <div className="space-y-4 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                <p className="text-2xl font-bold text-neutral-900">Đăng nhập tài khoản</p>
                <input
                  className="h-12 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Tên đăng nhập hoặc email"
                  value={loginForm.identifier}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, identifier: event.target.value }))}
                />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="h-12 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
                  disabled={isSubmitting}
                  onClick={submitLogin}
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
                </button>
                <div className="relative py-1 text-center text-xs text-neutral-400">
                  <span className="bg-white px-2">hoặc</span>
                </div>
                {GOOGLE_CLIENT_ID ? (
                  <div className="flex justify-center">
                    <div ref={googleButtonRef} />
                  </div>
                ) : (
                  <p className="text-center text-xs text-neutral-500">Google login chưa được cấu hình ở frontend.</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-3 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                {!verifyCodeSent ? (
                  <>
                    <p className="text-xl font-bold text-neutral-900">Tạo tài khoản mới</p>
                    <input
                      className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      placeholder="Tên đăng nhập"
                      value={registerForm.username}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, username: event.target.value }))}
                    />
                    <input
                      className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      placeholder="Tên hiển thị"
                      value={registerForm.displayName}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, displayName: event.target.value }))}
                    />
                    <input
                      type="email"
                      className={`h-11 w-full rounded-xl border px-4 text-sm outline-none focus:ring-2 ${
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
                      className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                      className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      placeholder="Nhập lại mật khẩu"
                      value={registerForm.confirmPassword}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700"
                      onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                    >
                      {showRegisterConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    </button>
                    <button
                      type="button"
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
                      disabled={isSubmitting || registerEmailInvalid}
                      onClick={submitRegister}
                    >
                      {isSubmitting ? 'Đang xử lý...' : 'Tạo tài khoản'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-neutral-900">Xác thực email đăng ký</p>
                    <input
                      type="email"
                      className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      placeholder="Email đã đăng ký"
                      value={verifyForm.email}
                      onChange={(event) => setVerifyForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="Mã xác thực email"
                        value={verifyForm.code}
                        onChange={(event) => setVerifyForm((prev) => ({ ...prev, code: event.target.value }))}
                      />
                      <button
                        type="button"
                        className="h-11 rounded-xl border border-orange-300 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
                        disabled={isSubmitting || verifyOtpCooldown > 0}
                        onClick={sendVerificationCode}
                      >
                        {isSubmitting
                          ? 'Đang gửi...'
                          : verifyOtpCooldown > 0
                            ? `Gửi lại sau ${verifyOtpCooldown}s`
                            : 'Gửi lại mã'}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500">Bạn chỉ có thể gửi lại mã sau mỗi 60 giây.</p>
                    <button
                      type="button"
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
                      disabled={isSubmitting}
                      onClick={submitVerifyEmail}
                    >
                      {isSubmitting ? 'Đang xử lý...' : 'Xác thực email'}
                    </button>
                    <button
                      type="button"
                      className="h-10 w-full rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      disabled={isSubmitting}
                      onClick={() => {
                        setVerifyCodeSent(false);
                        setVerifyOtpCooldown(0);
                        setVerifyForm({ email: '', code: '' });
                      }}
                    >
                      Quay lại chỉnh thông tin đăng ký
                    </button>
                  </>
                )}
              </div>
            )}

            {mode === 'forgot' && (
              <div className="space-y-3 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                <p className="text-xl font-bold text-neutral-900">Khôi phục mật khẩu</p>
                <input
                  type="email"
                  className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Email đã đăng ký"
                  value={forgotForm.email}
                  onChange={(event) => setForgotForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    placeholder="Mã OTP"
                    value={forgotForm.code}
                    onChange={(event) => setForgotForm((prev) => ({ ...prev, code: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-orange-300 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
                    disabled={isSubmitting || forgotOtpCooldown > 0}
                    onClick={sendForgotPasswordCode}
                  >
                    {isSubmitting
                      ? 'Đang gửi...'
                      : forgotOtpCooldown > 0
                        ? `Gửi lại sau ${forgotOtpCooldown}s`
                        : codeSent
                          ? 'Gửi lại mã'
                          : 'Gửi mã xác thực'}
                  </button>
                </div>
                <p className="text-xs text-neutral-500">Bạn chỉ có thể gửi lại mã sau mỗi 60 giây.</p>
                <input
                  type={showForgotPassword ? 'text' : 'password'}
                  className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Mật khẩu mới"
                  value={forgotForm.newPassword}
                  onChange={(event) => setForgotForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                />
                <button
                  type="button"
                  className="text-left text-xs font-semibold text-orange-600 hover:text-orange-700"
                  onClick={() => setShowForgotPassword((prev) => !prev)}
                >
                  {showForgotPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </button>
                <button
                  type="button"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
                  disabled={isSubmitting || !codeSent}
                  onClick={submitForgotPassword}
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                </button>
              </div>
            )}

                {(authError || authMessage) && (
                  <p
                    className={`mt-4 rounded-xl border px-3 py-2 text-sm font-medium ${
                      authError
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {authError ?? authMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {isPostRoomOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-3 py-4 backdrop-blur-[2px]">
          <div className="relative w-full max-h-[92vh] max-w-4xl overflow-y-auto rounded-3xl border border-orange-100 bg-white shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50"
              onClick={() => setIsPostRoomOpen(false)}
              aria-label="Đóng popup đăng tin"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="rounded-t-3xl border-b border-orange-100 bg-gradient-to-r from-orange-50 via-amber-50 to-white px-5 py-4 pr-14 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Đăng tin</p>
              <h2 className="mt-1 text-xl font-bold text-neutral-900">Tạo tin phòng mới</h2>
              <p className="text-sm text-neutral-600">Nhập nhanh thông tin, chọn vị trí trên map và đăng ngay.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-orange-100">
                  Ảnh đã chọn: {roomImages.length}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    selectedCoordinates
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-amber-100'
                  }`}
                >
                  {selectedCoordinates ? 'Đã chọn vị trí map' : 'Chưa chọn vị trí map'}
                </span>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Thông tin cơ bản</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-xs font-medium text-neutral-600">Tiêu đề tin</span>
                      <input
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="Ví dụ: Phòng full nội thất gần đại học"
                        value={postRoomForm.title}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Giá thuê (VNĐ/tháng)</span>
                      <input
                        type="number"
                        min="0"
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="3000000"
                        value={postRoomForm.price}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, price: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Diện tích (m²)</span>
                      <input
                        type="number"
                        min="0"
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        placeholder="20"
                        value={postRoomForm.area}
                        onChange={(event) => setPostRoomForm((prev) => ({ ...prev, area: event.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Địa chỉ</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-neutral-600">Tỉnh/Thành phố</span>
                      <select
                        className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={selectedProvinceCode ?? ''}
                        onChange={(event) =>
                          setSelectedProvinceCode(event.target.value ? Number(event.target.value) : null)
                        }
                      >
                        <option value="">Chọn Tỉnh/Thành phố</option>
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
                  <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="h-9 rounded-xl border border-orange-300 bg-white px-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                        onClick={() => {
                          setIsMapPickerOpen(true);
                          setMapSearchError(null);
                          if (!mapSearchKeyword.trim()) {
                            const selectedProvince = provinces.find((item) => item.code === selectedProvinceCode)?.name ?? '';
                            const selectedDistrict = districts.find((item) => item.code === selectedDistrictCode)?.name ?? '';
                            const selectedWard = wards.find((item) => item.code === selectedWardCode)?.name ?? '';
                            const suggested = [
                              postRoomForm.streetDetail.trim(),
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
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          Đã chọn: {selectedCoordinates.lat.toFixed(6)}, {selectedCoordinates.lng.toFixed(6)}
                        </span>
                      )}
                      {isReverseGeocoding && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                          Đang lấy địa chỉ...
                        </span>
                      )}
                    </div>
                    {selectedLocationLabel && (
                      <p className="mt-2 text-xs text-neutral-600">Vị trí: {selectedLocationLabel}</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Tiện ích</h3>
                    <span className="text-[11px] font-semibold text-neutral-500">Đã chọn {selectedAmenityIds.length}</span>
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
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              active
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-orange-100 bg-gradient-to-b from-orange-50/50 to-white p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Ảnh phòng</h3>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/30">
                    <span className="text-sm font-semibold text-neutral-800">Kéo thả hoặc bấm để chọn ảnh</span>
                    <span className="mt-1 text-xs text-neutral-500">PNG, JPG — có thể chọn nhiều ảnh</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        setRoomImages(files);
                        if (files.length === 0) {
                          setPrimaryPostImageIndex(0);
                        } else if (primaryPostImageIndex >= files.length) {
                          setPrimaryPostImageIndex(0);
                        }
                      }}
                    />
                  </label>
                  <p className="mt-2 text-xs text-neutral-500">
                    {roomImages.length > 0 ? `Đã chọn ${roomImages.length} ảnh` : 'Chưa chọn ảnh'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">Bấm ảnh để chọn ảnh đại diện, bấm "Xóa" để bỏ từng ảnh.</p>
                  {roomImagePreviews.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {roomImagePreviews.map((previewUrl, index) => (
                        <div
                          key={`${previewUrl}-${index}`}
                          className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white"
                        >
                          <button
                            type="button"
                            className={`block w-full ${index === primaryPostImageIndex ? 'ring-2 ring-orange-200' : ''}`}
                            onClick={() => setPrimaryPostImageIndex(index)}
                            title="Chọn làm ảnh đại diện"
                          >
                            <img
                              src={previewUrl}
                              alt={`Preview ${index + 1}`}
                              className={`h-20 w-full object-cover ${
                                index === primaryPostImageIndex ? 'border border-orange-500' : ''
                              }`}
                            />
                          </button>
                          <span
                            className={`pointer-events-none absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              index === primaryPostImageIndex
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/90 text-neutral-700'
                            }`}
                          >
                            Đại diện
                          </span>
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                            onClick={() => removePostRoomImage(index)}
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            className={`w-full border-t px-2 py-1 text-[11px] font-semibold transition ${
                              index === primaryPostImageIndex
                                ? 'border-orange-200 bg-orange-50 text-orange-700'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                            disabled={index === primaryPostImageIndex}
                            onClick={() => setPrimaryPostImageIndex(index)}
                          >
                            {index === primaryPostImageIndex ? 'Đang là ảnh đại diện' : 'Chọn ảnh này làm đại diện'}
                          </button>
                        </div>
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

              <div className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-white/95 pb-1 pt-4 backdrop-blur">
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
    </div>
  );
}

export default Header;

