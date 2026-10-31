import { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, User, Lock, Eye, EyeOff, Bell, Palette, 
  UserX, CheckCircle2, AlertTriangle, Save, Sparkles, KeyRound, 
  Smartphone, Mail, MapPin, GraduationCap, Heart, HelpCircle, 
  Trash2, Plus, Sliders, Moon, Sun, Globe, RefreshCw, AlertCircle
} from 'lucide-react';
import { settingsService } from '../services/settingsService';
import { profileService } from '../services/profileService';
import { fetchUserTrustHistory } from '../api/client';

export default function SettingsView({ 
  currentUser, 
  onUpdateUser, 
  theme = 'light', 
  onSetTheme, 
  onToggleTheme 
}) {
  const [activeSubTab, setActiveSubTab] = useState('safety');
  const [trustScore, setTrustScore] = useState(currentUser?.trustScore ?? currentUser?.trust_score ?? 100);
  const [trustTier, setTrustTier] = useState('good');
  const [trustLogs, setTrustLogs] = useState([]);
  const [showTrustLogs, setShowTrustLogs] = useState(false);
  const [isLoadingTrust, setIsLoadingTrust] = useState(false);

  const getTrustBadgeInfo = (score) => {
    if (score >= 80) return { name: 'Xuất sắc', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', desc: 'Tài khoản hoạt động rất tích cực, tuân thủ xuất sắc tiêu chuẩn cộng đồng.' };
    if (score >= 50) return { name: 'Tốt', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500', desc: 'Tài khoản có độ uy tín tiêu chuẩn, không bị hạn chế tương tác.' };
    if (score >= 30) return { name: 'Cảnh báo', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500', desc: 'Tài khoản đã có một số vi phạm. Hãy cẩn trọng để tránh bị giới hạn tính năng.' };
    return { name: 'Nguy cơ / Hạn chế', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', bar: 'bg-rose-500', desc: 'Điểm uy tín dưới 30. Tài khoản có thể bị đưa vào chế độ hạn chế (Cooldown) tạm thời.' };
  }; // 'safety' | 'profile' | 'security' | 'privacy' | 'blocked' | 'notifications' | 'appearance'
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // State cấu hình cài đặt
  const [settings, setSettings] = useState({
    // Profile
    full_name: currentUser?.name || currentUser?.full_name || '',
    username: currentUser?.username || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    bio: currentUser?.bio || '',
    location: currentUser?.location || '',
    hometown: currentUser?.hometown || '',
    education: currentUser?.education || '',
    high_school: currentUser?.high_school || currentUser?.highSchool || '',
    relationship_status: currentUser?.relationship_status || '',
    avatar_url: currentUser?.avatar || currentUser?.avatar_url || '',
    cover_url: currentUser?.cover_url || '',

    // AI Safety
    ai_shield_enabled: true,
    ai_sensitivity: 'high',
    auto_hide_toxic_comments: true,
    filter_keywords: 'chó, ngu, rác rưởi, đồ khốn, mất dạy, óc chó, cút, giết, chém, đập',
    block_strangers_messages: false,
    take_a_break_mode: false,

    // Privacy
    post_default_privacy: 'public',
    who_can_send_friend_requests: 'everyone',
    who_can_message: 'everyone',
    show_email: false,
    show_phone: false,

    // Notifications
    notify_likes: true,
    notify_comments: true,
    notify_friend_requests: true,
    notify_ai_warnings: true,
    sound_enabled: true,

    // Security & 2FA
    two_factor_enabled: false,

    // Appearance
    theme: 'light',
    language: 'vi'
  });

  // State đổi mật khẩu
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false
  });

  // Danh sách từ khóa cá nhân dạng mảng
  const [keywordList, setKeywordList] = useState([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // Danh sách người dùng bị chặn
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Tải dữ liệu ban đầu
  useEffect(() => {
    let isMounted = true;
    settingsService.getSettings(currentUser).then((data) => {
      if (isMounted && data) {
        setSettings(prev => ({ ...prev, ...data }));
        if (data.filter_keywords) {
          const list = data.filter_keywords.split(',').map(s => s.trim()).filter(Boolean);
          setKeywordList(list);
        }
      }
    });

    settingsService.getBlockedUsers().then((blocked) => {
      if (isMounted && blocked) {
        setBlockedUsers(blocked);
      }
    });

    return () => { isMounted = false; };
  }, [currentUser]);

  // Cập nhật từ khóa từ chuỗi sang mảng
  const handleAddKeyword = () => {
    const val = newKeywordInput.trim().toLowerCase();
    if (!val) return;
    if (keywordList.includes(val)) {
      showToast('error', 'Từ khóa này đã tồn tại trong danh sách cấm!');
      return;
    }
    const updated = [...keywordList, val];
    setKeywordList(updated);
    setSettings(prev => ({ ...prev, filter_keywords: updated.join(', ') }));
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (keywordToRemove) => {
    const updated = keywordList.filter(k => k !== keywordToRemove);
    setKeywordList(updated);
    setSettings(prev => ({ ...prev, filter_keywords: updated.join(', ') }));
  };

  const handleAddPresetKeywords = (presetArray) => {
    const merged = Array.from(new Set([...keywordList, ...presetArray]));
    setKeywordList(merged);
    setSettings(prev => ({ ...prev, filter_keywords: merged.join(', ') }));
    showToast('success', `Đã thêm ${presetArray.length} từ khóa mẫu an toàn!`);
  };

  // Toast helper
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Lưu Cài đặt Từ khóa cấm & An toàn
  const handleSaveSafety = async () => {
    setLoading(true);
    try {
      await settingsService.updateSafety({
        ai_shield_enabled: settings.ai_shield_enabled,
        ai_sensitivity: settings.ai_sensitivity,
        auto_hide_toxic_comments: settings.auto_hide_toxic_comments,
        filter_keywords: keywordList.join(', '),
        block_strangers_messages: settings.block_strangers_messages,
        take_a_break_mode: settings.take_a_break_mode
      });
      showToast('success', 'Đã lưu danh sách từ khóa cấm thành công!');
    } catch (err) {
      showToast('error', err.message || 'Không thể lưu cài đặt an toàn');
    } finally {
      setLoading(false);
    }
  };

  // 2. Lưu Cập nhật Hồ sơ
  const handleSaveProfile = async () => {
    if (!settings.full_name || settings.full_name.trim().length < 3) {
      showToast('error', 'Tên hiển thị phải từ 3 - 30 ký tự');
      return;
    }
    setLoading(true);
    try {
      await settingsService.updateProfile({
        full_name: settings.full_name,
        bio: settings.bio,
        phone: settings.phone,
        location: settings.location,
        hometown: settings.hometown,
        education: settings.education,
        relationship_status: settings.relationship_status,
        avatar_url: settings.avatar_url,
        cover_url: settings.cover_url
      });

      // Cập nhật vào state currentUser toàn cục
      if (onUpdateUser) {
        onUpdateUser({
          name: settings.full_name,
          full_name: settings.full_name,
          bio: settings.bio,
          phone: settings.phone,
          avatar: settings.avatar_url,
          avatar_url: settings.avatar_url,
          cover_url: settings.cover_url,
          location: settings.location,
          hometown: settings.hometown,
          education: settings.education,
          relationship_status: settings.relationship_status
        });
      }

      showToast('success', 'Cập nhật thông tin hồ sơ thành công!');
    } catch (err) {
      showToast('error', err.message || 'Cập nhật hồ sơ thất bại');
    } finally {
      setLoading(false);
    }
  };

  // 3. Đổi Mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.old_password) {
      showToast('error', 'Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      showToast('error', 'Mật khẩu mới bắt buộc 8 kí tự đổ lên có kí tự hoa, thường và số');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('error', 'Mật khẩu xác nhận không khớp');
      return;
    }
    if (passwordForm.old_password === passwordForm.new_password) {
      showToast('error', 'Mật khẩu mới không được trùng với mật khẩu hiện tại');
      return;
    }

    setLoading(true);
    try {
      await settingsService.changePassword(passwordForm);
      showToast('success', 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.');
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      showToast('error', err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  // 4. Bật/Tắt 2FA
  const handleToggle2FA = async () => {
    setLoading(true);
    try {
      const res = await settingsService.toggle2FA();
      const newState = res.data?.two_factor_enabled ?? !settings.two_factor_enabled;
      setSettings(prev => ({ ...prev, two_factor_enabled: newState }));
      showToast('success', `Đã ${newState ? 'bật' : 'tắt'} xác thực 2 yếu tố thành công!`);
    } catch (err) {
      showToast('error', err.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  // 5. Lưu Quyền riêng tư
  const handleSavePrivacy = async () => {
    setLoading(true);
    try {
      await settingsService.updatePrivacy({
        post_default_privacy: settings.post_default_privacy,
        who_can_send_friend_requests: settings.who_can_send_friend_requests,
        who_can_message: settings.who_can_message,
        show_email: settings.show_email,
        show_phone: settings.show_phone
      });
      showToast('success', 'Đã lưu cài đặt quyền riêng tư thành công!');
    } catch (err) {
      showToast('error', err.message || 'Lỗi khi lưu quyền riêng tư');
    } finally {
      setLoading(false);
    }
  };

  // 6. Lưu Thông báo
  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      await settingsService.updateNotifications({
        notify_likes: settings.notify_likes,
        notify_comments: settings.notify_comments,
        notify_friend_requests: settings.notify_friend_requests,
        notify_ai_warnings: settings.notify_ai_warnings,
        sound_enabled: settings.sound_enabled
      });
      showToast('success', 'Đã lưu cấu hình thông báo!');
    } catch (err) {
      showToast('error', err.message || 'Lỗi lưu thông báo');
    } finally {
      setLoading(false);
    }
  };

  // 7. Bỏ chặn
  const handleUnblock = async (targetId, name) => {
    try {
      await settingsService.unblockUser(targetId);
      setBlockedUsers(prev => prev.filter(u => u.id !== targetId));
      showToast('success', `Đã bỏ chặn ${name}`);
    } catch (err) {
      showToast('error', err.message || 'Bỏ chặn thất bại');
    }
  };

  const navItems = [
    { id: 'safety', label: 'Từ Khóa & An Toàn', icon: ShieldCheck },
    { id: 'profile', label: 'Hồ Sơ & Tài Khoản', icon: User },
    { id: 'security', label: 'Mật Khẩu & Bảo Mật', icon: Lock },
    { id: 'privacy', label: 'Quyền Riêng Tư', icon: Eye },
    { id: 'blocked', label: 'Danh Sách Chặn', icon: UserX, count: blockedUsers.length },
    { id: 'notifications', label: 'Thông Báo', icon: Bell },
    { id: 'appearance', label: 'Giao Diện', icon: Palette }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      
      {/* Header tiêu đề */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-cyan-300 border border-white/10 mb-3">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>NexusSocial Security & Customization</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Trung Tâm Cài Đặt & Quyền Riêng Tư</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl">
            Tùy biến tài khoản, danh sách từ khóa cấm, kiểm soát quyền riêng tư và bảo mật tối ưu.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
            <div className="text-left">
              <p className="text-[11px] text-slate-300 font-medium">Bộ Lọc Từ Khóa</p>
              <p className="text-xs font-bold text-white">
                {keywordList.length} từ khóa
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Thông báo Toast */}
      {toast && (
        <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 shadow-md animate-slide-in ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Bố cục 2 cột: Sidebar menu & Vùng nội dung */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Sidebar Tabs */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-200/80 sticky top-24 space-y-1">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Danh mục cài đặt
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nội dung chi tiết từng Tab */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* ======================================================== */}
          {/* TAB 1: BỘ LỌC TỪ KHÓA & AN TOÀN NỘI DUNG */}
          {/* ======================================================== */}
          {activeSubTab === 'safety' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 mb-1">
                  <ShieldCheck className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Danh Sách Từ Khóa Cấm & An Toàn</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Thiết lập danh sách các từ ngữ cấm để tự động ngăn chặn công kích và bình luận độc hại hướng về bạn.
                </p>
              </div>

              {/* Bộ lọc từ khóa cấm cá nhân */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">Danh Sách Từ Khóa Cấm Cá Nhân (Keyword Blacklist)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bình luận hoặc tin nhắn chứa những từ khóa này sẽ bị chặn ngay lập tức.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                    {keywordList.length} từ khóa
                  </span>
                </div>

                {/* Ô nhập từ khóa mới */}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }}
                    placeholder="Nhập từ hoặc cụm từ bạn muốn chặn rồi ấn Thêm..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                  />
                  <button 
                    type="button"
                    onClick={handleAddKeyword}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm</span>
                  </button>
                </div>

                {/* Danh sách các tag từ khóa hiện tại */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 min-h-[90px] flex flex-wrap gap-2 items-center">
                  {keywordList.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Chưa có từ khóa nào trong danh sách.</span>
                  ) : (
                    keywordList.map((kw, idx) => (
                      <span 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs group hover:border-rose-300"
                      >
                        <span>{kw}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveKeyword(kw)}
                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Nút nạp nhanh danh mục mẫu */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-400">Gợi ý thêm nhanh:</span>
                  <button
                    type="button"
                    onClick={() => handleAddPresetKeywords(['xúc phạm', 'miệt thị', 'xấu xí', 'béo ú', 'ngu ngốc'])}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    + Miệt thị ngoại hình
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPresetKeywords(['đâm', 'chém', 'giết', 'đánh nhau', 'tiêu diệt'])}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    + Từ ngữ bạo lực
                  </button>
                </div>
              </div>

              {/* Nút lưu */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveSafety}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Đang lưu...' : 'Lưu Danh Sách Từ Khóa'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: HỒ SƠ & TÀI KHOẢN */}
          {/* ======================================================== */}
          {activeSubTab === 'profile' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 mb-1">
                  <User className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Thông Tin Hồ Sơ & Tài Khoản</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Cập nhật các thông tin hiển thị với bạn bè và cộng đồng NexusSocial.
                </p>
              </div>

              {/* Ảnh đại diện & Ảnh bìa preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">Ảnh đại diện (Avatar URL)</label>
                  <div className="flex items-center gap-3">
                    <img 
                      src={settings.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"} 
                      alt="Avatar Preview" 
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/40"
                    />
                    <input 
                      type="text" 
                      value={settings.avatar_url}
                      onChange={(e) => setSettings(prev => ({ ...prev, avatar_url: e.target.value }))}
                      placeholder="Dán link ảnh đại diện..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">Ảnh bìa (Cover URL)</label>
                  <input 
                    type="text" 
                    value={settings.cover_url}
                    onChange={(e) => setSettings(prev => ({ ...prev, cover_url: e.target.value }))}
                    placeholder="Dán link ảnh bìa trang cá nhân..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                  {settings.cover_url && (
                    <img 
                      src={settings.cover_url} 
                      alt="Cover Preview" 
                      className="w-full h-12 object-cover rounded-lg border border-slate-200"
                    />
                  )}
                </div>
              </div>

              {/* Tên hiển thị & Số điện thoại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Tên hiển thị <span className="text-rose-500">* (3 - 30 ký tự)</span>
                  </label>
                  <input 
                    type="text" 
                    value={settings.full_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Số điện thoại</label>
                  <input 
                    type="text" 
                    value={settings.phone}
                    onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0912345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Email & Tên người dùng (Read-only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Email đăng ký (Cố định)</label>
                  <input 
                    type="text" 
                    disabled 
                    value={settings.email}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl text-xs sm:text-sm cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Tên định danh (@username)</label>
                  <input 
                    type="text" 
                    disabled 
                    value={`@${settings.username}`}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl text-xs sm:text-sm cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              {/* Giới thiệu / Bio */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Tiểu sử / Bio</label>
                <textarea 
                  rows="3"
                  value={settings.bio}
                  onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Chia sẻ đôi điều về bạn..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Nơi ở, Quê quán & Học vấn */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Tỉnh / Thành phố hiện tại</label>
                  <input 
                    type="text" 
                    value={settings.location}
                    onChange={(e) => setSettings(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Hà Nội, Việt Nam"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Quê quán</label>
                  <input 
                    type="text" 
                    value={settings.hometown}
                    onChange={(e) => setSettings(prev => ({ ...prev, hometown: e.target.value }))}
                    placeholder="Đà Nẵng"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Học vấn / Trường học</label>
                  <input 
                    type="text" 
                    value={settings.education}
                    onChange={(e) => setSettings(prev => ({ ...prev, education: e.target.value }))}
                    placeholder="Đại học Bách Khoa"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Nút lưu hồ sơ */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveProfile}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Đang lưu...' : 'Lưu Thay Đổi Hồ Sơ'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: MẬT KHẨU & BẢO MẬT */}
          {/* ======================================================== */}
          {activeSubTab === 'security' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 mb-1">
                  <Lock className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Mật Khẩu & Bảo Mật Tài Khoản</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Bảo vệ tài khoản bằng mật khẩu mạnh và tính năng xác thực hai yếu tố.
                </p>
              </div>

              {/* Form Đổi mật khẩu */}
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                <h3 className="text-sm font-bold text-slate-800">Đổi Mật Khẩu Đăng Nhập</h3>
                
                {/* Mật khẩu cũ */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <input 
                      type={showPasswords.old ? "text" : "password"} 
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, old_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Mật khẩu mới <span className="text-blue-600 font-normal">(Ít nhất 8 ký tự, có chữ hoa, thường và số)</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showPasswords.new ? "text" : "password"} 
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <input 
                      type={showPasswords.confirm ? "text" : "password"} 
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}</span>
                </button>
              </form>

              {/* Xác thực 2 bước (2FA) */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-900">Xác thực hai yếu tố (2FA)</span>
                  </div>
                  <p className="text-xs text-slate-500 max-w-lg">
                    Tăng cường bảo mật: Yêu cầu mã xác thực khi đăng nhập trên thiết bị lạ hoặc trình duyệt mới.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggle2FA}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    settings.two_factor_enabled
                      ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}
                >
                  {settings.two_factor_enabled ? 'Vô hiệu hóa 2FA' : 'Kích hoạt 2FA'}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: QUYỀN RIÊNG TƯ */}
          {/* ======================================================== */}
          {activeSubTab === 'privacy' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 mb-1">
                  <Eye className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Cài Đặt Quyền Riêng Tư & Tương Tác</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Kiểm soát đối tượng có thể xem nội dung và tương tác với bạn.
                </p>
              </div>

              {/* Quyền riêng tư bài viết mặc định */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  Quyền riêng tư mặc định khi tạo bài viết mới
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'public', label: 'Công khai', desc: 'Mọi người trên mạng xã hội đều xem được.' },
                    { id: 'friends', label: 'Bạn bè', desc: 'Chỉ những người đã kết bạn mới xem được.' },
                    { id: 'private', label: 'Chỉ mình tôi', desc: 'Nội dung riêng tư, chỉ mình bạn xem được.' }
                  ].map((p) => (
                    <div 
                      key={p.id}
                      onClick={() => setSettings(prev => ({ ...prev, post_default_privacy: p.id }))}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                        settings.post_default_privacy === p.id 
                          ? 'border-blue-600 bg-blue-50/50' 
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block mb-1">{p.label}</span>
                      <p className="text-[11px] text-slate-500">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ai có thể gửi lời mời kết bạn */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">
                  Ai có thể gửi lời mời kết bạn cho bạn?
                </label>
                <select
                  value={settings.who_can_send_friend_requests}
                  onChange={(e) => setSettings(prev => ({ ...prev, who_can_send_friend_requests: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500"
                >
                  <option value="everyone">Mọi người trên hệ thống</option>
                  <option value="friends_of_friends">Bạn của bạn bè</option>
                </select>
              </div>

              {/* Hiển thị Email / Phone */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">Hiển thị Email trên hồ sơ công khai</h4>
                    <p className="text-xs text-slate-500">Cho phép người khác nhìn thấy email của bạn trên trang cá nhân.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.show_email} 
                    onChange={(e) => setSettings(prev => ({ ...prev, show_email: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">Hiển thị Số điện thoại trên hồ sơ công khai</h4>
                    <p className="text-xs text-slate-500">Cho phép người khác nhìn thấy số điện thoại của bạn.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.show_phone} 
                    onChange={(e) => setSettings(prev => ({ ...prev, show_phone: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSavePrivacy}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Đang lưu...' : 'Lưu Quyền Riêng Tư'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: DANH SÁCH CHẶN */}
          {/* ======================================================== */}
          {activeSubTab === 'blocked' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-rose-600 mb-1">
                  <UserX className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Quản Lý Danh Sách Chặn</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Người dùng bị chặn sẽ không thể xem bài viết, bình luận hoặc gửi tin nhắn cho bạn.
                </p>
              </div>

              {blockedUsers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">Danh sách chặn đang trống</h4>
                  <p className="text-xs text-slate-400 mt-1">Bạn chưa chặn người dùng nào.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {blockedUsers.map((b) => (
                    <div key={b.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={b.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} 
                          alt={b.name} 
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-200"
                        />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800">{b.name}</p>
                          <p className="text-[11px] text-slate-400">@{b.username} • Chặn {b.blocked_at || 'Gần đây'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblock(b.id, b.name)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Bỏ chặn
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: THÔNG BÁO */}
          {/* ======================================================== */}
          {activeSubTab === 'notifications' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 mb-1">
                  <Bell className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Cài Đặt Nhận Thông Báo</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Tùy chỉnh các thông báo và cảnh báo an toàn bạn muốn nhận từ hệ thống.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'notify_ai_warnings', label: 'Cảnh báo an ninh AI', desc: 'Nhận thông báo tức thì khi AI phát hiện tài khoản bị công kích hoặc quấy rối.', highlight: true },
                  { key: 'notify_likes', label: 'Thông báo lượt bày tỏ cảm xúc', desc: 'Khi ai đó Thích, Yêu thích hoặc Haha bài viết của bạn.' },
                  { key: 'notify_comments', label: 'Thông báo bình luận', desc: 'Khi có người để lại bình luận trên bài viết của bạn.' },
                  { key: 'notify_friend_requests', label: 'Lời mời kết bạn', desc: 'Khi có người dùng gửi lời mời kết bạn mới.' },
                  { key: 'sound_enabled', label: 'Âm thanh thông báo', desc: 'Phát âm thanh nhẹ khi có tin nhắn hoặc thông báo mới.' }
                ].map((item) => (
                  <div 
                    key={item.key} 
                    className={`flex items-center justify-between p-4 rounded-2xl border ${
                      item.highlight 
                        ? 'bg-blue-50/60 border-blue-200' 
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div>
                      <h4 className={`text-xs sm:text-sm font-bold ${item.highlight ? 'text-blue-900' : 'text-slate-800'}`}>
                        {item.label}
                      </h4>
                      <p className={`text-xs mt-0.5 ${item.highlight ? 'text-blue-700/80' : 'text-slate-500'}`}>
                        {item.desc}
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings[item.key]} 
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveNotifications}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Đang lưu...' : 'Lưu Cài Đặt Thông Báo'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7: GIAO DIỆN & NGÔN NGỮ */}
          {/* ======================================================== */}
          {activeSubTab === 'appearance' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 mb-1">
                  <Palette className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900">Giao Diện & Ngôn Ngữ</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Tùy chỉnh phong cách hiển thị theo sở thích cá nhân.
                </p>
              </div>

              {/* Theme */}
              <div className="space-y-3">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">Chế độ hiển thị</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                    onClick={() => {
                      setSettings(prev => ({ ...prev, theme: 'light' }));
                      if (onSetTheme) onSetTheme('light');
                      settingsService.updateAppearance({ theme: 'light', language: settings.language });
                      showToast('success', 'Đã chuyển sang Giao diện Sáng (Light Mode)');
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      theme === 'light' 
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">Giao diện Sáng</p>
                        <p className="text-[11px] text-slate-500">Chuẩn sắc nét ban ngày</p>
                      </div>
                    </div>
                    {theme === 'light' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                        Đang chọn
                      </span>
                    )}
                  </div>

                  <div 
                    onClick={() => {
                      setSettings(prev => ({ ...prev, theme: 'dark' }));
                      if (onSetTheme) onSetTheme('dark');
                      settingsService.updateAppearance({ theme: 'dark', language: settings.language });
                      showToast('success', 'Đã chuyển sang Giao diện Tối (Dark Mode)');
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      theme === 'dark' 
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">Giao diện Tối</p>
                        <p className="text-[11px] text-slate-500">Dịu mắt ban đêm</p>
                      </div>
                    </div>
                    {theme === 'dark' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                        Đang chọn
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ngôn ngữ */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-800">Ngôn ngữ hiển thị</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings(prev => ({ ...prev, language: 'vi' }));
                      showToast('success', 'Đã chọn Tiếng Việt');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border-2 transition cursor-pointer flex items-center gap-2 ${
                      settings.language === 'vi' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>🇻🇳 Tiếng Việt (Mặc định)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettings(prev => ({ ...prev, language: 'en' }));
                      showToast('success', 'Switched to English');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border-2 transition cursor-pointer flex items-center gap-2 ${
                      settings.language === 'en' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>🇺🇸 English</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
