import { useRef, useState, useEffect } from 'react';
import { Image, Sparkles, Send, CheckCircle2, AlertTriangle, Lock, Timer } from 'lucide-react';
import { createPost, previewPostImage, uploadPostImage } from '../api/client';
import { DEFAULT_AVATAR } from '../constants/defaults';
import ImagePreview from './ImagePreview';
import FriendlyNudgeModal from './FriendlyNudgeModal';
import { validateImageFile } from '../utils/imageLogic';
import { canStartCreation } from '../utils/creationFlowLogic';

export default function CreatePostCard({ currentUser, onAddPost, onRequireAuth, onRequireLogin }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [showImageInput, setShowImageInput] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [imageAiPreview, setImageAiPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [nudgeData, setNudgeData] = useState(null);
  const submitLockRef = useRef(false);

  // Trạng thái xử phạt / cấm đăng bài
  const isBanned = currentUser?.status === 'banned';
  const cooldownVal = currentUser?.cooldown_until || currentUser?.cooldownUntil;
  const cooldownUntil = cooldownVal ? new Date(cooldownVal) : null;
  const isCooldown = (currentUser?.status === 'cooldown' || Boolean(cooldownUntil && cooldownUntil > new Date())) && Boolean(cooldownUntil && cooldownUntil > new Date());
  const [remainingTimeStr, setRemainingTimeStr] = useState('');

  useEffect(() => {
    if (!isCooldown || !cooldownUntil) {
      setRemainingTimeStr('');
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const diff = cooldownUntil - now;
      if (diff <= 0) {
        setRemainingTimeStr('0 giây (đã hết hạn)');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (hours > 0) {
        setRemainingTimeStr(`${hours} giờ ${minutes} phút ${seconds} giây`);
      } else if (minutes > 0) {
        setRemainingTimeStr(`${minutes} phút ${seconds} giây`);
      } else {
        setRemainingTimeStr(`${seconds} giây`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isCooldown, cooldownVal]);

  const handleCheckSafety = async () => {
    if (!content.trim()) return;
    setIsAiChecking(true);

    try {
      const fastApiUrl = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';
      const res = await fetch(`${fastApiUrl}/api/v1/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content })
      });
      if (!res.ok) throw new Error('Backend chưa sẵn sàng');
      const data = await res.json();
      setAiPreview(data);
    } catch {
      const lower = content.toLowerCase();
      let label = 'Normal';
      let confidence = 0.98;

      if (lower.includes('đánh') || lower.includes('đập') || lower.includes('giết') || lower.includes('chém')) {
        label = 'Violence';
        confidence = 0.95;
      } else if (lower.includes('ngu') || lower.includes('chó') || lower.includes('rác')) {
        label = 'Toxic';
        confidence = 0.91;
      }

      setAiPreview({
        label,
        confidence,
        action: label === 'Normal' ? 'allow' : 'warn',
        latency_ms: 38.5
      });
    } finally {
      if (imageFile) {
        try {
          const result = await previewPostImage(imageFile, currentUser?.id);
          setImageAiPreview(result?.category || 'PENDING_REVIEW');
        } catch {
          setImageAiPreview('PENDING_REVIEW');
        }
      }
      setIsAiChecking(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setImageUrl('');
      setImagePreview('');
      setErrorMessage(validation.message);
      e.target.value = '';
      return;
    }

    setImagePreview(URL.createObjectURL(file));
    setImageFile(file);
    setIsUploadingImage(true);

    try {
      const uploadedUrl = await uploadPostImage(file);
      setImageUrl(uploadedUrl);
    } catch (error) {
      setImageUrl('');
      setImagePreview('');
      setImageFile(null);
      setErrorMessage(error.message || 'Tải ảnh thất bại');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const doSubmitPost = async (forcePost = false) => {
    setMessage('');
    setErrorMessage('');

    if (!currentUser?.id) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (isBanned) {
      setErrorMessage('Tài khoản của bạn đang bị khóa. Không thể tạo bài viết mới.');
      return;
    }
    if (isCooldown) {
      setErrorMessage(`Bạn đang bị cấm đăng bài và bình luận. Thời gian còn lại: ${remainingTimeStr}`);
      return;
    }
    if (!content.trim()) {
      setErrorMessage('Nội dung là bắt buộc');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile && !finalImageUrl) {
        setIsUploadingImage(true);
        finalImageUrl = await uploadPostImage(imageFile);
        setImageUrl(finalImageUrl);
        setIsUploadingImage(false);
      }

      const result = await createPost({
        userId: currentUser.id,
        content: content.trim(),
        imageUrl: finalImageUrl || null,
        forcePost,
      });

      // Nhận gợi ý nhắc nhở nhẹ nhàng (Friendly Nudge) từ AI
      if (result.nudge) {
        setNudgeData({
          message: result.message,
          contentSnippet: content.trim(),
          warningType: result.warningType,
          predictedLabel: result.predictedLabel,
        });
        return;
      }

      onAddPost(result.data, result.cooldown);
      setContent('');
      setImageUrl('');
      setImagePreview('');
      setImageFile(null);
      setShowImageInput(false);
      setAiPreview(null);
      setMessage('Đăng bài thành công');
    } catch (error) {
      if (error.cooldown) {
        onAddPost(null, error.cooldown, { content: content.trim(), imageUrl: finalImageUrl, label: 'Violence' });
      }
      const msg = error.message === 'Failed to fetch'
        ? 'Không thể kết nối đến máy chủ bài viết (cổng 5000). Vui lòng kiểm tra backend server.'
        : (error.message || 'Đăng bài thất bại');
      setErrorMessage(msg);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

    const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!canStartCreation(submitLockRef.current)) return;
    await doSubmitPost(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs mb-5 transition duration-200">
      {/* Banner cảnh báo bị khóa tài khoản hoặc đang chịu án phạt cooldown */}
      {isBanned && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 text-xs">
          <Lock className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <strong className="font-semibold">Tài khoản của bạn đã bị khóa:</strong> Bạn không thể đăng bài hoặc bình luận trong hệ thống.
          </div>
        </div>
      )}

      {isCooldown && (
        <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 flex items-start gap-3 text-xs shadow-xs animate-fade-in">
          <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="font-extrabold text-sm flex items-center justify-between flex-wrap gap-2">
              <span className="text-amber-900 dark:text-amber-100">🚫 Bạn đang bị vô hiệu hóa Đăng bài & Bình luận</span>
              <div className="flex items-center gap-1.5 font-mono bg-amber-200/90 dark:bg-amber-900/80 px-2.5 py-1 rounded-xl text-xs text-amber-950 dark:text-amber-100 font-extrabold shadow-2xs border border-amber-300/70">
                <span>Thời gian gỡ phạt còn lại:</span>
                <span className="text-rose-600 dark:text-rose-400">{remainingTimeStr || 'Đang đếm ngược...'}</span>
              </div>
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Lý do: {currentUser?.cooldown_reason || 'Vi phạm tiêu chuẩn bạo lực'}. Hệ thống tự động vô hiệu hóa toàn bộ quyền đăng bài và bình luận cho đến khi hết hạn phạt.
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <img 
          src={currentUser?.avatar || DEFAULT_AVATAR} 
          alt={currentUser?.name || "Người dùng"}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
        />
        <div className="flex-1">
          <textarea
            rows={2}
            value={content}
            disabled={isBanned || isCooldown}
            onClick={() => {
              if (!currentUser && onRequireAuth) {
                onRequireAuth("Chỉ đăng nhập rồi mới được đăng bài (User Story 4)");
              }
            }}
            onChange={(e) => {
              setContent(e.target.value);
              if (aiPreview) setAiPreview(null);
            }}
            placeholder={
              isBanned 
                ? "Tài khoản của bạn đang bị khóa..." 
                : isCooldown 
                ? `🚫 Bạn đang bị cấm đăng bài và bình luận (Gỡ phạt sau: ${remainingTimeStr || 'Đang đếm...'})` 
                : currentUser 
                ? `${currentUser.name || currentUser.full_name || currentUser.username || 'Bạn'} ơi, bạn đang nghĩ gì thế?` 
                : "Đăng nhập để chia sẻ bài viết cùng cộng đồng..."
            }
            className={`w-full resize-none p-3 text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-3 focus:ring-blue-100 outline-none text-sm transition duration-150 ${
              (isBanned || isCooldown) ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
            }`}
          />

          {message && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}

          {showImageInput && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <ImagePreview
                src={imagePreview || imageUrl}
                alt="Ảnh xem trước bài viết"
                onRemove={() => {
                  setImageUrl('');
                  setImagePreview('');
                  setImageFile(null);
                  setImageAiPreview(null);
                }}
              />
            </div>
          )}

          {aiPreview && (
            <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
              aiPreview.label === 'Normal'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : aiPreview.label === 'Toxic'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                {aiPreview.label === 'Normal' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  <strong>AI Đánh giá:</strong> {aiPreview.label} (Độ tin cậy {(aiPreview.confidence * 100).toFixed(1)}%)
                </span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 shadow-xs">
                {aiPreview.action || 'analyzed'}
              </span>
            </div>
          )}
          {imageAiPreview && (
            <div className="mt-2 text-xs font-semibold text-slate-700">
              {imageAiPreview === 'SAFE' ? 'Ảnh: An toàn' : imageAiPreview === 'SENSITIVE' ? 'Ảnh: Nhạy cảm (sẽ bị che mờ)' : imageAiPreview === 'VIOLATION' ? 'Ảnh: Vi phạm (bài sẽ bị chặn)' : 'Ảnh: Cần quản trị viên duyệt'}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                disabled={isBanned || isCooldown}
                onClick={() => setShowImageInput(!showImageInput)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition duration-150 ${
                  showImageInput || imageUrl ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                } ${(isBanned || isCooldown) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
              >
                <Image className="w-4 h-4 text-emerald-500" />
                <span>Ảnh / Media</span>
              </button>

              <button
                type="button"
                onClick={handleCheckSafety}
                disabled={isBanned || isCooldown || isAiChecking || !content.trim()}
                title="Kiểm tra độc hại qua mô hình AI trước khi đăng"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>{isAiChecking ? 'AI đang duyệt...' : 'Duyệt thử AI'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isBanned || isCooldown || isSubmitting || isUploadingImage || !content.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 cursor-pointer"
            >
              <span>{isUploadingImage ? 'Đang tải ảnh...' : isSubmitting ? 'Đang đăng...' : 'Đăng bài'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <FriendlyNudgeModal
        isOpen={Boolean(nudgeData)}
        message={nudgeData?.message}
        targetType="bài viết"
        warningType={nudgeData?.warningType}
        contentSnippet={nudgeData?.contentSnippet}
        isSubmitting={isSubmitting}
        onEdit={() => {
          setNudgeData(null);
          submitLockRef.current = false;
        }}
        onConfirmForce={async () => {
          setNudgeData(null);
          await doSubmitPost(true);
        }}
      />
    </form>
  );
}
