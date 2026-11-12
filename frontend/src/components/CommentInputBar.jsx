import { useRef, useEffect } from 'react';
import { Image as ImageIcon, Loader2, Reply, Send, X } from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import CommentEmojiPicker from './CommentEmojiPicker';

export default function CommentInputBar({
  avatar,
  userName = 'Bạn',
  value = '',
  onChange,
  onSubmit,
  disabled = false,
  isSubmitting = false,
  hasContent = false,
  placeholder = 'Viết bình luận công khai...',
  imagePreview = '',
  onSelectImageFile,
  onRemoveImage,
  imageAccept = 'image/*',
  replyingToName = '',
  onCancelReply,
  onInputClick,
  onImageButtonClick,
  inputRef: externalInputRef,
  autoFocus = false,
  compact = false,
  maxLength,
}) {
  const internalInputRef = useRef(null);
  const inputRef = externalInputRef || internalInputRef;
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoFocus, inputRef]);

  const handleInsertEmoji = (emoji) => {
    const nextValue = `${value || ''}${emoji}`;
    onChange?.(nextValue);
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const canSend = !disabled && !isSubmitting && (Boolean(String(value || '').trim()) || hasContent || Boolean(imagePreview));

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {imagePreview && (
        <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="relative group">
            <img
              src={imagePreview}
              alt="Ảnh bình luận"
              className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
            />
            <button
              type="button"
              onClick={onRemoveImage}
              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow hover:bg-rose-600 transition cursor-pointer"
              title="Xóa ảnh"
              aria-label="Xóa ảnh"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Ảnh đính kèm sẽ được đăng cùng bình luận
            </span>
          </div>
        </div>
      )}

      {replyingToName && (
        <div className="flex items-center justify-between px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] text-blue-700 dark:text-blue-300 animate-fade-in">
          <div className="flex items-center gap-1.5 font-medium truncate">
            <Reply className="w-3 h-3 text-blue-600 dark:text-blue-400 rotate-180 shrink-0" />
            <span className="truncate">Đang trả lời <strong>@{replyingToName}</strong></span>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer shrink-0"
              title="Hủy trả lời"
              aria-label="Hủy trả lời"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <img
          src={avatar || DEFAULT_AVATAR}
          alt={userName}
          onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
          className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700`}
        />
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            onClick={onInputClick}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className={`w-full pl-3.5 pr-24 ${compact ? 'py-1.5' : 'py-2'} text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-full focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950 ${
              disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''
            }`}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={imageAccept}
            onChange={onSelectImageFile}
            className="hidden"
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <CommentEmojiPicker
              disabled={disabled}
              onSelectEmoji={handleInsertEmoji}
            />

            {onSelectImageFile && (
              <button
                type="button"
                onClick={() => {
                  if (onImageButtonClick && onImageButtonClick() === false) return;
                  fileInputRef.current?.click();
                }}
                disabled={disabled || isSubmitting}
                title="Đính kèm ảnh vào bình luận"
                aria-label="Đính kèm ảnh vào bình luận"
                className={`p-1 rounded-full transition ${
                  disabled
                    ? 'text-slate-300 opacity-40 cursor-not-allowed pointer-events-none'
                    : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!canSend}
              title="Gửi bình luận"
              aria-label="Gửi bình luận"
              className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-600 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

