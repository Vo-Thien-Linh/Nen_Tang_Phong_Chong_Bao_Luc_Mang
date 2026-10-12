// API Service kết nối Backend FastAPI (http://localhost:8000)
const API_BASE_URL = 'http://localhost:8000/api/v1/auth';

const STORAGE_KEYS = {
  TOKEN: 'nexussocial_token',
  USER: 'nexussocial_current_user',
  SAVED_ACCOUNTS: 'nexussocial_saved_accounts'
};

// Danh sách tài khoản mẫu cục bộ phòng khi backend chưa bật
const MOCK_DEMO_USERS = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Võ Thiện Linh",
    full_name: "Võ Thiện Linh",
    username: "linh.vothien.16",
    email: "linh.vothien@example.com",
    phone: "0912345678",
    role: "ADMIN",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    bio: "Cuộc sống là những chuyến đi và trải nghiệm 🌊 Đam mê công nghệ & khám phá cuộc sống.",
    postsCount: 4,
    friendsCount: 309,
    isVerified: true
  },
  {
    id: "a0000000-0000-0000-0000-000000000099",
    name: "Quản Trị Viên Hệ Thống",
    full_name: "Quản Trị Viên Hệ Thống",
    username: "admin_moderator",
    email: "admin@nexussocial.vn",
    phone: "0909999999",
    role: "ADMIN",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
    avatar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
    bio: "Quản trị viên an toàn không gian mạng.",
    postsCount: 1,
    friendsCount: 50,
    isVerified: true
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    name: "Trần Minh Tuấn (Bị khóa)",
    full_name: "Trần Minh Tuấn (Bị khóa)",
    username: "tuan_tran_ai",
    email: "tuan.tran.hack@darkmail.com",
    phone: "0988888888",
    role: "USER",
    status: "banned", // Bị khóa
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    bio: "Tài khoản vi phạm tiêu chuẩn cộng đồng.",
    postsCount: 0,
    friendsCount: 0,
    isVerified: false
  }
];

export const authService = {
  // Lấy danh sách tài khoản đã từng đăng nhập để gợi ý
  getSavedAccounts: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_ACCOUNTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    // Mặc định nạp 2 tài khoản gợi ý sẵn
    return [
      {
        identifier: "0912345678",
        name: "Võ Thiện Linh",
        email: "linh.vothien@example.com",
        phone: "0912345678",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
        lastLogin: "Gần đây"
      },
      {
        identifier: "admin@nexussocial.vn",
        name: "Quản Trị Viên Hệ Thống",
        email: "admin@nexussocial.vn",
        phone: "0909999999",
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
        lastLogin: "Hôm qua"
      }
    ];
  },

  // Lưu tài khoản vào danh sách gợi ý
  saveAccountToHistory: (user, identifier) => {
    try {
      let accounts = authService.getSavedAccounts();
      // Loại bỏ nếu đã có
      accounts = accounts.filter(a => a.identifier !== identifier && a.email !== user.email);
      // Thêm lên đầu danh sách
      accounts.unshift({
        identifier: identifier,
        name: user.full_name || user.name,
        email: user.email,
        phone: user.phone || identifier,
        avatar: user.avatar_url || user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        lastLogin: "Vừa xong"
      });
      // Giới hạn 5 tài khoản gần nhất
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
    } catch (e) {
      console.warn("Không thể lưu cập nhật người dùng vào localStorage:", e);
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

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password: password.trim() })
      });

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
      // Nếu Backend chưa bật, hỗ trợ Mock Fallback cho kiểm thử
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.warn("Backend FastAPI chưa bật hoặc mạng lỗi, chuyển sang cơ chế Offline Mock Test");
        const identLower = identifier.trim().toLowerCase();
        const user = MOCK_DEMO_USERS.find(
          u => u.email.toLowerCase() === identLower || u.phone === identifier.trim()
        );

        if (!user || (password !== "Password123" && password !== user._rawPassword)) {
          throw new Error("Email hoặc mật khẩu không chính xác");
        }

        if (user.status === "banned") {
          throw new Error("Tài khoản của bạn đã bị khóa");
        }

        const fakeToken = "mock_jwt_token_" + Date.now();
        localStorage.setItem(STORAGE_KEYS.TOKEN, fakeToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        authService.saveAccountToHistory(user, identifier.trim());
        return { user, token: fakeToken };
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
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Đăng ký thất bại");
      }

      return data;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        // Fallback offline mock test
        if (MOCK_DEMO_USERS.some(u => u.name === trimmedName)) {
          throw new Error("Tên đã được tồn tại");
        }
        if (MOCK_DEMO_USERS.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
          throw new Error("Email đã được sử dụng");
        }
        if (MOCK_DEMO_USERS.some(u => u.phone === phone.trim())) {
          throw new Error("Số điện thoại đã được sử dụng");
        }

        const newMockUser = {
          id: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "b0000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12)),
          name: trimmedName,
          full_name: trimmedName,
          username: email.trim().split('@')[0],
          email: email.trim(),
          phone: phone.trim(),
          role: "USER",
          status: "active",
          avatar: null,
          avatar_url: null,
          cover: null,
          cover_url: null,
          postsCount: 0,
          friendsCount: 0,
          isVerified: false,
          _rawPassword: password
        };
        MOCK_DEMO_USERS.push(newMockUser);

        return { success: true, message: "Đăng kí thành công" };
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
