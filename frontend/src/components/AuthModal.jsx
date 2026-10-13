import { useState, useEffect, useRef } from 'react';
import { 
  X, Mail, Lock, Phone, User, Eye, EyeOff, ShieldAlert, 
  CheckCircle2, Sparkles, ArrowRight, Clock, Trash2 
} from 'lucide-react';
import { authService } from '../services/authService';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  initialTab = 'login', 
  onAuthSuccess,
  noticeMessage = ''
}) {
  const [tab, setTab] = useState(initialTab); // 'login' | 'register'
  
  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showAccountSuggestions, setShowAccountSuggestions] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);

  // Register Form States
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Status & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const suggestionsRef = useRef(null);

  // Đồng bộ tab khi mở modal
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMessage('');
      setSuccessMessage('');
      setSavedAccounts(authService.getSavedAccounts());
    }
  }, [isOpen, initialTab]);

  // Đóng dropdown gợi ý khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowAccountSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Tính toán độ mạnh mật khẩu đăng ký
  const passwordCriteria = {
    length: regPassword.length >= 8,
    hasUpper: /[A-Z]/.test(regPassword),
    hasLower: /[a-z]/.test(regPassword),
    hasNumber: /\d/.test(regPassword)
  };
  const passedCriteriaCount = Object.values(passwordCriteria).filter(Boolean).length;

  // Xử lý ĐĂNG NHẬP
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const { user } = await authService.login(loginIdentifier, loginPassword);
      setSuccessMessage("Đăng nhập thành công! Đang chuyển hướng...");
      setTimeout(() => {
        onAuthSuccess(user);
        onClose();
      }, 700);
    } catch (err) {
      setErrorMessage(err.message || "Email hoặc mật khẩu không chính xác");
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý ĐĂNG KÝ
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await authService.register({
        fullName: regFullName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        confirmPassword: regConfirmPassword
      });

      setSuccessMessage(res.message || "Đăng kí thành công");
      
      // Chuyển sang tab Đăng nhập sau 1.2s và điền sẵn thông tin
      setTimeout(() => {
        setTab('login');
        setLoginIdentifier(regPhone || regEmail);
        setLoginPassword('');
        setSuccessMessage("Đăng kí thành công! Vui lòng đăng nhập vào tài khoản.");
      }, 1200);

    } catch (err) {
      setErrorMessage(err.message || "Đăng ký không thành công");
    } finally {
      setIsLoading(false);
    }
  };

  // Chọn tài khoản từ danh sách gợi ý
  const handleSelectSuggestedAccount = (acc) => {
    setLoginIdentifier(acc.identifier || acc.phone || acc.email);
    setShowAccountSuggestions(false);
  };

  // Xóa tài khoản gợi ý
  const handleRemoveSuggestedAccount = (e, identifier) => {
    e.stopPropagation();
    const updated = authService.removeSavedAccount(identifier);
    setSavedAccounts(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với Gradient sang trọng */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">NexusSocial AI</h2>
              <p className="text-xs text-blue-100">Nền tảng phòng chống bạo lực mạng</p>
            </div>
          </div>

          {/* Thông báo lý do bắt buộc đăng nhập (nếu có) */}
          {noticeMessage && (
            <div className="mt-3 p-2.5 bg-white/15 backdrop-blur-md rounded-xl text-xs text-white border border-white/20 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex bg-black/20 p-1 rounded-xl mt-4">
            <button
              type="button"
              onClick={() => { setTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition duration-200 cursor-pointer ${
                tab === 'login' 
                  ? 'bg-white keep-white text-indigo-700 shadow-sm' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition duration-200 cursor-pointer ${
                tab === 'register' 
                  ? 'bg-white keep-white text-indigo-700 shadow-sm' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>
        </div>

        {/* Thân Form */}
        <div className="p-6 sm:p-7">
          
          {/* Thông báo lỗi nổi bật */}
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs sm:text-sm animate-shake">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Thông báo thành công */}
          {successMessage && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs sm:text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 font-semibold">{successMessage}</div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: FORM ĐĂNG NHẬP */}
          {/* ======================================================== */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              
              {/* Trường Email hoặc Số điện thoại (Kèm gợi ý tài khoản) */}
              <div className="relative" ref={suggestionsRef}>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email hoặc Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    onFocus={() => setShowAccountSuggestions(true)}
                    placeholder="Nhập email (ten@gmail.com) hoặc SĐT (09...)"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  {savedAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAccountSuggestions(!showAccountSuggestions)}
                      title="Gợi ý tài khoản đã từng đăng nhập"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Popover gợi ý các tài khoản đã từng đăng nhập */}
                {showAccountSuggestions && savedAccounts.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Tài khoản đã từng đăng nhập</span>
                      <span className="text-[10px] text-slate-400">Bấm để chọn</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {savedAccounts.map((acc, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectSuggestedAccount(acc)}
                          className="px-3.5 py-2.5 hover:bg-blue-50/70 flex items-center justify-between cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5">
                            <img 
                              src={acc.avatar} 
                              alt={acc.name} 
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                            />
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-800">{acc.name}</p>
                              <p className="text-[11px] text-slate-500">{acc.identifier}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveSuggestedAccount(e, acc.identifier)}
                            title="Xóa khỏi danh sách gợi ý"
                            className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Trường Mật khẩu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nút Submit Đăng nhập */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Đăng nhập vào hệ thống</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: FORM ĐĂNG KÝ */}
          {/* ======================================================== */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              
              {/* Tên hiển thị (3 - 30 kí tự) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên hiển thị <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn An (từ 3 - 30 ký tự)"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ten@gmail.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>

              {/* Số điện thoại (Yêu cầu thêm để đăng nhập bằng SĐT) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự, có hoa, thường, số"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Thanh đo độ mạnh mật khẩu */}
                {regPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 rounded-full ${passwordCriteria.length ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${passwordCriteria.hasUpper ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${passwordCriteria.hasLower ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${passwordCriteria.hasNumber ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                      <span className={passwordCriteria.length ? "text-emerald-600 font-bold" : ""}>✓ Từ 8 ký tự</span>
                      <span className={passwordCriteria.hasUpper ? "text-emerald-600 font-bold" : ""}>✓ Chữ HOA (A-Z)</span>
                      <span className={passwordCriteria.hasLower ? "text-emerald-600 font-bold" : ""}>✓ Chữ thường (a-z)</span>
                      <span className={passwordCriteria.hasNumber ? "text-emerald-600 font-bold" : ""}>✓ Chữ số (0-9)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Xác nhận mật khẩu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Xác nhận mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegConfirmPassword ? "text" : "password"}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nút Đăng ký */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Tạo tài khoản mới</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
