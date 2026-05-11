import { useState, useEffect } from 'react';
import { get, post } from '../apiClient';

type TurnPurchase = {
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

type PaginatedResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

type Props = {
  isOpen: boolean;
};

export default function PurchaseManagementTab({ isOpen }: Props) {
  const [purchases, setPurchases] = useState<TurnPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPurchases();
    }
  }, [isOpen, page, statusFilter, sortOrder]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const endpoint = statusFilter === 'ALL' ? '/api/payment/admin/all' : '/api/payment/admin/pending';
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', '10');
      params.set('sortOrder', sortOrder);
      const response = await get<ApiResponse<PaginatedResponse<TurnPurchase>>>(
        `${endpoint}?${params.toString()}`
      );
      if (response.status === 200) {
        setPurchases(response.data.content || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Lỗi tải danh sách mua lượt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePurchase = async (purchaseId: number) => {
    setApprovingId(purchaseId);
    try {
      const response = await post('/api/payment/admin/approve', {
        purchaseId: purchaseId,
      });
      if (response.status === 200) {
        alert('Duyệt yêu cầu thành công!');
        loadPurchases();
      }
    } catch (error) {
      console.error('Lỗi duyệt yêu cầu:', error);
      alert('Lỗi khi duyệt yêu cầu');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectPurchase = async (purchaseId: number) => {
    const reason = rejectReason[purchaseId];
    if (!reason || reason.trim() === '') {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }

    setRejectingId(purchaseId);
    try {
      const response = await post('/api/payment/admin/reject', {
        purchaseId: purchaseId,
        rejectionReason: reason,
      });
      if (response.status === 200) {
        alert('Từ chối yêu cầu thành công!');
        setShowRejectForm(null);
        setRejectReason((prev) => {
          const newReasons = { ...prev };
          delete newReasons[purchaseId];
          return newReasons;
        });
        loadPurchases();
      }
    } catch (error) {
      console.error('Lỗi từ chối yêu cầu:', error);
      alert('Lỗi khi từ chối yêu cầu');
    } finally {
      setRejectingId(null);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setStatusFilter('PENDING');
              setPage(0);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              statusFilter === 'PENDING'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Chờ duyệt
          </button>
          <button
            onClick={() => {
              setStatusFilter('ALL');
              setPage(0);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => {
              setSortOrder('DESC');
              setPage(0);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              sortOrder === 'DESC'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Mới nhất
          </button>
          <button
            onClick={() => {
              setSortOrder('ASC');
              setPage(0);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              sortOrder === 'ASC'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Cũ nhất
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button
            onClick={() => {
              setSortOrder('DESC');
              setPage(0);
            }}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
          >
            Mặc định
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500">
          Không có yêu cầu mua lượt
        </div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Người dùng</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Lượt</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Số tiền</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nội dung CK</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Ngày tạo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold">{purchase.username}</div>
                      <div className="text-xs text-gray-500">ID: {purchase.userId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{purchase.turns}</td>
                    <td className="px-4 py-3 text-sm">{purchase.amount.toLocaleString('vi-VN')} VNĐ</td>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600">{purchase.transferContent}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(purchase.createdAt)}</td>
                    <td className="px-4 py-3">{getStatusBadge(purchase.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      {purchase.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprovePurchase(purchase.id)}
                            disabled={approvingId === purchase.id}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {approvingId === purchase.id ? 'Đang...' : 'Duyệt'}
                          </button>
                          <button
                            onClick={() => setShowRejectForm(showRejectForm === purchase.id ? null : purchase.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
                          >
                            Từ chối
                          </button>
                        </div>
                      )}
                      {purchase.status === 'APPROVED' && (
                        <span className="text-xs text-green-600 font-semibold">Duyệt: {formatDate(purchase.approvedAt!)}</span>
                      )}
                      {purchase.status === 'REJECTED' && (
                        <button
                          onClick={() => alert(`Lý do: ${purchase.rejectionReason}`)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold"
                        >
                          Xem lý do
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="border-t p-4 bg-red-50">
              {purchases
                .filter((p) => p.id === showRejectForm && p.status === 'PENDING')
                .map((purchase) => (
                  <div key={purchase.id} className="space-y-3">
                    <p className="text-sm font-semibold">
                      Nhập lý do từ chối cho yêu cầu của {purchase.username}:
                    </p>
                    <textarea
                      value={rejectReason[purchase.id] || ''}
                      onChange={(e) =>
                        setRejectReason((prev) => ({
                          ...prev,
                          [purchase.id]: e.target.value,
                        }))
                      }
                      placeholder="Nhập lý do từ chối..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectPurchase(purchase.id)}
                        disabled={rejectingId === purchase.id}
                        className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 disabled:bg-gray-400"
                      >
                        {rejectingId === purchase.id ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(null)}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded text-sm font-semibold hover:bg-gray-400"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ← Trước
          </button>
          <span className="text-sm">
            Trang {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
