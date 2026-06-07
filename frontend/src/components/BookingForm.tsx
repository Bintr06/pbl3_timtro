import { useState } from 'react';
import { post } from '../apiClient';

type Props = {
    roomId: number;
};

export default function BookingForm({ roomId }: Props) {
    const [appointmentDate, setAppointmentDate] = useState('');
    const [note, setNote] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setIsError(false);

        try {
            await post('/api/appointments', {
                roomId,
                appointmentDate,
                note,
            });
            setMessage('Đặt lịch thành công! Vui lòng chờ chủ trọ phản hồi.');
            setAppointmentDate('');
            setNote('');
        } catch (error) {
            console.error('Booking error:', error);
            setIsError(true);
            setMessage('Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-neutral-800">Đặt lịch xem phòng</h3>

            <form onSubmit={handleBooking} className="flex flex-col gap-4">
                <div>
                    <label className="mb-1 block text-sm font-semibold text-neutral-600">
                        Ngày giờ xem phòng <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="datetime-local"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        required
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-neutral-600">
                        Ghi chú cho chủ trọ
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ví dụ: Mình có thể qua xem vào buổi chiều..."
                        rows={3}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !appointmentDate}
                    className="mt-2 h-10 w-full rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:bg-neutral-300"
                >
                    {loading ? 'Đang gửi...' : 'Gửi yêu cầu đặt lịch'}
                </button>

                {message && (
                    <p className={`mt-2 text-sm font-medium ${isError ? 'text-red-600' : 'text-green-600'}`}>
                        {message}
                    </p>
                )}
            </form>
        </div>
    );
}