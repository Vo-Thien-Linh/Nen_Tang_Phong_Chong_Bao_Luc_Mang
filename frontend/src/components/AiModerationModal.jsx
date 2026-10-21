import { useState, useEffect } from 'react';
import { X, ShieldCheck, Clock, Zap, Sparkles } from 'lucide-react';

export default function AiModerationModal({ isOpen, onClose }) {
  const [comment, setComment] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Đếm ngược thời gian phạt (nếu bị dính Cooldown)
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  if (!isOpen) return null;

  const sampleInputs = [
    "Hôm nay trời đẹp quá, chúc mọi người một ngày làm việc hiệu quả!",
    "Thằng ngu này nói chuyện rác rưởi thật sự, cút đi cho khuất mắt tao.",
    "Hẹn ra cổng trường đập nát mặt mày, bố mày thách thức cả lò nhà mày đấy!"
  ];

  const handleModerate = async () => {
    if (!comment.trim()) return;
    setLoading(true);

    try {
      // Gọi sang API FastAPI (Python)
      const fastApiUrl = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';
      const res = await fetch(`${fastApiUrl}/api/v1/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment })
      });

      if (!res.ok) throw new Error('API Backend chưa bật');
      
      const data = await res.json();
      setResult(data);

      if (data.cooldown_seconds > 0) {
        setCooldown(data.cooldown_seconds);
      }
    } catch {
      // Giả lập kết quả test khi chưa bật server Python
      const lower = comment.toLowerCase();
      let label = "Normal";
      let confidence = 0.985;
      let action = "allow";
      let cd = 0;

      if (lower.includes("đập") || lower.includes("đánh") || lower.includes("giết") || lower.includes("chém")) {
        label = "Violence";
        confidence = 0.962;
        action = "auto_hide_and_alert";
        cd = 30;
      } else if (lower.includes("ngu") || lower.includes("chó") || lower.includes("rác") || lower.includes("cút")) {
        label = "Toxic";
        confidence = 0.924;
        action = "warn_user";
        cd = 15;
      }

      setResult({
        label,
        confidence,
        action,
        cooldown_seconds: cd,
        latency_ms: 42.8,
        isSimulated: true
      });

      if (cd > 0) {
        setCooldown(cd);
      }
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (label) => {
    switch (label) {
      case 'Normal': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Toxic': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Hate Speech': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Violence': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Hệ thống Kiểm duyệt AI (AI Shield Lab)</h2>
              <p className="text-[11px] text-slate-300">FastAPI Backend (http://localhost:8000) & AI Moderation Model</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* Gợi ý mẫu câu test nhanh */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Thử nhanh câu mẫu:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleInputs.map((sample, i) => (
                <button
                  key={i}
                  onClick={() => setComment(sample)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-left truncate max-w-xs transition"
                >
                  Mẫu {i + 1}: "{sample.slice(0, 25)}..."
                </button>
              ))}
            </div>
          </div>

          {/* Ô nhập bình luận */}
          <div>
            <textarea
              rows={3}
              value={comment}
              disabled={cooldown > 0}
              onChange={(e) => setComment(e.target.value)}
              placeholder={cooldown > 0 ? `Tài khoản đang bị tạm khóa. Vui lòng chờ ${cooldown}s...` : "Nhập câu cần phân loại kiểm duyệt nội dung độc hại..."}
              className={`w-full p-3 border rounded-2xl outline-none text-sm transition duration-200 text-slate-800 ${
                cooldown > 0 ? 'bg-rose-50 border-rose-300 cursor-not-allowed' : 'border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
              }`}
            />
          </div>

          {/* Nút gửi kiểm duyệt */}
          <button
            onClick={handleModerate}
            disabled={loading || cooldown > 0 || !comment.trim()}
            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition duration-200 shadow-sm flex items-center justify-center gap-2 ${
              cooldown > 0
                ? 'bg-rose-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300'
            }`}
          >
            {loading ? (
              <>
                <Zap className="w-4 h-4 animate-spin" />
                <span>Mô hình AI đang phân tích dữ liệu...</span>
              </>
            ) : cooldown > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Tạm khóa thao tác ({cooldown}s)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Phân tích kiểm duyệt AI</span>
              </>
            )}
          </button>

          {/* Khung hiển thị kết quả phân loại */}
          {result && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Kết quả suy luận AI
                </span>
                {result.isSimulated && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                    Mô phỏng (FastAPI chưa mở)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-1">Nhãn dự đoán:</span>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border inline-block ${getBadgeColor(result.label)}`}>
                    {result.label}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-1">Độ tin cậy:</span>
                  <span className="text-sm font-bold text-slate-800">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-1">Hành động:</span>
                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-indigo-700 font-mono font-bold">
                    {result.action}
                  </code>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-1">Độ trễ (Latency):</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {result.latency_ms} ms
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
