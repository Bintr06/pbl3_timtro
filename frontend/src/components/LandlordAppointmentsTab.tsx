import { useState, useEffect } from 'react';
import { get, put } from '../apiClient';

type Appointment = {
    id: number;
    roomId: number;
    tenantId: number;
    tenantUsername?: string;
    landlordId: number;
    appointmentDate?: string;
    appointmentTime?: string;
    note: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    rejectionReason?: string;
};

type ApiResponse<T> = {
    status: number;
    message: string;
    data: T;
};

type Props = {
    isOpen: boolean;
};

export default function LandlordAppointmentsTab({ isOpen }: Props) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState<string>('Phòng đã được cho thuê');
    const [customReason, setCustomReason] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            fetchAppointments();
        }
    }, [isOpen]);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const response = await get('/api/appointments/landlord') as ApiResponse<Appointment[]> | Appointment[];
            const data = (response as ApiResponse<Appointment[]>).data || response;
            setAppointments(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Lỗi tải danh sách lịch hẹn", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: number, action: 'approve' | 'reject' | 'REJECTED', reason?: string) => {
        setProcessingId(id);
        try {
            const newStatus = (action === 'approve' || action === 'APPROVED') ? 'APPROVED' : 'REJECTED';
            await put(`/api/appointments/${id}/status`, {
                status: newStatus,
                reason: reason
            });
            setAppointments(prev =>
                prev.map(app =>
                    // Sửa status: status thành status: newStatus ở đây
                    app.id === id ? { ...app, status: newStatus, rejectionReason: reason } : app
                )
            );
            if (newStatus === 'REJECTED') {
                setRejectingId(null);
                setCustomReason('');
            }
        } catch (error: any) {
            console.error(`Lỗi cập nhật trạng thái lịch hẹn`, error);
            alert(error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    // TẤT CẢ GIAO DIỆN PHẢI NẰM TRONG CẶP NGOẶC TRÒN CỦA return NÀY
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm relative">
            <h2 className="mb-6 text-xl font-bold text-neutral-800">Quản lý lịch hẹn xem phòng</h2>

            {loading ? (
                <div className="flex h-32 items-center justify-center text-neutral-500">
                    Đang tải dữ liệu...
                </div>
            ) : appointments.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-neutral-500">
                    Chưa có lịch hẹn nào.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                        <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50">
                            <th className="p-4 font-semibold text-neutral-600">ID</th>
                            <th className="p-4 font-semibold text-neutral-600">Người thuê</th>
                            <th className="p-4 font-semibold text-neutral-600">Phòng</th>
                            <th className="p-4 font-semibold text-neutral-600">Thời gian</th>
                            <th className="p-4 font-semibold text-neutral-600">Ghi chú</th>
                            <th className="p-4 font-semibold text-neutral-600">Trạng thái</th>
                            <th className="p-4 font-semibold text-neutral-600">Thao tác</th>
                        </tr>
                        </thead>
                        <tbody>
                        {appointments.map((app) => (
                            <tr key={app.id} className="border-b border-neutral-100 last:border-none hover:bg-neutral-50">
                                <td className="p-4 text-neutral-700">#{app.id}</td>
                                <td className="p-4 font-medium text-neutral-900">
                                    {app.tenantUsername ? app.tenantUsername : `Người thuê ID: ${app.tenantId}`}
                                </td>
                                <td className="p-4 text-neutral-700">Phòng ID: {app.roomId}</td>
                                <td className="p-4 text-neutral-700">
                                    {app.appointmentTime || app.appointmentDate
                                        ? new Date(app.appointmentTime || app.appointmentDate).toLocaleString('vi-VN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        })
                                        : 'Không rõ thời gian'}
                                </td>
                                <td className="p-4 text-neutral-600 max-w-[200px] truncate" title={app.note}>
                                    {app.note || <span className="italic text-neutral-400">Không có</span>}
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                                        ${app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                        app.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                            app.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'}`}
                                    >
                                        {app.status === 'PENDING' ? 'Chờ duyệt' : app.status === 'APPROVED' ? 'Đã duyệt' : app.status === 'REJECTED' ? 'Từ chối' : 'Đã hủy'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {app.status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAction(app.id, 'approve')}
                                                disabled={processingId === app.id}
                                                className="rounded bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:bg-green-300"
                                            >
                                                {processingId === app.id ? '...' : 'Duyệt'}
                                            </button>
                                            <button
                                                onClick={() => setRejectingId(app.id)}
                                                disabled={processingId === app.id}
                                                className="rounded border border-red-500 bg-white px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:border-red-300 disabled:text-red-300"
                                            >
                                                Từ chối
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- BẢNG CHỌN LÝ DO TỪ CHỐI (Đã được đưa vào TRONG return) --- */}
            {rejectingId && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="mb-4 text-lg font-bold text-neutral-900">Lý do từ chối lịch hẹn #{rejectingId}</h3>

                        <div className="space-y-3 mb-6">
                            {[
                                'Phòng đã được cho thuê',
                                'Trùng lịch hẹn, vui lòng chọn giờ khác',
                                'Phòng đang sửa chữa, chưa thể xem',
                                'Khác'
                            ].map((reason) => (
                                <label key={reason} className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="rejectReason"
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                                        checked={rejectReason === reason}
                                        onChange={() => setRejectReason(reason)}
                                    />
                                    <span className="text-sm text-neutral-700">{reason}</span>
                                </label>
                            ))}

                            {rejectReason === 'Khác' && (
                                <textarea
                                    className="w-full mt-2 rounded-lg border border-neutral-300 p-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    rows={3}
                                    placeholder="Nhập lý do từ chối của bạn..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setRejectingId(null)}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={() => handleAction(
                                    rejectingId,
                                    'REJECTED',
                                    rejectReason === 'Khác' ? customReason : rejectReason
                                )}
                                disabled={processingId === rejectingId}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                            >
                                {processingId === rejectingId ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}