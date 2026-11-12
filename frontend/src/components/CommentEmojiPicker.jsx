import { useState, useEffect, useRef } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'faces',
    label: 'Biểu cảm',
    emojis: ['😀', '😄', '😁', '😂', '🤣', '😊', '🥰', '😍', '🤩', '😘', '😎', '🥳', '🤔', '😮', '😢', '😡'],
  },
  {
    id: 'gestures',
    label: 'Cử chỉ & Tim',
    emojis: ['👍', '👏', '🙌', '🤝', '✌️', '👌', '💪', '🙏', '❤️', '🧡', '💙', '💖', '💯', '🔥', '✨', '🎉'],
  },
  {
    id: 'icons',
    label: 'Biểu tượng',
    emojis: ['🌟', '🚀', '💡', '📌', '💬', '👀', '☕', '🍕', '🎵', '🌸', '☀️', '🌈'],
  },
];

export default function CommentEmojiPicker({
  onSelectEmoji,
  disabled = false,
  buttonTitle = 'Chèn emoji / biểu tượng',
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('faces');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const currentGroup = EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory) || EMOJI_CATEGORIES[0];

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        title={buttonTitle}
        aria-label={buttonTitle}
        className={`p-1 rounded-full transition ${
          disabled
            ? 'text-slate-300 opacity-40 cursor-not-allowed'
            : open
            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-500 cursor-pointer'
            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-700 cursor-pointer'
        }`}
      >
        <Smile className="w-4 h-4" />
      </button>

      {open && !disabled && (
        <div className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2.5 z-50 animate-fade-in">
          <div className="flex items-center gap-1 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {currentGroup.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectEmoji?.(emoji);
                  setOpen(false);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

