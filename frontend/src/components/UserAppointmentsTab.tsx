import React, { useEffect, useState } from 'react';
import { get } from '../apiClient'; // Sửa lại đường dẫn import nếu cần

type Appointment = {
    id: number;
    roomId: number;
    appointmentDate?: string;
    appointmentTime?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
};

const UserAppointmentsTab: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyBookings();
    }, []);

    const fetchMyBookings = async () => {
        try {
            // Gọi API lấy lịch hẹn của User đang đăng nhập (như trong Controller của bạn)
            const response = await get('/api/appointments/my');
            setAppointments(response.data?.data || response.data || []);
        } catch (error) {
            console.error('Lỗi khi tải lịch hẹn:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">Chờ duyệt</span>;
            case 'APPROVED':
                return <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">Đã duyệt</span>;
            case 'REJECTED':
                return <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">Từ chối</span>;
            default:
                return <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">{status}</span>;
        }
    };

    if (loading) return <div className="p-4 text-center">Đang tải lịch hẹn...</div>;

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-neutral-900">Lịch hẹn xem phòng của tôi</h2>

            {appointments.length === 0 ? (
                <p className="text-neutral-500">Bạn chưa đặt lịch xem phòng nào.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                        <tr>
                            <th className="p-4 font-semibold">Mã lịch hẹn</th>
                            <th className="p-4 font-semibold">ID Phòng</th>
                            <th className="p-4 font-semibold">Thời gian hẹn</th>
                            <th className="p-4 font-semibold text-right">Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                        {appointments.map((app) => (
                            <tr key={app.id} className="hover:bg-neutral-50">
                                <td className="p-4 font-medium text-neutral-900">#{app.id}</td>
                                <td className="p-4 text-neutral-700">{app.roomId}</td>
                                <td className="p-4 text-neutral-700">
                                    {app.appointmentTime || app.appointmentDate
                                        ? new Date(app.appointmentTime || app.appointmentDate).toLocaleString('vi-VN', {
                                            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                                        })
                                        : 'Không rõ'}
                                </td>
                                <td className="p-4 text-right">
                                    {getStatusBadge(app.status)}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default UserAppointmentsTab;