import { useEffect, useState } from 'react';
import { fetchPendingImageModeration, reviewImageModeration } from '../api/client';

export default function ImageModerationQueue({ currentUser }) {
  const [items, setItems] = useState([]);
  const load = async () => {
    const result = await fetchPendingImageModeration(currentUser?.id);
    setItems(result.data || []);
  };
  useEffect(() => { load().catch(() => setItems([])); }, [currentUser?.id]);
  const review = async (item, decision) => {
    await reviewImageModeration({ userId: currentUser?.id, contentType: item.content_type, id: item.id, decision });
    setItems((prev) => prev.filter((entry) => !(entry.content_type === item.content_type && entry.id === item.id)));
  };
  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-800">Duyệt ảnh</h3><button type="button" onClick={() => load()} className="text-xs text-blue-600">Làm mới</button></div>
      {items.length === 0 ? <p className="text-sm text-slate-500">Không có nội dung chờ duyệt.</p> : <div className="grid gap-3 md:grid-cols-2">{items.map((item) => (
        <article key={`${item.content_type}-${item.id}`} className="rounded-xl border bg-white p-3">
          <img src={item.image_url} alt="Nội dung chờ duyệt" className="mb-2 h-40 w-full rounded-lg object-cover" />
          <p className="mb-2 text-sm text-slate-700">{item.content}</p>
          <p className="text-xs text-slate-500">safe {item.safe ?? '-'} · nsfw {item.nsfw ?? '-'} · violence {item.violence ?? '-'}</p>
          <div className="mt-3 flex gap-2"><button type="button" onClick={() => review(item, 'approve')} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Duyệt</button><button type="button" onClick={() => review(item, 'reject')} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Từ chối</button></div>
        </article>
      ))}</div>}
    </section>
  );
}
