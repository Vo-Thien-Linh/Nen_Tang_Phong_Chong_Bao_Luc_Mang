// API Service kết nối Backend FastAPI (http://localhost:8000)
const API_BASE_URL = 'http://localhost:8000/api/v1/auth';

const STORAGE_KEYS = {
  TOKEN: 'nexussocial_token',
  USER: 'nexussocial_current_user',
  SAVED_ACCOUNTS: 'nexussocial_saved_accounts'
};

export const authService = {
  // Lấy danh sách tài khoản đã từng đăng nhập trên trình duyệt này
  getSavedAccounts: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_ACCOUNTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  },

  // Lưu tài khoản vào danh sách gợi ý sau khi đăng nhập thành công
  saveAccountToHistory: (user, identifier) => {
    try {
      let accounts = authService.getSavedAccounts();
      accounts = accounts.filter(a => a.identifier !== identifier && a.email !== user.email);
      accounts.unshift({
        identifier: identifier,
        name: user.full_name || user.name,
        email: user.email,
        phone: user.phone || identifier,
        avatar: user.avatar_url || user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        lastLogin: "Vừa xong"
      });
      localStorage.setItem(STORAGE_KEYS.SAVED_ACCOUNTS, JSON.stringify(accounts.slice(0, 5)));
    } catch (err) {
      console.warn("Không thể lưu lịch sử tài khoản:", err);
    }
  },

  // Xóa một tài khoản khỏi danh sách gợi ý
  removeSavedAccount: (identifier) => {
    try {
      let accounts = authService.getSavedAccounts();
      accounts = accounts.filter(a => a.identifier !== identifier);
      localStorage.setItem(STORAGE_KEYS.SAVED_ACCOUNTS, JSON.stringify(accounts));
      return accounts;
    } catch {
      return [];
    }
  },

  // Lấy người dùng đang đăng nhập hiện tại
  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch {
      // fallback
    }
    return null;
  },

  // Cập nhật thông tin người dùng đang đăng nhập vào LocalStorage
  updateCurrentUser: (updatedFields) => {
    try {
      const current = authService.getCurrentUser() || {};
      const updated = { ...current, ...updatedFields };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.error("Không thể cập nhật User LocalStorage:", err);
      return null;
    }
  },

  // Lấy Token hiện tại
  getToken: () => {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  // ĐĂNG NHẬP (Hỗ trợ cả Email HOẶC Số điện thoại)
  login: async (identifier, password) => {
    if (!identifier || !identifier.trim() || !password || !password.trim()) {
      throw new Error("Vui lòng nhập đầy đủ thông tin");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password: password.trim() }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Email hoặc mật khẩu không chính xác");
      }

      // Chuẩn hóa object người dùng tương thích Frontend
      const user = {
        ...data.user,
        name: data.user.full_name,
        avatar: data.user.avatar_url,
        isAdmin: data.user.role === 'ADMIN'
      };

      // Lưu token và user vào LocalStorage
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

      // Lưu vào danh sách gợi ý tài khoản đã từng đăng nhập
      authService.saveAccountToHistory(user, identifier.trim());

      return { user, token: data.access_token };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:8000). Vui lòng đảm bảo backend FastAPI đang chạy.");
      }
      throw err;
    }
  },

  // ĐĂNG KÝ TÀI KHOẢN MỚI
  register: async ({ fullName, email, phone, password, confirmPassword }) => {
    // 1. Kiểm tra thiếu trường
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      throw new Error("Vui lòng điền đầy đủ tất cả các trường bắt buộc");
    }

    // 2. Kiểm tra độ dài tên hiển thị
    const trimmedName = fullName.trim();
    if (trimmedName.length < 3 || trimmedName.length > 30) {
      throw new Error("Tên hiển thị phải từ 3 - 30 kí tự");
    }

    // 3. Kiểm tra định dạng Email
    const emailPattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (!emailPattern.test(email.trim())) {
      throw new Error("Email bắt buộc đúng định dạng (ten@gmail.com)");
    }

    // 4. Kiểm tra số điện thoại
    const phonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phonePattern.test(phone.trim().replace(/\s/g, ''))) {
      throw new Error("Số điện thoại không đúng định dạng hợp lệ (10 chữ số)");
    }

    // 5. Kiểm tra mật khẩu (>=8 kí tự, có hoa, thường, số)
    if (password.length < 8) {
      throw new Error("Mật khẩu bắt buộc 8 kí tự đổ lên có kí tự hoa, thường và số");
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      throw new Error("Mật khẩu bắt buộc có kí tự hoa, thường và số");
    }

    // 6. Kiểm tra xác nhận mật khẩu
    if (password !== confirmPassword) {
      throw new Error("Mật khẩu xác nhận không khớp");
    }

    const regController = new AbortController();
    const regTimeoutId = setTimeout(() => regController.abort(), 12000);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: trimmedName,
          email: email.trim(),
          phone: phone.trim(),
          password: password,
          confirm_password: confirmPassword
        }),
        signal: regController.signal
      });
      clearTimeout(regTimeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Đăng ký thất bại");
      }

      return data;
    } catch (err) {
      clearTimeout(regTimeoutId);
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:8000). Vui lòng đảm bảo backend FastAPI đang chạy.");
      }
      throw err;
    }
  },

  // XÁC THỰC EMAIL BẰNG MÃ OTP THẬT
  verifyEmail: async (email, otp) => {
    if (!email || !email.trim()) {
      throw new Error("Vui lòng nhập email");
    }
    if (!otp || !otp.trim() || otp.trim().length !== 6) {
      throw new Error("Mã xác thực OTP phải gồm 6 chữ số");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Mã xác thực không chính xác hoặc đã hết hạn");
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:8000).");
      }
      throw err;
    }
  },

  // GỬI LẠI MÃ XÁC THỰC OTP QUA GMAIL THẬT
  resendVerificationOtp: async (email) => {
    if (!email || !email.trim()) {
      throw new Error("Vui lòng nhập email");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/resend-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Không thể gửi lại mã OTP");
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:8000).");
      }
      throw err;
    }
  },

  // YÊU CẦU ĐẶT LẠI MẬT KHẨU (GỬI MÃ OTP VỀ GMAIL THẬT)
  forgotPassword: async (identifier) => {
    if (!identifier || !identifier.trim()) {
      throw new Error("Vui lòng nhập email hoặc số điện thoại");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Không tìm thấy tài khoản");
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:8000).");
      }
      throw err;
    }
  },

  // ĐẶT LẠI MẬT KHẨU MỚI BẰNG OTP THẬT
  resetPassword: async (identifier, otp, newPassword, confirmPassword) => {
    if (!identifier || !identifier.trim()) {
      throw new Error("Vui lòng nhập email hoặc số điện thoại");
    }
    if (!otp || !otp.trim() || otp.trim().length !== 6) {
      throw new Error("Mã xác thực OTP phải gồm 6 chữ số");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Mật khẩu mới bắt buộc từ 8 kí tự đổ lên");
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new Error("Mật khẩu mới bắt buộc có kí tự hoa, thường và số");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("Mật khẩu xác nhận không khớp");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: otp.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Đặt lại mật khẩu thất bại");
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:8000).");
      }
      throw err;
    }
  },

  // ĐĂNG XUẤT
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    try {
      fetch(`${API_BASE_URL}/logout`, { method: 'POST' }).catch(() => { });
    } catch {
      // ignore
    }
  }
};
