import { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Save, Loader2, MapPin, Home, GraduationCap, 
  Heart, Sparkles, CheckCircle2, User, UploadCloud, AlertCircle, Check
} from 'lucide-react';
import { profileService } from '../services/profileService';
import { DEFAULT_AVATAR, DEFAULT_COVER } from '../constants/defaults';

const RELATIONSHIP_OPTIONS = [
  'Độc thân',
  'Đang hẹn hò',
  'Đã đính hôn',
  'Đã kết hôn',
  'Đang tìm hiểu',
  'Có mối quan hệ phức tạp'
];

export default function EditProfileModal({
  isOpen,
  onClose,
  initialData = {},
  onSave,
  isSaving = false,
  successMsg = ''
}) {
  const [formData, setFormData] = useState({
    avatar_url: '',
    cover_url: '',
    bio: '',
    location: '',
    hometown: '',
    education: '',
    highSchool: '',
    relationship: 'Độc thân'
  });

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [avatarUploadSuccess, setAvatarUploadSuccess] = useState(false);
  const [coverUploadSuccess, setCoverUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        avatar_url: initialData.avatar || initialData.avatar_url || '',
        cover_url: initialData.cover || initialData.cover_url || initialData.coverImage || '',
        bio: initialData.bio || '',
        location: initialData.location || '',
        hometown: initialData.hometown || '',
        education: initialData.education || '',
        highSchool: initialData.highSchool || initialData.high_school || '',
        relationship: initialData.relationship || initialData.relationship_status || 'Độc thân'
      });
      setAvatarUploadSuccess(false);
      setCoverUploadSuccess(false);
      setUploadError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Upload ảnh đại diện từ máy tính lên Cloudinary
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng ảnh tối đa là 10MB');
      return;
    }

    setUploadError('');
    setIsUploadingAvatar(true);
    setAvatarUploadSuccess(false);

    try {
      const cloudinaryUrl = await profileService.uploadImage(file);
      handleChange('avatar_url', cloudinaryUrl);
      setAvatarUploadSuccess(true);
      setTimeout(() => setAvatarUploadSuccess(false), 4000);
    } catch (err) {
      setUploadError(err.message || 'Không thể tải ảnh lên Cloudinary');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Upload ảnh bìa từ máy tính lên Cloudinary
  const handleCoverFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng ảnh tối đa là 10MB');
      return;
    }

    setUploadError('');
    setIsUploadingCover(true);
    setCoverUploadSuccess(false);

    try {
      const cloudinaryUrl = await profileService.uploadImage(file);
      handleChange('cover_url', cloudinaryUrl);
      setCoverUploadSuccess(true);
      setTimeout(() => setCoverUploadSuccess(false), 4000);
    } catch (err) {
      setUploadError(err.message || 'Không thể tải ảnh bìa lên Cloudinary');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isUploadingAvatar || isUploadingCover) {
      alert("Đang tải ảnh lên Cloudinary, vui lòng chờ trong giây lát...");
      return;
    }
    if (onSave) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Chỉnh sửa trang cá nhân</h2>
              <p className="text-xs text-slate-500">Chọn ảnh trực tiếp từ máy tính, lưu trữ trên Cloudinary và Database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving || isUploadingAvatar || isUploadingCover}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông báo thành công */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs sm:text-sm font-semibold animate-fade-in shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thông báo lỗi upload */}
        {uploadError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs sm:text-sm font-semibold animate-fade-in shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6 flex-1 divide-y divide-slate-100">
          
          {/* Section 1: Ảnh đại diện & Ảnh bìa với Cloudinary Upload */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                Ảnh đại diện & Ảnh bìa
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                ☁️ Cloudinary Storage
              </span>
            </div>

            {/* Input file ẩn cho Avatar */}
            <input 
              type="file" 
              ref={avatarInputRef}
              accept="image/*"
              onChange={handleAvatarFileSelect}
              className="hidden"
            />

            {/* Input file ẩn cho Cover */}
            <input 
              type="file" 
              ref={coverInputRef}
              accept="image/*"
              onChange={handleCoverFileSelect}
              className="hidden"
            />

            {/* 1.1 Khung đổi Ảnh đại diện */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Ảnh đại diện (Avatar)
                </label>
                {avatarUploadSuccess && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md animate-fade-in">
                    <Check className="w-3.5 h-3.5" /> Đã tải lên Cloudinary
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Avatar Preview */}
                <div className="relative group shrink-0">
                  <img 
                    src={formData.avatar_url || DEFAULT_AVATAR} 
                    alt="Avatar preview"
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md bg-white"
                    onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-white">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Các nút tải ảnh từ máy tính */}
                <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang tải lên Cloudinary...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>Chọn ảnh từ máy tính</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAvatarUrlInput(!showAvatarUrlInput)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                      {showAvatarUrlInput ? "Ẩn link URL" : "Dán link ảnh"}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Hỗ trợ định dạng PNG, JPG, WEBP. Ảnh sẽ được tự động tối ưu hóa và lưu trên Cloudinary.
                  </p>

                  {/* Input URL thủ công nếu cần */}
                  {showAvatarUrlInput && (
                    <input
                      type="text"
                      value={formData.avatar_url}
                      onChange={(e) => handleChange('avatar_url', e.target.value)}
                      placeholder="Dán link ảnh online (https://...)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 1.2 Khung đổi Ảnh bìa */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Ảnh bìa (Cover Photo)
                </label>
                {coverUploadSuccess && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md animate-fade-in">
                    <Check className="w-3.5 h-3.5" /> Đã tải lên Cloudinary
                  </span>
                )}
              </div>

              {/* Cover Preview */}
              <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-200 shadow-inner group">
                <img 
                  src={formData.cover_url || DEFAULT_COVER} 
                  alt="Cover preview" 
                  className="w-full h-full object-cover"
                />
                {isUploadingCover && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white gap-2 font-bold text-xs">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang tải ảnh bìa lên Cloudinary...</span>
                  </div>
                )}
              </div>

              {/* Nút upload ảnh bìa từ máy tính */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isUploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
                >
                  {isUploadingCover ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tải lên Cloudinary...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Chọn ảnh bìa từ máy tính</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCoverUrlInput(!showCoverUrlInput)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  {showCoverUrlInput ? "Ẩn link URL" : "Dán link ảnh bìa"}
                </button>
              </div>

              {showCoverUrlInput && (
                <input
                  type="text"
                  value={formData.cover_url}
                  onChange={(e) => handleChange('cover_url', e.target.value)}
                  placeholder="Dán link ảnh bìa online (https://...)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              )}
            </div>

          </div>

          {/* Section 2: Tiểu sử (Bio) */}
          <div className="pt-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Tiểu sử (Bio)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {(formData.bio || '').length}/200 ký tự
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={200}
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Mô tả ngắn về bản thân bạn..."
              className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition resize-none"
            />
          </div>

          {/* Section 3: Chi tiết cá nhân */}
          <div className="pt-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Chi tiết thông tin cá nhân
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nơi sống */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Nơi ở hiện tại
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="Ví dụ: Vũng Tàu, TP. Hồ Chí Minh"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Quê quán */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  Quê quán
                </label>
                <input
                  type="text"
                  value={formData.hometown}
                  onChange={(e) => handleChange('hometown', e.target.value)}
                  placeholder="Ví dụ: Vũng Tàu, Hà Nội"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Trường Đại học */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Đại học / Chuyên ngành
                </label>
                <input
                  type="text"
                  value={formData.education}
                  onChange={(e) => handleChange('education', e.target.value)}
                  placeholder="Ví dụ: Đại học Bách Khoa"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Trường Cấp 3 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Trường THPT
                </label>
                <input
                  type="text"
                  value={formData.highSchool}
                  onChange={(e) => handleChange('highSchool', e.target.value)}
                  placeholder="Ví dụ: Trường THPT Hòa Hội"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Tình trạng mối quan hệ */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  Tình trạng mối quan hệ
                </label>
                <select
                  value={formData.relationship}
                  onChange={(e) => handleChange('relationship', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isUploadingAvatar || isUploadingCover}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || isUploadingAvatar || isUploadingCover}
            className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
