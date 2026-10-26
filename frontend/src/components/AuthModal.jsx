import { useState, useEffect, useRef } from 'react';
import { 
  X, Mail, Lock, Phone, User, Eye, EyeOff, ShieldAlert, 
  CheckCircle2, Sparkles, ArrowRight, ArrowLeft, Clock, Trash2,
  KeyRound, MailCheck, RefreshCw, ShieldCheck
} from 'lucide-react';
import { authService } from '../services/authService';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  initialTab = 'login', 
  onAuthSuccess,
  noticeMessage = ''
}) {
  const [tab, setTab] = useState(initialTab); // 'login' | 'register' | 'verify-email' | 'forgot-password'
  
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

  // Email Verification States
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [verifyOtp, setVerifyOtp] = useState('');
  const [verifyEmailSent, setVerifyEmailSent] = useState(false);
  const [verifyFallbackOtp, setVerifyFallbackOtp] = useState('');

  // Forgot Password States
  const [forgotStep, setForgotStep] = useState(1); // 1: request OTP, 2: input OTP & new pwd
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const [forgotFallbackOtp, setForgotFallbackOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // Trạng thái kết nối máy chủ Backend AI
  const [isBackendReady, setIsBackendReady] = useState(true);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  // Kiểm tra sức khỏe Backend FastAPI khi mở Modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    let timer = null;

    const checkServerStatus = async () => {
      setIsCheckingBackend(true);
      const ready = await authService.checkHealth();
      if (isMounted) {
        setIsBackendReady(ready);
        setIsCheckingBackend(false);
        if (!ready) {
          timer = setTimeout(checkServerStatus, 2500);
        }
      }
    };

    checkServerStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);


  // Common Feedback & Timer States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

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

  // Bộ đếm lùi thời gian gửi lại mã OTP
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

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

  // Tính toán độ mạnh mật khẩu mới (quên mật khẩu)
  const forgotPasswordCriteria = {
    length: forgotNewPassword.length >= 8,
    hasUpper: /[A-Z]/.test(forgotNewPassword),
    hasLower: /[a-z]/.test(forgotNewPassword),
    hasNumber: /\d/.test(forgotNewPassword)
  };

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

      const emailToVerify = regEmail.trim();
      setVerifyEmailAddress(emailToVerify);
      setVerifyEmailSent(res.data?.email_sent === true);
      setVerifyFallbackOtp(res.data?.demo_otp || '');
      setSuccessMessage("Đăng kí thành công!");
      setTab('verify-email');
      setResendCountdown(60);
    } catch (err) {
      setErrorMessage(err.message || "Đăng ký không thành công");
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý XÁC THỰC EMAIL BẰNG OTP
  const handleVerifyEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await authService.verifyEmail(verifyEmailAddress, verifyOtp);
      setSuccessMessage(res.message || "Xác thực email thành công! Đang chuyển đến đăng nhập...");
      setTimeout(() => {
        setTab('login');
        setLoginIdentifier(verifyEmailAddress);
        setLoginPassword('');
        setVerifyOtp('');
        setSuccessMessage("Xác thực email thành công! Vui lòng đăng nhập vào tài khoản.");
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || "Mã xác thực không chính xác hoặc đã hết hạn");
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý GỬI LẠI MÃ XÁC THỰC EMAIL
  const handleResendEmailOtp = async () => {
    if (resendCountdown > 0 || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await authService.resendVerificationOtp(verifyEmailAddress);
      setVerifyEmailSent(res.data?.email_sent === true);
      setVerifyFallbackOtp(res.data?.demo_otp || '');
      setSuccessMessage(res.message || "Đã gửi lại mã xác thực OTP qua email!");
      setResendCountdown(60);
    } catch (err) {
      setErrorMessage(err.message || "Không thể gửi lại mã OTP");
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý YÊU CẦU MÃ QUÊN MẬT KHẨU
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await authService.forgotPassword(forgotIdentifier);
      setForgotMaskedEmail(res.data?.masked_email || res.data?.email || forgotIdentifier);
      setForgotEmailSent(res.data?.email_sent === true);
      setForgotFallbackOtp(res.data?.demo_otp || '');
      setSuccessMessage(res.message || "Đã gửi mã xác nhận đến email của bạn!");
      setForgotStep(2);
      setResendCountdown(60);
    } catch (err) {
      setErrorMessage(err.message || "Không tìm thấy tài khoản tương ứng");
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý XÁC THỰC MÃ OTP QUÊN MẬT KHẨU (BƯỚC 2: MÀN HÌNH NHẬP OTP RIÊNG)
  const handleVerifyForgotOtp = async (e) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setErrorMessage("Vui lòng nhập đầy đủ mã xác thực OTP gồm 6 chữ số");
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await authService.verifyResetOtp(forgotIdentifier, forgotOtp);
      setSuccessMessage(res.message || "Mã xác thực OTP chính xác! Bạn có thể đặt mật khẩu mới.");
      setForgotStep(3); // Chuyển sang màn hình đặt lại mật khẩu riêng
    } catch (err) {
      setErrorMessage(err.message || "Mã xác thực không chính xác hoặc đã hết hạn");
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý ĐẶT LẠI MẬT KHẨU MỚI (BƯỚC 3: MÀN HÌNH ĐẶT LẠI MẬT KHẨU RIÊNG)
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      setErrorMessage("Mật khẩu mới bắt buộc từ 8 kí tự đổ lên");
      return;
    }
    if (!forgotPasswordCriteria.hasUpper || !forgotPasswordCriteria.hasLower || !forgotPasswordCriteria.hasNumber) {
      setErrorMessage("Mật khẩu mới bắt buộc có kí tự hoa, thường và số");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.resetPassword(
        forgotIdentifier,
        forgotOtp,
        forgotNewPassword,
        forgotConfirmPassword
      );
      setSuccessMessage(res.message || "Đặt lại mật khẩu thành công! Đang chuyển hướng...");
      setTimeout(() => {
        setTab('login');
        setLoginIdentifier(forgotIdentifier);
        setLoginPassword('');
        setForgotStep(1);
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setSuccessMessage("Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.");
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || "Đặt lại mật khẩu thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi lại mã OTP quên mật khẩu
  const handleResendForgotOtp = async () => {
    if (resendCountdown > 0 || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await authService.forgotPassword(forgotIdentifier);
      setForgotEmailSent(res.data?.email_sent === true);
      setForgotFallbackOtp(res.data?.demo_otp || '');
      setSuccessMessage(res.message || "Đã gửi lại mã OTP qua email!");
      setResendCountdown(60);
    } catch (err) {
      setErrorMessage(err.message || "Không thể gửi lại mã OTP");
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
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <img 
              src="/wings-logo.png" 
              alt="WINGS Logo" 
              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/30 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">WINGS</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isBackendReady 
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' 
                    : 'bg-amber-500/20 text-amber-200 border-amber-400/30 animate-pulse'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isBackendReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {isBackendReady ? 'AI & CSDL Sẵn sàng' : 'AI: Đang nạp...'}
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">social network • Nền tảng kết nối văn minh</p>
            </div>
          </div>

          {/* Thông báo lý do bắt buộc đăng nhập (nếu có) */}
          {noticeMessage && (
            <div className="mt-3 p-2.5 bg-white/15 backdrop-blur-md rounded-xl text-xs text-white border border-white/20 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
          )}

          {/* Tab Selector chính: Đăng nhập vs Đăng ký */}
          {(tab === 'login' || tab === 'register') && (
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
          )}

          {/* Header phụ khi ở tab Xác thực Email hoặc Quên mật khẩu */}
          {tab === 'verify-email' && (
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-blue-100 bg-white/10 px-3 py-1.5 rounded-lg">
              <span>Xác nhận kích hoạt Gmail</span>
              <button 
                type="button"
                onClick={() => { setTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
                className="hover:text-white underline cursor-pointer"
              >
                Đăng nhập sau
              </button>
            </div>
          )}

          {tab === 'forgot-password' && (
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-blue-100 bg-white/10 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-2">
                <span>
                  {forgotStep === 1 && "Bước 1/3: Nhập tài khoản"}
                  {forgotStep === 2 && "Bước 2/3: Xác thực OTP"}
                  {forgotStep === 3 && "Bước 3/3: Đặt lại mật khẩu"}
                </span>
                <span className="flex gap-1 items-center">
                  <span className={`w-2 h-2 rounded-full transition-colors ${forgotStep >= 1 ? 'bg-amber-300 ring-2 ring-amber-300/30' : 'bg-white/30'}`} />
                  <span className={`w-2 h-2 rounded-full transition-colors ${forgotStep >= 2 ? 'bg-amber-300 ring-2 ring-amber-300/30' : 'bg-white/30'}`} />
                  <span className={`w-2 h-2 rounded-full transition-colors ${forgotStep >= 3 ? 'bg-amber-300 ring-2 ring-amber-300/30' : 'bg-white/30'}`} />
                </span>
              </div>
              <button 
                type="button"
                onClick={() => { 
                  if (forgotStep === 3) {
                    setForgotStep(2);
                    setErrorMessage('');
                    setSuccessMessage('');
                  } else if (forgotStep === 2) {
                    setForgotStep(1);
                    setErrorMessage('');
                    setSuccessMessage('');
                  } else {
                    setTab('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }
                }}
                className="hover:text-white underline cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{forgotStep > 1 ? "Quay lại" : "Đăng nhập"}</span>
              </button>
            </div>
          )}
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot-password');
                      setForgotStep(1);
                      setForgotIdentifier(loginIdentifier || '');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
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
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

              {/* Lối tắt chọn tài khoản mẫu để đăng nhập nhanh */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  <span>💡 Tài khoản mẫu đăng nhập nhanh:</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier('linh.vothien@example.com');
                      setLoginPassword('Password123');
                      setErrorMessage('');
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition cursor-pointer text-left truncate"
                  >
                    👑 Admin (Võ Thiện Linh)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier('thutrang@example.com');
                      setLoginPassword('Password123');
                      setErrorMessage('');
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition cursor-pointer text-left truncate"
                  >
                    👤 Người dùng (Lê Thu Trang)
                  </button>
                </div>
              </div>
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
                  Gmail / Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ten@gmail.com (sẽ nhận mã xác thực)"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>

              {/* Số điện thoại */}
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
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Đăng ký & Nhận mã qua Gmail</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 3: XÁC THỰC EMAIL BẰNG MÃ OTP */}
          {/* ======================================================== */}
          {tab === 'verify-email' && (
            <form onSubmit={handleVerifyEmailSubmit} className="space-y-4">
              <div className="text-center py-2">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-blue-100">
                  <MailCheck className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Xác thực tài khoản Gmail</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Mã xác thực gồm 6 chữ số đã được gửi đến địa chỉ email:
                </p>
                <div className="mt-1.5 inline-block px-3 py-1 bg-blue-50/80 border border-blue-200 text-blue-800 text-xs font-bold rounded-lg">
                  {verifyEmailAddress || "Email của bạn"}
                </div>
                
                {verifyEmailSent ? (
                  <div className="mt-2.5 text-[11.5px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 flex items-center justify-center gap-1.5 text-center">
                    <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Mã OTP đã được gửi thành công đến hòm thư Gmail của bạn. Vui lòng kiểm tra hộp thư đến hoặc Spam.</span>
                  </div>
                ) : (
                  <div className="mt-2.5 text-[11.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-left space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Máy chủ chưa cấu hình gửi Gmail thật (.env)</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Để nhận thư vào Gmail thật, vui lòng điền <code>SMTP_USER</code> và <code>SMTP_PASSWORD</code> vào file <code>backend/.env</code>.
                    </p>
                    {verifyFallbackOtp && (
                      <p className="text-[11.5px] font-bold text-blue-700 pt-0.5">
                        👉 Mã OTP để bạn kích hoạt ngay: <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono text-sm tracking-wider">{verifyFallbackOtp}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                  Nhập mã OTP 6 chữ số
                </label>
                <div className="max-w-xs mx-auto">
                  <input
                    type="text"
                    maxLength={6}
                    value={verifyOtp}
                    onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || verifyOtp.length !== 6}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận & Kích hoạt tài khoản</span>
                  </>
                )}
              </button>

              {/* Nút gửi lại mã & Quay lại đăng nhập */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={handleResendEmailOtp}
                  disabled={resendCountdown > 0 || isLoading}
                  className="font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCountdown > 0 ? `Gửi lại mã sau ${resendCountdown}s` : 'Gửi lại mã OTP'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
                  className="font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Bỏ qua & Đăng nhập sau
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 4: QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU */}
          {/* ======================================================== */}
          {tab === 'forgot-password' && (
            <div>
              {/* BƯỚC 1: NHẬP EMAIL / SĐT ĐỂ NHẬN OTP */}
              {forgotStep === 1 && (
                <form onSubmit={handleForgotRequestOtp} className="space-y-4">
                  <div className="text-center py-2">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-amber-100">
                      <KeyRound className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">Quên mật khẩu</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Vui lòng nhập Email hoặc Số điện thoại của bạn. Chúng tôi sẽ gửi mã OTP để bạn đặt lại mật khẩu mới.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email hoặc Số điện thoại <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="ten@gmail.com hoặc 09..."
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !forgotIdentifier.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Gửi mã xác nhận qua Email</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
                      className="text-xs font-semibold text-slate-600 hover:text-blue-600 cursor-pointer flex items-center justify-center gap-1 mx-auto"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại trang Đăng nhập</span>
                    </button>
                  </div>
                </form>
              )}

              {/* BƯỚC 2: MÀN HÌNH NHẬP OTP RIÊNG */}
              {forgotStep === 2 && (
                <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                  <div className="text-center py-2">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-blue-100">
                      <KeyRound className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">Xác thực mã OTP</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Mã xác nhận 6 chữ số đã được gửi đến:
                    </p>
                    <p className="text-sm font-bold text-blue-600 mt-0.5">
                      {forgotMaskedEmail}
                    </p>

                    {forgotEmailSent ? (
                      <div className="mt-2.5 text-[11.5px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 flex items-center justify-center gap-1.5 text-center">
                        <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Mã OTP đã được gửi thành công đến hòm thư Gmail của bạn. Vui lòng kiểm tra hộp thư đến hoặc Spam.</span>
                      </div>
                    ) : (
                      <div className="mt-2.5 text-[11.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-left space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Máy chủ chưa cấu hình gửi Gmail thật (.env)</span>
                        </div>
                        {forgotFallbackOtp && (
                          <p className="text-[11.5px] font-bold text-blue-700 pt-0.5">
                            👉 Mã OTP để bạn đổi mật khẩu ngay: <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono text-sm tracking-wider">{forgotFallbackOtp}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ô nhập mã OTP 6 số to rõ ràng */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                      Nhập mã OTP gồm 6 chữ số <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="------"
                      className="w-full px-4 py-3.5 text-center font-mono font-black text-2xl tracking-[0.4em] bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition shadow-inner"
                      autoFocus
                    />
                  </div>

                  {/* Nút xác nhận mã OTP */}
                  <button
                    type="submit"
                    disabled={isLoading || forgotOtp.length !== 6}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Xác nhận mã OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Nút gửi lại mã & Đổi Email */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={handleResendForgotOtp}
                      disabled={resendCountdown > 0 || isLoading}
                      className="font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {resendCountdown > 0 ? `Gửi lại mã sau ${resendCountdown}s` : 'Gửi lại mã OTP'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setForgotStep(1); setErrorMessage(''); setSuccessMessage(''); }}
                      className="font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Đổi Email/SĐT khác
                    </button>
                  </div>
                </form>
              )}

              {/* BƯỚC 3: MÀN HÌNH ĐẶT LẠI MẬT KHẨU RIÊNG */}
              {forgotStep === 3 && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                  <div className="text-center py-1">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm border border-emerald-100">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">Đặt lại mật khẩu mới</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Mã OTP đã được xác nhận thành công. Vui lòng thiết lập mật khẩu mới cho tài khoản của bạn.
                    </p>
                  </div>

                  {/* Mật khẩu mới */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showForgotNewPassword ? "text" : "password"}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="Tối thiểu 8 ký tự, có hoa, thường, số"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Thanh đo độ mạnh mật khẩu mới */}
                    {forgotNewPassword && (
                      <div className="mt-2 space-y-1">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                          <div className={`h-full flex-1 rounded-full ${forgotPasswordCriteria.length ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <div className={`h-full flex-1 rounded-full ${forgotPasswordCriteria.hasUpper ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <div className={`h-full flex-1 rounded-full ${forgotPasswordCriteria.hasLower ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <div className={`h-full flex-1 rounded-full ${forgotPasswordCriteria.hasNumber ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                          <span className={forgotPasswordCriteria.length ? "text-emerald-600 font-bold" : ""}>✓ Từ 8 ký tự</span>
                          <span className={forgotPasswordCriteria.hasUpper ? "text-emerald-600 font-bold" : ""}>✓ Chữ HOA (A-Z)</span>
                          <span className={forgotPasswordCriteria.hasLower ? "text-emerald-600 font-bold" : ""}>✓ Chữ thường (a-z)</span>
                          <span className={forgotPasswordCriteria.hasNumber ? "text-emerald-600 font-bold" : ""}>✓ Chữ số (0-9)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Xác nhận mật khẩu mới */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showForgotConfirmPassword ? "text" : "password"}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {forgotConfirmPassword && forgotNewPassword !== forgotConfirmPassword && (
                      <p className="text-[11px] text-rose-500 font-medium mt-1">
                        Mật khẩu xác nhận chưa khớp với mật khẩu mới
                      </p>
                    )}
                  </div>

                  {/* Nút lưu mật khẩu mới */}
                  <button
                    type="submit"
                    disabled={
                      isLoading || 
                      !forgotNewPassword || 
                      forgotNewPassword.length < 8 || 
                      !forgotPasswordCriteria.hasUpper || 
                      !forgotPasswordCriteria.hasLower || 
                      !forgotPasswordCriteria.hasNumber || 
                      forgotNewPassword !== forgotConfirmPassword
                    }
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lưu mật khẩu mới & Đăng nhập</span>
                      </>
                    )}
                  </button>

                  {/* Nút quay lại bước trước */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => { setForgotStep(2); setErrorMessage(''); setSuccessMessage(''); }}
                      className="font-medium text-slate-500 hover:text-slate-800 cursor-pointer flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Nhập lại mã OTP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
                      className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Hủy bỏ & Đăng nhập
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
