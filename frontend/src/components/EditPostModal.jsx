import { useState } from 'react';
import { X, Image as ImageIcon, Save } from 'lucide-react';
import { uploadPostImage } from '../api/client';
import ImagePreview from './ImagePreview';
import { validateImageFile } from '../utils/imageLogic';

export default function EditPostModal({ post, isOpen, onClose, onSave }) {
  const [content, setContent] = useState(post?.content || '');
  const [imageUrl, setImageUrl] = useState(post?.image || '');
  const [imagePreview, setImagePreview] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !post) return null;

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.message);
      event.target.value = '';
      return;
    }

    setErrorMessage('');
    setImagePreview(URL.createObjectURL(file));
    try {
      const uploadedUrl = await uploadPostImage(file);
      setImageUrl(uploadedUrl);
    } catch (error) {
      setImagePreview('');
      setErrorMessage(error.message || 'Tải ảnh thất bại');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!content.trim()) {
      setErrorMessage('Nội dung không được để trống');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await onSave({
        content: content.trim(),
        imageUrl: imageUrl || null,
      });
    } catch (error) {
      setErrorMessage(error.message || 'Cập nhật bài viết thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-6" onMouseDown={onClose}>
      <form
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-base font-bold text-slate-900">Chỉnh sửa bài viết</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={5}
            className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="Nội dung bài viết"
          />

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            <ImageIcon className="h-4 w-4 text-emerald-500" />
            <span>Chọn ảnh khác</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              className="sr-only"
            />
          </label>

          <ImagePreview
            src={imagePreview || imageUrl}
            alt="Ảnh đính kèm bài viết"
            onRemove={() => {
              setImageUrl('');
              setImagePreview('');
            }}
          />

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
