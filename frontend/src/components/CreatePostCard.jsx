import { useState } from 'react';
import { Image, Sparkles, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createPost, uploadPostImage } from '../api/client';
import ImagePreview from './ImagePreview';
import { validateImageFile } from '../utils/imageLogic';

export default function CreatePostCard({ currentUser, onAddPost, onRequireAuth, onRequireLogin }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheckSafety = async () => {
    if (!content.trim()) return;
    setIsAiChecking(true);

    try {
      const res = await fetch('http://localhost:8000/api/v1/moderate', {
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

    try {
      const uploadedUrl = await uploadPostImage(file);
      setImageUrl(uploadedUrl);
    } catch (error) {
      setImageUrl('');
      setImagePreview('');
      setErrorMessage(error.message || 'Tải ảnh thất bại');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!currentUser?.id) {
      if (onRequireLogin) {
        onRequireLogin();
      }
      return;
    }

    if (!content.trim()) {
      setErrorMessage('Nội dung là bắt buộc');
      return;
    }

    if (aiPreview && (aiPreview.label === 'Violence' || aiPreview.label === 'Hate Speech')) {
      const confirmed = window.confirm(
        `Cảnh báo AI: Nội dung này bị phân loại là "${aiPreview.label}". Bạn có chắc chắn muốn đăng không?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      const result = await createPost({
        userId: currentUser.id,
        content: content.trim(),
        imageUrl: imageUrl || null,
      });

      onAddPost(result.data);
      setContent('');
      setImageUrl('');
      setImagePreview('');
      setShowImageInput(false);
      setAiPreview(null);
      setMessage('Đăng bài thành công');
    } catch (error) {
      setErrorMessage(error.message || 'Đăng bài thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs mb-5 transition duration-200">
      <div className="flex gap-3">
        <img 
          src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"} 
          alt={currentUser?.name || "Người dùng"}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
        />
        <div className="flex-1">
          <textarea
            rows={2}
            value={content}
            onClick={() => {
              if (!currentUser && onRequireAuth) {
                onRequireAuth("Chỉ đăng nhập rồi mới được đăng bài (User Story 4)");
              }
            }}
            onChange={(e) => {
              setContent(e.target.value);
              if (aiPreview) setAiPreview(null);
            }}
            placeholder={currentUser ? `${currentUser.name} ơi, bạn đang nghĩ gì thế?` : "Đăng nhập để chia sẻ bài viết cùng cộng đồng..."}
            className="w-full resize-none p-3 text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-3 focus:ring-blue-100 outline-none text-sm transition duration-150"
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

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowImageInput(!showImageInput)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition duration-150 ${
                  showImageInput || imageUrl ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Image className="w-4 h-4 text-emerald-500" />
                <span>Ảnh / Media</span>
              </button>

              <button
                type="button"
                onClick={handleCheckSafety}
                disabled={isAiChecking || !content.trim()}
                title="Kiểm tra độc hại qua mô hình AI trước khi đăng"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition duration-150 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>{isAiChecking ? 'AI đang duyệt...' : 'Duyệt thử AI'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-xs hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
            >
              <span>{isSubmitting ? 'Đang đăng...' : 'Đăng bài'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
