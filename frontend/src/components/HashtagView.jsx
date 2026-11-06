import { useEffect, useState } from 'react';
import { ArrowLeft, Hash, Loader2 } from 'lucide-react';
import PostCard from './PostCard';
import { fetchHashtagPosts } from '../api/client';

export default function HashtagView({
  tag,
  currentUser,
  allPosts = [],
  onBack,
  ...postProps
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedTag, setLoadedTag] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchHashtagPosts({ userId: currentUser?.id, tag })
      .then((result) => {
        if (mounted) setError('');
        if (mounted) setPosts(Array.isArray(result?.data) ? result.data : []);
        if (mounted) setLoadedTag(tag);
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Không thể tải bài viết theo hashtag.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [currentUser?.id, tag]);

  const displayedPosts = posts.map((post) => (
    Array.isArray(allPosts) ? allPosts.find((item) => String(item.id) === String(post.id)) || post : post
  ));
  const isLoading = loading || loadedTag !== tag;

  return (
    <main className="w-full max-w-[760px] mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-5">
        <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:text-blue-600" aria-label="Quay lại">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="flex items-center gap-1.5 text-lg font-bold text-slate-900"><Hash className="w-5 h-5 text-blue-600" />{tag}</h1>
          <p className="text-xs text-slate-500">Bài viết công khai có hashtag này</p>
        </div>
      </div>
      {isLoading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}
      {!isLoading && error && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {!isLoading && !error && displayedPosts.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">Chưa có bài viết nào với hashtag này.</p>}
      <div className="space-y-4">
        {displayedPosts.map((post) => (
          <PostCard key={post.id} post={post} currentUser={currentUser} allPosts={allPosts} {...postProps} />
        ))}
      </div>
    </main>
  );
}
