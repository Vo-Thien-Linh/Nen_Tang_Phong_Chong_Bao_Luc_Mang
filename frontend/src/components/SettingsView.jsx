import { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, User, Lock, Eye, EyeOff, Bell, Palette, 
  UserX, UserPlus, Users, CheckCircle2, AlertTriangle, Save, Sparkles, KeyRound, 
  Smartphone, Mail, MapPin, GraduationCap, Heart, HelpCircle, 
  Trash2, Plus, Sliders, Moon, Sun, Globe, RefreshCw, AlertCircle,
  Volume2
} from 'lucide-react';
import { settingsService } from '../services/settingsService';
import { playNotificationSound } from '../utils/soundUtil';
import { profileService } from '../services/profileService';
import { fetchUserTrustHistory } from '../api/client';
import { useTranslation } from '../utils/i18n';

export default function SettingsView({ 
  currentUser, 
  onUpdateUser, 
  theme = 'light', 
  onSetTheme, 
  onToggleTheme 
}) {
  const { t, language: i18nLang, setLanguage, isEn } = useTranslation();
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
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const kwString = keywordList.join(', ');
      await settingsService.updateSafety({
        ai_shield_enabled: settings.ai_shield_enabled,
        ai_sensitivity: settings.ai_sensitivity,
        auto_hide_toxic_comments: settings.auto_hide_toxic_comments,
        filter_keywords: kwString,
        block_strangers_messages: settings.block_strangers_messages,
        take_a_break_mode: settings.take_a_break_mode
      });
      if (onUpdateUser) {
        onUpdateUser({
          settings: {
            ...settings,
            filter_keywords: kwString
          }
        });
      }
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
      const payload = {
        post_default_privacy: settings.post_default_privacy || 'public',
        who_can_send_friend_requests: settings.who_can_send_friend_requests || 'everyone',
        who_can_message: settings.who_can_message || 'everyone',
        show_email: Boolean(settings.show_email),
        show_phone: Boolean(settings.show_phone)
      };

      await settingsService.updatePrivacy(payload);
      if (onUpdateUser) {
        onUpdateUser({
          show_email: Boolean(settings.show_email),
          show_phone: Boolean(settings.show_phone),
          settings: {
            ...settings,
            ...payload
          }
        });
      }
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
      if (onUpdateUser) {
        onUpdateUser({
          settings: {
            ...settings,
            notify_likes: settings.notify_likes,
            notify_comments: settings.notify_comments,
            notify_friend_requests: settings.notify_friend_requests,
            notify_ai_warnings: settings.notify_ai_warnings,
            sound_enabled: settings.sound_enabled
          }
        });
      }
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
      if (onUpdateUser) {
        onUpdateUser({ blocked_users_updated: Date.now() });
      }
      showToast('success', `Đã bỏ chặn ${name}`);
    } catch (err) {
      showToast('error', err.message || 'Bỏ chặn thất bại');
    }
  };

  const navItems = [
    { id: 'safety', label: t('settings.tab.safety'), icon: ShieldCheck },
    { id: 'profile', label: t('settings.tab.profile'), icon: User },
    { id: 'security', label: t('settings.tab.security'), icon: Lock },
    { id: 'privacy', label: t('settings.tab.privacy'), icon: Eye },
    { id: 'blocked', label: t('settings.tab.blocked'), icon: UserX, count: blockedUsers.length },
    { id: 'notifications', label: t('settings.tab.notifications'), icon: Bell },
    { id: 'appearance', label: t('settings.tab.appearance'), icon: Palette }
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
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t('settings.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl">
            {t('settings.subtitle')}
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
            <div className="text-left">
              <p className="text-[11px] text-slate-300 font-medium">{isEn ? 'Keyword Filter' : 'Bộ Lọc Từ Khóa'}</p>
              <p className="text-xs font-bold text-white">
                {t('safety.keywords_count', { count: keywordList.length })}
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-slate-200/80 dark:border-slate-800 sticky top-24 space-y-1">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('settings.categories')}
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
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 mb-1">
                  <ShieldCheck className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('safety.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('safety.subtitle')}
                </p>
              </div>

              {/* Bộ lọc từ khóa cấm cá nhân */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">{t('safety.blacklist_title')}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t('safety.blacklist_desc')}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                    {t('safety.keywords_count', { count: keywordList.length })}
                  </span>
                </div>

                {/* Ô nhập từ khóa mới */}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }}
                    placeholder={t("safety.input_placeholder")}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white"
                  />
                  <button 
                    type="button"
                    onClick={handleAddKeyword}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t("safety.add_btn")}</span>
                  </button>
                </div>

                {/* Danh sách các tag từ khóa hiện tại */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 min-h-[90px] flex flex-wrap gap-2 items-center">
                  {keywordList.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">{t('safety.empty_keywords')}</span>
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
                  <span className="text-[11px] font-bold text-slate-400">{t('safety.quick_suggestions')}</span>
                  <button
                    type="button"
                    onClick={() => handleAddPresetKeywords(['xúc phạm', 'miệt thị', 'xấu xí', 'béo ú', 'ngu ngốc'])}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    {t('safety.preset_body_shaming')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPresetKeywords(['đâm', 'chém', 'giết', 'đánh nhau', 'tiêu diệt'])}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    {t('safety.preset_violence')}
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
                  <span>{loading ? 'Đang lưu...' : t('safety.save_btn')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: HỒ SƠ & TÀI KHOẢN */}
          {/* ======================================================== */}
          {activeSubTab === 'profile' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 mb-1">
                  <User className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('settings_profile.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('settings_profile.subtitle')}
                </p>
              </div>

              {/* Ảnh đại diện & Ảnh bìa preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">{t('settings_profile.avatar_label')}</label>
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
                      placeholder={isEn ? "Paste avatar image URL..." : "Dán link ảnh đại diện..."}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">{t('settings_profile.cover_label')}</label>
                  <input 
                    type="text" 
                    value={settings.cover_url}
                    onChange={(e) => setSettings(prev => ({ ...prev, cover_url: e.target.value }))}
                    placeholder={isEn ? "Paste cover image URL..." : "Dán link ảnh bìa trang cá nhân..."}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs outline-none focus:border-blue-500"
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
                    {t('settings_profile.name_label')} <span className="text-rose-500">* (3 - 30 ký tự)</span>
                  </label>
                  <input 
                    type="text" 
                    value={settings.full_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('settings_profile.phone_label')}</label>
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
                <label className="block text-xs font-bold text-slate-700">{t('settings_profile.bio_label')}</label>
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
                  <label className="block text-xs font-bold text-slate-700">{t('edit_profile.city')}</label>
                  <input 
                    type="text" 
                    value={settings.location}
                    onChange={(e) => setSettings(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Hà Nội, Việt Nam"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('edit_profile.hometown')}</label>
                  <input 
                    type="text" 
                    value={settings.hometown}
                    onChange={(e) => setSettings(prev => ({ ...prev, hometown: e.target.value }))}
                    placeholder="Đà Nẵng"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('edit_profile.education')}</label>
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
                  <span>{loading ? 'Đang lưu...' : t('settings_profile.save_btn')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: MẬT KHẨU & BẢO MẬT */}
          {/* ======================================================== */}
          {activeSubTab === 'security' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 mb-1">
                  <Lock className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('security.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('security.subtitle')}
                </p>
              </div>

              {/* Form Đổi mật khẩu */}
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('security.change_password')}</h3>
                
                {/* Mật khẩu cũ */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('security.current_password')}</label>
                  <div className="relative">
                    <input 
                      type={showOldPassword ? "text" : "password"} 
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, old_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10 p-1"
                      title={showOldPassword ? t('security.hide_pwd') : t('security.show_pwd')}
                    >
                      {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('security.new_password')} <span className="text-blue-600 dark:text-blue-400 font-normal">{t('security.password_hint')}</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer z-10 p-1"
                      title={showNewPassword ? t('security.hide_pwd') : t('security.show_pwd')}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('security.confirm_password')}</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-xs sm:text-sm outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer z-10 p-1"
                      title={showConfirmPassword ? t('security.hide_pwd') : t('security.show_pwd')}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? t('security.updating') : t('security.update_btn')}</span>
                </button>
              </form>

              {/* Xác thực 2 bước (2FA) */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-900">{t('security.2fa_title')}</span>
                  </div>
                  <p className="text-xs text-slate-500 max-w-lg">
                    {t('security.2fa_desc')}
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
                  {settings.two_factor_enabled ? (isEn ? 'Disable 2FA' : 'Vô hiệu hóa 2FA') : (isEn ? 'Enable 2FA' : 'Kích hoạt 2FA')}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: QUYỀN RIÊNG TƯ */}
          {/* ======================================================== */}
          {activeSubTab === 'privacy' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 mb-1">
                  <Eye className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('privacy.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('privacy.subtitle')}
                </p>
              </div>

              {/* Quyền riêng tư bài viết mặc định */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t('privacy.default_post')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'public', label: t('privacy.public'), desc: t('privacy.public_desc') },
                    { id: 'friends', label: t('privacy.friends'), desc: t('privacy.friends_desc') },
                    { id: 'private', label: t('privacy.private'), desc: t('privacy.private_desc') }
                  ].map((p) => (
                    <div 
                      key={p.id}
                      onClick={() => setSettings(prev => ({ ...prev, post_default_privacy: p.id }))}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                        settings.post_default_privacy === p.id 
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs' 
                          : 'border-slate-200 dark:border-slate-750 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">{p.label}</span>
                        {settings.post_default_privacy === p.id && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ai có thể gửi cho bạn lời mời kết bạn? (Chuẩn Facebook UI/UX) */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t('privacy.who_can_request')}
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                    {t('privacy.who_can_request_desc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'everyone',
                      label: t('privacy.everyone'),
                      desc: t('privacy.everyone_desc'),
                      icon: Globe,
                      iconColor: 'text-blue-600 dark:text-blue-400',
                      iconBg: 'bg-blue-100/70 dark:bg-blue-950/60'
                    },
                    {
                      id: 'friends_of_friends',
                      label: t('privacy.friends_of_friends'),
                      desc: t('privacy.friends_of_friends_desc'),
                      icon: Users,
                      iconColor: 'text-indigo-600 dark:text-indigo-400',
                      iconBg: 'bg-indigo-100/70 dark:bg-indigo-950/60'
                    }
                  ].map((opt) => {
                    const IconComponent = opt.icon;
                    const isSelected = (settings.who_can_send_friend_requests || 'everyone') === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSettings(prev => ({ ...prev, who_can_send_friend_requests: opt.id }))}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3.5 select-none ${
                          isSelected
                            ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 shadow-xs'
                            : 'border-slate-200 dark:border-slate-750 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 ${opt.iconBg} ${opt.iconColor}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                              {opt.label}
                            </span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hiển thị Email / Phone - Chuẩn hóa Toggle Switch */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{t('privacy.show_email')}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition ${
                        Boolean(settings.show_email)
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}>
                        {Boolean(settings.show_email) ? t('privacy.public') : t('privacy.private')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('privacy.show_email_desc')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(settings.show_email)}
                    onClick={() => setSettings(prev => ({ ...prev, show_email: !prev.show_email }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      Boolean(settings.show_email) ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span 
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        Boolean(settings.show_email) ? 'translate-x-5' : 'translate-x-0'
                      }`} 
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{t('privacy.show_phone')}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition ${
                        Boolean(settings.show_phone)
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}>
                        {Boolean(settings.show_phone) ? t('privacy.public') : t('privacy.private')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('privacy.show_phone_desc')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(settings.show_phone)}
                    onClick={() => setSettings(prev => ({ ...prev, show_phone: !prev.show_phone }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      Boolean(settings.show_phone) ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span 
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        Boolean(settings.show_phone) ? 'translate-x-5' : 'translate-x-0'
                      }`} 
                    />
                  </button>
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
                  <span>{loading ? t('privacy.saving') : t('privacy.save_btn')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: DANH SÁCH CHẶN */}
          {/* ======================================================== */}
          {activeSubTab === 'blocked' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 mb-1">
                  <UserX className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('blocked.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('blocked.subtitle')}
                </p>
              </div>

              {blockedUsers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('blocked.empty')}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{isEn ? 'You have not blocked any users.' : 'Bạn chưa chặn người dùng nào.'}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {blockedUsers.map((b) => (
                    <div key={b.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={b.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} 
                          alt={b.name} 
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-200 dark:ring-rose-900"
                        />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{b.name}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">@{b.username} • {isEn ? 'Blocked' : 'Chặn'} {b.blocked_at || (isEn ? 'Recently' : 'Gần đây')}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblock(b.id, b.name)}
                        className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-bold rounded-xl text-xs transition cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        {t('blocked.unblock_btn')}
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 mb-1">
                  <Bell className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('notifications_settings.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('notifications_settings.subtitle')}
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'notify_ai_warnings', label: t('notifications_settings.ai_warnings'), desc: isEn ? 'Instant notification when AI detects account attacks or harassment.' : 'Nhận thông báo tức thì khi AI phát hiện tài khoản bị công kích hoặc quấy rối.', highlight: true },
                  { key: 'notify_likes', label: t('notifications_settings.likes'), desc: isEn ? 'When someone likes, loves, or reacts to your posts.' : 'Khi ai đó Thích, Yêu thích hoặc Haha bài viết của bạn.' },
                  { key: 'notify_comments', label: t('notifications_settings.comments'), desc: isEn ? 'When someone comments on your posts.' : 'Khi có người để lại bình luận trên bài viết của bạn.' },
                  { key: 'notify_friend_requests', label: t('notifications_settings.requests'), desc: isEn ? 'When someone sends you a new friend request.' : 'Khi có người dùng gửi lời mời kết bạn mới.' },
                  { key: 'sound_enabled', label: t('notifications_settings.sound'), desc: t('notifications_settings.sound_desc') }
                ].map((item) => (
                  <div 
                    key={item.key} 
                    className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                      item.highlight 
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' 
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-750'
                    }`}
                  >
                    <div>
                      <h4 className={`text-xs sm:text-sm font-bold ${item.highlight ? 'text-blue-900 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.label}
                      </h4>
                      <p className={`text-xs mt-0.5 ${item.highlight ? 'text-blue-700/80 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.key === 'sound_enabled' && (
                        <button
                          type="button"
                          onClick={() => playNotificationSound()}
                          title={isEn ? "Preview notification sound" : "Nghe thử âm thanh thông báo"}
                          className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{isEn ? 'Preview' : 'Nghe thử'}</span>
                        </button>
                      )}
                      <input 
                        type="checkbox" 
                        checked={settings[item.key]} 
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSettings(prev => ({ ...prev, [item.key]: checked }));
                          if (item.key === 'sound_enabled' && checked) {
                            playNotificationSound();
                          }
                        }}
                        className="w-5 h-5 text-blue-600 rounded-lg cursor-pointer"
                      />
                    </div>
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 mb-1">
                  <Palette className="w-6 h-6" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{t('appearance.title')}</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t('appearance.subtitle')}
                </p>
              </div>

              {/* Theme */}
              <div className="space-y-3">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{t('appearance.mode_title')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                    onClick={() => {
                      setSettings(prev => ({ ...prev, theme: 'light' }));
                      if (onSetTheme) onSetTheme('light');
                      settingsService.updateAppearance({ theme: 'light', language: settings.language });
                      showToast('success', isEn ? 'Switched to Light Mode' : 'Đã chuyển sang Giao diện Sáng (Light Mode)');
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      theme === 'light' 
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm' 
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{t('appearance.light_title')}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('appearance.light_desc')}</p>
                      </div>
                    </div>
                    {theme === 'light' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                        {isEn ? 'Selected' : 'Đang chọn'}
                      </span>
                    )}
                  </div>

                  <div 
                    onClick={() => {
                      setSettings(prev => ({ ...prev, theme: 'dark' }));
                      if (onSetTheme) onSetTheme('dark');
                      settingsService.updateAppearance({ theme: 'dark', language: settings.language });
                      showToast('success', isEn ? 'Switched to Dark Mode' : 'Đã chuyển sang Giao diện Tối (Dark Mode)');
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      theme === 'dark' 
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm' 
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{t('appearance.dark_title')}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('appearance.dark_desc')}</p>
                      </div>
                    </div>
                    {theme === 'dark' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                        {isEn ? 'Selected' : 'Đang chọn'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ngôn ngữ */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{t('appearance.lang_title')}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('vi');
                      setSettings(prev => ({ ...prev, language: 'vi' }));
                      settingsService.updateAppearance({ theme: settings.theme, language: 'vi' });
                      if (onUpdateUser) onUpdateUser({ settings: { ...settings, language: 'vi' } });
                      showToast('success', 'Đã lưu và áp dụng Tiếng Việt');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border-2 transition cursor-pointer flex items-center gap-2 ${
                      (i18nLang === 'vi' || settings.language === 'vi') ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>🇻🇳 {t('appearance.lang_vi')} ({t('appearance.lang_vi_sub')})</span>
                    {(i18nLang === 'vi' || settings.language === 'vi') && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
                        Đang chọn
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      setSettings(prev => ({ ...prev, language: 'en' }));
                      settingsService.updateAppearance({ theme: settings.theme, language: 'en' });
                      if (onUpdateUser) onUpdateUser({ settings: { ...settings, language: 'en' } });
                      showToast('success', 'Saved and applied English');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border-2 transition cursor-pointer flex items-center gap-2 ${
                      (i18nLang === 'en' || settings.language === 'en') ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>🇺🇸 {t('appearance.lang_en')}</span>
                    {(i18nLang === 'en' || settings.language === 'en') && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
                        Selected
                      </span>
                    )}
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
