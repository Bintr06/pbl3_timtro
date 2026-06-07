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
  payUrl?: string;
};

export default function BuyTurnsPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<TurnPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [purchaseData, setPurchaseData] = useState<PurchaseResponse | null>(null);

  const authToken = getAuthToken();

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await get('/api/payment/packages') as any;
        const status = response.status ?? (response.data ? 200 : null);
        const data = response.data ?? response;

        if (status === 200) {
          setPackages(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Lỗi tải gói lượt đăng tin:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async (packageId: number) => {
    if (!authToken) {
      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }

    setPurchasing(true);
    try {
      const response = await post('/api/payment/purchase', { packageId }) as any;
      const status = response.status ?? (response.data ? 200 : null);
      const resData = response.data ?? response;

      if (status === 200 && resData) {
        if (resData.payUrl) {
          window.location.href = resData.payUrl;
        } else {
          setPurchaseData(resData);
          setShowConfirmation(true);
        }
      } else {
        alert(response.message || 'Lỗi hệ thống khi khởi tạo yêu cầu mua lượt');
      }
    } catch (error) {
      console.error('Lỗi kết nối cổng thanh toán:', error);
      alert('Không thể tạo yêu cầu mua lượt lúc này. Vui lòng thử lại.');
    } finally {
      setPurchasing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép nội dung thành công!');
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
            <p className="text-neutral-500 text-sm font-medium">Đang tải danh sách gói lượt...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-neutral-50/50 py-8">
        <div className="max-w-5xl mx-auto px-4">
          {!showConfirmation ? (
              <>
                <div className="text-center mb-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Dịch vụ hệ thống</p>
                  <h1 className="text-3xl font-extrabold text-neutral-900 mt-2">Mua Lượt Đăng Tin</h1>
                  <p className="text-neutral-500 text-sm mt-2 max-w-md mx-auto">
                    Lựa chọn gói số lượng phù hợp để tối ưu hiệu quả hiển thị và quản lý bài đăng tin tìm phòng trọ của bạn.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {packages.map((pkg) => (
                      <div
                          key={pkg.id}
                          className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white p-6 text-center">
                          <div className="text-5xl font-black mb-1">{pkg.turns}</div>
                          <div className="text-xs font-bold uppercase tracking-wider opacity-90">Lượt đăng tin</div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div className="text-center mb-5">
                            <div className="text-2xl font-black text-neutral-900 mb-2">
                              {pkg.price.toLocaleString('vi-VN')} VNĐ
                            </div>
                            <p className="text-neutral-600 text-xs leading-relaxed min-h-[36px]">
                              {pkg.description || 'Không có mô tả chi tiết cho gói dịch vụ này.'}
                            </p>
                          </div>

                          <button
                              onClick={() => handlePurchase(pkg.id)}
                              disabled={purchasing}
                              className="w-full bg-neutral-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed shadow-sm"
                          >
                            {purchasing ? 'Đang xử lý...' : 'Mua ngay'}
                          </button>
                        </div>
                      </div>
                  ))}
                </div>
              </>
          ) : purchaseData ? (
              <div className="max-w-xl mx-auto bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                <h2 className="text-xl font-bold text-emerald-600 mb-4 flex items-center gap-2">
                  <span>✓</span> Yêu cầu mua lượt thành công!
                </h2>

                {/* --- KHU VỰC HIỂN THỊ MÃ QR TỰ ĐỘNG --- */}
                <div className="mb-6 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50/40 p-6">
                  <p className="mb-4 text-sm font-bold text-neutral-800">Quét mã QR để thanh toán tự động</p>
                  <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-md">
                    {/* Gọi API tạo QR của VietQR với bank là 'momo' */}
                    <img
                        src={`https://img.vietqr.io/image/momo-${purchaseData.bankAccount}-compact2.png?amount=${purchaseData.amount}&addInfo=${purchaseData.transferContent}&accountName=${encodeURIComponent('NGUYEN THI KIM NGAN')}`}
                        alt="QR Code Thanh Toán MoMo"
                        className="h-48 w-48 object-cover"
                    />
                  </div>
                  <p className="mt-4 text-center text-xs font-medium leading-relaxed text-neutral-500">
                    Sử dụng ứng dụng <b>MoMo</b> (hoặc ngân hàng) quét mã để thanh toán.<br/>
                    Số tiền và nội dung chuyển khoản sẽ được <b>nhập tự động</b>.
                  </p>
                </div>
                {/* ------------------------------------- */}

                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-neutral-200"></div>
                  <span className="text-xs font-semibold uppercase text-neutral-400 tracking-wider">Hoặc chuyển thủ công</span>
                  <div className="h-px flex-1 bg-neutral-200"></div>
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="border border-neutral-100 rounded-xl p-3 bg-neutral-50/50">
                    <div className="text-xs text-neutral-500 mb-1">Số tài khoản / Số MoMo nhận tiền</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-800">{purchaseData.bankAccount}</span>
                      <button
                          onClick={() => copyToClipboard(purchaseData.bankAccount)}
                          className="text-orange-600 hover:text-orange-700 text-xs font-bold"
                      >
                        Sao chép Số
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-neutral-100 rounded-xl p-3 bg-neutral-50/50">
                      <div className="text-xs text-neutral-500 mb-1">Ngân hàng / Ví</div>
                      <span className="font-semibold text-neutral-800">{purchaseData.bankName}</span>
                    </div>
                    <div className="border border-neutral-100 rounded-xl p-3 bg-neutral-50/50">
                      <div className="text-xs text-neutral-500 mb-1">Chủ tài khoản</div>
                      <span className="font-semibold text-neutral-800 truncate block">NGUYEN THI KIM NGAN</span>
                    </div>
                  </div>

                  <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/40">
                    <div className="text-xs text-blue-600 font-medium mb-1">Nội dung ghi chú bắt buộc</div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-blue-700 tracking-wider">{purchaseData.transferContent}</span>
                      <button
                          onClick={() => copyToClipboard(purchaseData.transferContent)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                      >
                        Sao chép nội dung
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-neutral-100 rounded-xl p-3 bg-neutral-50/50">
                      <div className="text-xs text-neutral-500 mb-1">Số lượng cung cấp</div>
                      <span className="font-bold text-neutral-800">{purchaseData.turns} lượt đăng tin</span>
                    </div>
                    <div className="border border-neutral-100 rounded-xl p-3 bg-neutral-50/50">
                      <div className="text-xs text-neutral-500 mb-1">Tổng chi phí thanh toán</div>
                      <span className="font-black text-red-600">{purchaseData.amount.toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                      onClick={() => navigate('/personal')}
                      className="flex-1 bg-neutral-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-colors"
                  >
                    Tôi đã thanh toán xong
                  </button>
                  <button
                      onClick={() => {
                        setShowConfirmation(false);
                        setPurchaseData(null);
                      }}
                      className="flex-1 border border-neutral-300 text-neutral-700 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-colors"
                  >
                    Hủy giao dịch
                  </button>
                </div>
              </div>
          ) : null}
        </div>
      </div>
  );
}