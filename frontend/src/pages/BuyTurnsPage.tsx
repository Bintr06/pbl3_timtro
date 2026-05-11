import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, getAuthToken } from '../apiClient';

type TurnPackage = {
  id: number;
  turns: number;
  price: number;
  description: string;
  active: boolean;
};

type PurchaseResponse = {
  purchaseId: number;
  turns: number;
  amount: number;
  transferContent: string;
  bankAccount: string;
  bankName: string;
  status: string;
  createdAt: string;
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

export default function BuyTurnsPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<TurnPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [purchaseData, setPurchaseData] = useState<PurchaseResponse | null>(null);

  const authToken = getAuthToken();

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await get('/api/payment/packages');
        if (response.status === 200) {
          setPackages(response.data);
        }
      } catch (error) {
        console.error('Lỗi tải gói:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async (packageId: number) => {
    if (!authToken) {
      navigate('/login');
      return;
    }

    setPurchasing(true);
    try {
      const response = await post('/api/payment/purchase', {
        packageId: packageId,
      });

      if (response.status === 200) {
        setPurchaseData(response.data);
        setShowConfirmation(true);
      } else {
        alert(response.message || 'Lỗi tạo yêu cầu mua lượt');
      }
    } catch (error) {
      console.error('Lỗi:', error);
      alert('Lỗi khi tạo yêu cầu mua lượt');
    } finally {
      setPurchasing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép!');
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
        {!showConfirmation ? (
          <>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">Mua Lượt Đăng Tin</h1>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Chọn gói lượt phù hợp để mở rộng khả năng đăng tin của bạn
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 text-center">
                    <div className="text-4xl font-bold mb-2">{pkg.turns}</div>
                    <div className="text-sm opacity-90">lượt đăng tin</div>
                  </div>

                  <div className="p-6">
                    <div className="text-3xl font-bold text-gray-900 mb-2">{pkg.price.toLocaleString('vi-VN')} VNĐ</div>
                    <p className="text-gray-600 mb-6 min-h-12">{pkg.description}</p>

                    <button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchasing}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {purchasing ? 'Đang xử lý...' : 'Mua ngay'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : purchaseData ? (
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-green-600 mb-6">✓ Yêu cầu mua lượt thành công!</h2>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-yellow-700 font-semibold">Hướng dẫn thanh toán:</p>
              <p className="text-yellow-700 text-sm mt-2">
                Vui lòng chuyển khoản ngân hàng theo thông tin bên dưới. Sau khi chuyển, admin sẽ kiểm tra và duyệt yêu cầu của bạn trong vòng 24 giờ.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Số tài khoản</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{purchaseData.bankAccount}</span>
                  <button
                    onClick={() => copyToClipboard(purchaseData.bankAccount)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                  >
                    Sao chép
                  </button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Ngân hàng</div>
                <span className="text-lg font-semibold">{purchaseData.bankName}</span>
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Chủ tài khoản</div>
                <span className="text-lg font-semibold">TRAN MANH QUYNH</span>
              </div>

              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="text-sm text-gray-600 mb-1">Nội dung chuyển khoản (bắt buộc)</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-600 tracking-widest">{purchaseData.transferContent}</span>
                  <button
                    onClick={() => copyToClipboard(purchaseData.transferContent)}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                  >
                    Sao chép
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">Nội dung này sẽ giúp chúng tôi xác định yêu cầu của bạn</p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Số lượng lượt</div>
                <span className="text-lg font-semibold">{purchaseData.turns} lượt</span>
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Số tiền cần chuyển</div>
                <span className="text-xl font-bold text-red-600">{purchaseData.amount.toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => navigate('/personal')}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Xem lịch sử mua
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setPurchaseData(null);
                }}
                className="flex-1 bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Quay lại
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
