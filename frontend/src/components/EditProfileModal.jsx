import { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Save, Loader2, MapPin, Home, GraduationCap, Briefcase,
  Heart, Sparkles, CheckCircle2, User, UploadCloud, AlertCircle, Check, Trash2
} from 'lucide-react';
import { profileService } from '../services/profileService';
import { DEFAULT_AVATAR, DEFAULT_COVER } from '../constants/defaults';
import { useTranslation } from '../utils/i18n';
import {
  RELATIONSHIP_OPTIONS,
  validateProfileField,
  validateProfileForm
} from '../utils/profileValidation';

export default function EditProfileModal({
  isOpen,
  onClose,
  initialData = {},
  onSave,
  isSaving = false,
  successMsg = '',
  saveError = ''
}) {
  const { t, isEn } = useTranslation();
  const [formData, setFormData] = useState({
    avatar_url: '',
    cover_url: '',
    bio: '',
    workplace: '',
    jobTitle: '',
    location: '',
    hometown: '',
    education: '',
    highSchool: '',
    relationship: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

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
        workplace: initialData.workplace || '',
        jobTitle: initialData.jobTitle || initialData.job_title || '',
        location: initialData.location || '',
        hometown: initialData.hometown || '',
        education: initialData.education || '',
        highSchool: initialData.highSchool || initialData.high_school || '',
        relationship: initialData.relationship || initialData.relationship_status || ''
      });
      setFieldErrors({});
      setFormError('');
      setAvatarUploadSuccess(false);
      setCoverUploadSuccess(false);
      setUploadError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormError('');
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleFieldBlur = (field) => {
    const err = validateProfileField(field, formData[field], isEn);
    setFieldErrors(prev => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const getInputClass = (field, extra = '') =>
    `w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border ${
      fieldErrors[field]
        ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500 bg-rose-50/40 dark:bg-rose-950/20'
        : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
    } text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-850 transition ${extra}`;

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
      setFormError(isEn ? 'Images are still uploading, please wait a moment...' : 'Đang tải ảnh lên Cloudinary, vui lòng chờ trong giây lát...');
      return;
    }

    const { valid, errors, sanitized } = validateProfileForm(formData, isEn);
    setFieldErrors(errors);
    if (!valid) {
      setFormError(
        isEn
          ? 'Please review and fix the highlighted fields before saving.'
          : 'Một số thông tin chưa hợp lệ hoặc chưa rõ ràng. Vui lòng kiểm tra các ô báo đỏ bên dưới.'
      );
      return;
    }

    setFormError('');
    setFormData(sanitized);
    if (onSave) {
      onSave(sanitized);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('edit_profile.title')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'Update accurate public details about your work, education, and places lived.'
                  : 'Cập nhật đầy đủ, chính xác thông tin giới thiệu, công việc, học vấn và nơi ở của bạn.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving || isUploadingAvatar || isUploadingCover}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông báo thành công */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-semibold animate-fade-in shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thông báo lỗi upload / validation / server */}
        {(uploadError || formError || saveError) && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-semibold animate-fade-in shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{uploadError || formError || saveError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* Section 1: Ảnh đại diện & Ảnh bìa với Cloudinary Upload */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {t('edit_profile.avatar_cover')}
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800">
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
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {t('edit_profile.avatar')}
                </label>
                {avatarUploadSuccess && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md animate-fade-in">
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
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-slate-700 shadow-md bg-white dark:bg-slate-800"
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
                      className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                    >
                      {showAvatarUrlInput ? "Ẩn link URL" : "Dán link ảnh"}
                    </button>

                    {formData.avatar_url && formData.avatar_url !== DEFAULT_AVATAR && (
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('avatar_url', DEFAULT_AVATAR);
                          setAvatarUploadSuccess(false);
                          setUploadError('');
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                        title="Xóa ảnh đại diện và quay về ảnh đại diện mặc định"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa ảnh (về mặc định)</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Hỗ trợ định dạng PNG, JPG, WEBP. Ảnh sẽ được tự động tối ưu hóa và lưu trên Cloudinary.
                  </p>

                  {/* Input URL thủ công nếu cần */}
                  {showAvatarUrlInput && (
                    <input
                      type="text"
                      value={formData.avatar_url}
                      onChange={(e) => handleChange('avatar_url', e.target.value)}
                      placeholder="Dán link ảnh online (https://...)"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 1.2 Khung đổi Ảnh bìa */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {t('edit_profile.cover')}
                </label>
                {coverUploadSuccess && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md animate-fade-in">
                    <Check className="w-3.5 h-3.5" /> Đã tải lên Cloudinary
                  </span>
                )}
              </div>

              {/* Cover Preview */}
              <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 shadow-inner group">
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
                      <span>{t('edit_profile.choose_cover_file')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCoverUrlInput(!showCoverUrlInput)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  {showCoverUrlInput ? "Ẩn link URL" : "Dán link ảnh bìa"}
                </button>
              </div>

              {showCoverUrlInput && (
                <input
                  type="text"
                  value={formData.cover_url}
                  onChange={(e) => handleChange('cover_url', e.target.value)}
                  placeholder="Dán link ảnh online (https://...)"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-blue-500"
                />
              )}
            </div>

          </div>

          {/* Section 2: Tiểu sử (Bio) */}
          <div className="pt-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {t('edit_profile.bio')}
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {(formData.bio || '').length}/200 {isEn ? 'chars' : 'ký tự'}
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={200}
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              onBlur={() => handleFieldBlur('bio')}
              placeholder={isEn ? 'Describe your interests, expertise, or personal motto...' : 'Ví dụ: Yêu thích công nghệ, chia sẻ kiến thức lập trình & nhiếp ảnh...'}
              className={`w-full p-3 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border ${
                fieldErrors.bio
                  ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500 bg-rose-50/40 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
              } text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-850 transition resize-none`}
            />
            {fieldErrors.bio && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.bio}</p>
            )}
          </div>

          {/* Section 3: Công việc và Học vấn */}
          <div className="pt-5 space-y-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {isEn ? 'Work & Education' : 'Công việc & Học vấn'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Displayed under the Overview and Work & Education tabs (optional — leave blank if you prefer not to share).'
                  : 'Hiển thị tại mục Tổng quan và Công việc & Học vấn (có thể bỏ trống nếu không muốn chia sẻ).'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nơi làm việc */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {isEn ? 'Workplace / Company' : 'Nơi làm việc / Công ty'}
                  </label>
                  <span className="text-[10px] text-slate-400">{(formData.workplace || '').length}/150</span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={formData.workplace}
                  onChange={(e) => handleChange('workplace', e.target.value)}
                  onBlur={() => handleFieldBlur('workplace')}
                  placeholder={isEn ? 'e.g., FPT Software, Freelancer' : 'Ví dụ: Công ty Cổ phần FPT, Tự kinh doanh'}
                  className={getInputClass('workplace')}
                />
                {fieldErrors.workplace && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.workplace}</p>
                )}
              </div>

              {/* Chức vụ / Nghề nghiệp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {isEn ? 'Job Title / Role' : 'Chức vụ / Nghề nghiệp'}
                  </label>
                  <span className="text-[10px] text-slate-400">{(formData.jobTitle || '').length}/150</span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={formData.jobTitle}
                  onChange={(e) => handleChange('jobTitle', e.target.value)}
                  onBlur={() => handleFieldBlur('jobTitle')}
                  placeholder={isEn ? 'e.g., Software Engineer, Student' : 'Ví dụ: Kỹ sư phần mềm, Sinh viên'}
                  className={getInputClass('jobTitle')}
                />
                {fieldErrors.jobTitle && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.jobTitle}</p>
                )}
              </div>

              {/* Trường Đại học / Chuyên ngành */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {isEn ? 'College / University & Major' : 'Đại học / Chuyên ngành'}
                  </label>
                  <span className="text-[10px] text-slate-400">{(formData.education || '').length}/150</span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={formData.education}
                  onChange={(e) => handleChange('education', e.target.value)}
                  onBlur={() => handleFieldBlur('education')}
                  placeholder={isEn ? 'e.g., HCMC University of Technology - IT' : 'Ví dụ: Đại học Bách Khoa - CNTT'}
                  className={getInputClass('education')}
                />
                {fieldErrors.education && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.education}</p>
                )}
              </div>

              {/* Trường THPT */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {isEn ? 'High School' : 'Trường THPT'}
                  </label>
                  <span className="text-[10px] text-slate-400">{(formData.highSchool || '').length}/150</span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={formData.highSchool}
                  onChange={(e) => handleChange('highSchool', e.target.value)}
                  onBlur={() => handleFieldBlur('highSchool')}
                  placeholder={isEn ? 'e.g., Central High School' : 'Ví dụ: Trường THPT Hòa Hội'}
                  className={getInputClass('highSchool')}
                />
                {fieldErrors.highSchool && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.highSchool}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Nơi ở & Mối quan hệ */}
          <div className="pt-5 space-y-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {isEn ? 'Places & Relationship' : 'Nơi ở & Mối quan hệ'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Enter real city or province names (at least 2 letters, no random symbols).'
                  : 'Nhập tên tỉnh/thành phố hoặc địa danh thật rõ ràng (ít nhất 2 chữ cái, không nhập ký tự tào lao).'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nơi sống */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {isEn ? 'Current City / Residence' : 'Nơi ở hiện tại'}
                  </label>
                  <span className="text-[10px] text-slate-400">{(formData.location || '').length}/100</span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  onBlur={() => handleFieldBlur('location')}
                  placeholder={isEn ? 'e.g., Ho Chi Minh City' : 'Ví dụ: Quận 1, TP. Hồ Chí Minh'}
                  className={getInputClass('location')}
                />
                {fieldErrors.location && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.location}</p>
                )}
              </div>

              {/* Quê quán */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-slate-400" />
                    {t("edit_profile.hometown")}
                  </label>
                  <span className="text-[10px] text-slate-400">{(formData.hometown || '').length}/100</span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  value={formData.hometown}
                  onChange={(e) => handleChange('hometown', e.target.value)}
                  onBlur={() => handleFieldBlur('hometown')}
                  placeholder={isEn ? 'e.g., Vung Tau, Hanoi' : 'Ví dụ: Bà Rịa - Vũng Tàu, Hà Nội'}
                  className={getInputClass('hometown')}
                />
                {fieldErrors.hometown && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.hometown}</p>
                )}
              </div>

              {/* Tình trạng mối quan hệ */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  {t('edit_profile.relationship')}
                </label>
                <select
                  value={formData.relationship}
                  onChange={(e) => handleChange('relationship', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-500">
                    {isEn ? 'Not specified' : 'Chưa cập nhật'}
                  </option>
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{opt}</option>
                  ))}
                </select>
                {fieldErrors.relationship && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{fieldErrors.relationship}</p>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isUploadingAvatar || isUploadingCover}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer"
          >
            {t("edit_profile.cancel")}
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
                <span>{t('edit_profile.saving')}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t('edit_profile.save')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
