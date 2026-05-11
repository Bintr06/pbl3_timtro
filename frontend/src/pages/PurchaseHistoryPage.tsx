import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, getAuthToken } from '../apiClient';

type PurchaseHistory = {
  id: number;
  userId: number;
  username: string;
  packageId: number;
  turns: number;
  amount: number;
  transferContent: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedByUsername: string | null;
  rejectionReason: string | null;
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

export default function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const authToken = getAuthToken();

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }

    const fetchHistory = async () => {
      try {
        const response = await get('/api/payment/history');
        if (response.status === 200) {
          setHistory(response.data);
        }
      } catch (error) {
        console.error('Lỗi tải lịch sử:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [authToken, navigate]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Chờ duyệt' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Đã duyệt' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Bị từ chối' },
    };
    const config = statusConfig[status] || statusConfig.PENDING;
    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}>{config.label}</span>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lịch sử mua lượt</h1>
          <button
            onClick={() => navigate('/buy-turns')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            + Mua thêm lượt
          </button>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Bạn chưa mua lượt nào</p>
            <button
              onClick={() => navigate('/buy-turns')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Mua lượt ngay
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ngày tạo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Số lượt</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Số tiền</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nội dung CK</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Trạng thái</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-800">{formatDate(item.createdAt)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{item.turns}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{item.amount.toLocaleString('vi-VN')} VNĐ</td>
                      <td className="px-6 py-4 text-sm font-mono text-blue-600 font-bold">{item.transferContent}</td>
                      <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                      <td className="px-6 py-4">
                        {item.status === 'REJECTED' && item.rejectionReason && (
                          <button
                            onClick={() => alert(`Lý do: ${item.rejectionReason}`)}
                            className="text-red-600 hover:text-red-800 text-sm font-semibold"
                          >
                            Xem lý do
                          </button>
                        )}
                        {item.status === 'APPROVED' && item.approvedAt && (
                          <span className="text-sm text-gray-600">Duyệt: {formatDate(item.approvedAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
