import { useState } from 'react';
import { Image, Sparkles, Send, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function CreatePostCard({ currentUser, onAddPost }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);

  // Mẫu ảnh demo cho người dùng bấm chọn nhanh
  const sampleImages = [
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
  ];

  // Kiểm tra an toàn trước khi đăng (kết nối FastAPI hoặc tự phân tích mô phỏng)
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
      // Mô phỏng kiểm duyệt AI nếu chưa bật backend python
      const lower = content.toLowerCase();
      let label = "Normal";
      let confidence = 0.98;

      if (lower.includes("đánh") || lower.includes("đập") || lower.includes("giết") || lower.includes("chém")) {
        label = "Violence";
        confidence = 0.95;
      } else if (lower.includes("ngu") || lower.includes("chó") || lower.includes("rác")) {
        label = "Toxic";
        confidence = 0.91;
      }

      setAiPreview({
        label,
        confidence,
        action: label === "Normal" ? "allow" : "warn",
        latency_ms: 38.5
      });
    } finally {
      setIsAiChecking(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (aiPreview && (aiPreview.label === "Violence" || aiPreview.label === "Hate Speech")) {
      const confirmed = window.confirm(
        `Cảnh báo AI: Nội dung này bị phân loại là "${aiPreview.label}". Bạn có chắc chắn muốn đăng không?`
      );
      if (!confirmed) return;
    }

    const newPost = {
      id: `post-${Date.now()}`,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
        isVerified: currentUser.isVerified
      },
      createdAt: "Vừa xong",
      content: content.trim(),
      image: imageUrl.trim() || null,
      tags: ["share", "social"],
      likesCount: 0,
      isLiked: false,
      sharesCount: 0,
      isSaved: false,
      aiStatus: aiPreview || { label: "Normal", confidence: 0.99 },
      comments: []
    };

    onAddPost(newPost);
    setContent('');
    setImageUrl('');
    setShowImageInput(false);
    setAiPreview(null);
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs mb-5 transition duration-200">
      <div className="flex gap-3">
        <img 
          src={currentUser.avatar} 
          alt={currentUser.name} 
          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
        />
        <div className="flex-1">
          <textarea
            rows={2}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (aiPreview) setAiPreview(null); // Reset preview khi người dùng sửa chữ
            }}
            placeholder={`${currentUser.name} ơi, bạn đang nghĩ gì thế?`}
            className="w-full resize-none p-3 text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-3 focus:ring-blue-100 outline-none text-sm transition duration-150"
          />

          {/* Ô nhập link ảnh hoặc chọn ảnh mẫu */}
          {showImageInput && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Dán đường dẫn ảnh (URL) hoặc chọn ảnh mẫu bên dưới..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-400"
              />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Ảnh mẫu:</span>
                {sampleImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(img)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 underline bg-white px-2 py-0.5 rounded border border-slate-200"
                  >
                    Mẫu {idx + 1}
                  </button>
                ))}
              </div>
              {imageUrl && (
                <div className="relative mt-2 rounded-lg overflow-hidden max-h-48 border border-slate-200">
                  <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover" />
                  <button 
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 text-xs px-2"
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview AI Safety Status */}
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

          {/* Action Toolbar */}
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
              onClick={handleSubmit}
              disabled={!content.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-xs hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
            >
              <span>Đăng bài</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
