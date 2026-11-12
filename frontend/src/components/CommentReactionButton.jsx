import { useEffect, useRef, useState } from 'react';
import {
  REACTIONS,
  applyReactionCounts,
  applyReactionState,
  getSummaryReactions,
  getTotalReactionCount,
  normalizeReactionCounts,
} from '../utils/reactionLogic';

export default function CommentReactionButton({
  initialCounts = {},
  initialMyReaction = null,
  disabled = false,
  canReact = true,
  onRequireAuth,
  onReact,
}) {
  const [myReaction, setMyReaction] = useState(initialMyReaction || null);
  const [counts, setCounts] = useState(() => normalizeReactionCounts(initialCounts));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    setMyReaction(initialMyReaction || null);
  }, [initialMyReaction]);

  useEffect(() => {
    setCounts(normalizeReactionCounts(initialCounts));
  }, [initialCounts]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const openPicker = () => {
    if (disabled) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setPickerOpen(true);
  };

  const closePicker = (delay = 250) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setPickerOpen(false);
      closeTimerRef.current = null;
    }, delay);
  };

  const triggerReaction = async (selectedType = myReaction || 'like') => {
    if (disabled || isBusy) return;
    if (!canReact) {
      onRequireAuth?.();
      return;
    }

    const prevReaction = myReaction;
    const prevCounts = counts;
    const totalCount = getTotalReactionCount(counts);
    const nextState = applyReactionState({
      currentReaction: prevReaction,
      totalCount,
      selectedReaction: selectedType,
    });
    const nextCounts = applyReactionCounts({
      counts: prevCounts,
      previousReaction: prevReaction,
      nextReaction: nextState.myReaction,
    });

    setPickerOpen(false);
    setMyReaction(nextState.myReaction);
    setCounts(nextCounts);

    if (!onReact) return;
    setIsBusy(true);
    try {
      const serverData = await onReact({
        type: nextState.myReaction,
        action: nextState.myReaction ? 'set' : 'remove',
      });
      if (serverData && (serverData.reactionCounts || serverData.counts)) {
        setCounts(normalizeReactionCounts(serverData.reactionCounts || serverData.counts));
        if (serverData.myReaction !== undefined) {
          setMyReaction(serverData.myReaction || null);
        }
      }
    } catch {
      setMyReaction(prevReaction);
      setCounts(prevCounts);
    } finally {
      setIsBusy(false);
    }
  };

  const activeObj = REACTIONS.find((r) => r.id === myReaction);
  const totalReactions = getTotalReactionCount(counts);
  const summary = getSummaryReactions({ counts, myReaction, max: 3 });

  return (
    <div
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={openPicker}
      onMouseLeave={() => closePicker(280)}
    >
      {pickerOpen && (
        <div
          onMouseEnter={openPicker}
          onMouseLeave={() => closePicker(220)}
          className="absolute bottom-full left-0 mb-1.5 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-lg z-40 animate-fade-in"
        >
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => triggerReaction(r.id)}
              title={r.label}
              aria-label={r.label}
              className={`w-6 h-6 flex items-center justify-center rounded-full text-sm transition-transform hover:scale-125 cursor-pointer ${
                myReaction === r.id ? 'bg-blue-50 dark:bg-blue-950/60 ring-1 ring-blue-300' : ''
              }`}
            >
              <span>{r.emoji}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled || isBusy}
        onClick={() => triggerReaction(myReaction || 'like')}
        className={`inline-flex items-center gap-1 font-semibold transition ${
          disabled
            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50'
            : activeObj
            ? `${activeObj.color} cursor-pointer`
            : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
        }`}
      >
        {activeObj ? (
          <>
            <span className="text-xs leading-none">{activeObj.emoji}</span>
            <span>{activeObj.label}</span>
          </>
        ) : (
          <span>Thích</span>
        )}
      </button>

      {totalReactions > 0 && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/70 text-[10px] font-bold text-slate-600 dark:text-slate-300"
          title={summary.map((item) => `${item.emoji} ${item.count}`).join(' · ')}
        >
          <span className="flex items-center -space-x-0.5">
            {summary.map((item) => (
              <span key={item.id} className="text-[11px] leading-none">{item.emoji}</span>
            ))}
          </span>
          <span className="ml-0.5">{totalReactions}</span>
        </span>
      )}
    </div>
  );
}

