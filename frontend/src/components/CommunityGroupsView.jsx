import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BookOpen, Check, CheckCircle2, Clock3, Globe2, ImagePlus,
  LockKeyhole, MessageCircle, Plus, Search, Send, ShieldCheck, Sparkles, UsersRound, X,
} from 'lucide-react';
import {
  createCommunityGroup,
  createCommunityGroupPost,
  createCommunityGroupPostAppeal,
  fetchCommunityGroup,
  fetchCommunityGroupAppeals,
  fetchCommunityGroupMemberRequests,
  fetchCommunityGroupMembers,
  fetchCommunityGroupPosts,
  fetchCommunityGroupReports,
  fetchCommunityGroupReviewQueue,
  fetchCommunityGroups,
  joinCommunityGroup,
  leaveCommunityGroup,
  reviewCommunityGroupAppeal,
  reviewCommunityGroupMember,
  reviewCommunityGroupPost,
  reviewCommunityGroupReport,
  updateCommunityGroupMemberRole,
  updateCommunityGroupPostApprovalMode,
  previewPostImage,
  uploadCommunityGroupPostImage,
  cleanupCommunityGroupPostImage,
} from '../api/client';
import { validateImageFile } from '../utils/imageLogic';
import { getHashtagHighlightParts } from '../utils/hashtagHighlight';
import { getGroupModerationSourceLabel, selectGroupModerationPreview } from '../utils/groupModerationPreview';
import AppealModal from './AppealModal';
import HashtagText from './HashtagText';
import ImagePreview from './ImagePreview';
import GroupPostCard from './GroupPostCard';

const initialGroupForm = { name: '', description: '', rules: '', privacy: 'public', isDiscoverable: true, postApprovalMode: 'manual' };

function displayDate(value) {
  if (!value) return 'Vừa xong';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function roleLabel(role) {
  return ({ owner: 'Chủ nhóm', admin: 'Quản trị viên', moderator: 'Điều phối viên', member: 'Thành viên' })[role] || 'Thành viên';
}

function aiLabel(label) {
  return ({ Normal: 'Có vẻ an toàn', 'No text': 'Không có văn bản', Toxic: 'Có thể xúc phạm', 'Hate Speech': 'Có thể thù ghét', Violence: 'Có thể bạo lực' })[label] || 'Cần xem xét';
}

function imageLabel(label) {
  return ({ SAFE: 'Ảnh có vẻ an toàn', SENSITIVE: 'Ảnh nhạy cảm', PENDING_REVIEW: 'Ảnh cần xem xét', VIOLATION: 'Ảnh vi phạm', safe: 'Ảnh có vẻ an toàn', sensitive: 'Ảnh nhạy cảm', pending_review: 'Ảnh cần xem xét', rejected: 'Ảnh vi phạm' })[label] || 'Ảnh chưa xác định';
}

function ModerationBadges({ post, className = 'mt-3' }) {
  const moderation = selectGroupModerationPreview(
    { label: post.aiLabel, confidence: post.aiConfidence, source: post.aiSource },
    post.imageModeration,
  );
  if (!moderation || moderation.severity === 0) return null;

  const rawLabel = moderation.type === 'image'
    ? moderation.confidenceLabel || imageLabel(moderation.label)
    : aiLabel(moderation.label);
  const label = moderation.type === 'image' ? rawLabel.replace(/^Ảnh /, '') : rawLabel;
  const resultLabel = `${moderation.type === 'image' ? 'Ảnh' : 'Văn bản'} · ${label}`;
  const severityClass = moderation.severity >= 3
    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  const confidence = moderation.confidence == null ? '' : ` · ${Math.round(moderation.confidence * 100)}%`;
  return (
    <div className={className} aria-label="Kết quả kiểm duyệt AI">
      <span aria-label={`${resultLabel}${confidence}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${severityClass}`}>
        {moderation.type === 'image' ? <ImagePlus size={12} /> : <Sparkles size={12} />}
        {resultLabel}{confidence}
      </span>
    </div>
  );
}

function GroupCard({ group, onOpen, onJoin, isJoining }) {
  const isPrivate = group.privacy === 'private';
  const isMember = group.membershipStatus === 'active';
  const isPending = group.membershipStatus === 'pending';
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <button onClick={() => onOpen(group.id)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {isPrivate ? <LockKeyhole size={21} /> : <UsersRound size={22} />}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isPrivate ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
            {isPrivate ? <LockKeyhole size={12} /> : <Globe2 size={12} />}
            {isPrivate ? 'Riêng tư' : 'Công khai'}
          </span>
        </div>
        <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white">{group.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-300">
          {group.description || 'Chưa có mô tả cho nhóm này.'}
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <UsersRound size={14} />
          <span>{Number(group.memberCount || 0).toLocaleString('vi-VN')} thành viên</span>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button onClick={() => onOpen(group.id)} className="text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300">
          Xem nhóm
        </button>
        {!isMember && !isPending && (
          <button onClick={() => onJoin(group)} disabled={isJoining} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {isJoining ? 'Đang gửi…' : isPrivate ? 'Xin tham gia' : 'Tham gia'}
          </button>
        )}
        {isPending && <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Đang chờ duyệt</span>}
        {isMember && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Đã tham gia</span>}
      </div>
    </article>
  );
}

function CreateGroupDialog({ onClose, onCreate, busy }) {
  const [form, setForm] = useState(initialGroupForm);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    try {
      await onCreate(form);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tạo nhóm.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Không gian cộng đồng</p>
            <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Tạo nhóm mới</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={19} /></button>
        </div>
        <div className="space-y-4 p-6">
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tên nhóm
            <input autoFocus maxLength={100} required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ví dụ: Cộng đồng yêu sách" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" />
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Mô tả
            <textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Nhóm dành cho ai, cùng trao đổi điều gì?" className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" />
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Quy tắc nhóm
            <textarea maxLength={3000} rows={3} value={form.rules} onChange={(event) => update('rules', event.target.value)} placeholder="Nêu các quy tắc ứng xử và nội dung được phép đăng." className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Quyền riêng tư</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { value: 'public', title: 'Công khai', detail: 'Mọi người xem được bài viết và có thể tham gia.', Icon: Globe2 },
                { value: 'private', title: 'Riêng tư', detail: 'Bài viết chỉ dành cho thành viên được duyệt.', Icon: LockKeyhole },
              ].map(({ value, title, detail, Icon }) => (
                <button key={value} type="button" onClick={() => update('privacy', value)} className={`rounded-2xl border p-3 text-left transition ${form.privacy === value ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-950' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><Icon size={16} />{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Duyệt bài viết thành viên</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { value: 'manual', title: 'Quản trị viên duyệt', detail: 'Mọi bài viết chờ quản trị viên hoặc điều phối viên quyết định.' },
                { value: 'automatic', title: 'AI tự động duyệt bài an toàn', detail: 'Chỉ bài AI đánh giá an toàn với độ tin cậy từ 90% mới được đăng ngay; các bài khác chờ quản trị viên.' },
              ].map(({ value, title, detail }) => (
                <button key={value} type="button" onClick={() => update('postApprovalMode', value)} aria-pressed={form.postApprovalMode === value} className={`rounded-2xl border p-3 text-left transition ${form.postApprovalMode === value ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-950' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {form.privacy === 'private' && (
            <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.isDiscoverable} onChange={(event) => update('isDiscoverable', event.target.checked)} className="mt-0.5 accent-blue-600" />
              Nhóm có thể được tìm thấy trong danh sách khám phá.
            </label>
          )}
          <div className="rounded-xl bg-blue-50 px-3.5 py-3 text-xs leading-5 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
            {form.postApprovalMode === 'manual' ? 'Bài đăng mới chờ quản trị viên duyệt. AI chỉ đưa ra gợi ý, không tự quyết định.' : 'AI chỉ tự duyệt nội dung an toàn có độ tin cậy từ 90%. Nội dung đáng ngờ hoặc khi AI gặp lỗi sẽ chờ quản trị viên.'}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
          <button disabled={busy} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{busy ? 'Đang tạo…' : 'Tạo nhóm'}</button>
        </div>
      </form>
    </div>
  );
}

function GroupPost({ post, ownPost, onAppeal }) {
  const pending = post.status === 'pending';
  const rejected = post.status === 'rejected';
  const blurImage = ['sensitive', 'pending_review', 'rejected'].includes(post.imageModeration?.decision);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">{(post.authorName || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{post.authorName || 'Thành viên'}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{displayDate(post.createdAt)}</p>
          </div>
        </div>
        {pending && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"><Clock3 size={12} />{ownPost ? 'Chờ duyệt' : 'Đang chờ'}</span>}
        {rejected && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Không được duyệt</span>}
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-100">
        <HashtagText text={post.content} />
      </p>
      {post.imageUrl && <img src={post.imageUrl} alt="Ảnh trong bài viết nhóm" loading="lazy" className={`mt-3 max-h-[28rem] w-full rounded-xl object-contain ${blurImage ? 'blur-md' : ''}`} />}
      <ModerationBadges post={post} />
      {rejected && post.reviewNote && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">Lý do: {post.reviewNote}</p>}
      {rejected && ownPost && onAppeal && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onAppeal(post)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            Khiếu nại quyết định này
          </button>
        </div>
      )}
    </article>
  );
}

export default function CommunityGroupsView({ currentUser, onRequireAuth, onOpenProfile, initialGroupRequest, onInitialGroupOpened }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [groupReports, setGroupReports] = useState([]);
  const [groupAppeals, setGroupAppeals] = useState([]);
  const [appealTargetPost, setAppealTargetPost] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberRequests, setMemberRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [activePanel, setActivePanel] = useState('posts');
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [imageAiPreview, setImageAiPreview] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingPostScrollId, setPendingPostScrollId] = useState('');
  const [busy, setBusy] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const postHashtagHighlightRef = useRef(null);
  const handledGroupRequestRef = useRef(null);

  useEffect(() => {
    if (!postImage) {
      setPostImagePreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(postImage);
    setPostImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [postImage]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchCommunityGroups({ search });
      setGroups(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Không tải được danh sách nhóm.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const loadGroup = useCallback(async (groupId, postId = '') => {
    const normalizedGroupId = String(groupId ?? '').trim();
    if (!/^[1-9]\d*$/.test(normalizedGroupId)) {
      setError('Mã nhóm không hợp lệ. Vui lòng tải lại danh sách nhóm.');
      return;
    }
    setDetailLoading(true);
    setError('');
    try {
      const [groupResponse, postsResult, membersResult] = await Promise.all([
        fetchCommunityGroup(normalizedGroupId),
        fetchCommunityGroupPosts(normalizedGroupId).then((result) => ({ status: 'fulfilled', value: result })).catch((reason) => ({ status: 'rejected', reason })),
        fetchCommunityGroupMembers(normalizedGroupId).then((result) => ({ status: 'fulfilled', value: result })).catch((reason) => ({ status: 'rejected', reason })),
      ]);
      const group = groupResponse.data;
      setSelectedGroup(group);
      setPostComposerOpen(false);
      if (postsResult.status === 'fulfilled' && Array.isArray(postsResult.value.data)) {
        setPosts(postsResult.value.data);
      } else {
        setPosts([]);
        setError(postsResult.reason?.message || 'Không tải được bài viết của nhóm. Vui lòng thử lại.');
      }
      setPendingPostScrollId(postId);
      setMembers(membersResult.status === 'fulfilled' && Array.isArray(membersResult.value.data) ? membersResult.value.data : []);
      setActivePanel('posts');
      setNotice('');
      if (['owner', 'admin', 'moderator'].includes(group.currentRole)) {
        const [queueResponse, reportsResponse, appealsResponse] = await Promise.all([
          fetchCommunityGroupReviewQueue(normalizedGroupId),
          fetchCommunityGroupReports(normalizedGroupId).catch(() => ({ data: [] })),
          fetchCommunityGroupAppeals(normalizedGroupId).catch(() => ({ data: [] })),
        ]);
        setReviewQueue(Array.isArray(queueResponse.data) ? queueResponse.data : []);
        setGroupReports(Array.isArray(reportsResponse.data) ? reportsResponse.data : []);
        setGroupAppeals(Array.isArray(appealsResponse.data) ? appealsResponse.data : []);
      } else {
        setReviewQueue([]);
        setGroupReports([]);
        setGroupAppeals([]);
      }
      if (['owner', 'admin'].includes(group.currentRole)) {
        const requestsResponse = await fetchCommunityGroupMemberRequests(normalizedGroupId);
        setMemberRequests(Array.isArray(requestsResponse.data) ? requestsResponse.data : []);
      } else {
        setMemberRequests([]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Không thể mở nhóm.');
      setSelectedGroup(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pendingPostScrollId || detailLoading || !selectedGroup) return;
    const target = document.getElementById(`group-post-${pendingPostScrollId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setPendingPostScrollId('');
  }, [detailLoading, pendingPostScrollId, posts, selectedGroup]);

  useEffect(() => {
    const request = initialGroupRequest;
    if (!request?.groupId || handledGroupRequestRef.current === request.requestId) return;
    handledGroupRequestRef.current = request.requestId;
    loadGroup(request.groupId, request.postId);
    onInitialGroupOpened?.(request.requestId);
  }, [initialGroupRequest, loadGroup, onInitialGroupOpened]);

  useEffect(() => {
    if (!selectedGroup?.id) return undefined;
    const handleGroupRealtime = (event) => {
      const payload = event.detail;
      if (!payload || String(payload.groupId) !== String(selectedGroup.id)) return;
      if (payload.type === 'GROUP_POST_CREATED' && payload.post) {
        setPosts((prev) => (prev.some((item) => String(item.id) === String(payload.post.id)) ? prev : [payload.post, ...prev]));
      } else if (payload.type === 'GROUP_POST_UPDATED' && payload.post) {
        setPosts((prev) => {
          const exists = prev.some((item) => String(item.id) === String(payload.post.id));
          if (!exists) return payload.post.status === 'approved' ? [payload.post, ...prev] : prev;
          return prev.map((item) => (String(item.id) === String(payload.post.id) ? { ...item, ...payload.post } : item));
        });
      } else if (payload.type === 'GROUP_POST_DELETED' && payload.postId) {
        setPosts((prev) => prev.filter((item) => String(item.id) !== String(payload.postId)));
      }
    };
    window.addEventListener('nexussocial:group-realtime', handleGroupRealtime);
    return () => window.removeEventListener('nexussocial:group-realtime', handleGroupRealtime);
  }, [selectedGroup?.id]);

  const handleOpenGroup = (groupId) => { loadGroup(groupId); };

  const handleCreateGroup = async (form) => {
    if (!currentUser) {
      onRequireAuth?.('Vui lòng đăng nhập để tạo nhóm.');
      throw new Error('');
    }
    setBusy(true);
    try {
      const response = await createCommunityGroup(form);
      setCreateOpen(false);
      await loadGroups();
      await loadGroup(response.data.id);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (group) => {
    if (!currentUser) {
      onRequireAuth?.('Vui lòng đăng nhập để tham gia nhóm.');
      return;
    }
    setJoiningId(group.id);
    try {
      await joinCommunityGroup(group.id);
      await loadGroups();
      await loadGroup(group.id);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tham gia nhóm.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async () => {
    if (!selectedGroup) return;
    setBusy(true);
    try {
      await leaveCommunityGroup(selectedGroup.id);
      setSelectedGroup(null);
      await loadGroups();
    } catch (requestError) {
      setError(requestError.message || 'Không thể rời nhóm.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();
    if (!selectedGroup || busy || isPostRestricted || isUploadingImage || (!postContent.trim() && !postImage)) return;
    setBusy(true);
    setError('');
    let uploadedImageForCleanup = null;
    try {
      let imageUrl = null;
      let imageCleanupToken = null;
      if (postImage) {
        setIsAiChecking(true);
        let imageCheck;
        try {
          imageCheck = await previewPostImage(postImage, currentUser?.id);
        } catch {
          throw new Error('Không thể kiểm duyệt ảnh trước khi tải lên; vui lòng thử lại.');
        } finally {
          setIsAiChecking(false);
        }
        const imageDecision = imageCheck?.category || 'PENDING_REVIEW';
        setImageAiPreview(imageDecision);
        if (imageCheck?.failed || !imageCheck?.category) {
          throw new Error('Chưa thể kiểm duyệt ảnh; ảnh chưa được tải lên Cloudinary.');
        }

        setIsUploadingImage(true);
        try {
          const uploadedImage = await uploadCommunityGroupPostImage(postImage);
          imageUrl = uploadedImage.url;
          imageCleanupToken = uploadedImage.cleanupToken;
          uploadedImageForCleanup = uploadedImage;
        } finally {
          setIsUploadingImage(false);
        }
      }
      const response = await createCommunityGroupPost({ groupId: selectedGroup.id, content: postContent, imageUrl, imageCleanupToken });
      uploadedImageForCleanup = null;
      const post = response?.data;
      const trustPenalty = Number(post?.authorTrustPenalty || 0);
      setPostContent('');
      setPostImage(null);
      setAiPreview(null);
      setImageAiPreview(null);
      setPostComposerOpen(false);
      const confirmation = post?.status === 'pending'
        ? 'Bài viết đang chờ người quản lý nhóm xem xét.'
        : post?.status === 'rejected'
          ? `AI đã từ chối bài viết${trustPenalty ? `; điểm uy tín người đăng bị trừ ${trustPenalty} điểm` : ''}.`
          : `Bài viết đã được đăng${trustPenalty ? `; điểm uy tín người đăng bị trừ ${trustPenalty} điểm` : ''}.`;
      await loadGroup(selectedGroup.id);
      setNotice(confirmation);
    } catch (requestError) {
      let cleanupFailed = false;
      if (uploadedImageForCleanup?.cleanupToken) {
        try {
          await cleanupCommunityGroupPostImage({ imageUrl: uploadedImageForCleanup.url, cleanupToken: uploadedImageForCleanup.cleanupToken });
        } catch {
          cleanupFailed = true;
        }
      }
      setError(`${requestError.message || 'Không thể gửi bài viết.'}${cleanupFailed ? ' Không xác nhận được việc dọn ảnh Cloudinary; hãy thử lại.' : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReviewPost = async (postId, decision) => {
    if (!selectedGroup) return;
    setBusy(true);
    try {
      const response = await reviewCommunityGroupPost({ groupId: selectedGroup.id, postId, decision });
      const result = response?.data;
      const authorPenalty = Number(result?.authorTrustPenalty || 0);
      const moderatorPenalty = Number(result?.moderatorTrustPenalty || 0);
      const groupName = selectedGroup.name;
      await loadGroup(selectedGroup.id);
      setNotice(moderatorPenalty
        ? `Đã duyệt và đăng bài trong nhóm ${groupName}; người đăng và điểm kiểm duyệt riêng của bạn đều bị trừ ${moderatorPenalty} điểm.`
        : authorPenalty
          ? `Đã ${decision === 'approved' ? `duyệt và đăng bài trong nhóm ${groupName}` : `từ chối bài trong nhóm ${groupName}`} có vi phạm; người đăng bị trừ ${authorPenalty} điểm. Điểm kiểm duyệt của bạn không bị trừ.`
          : decision === 'approved' ? `Đã duyệt và đăng bài trong nhóm ${groupName}.` : `Đã từ chối bài viết trong nhóm ${groupName}.`);
    } catch (requestError) {
      setError(requestError.message || 'Không thể xử lý bài viết.');
    } finally {
      setBusy(false);
    }
  };

  const handleReviewGroupReport = async (reportId, decision) => {
    if (!selectedGroup) return;
    setBusy(true);
    setError('');
    try {
      const response = await reviewCommunityGroupReport({ groupId: selectedGroup.id, reportId, decision });
      const penalty = Number(response?.data?.authorTrustPenalty || 0);
      await loadGroup(selectedGroup.id);
      setNotice(decision === 'resolved_violation'
        ? `Đã xác nhận vi phạm và gỡ nội dung${penalty ? ` (trừ ${penalty} điểm uy tín tác giả)` : ''}.`
        : 'Đã bỏ qua báo cáo.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể xử lý báo cáo.');
    } finally {
      setBusy(false);
    }
  };

  const handleReviewGroupAppeal = async (appealId, decision) => {
    if (!selectedGroup) return;
    setBusy(true);
    setError('');
    try {
      await reviewCommunityGroupAppeal({ groupId: selectedGroup.id, appealId, decision });
      await loadGroup(selectedGroup.id);
      setNotice(decision === 'approved' ? 'Đã chấp nhận kháng cáo và khôi phục bài viết.' : 'Đã từ chối đơn kháng cáo.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể xử lý kháng cáo.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitRejectedPostAppeal = async (appealData) => {
    if (!selectedGroup || !appealTargetPost) return;
    try {
      await createCommunityGroupPostAppeal({
        groupId: selectedGroup.id,
        postId: appealTargetPost.id,
        appealReason: appealData.appealReason,
      });
      setNotice('Đã gửi đơn kháng cáo tới quản trị viên nhóm.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi kháng cáo.');
    }
  };

  const handleReviewMember = async (userId, decision) => {
    if (!selectedGroup) return;
    setBusy(true);
    try {
      await reviewCommunityGroupMember({ groupId: selectedGroup.id, userId, decision });
      await loadGroup(selectedGroup.id);
      setNotice(decision === 'active' ? 'Đã duyệt yêu cầu tham gia.' : 'Đã từ chối yêu cầu tham gia.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể xử lý yêu cầu thành viên.');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    if (!selectedGroup) return;
    try {
      await updateCommunityGroupMemberRole({ groupId: selectedGroup.id, userId, role });
      await loadGroup(selectedGroup.id);
      setNotice('Đã cập nhật vai trò thành viên.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể đổi vai trò.');
    }
  };

  const handleApprovalModeChange = async (postApprovalMode) => {
    if (!selectedGroup || !isAdmin) return;
    setBusy(true);
    setError('');
    try {
      const response = await updateCommunityGroupPostApprovalMode({ groupId: selectedGroup.id, postApprovalMode });
      setSelectedGroup((group) => ({ ...group, ...response.data }));
      setNotice(postApprovalMode === 'automatic' ? 'Đã bật tự động duyệt bài an toàn.' : 'Đã chuyển sang chờ quản trị viên duyệt bài.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể đổi chế độ duyệt bài.');
    } finally {
      setBusy(false);
    }
  };

  const handlePostImageChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setError('');
    setPostImage(file);
    setImageAiPreview(null);
  };

  const handleCheckPostSafety = async () => {
    if (!postContent.trim() && !postImage) return;
    setIsAiChecking(true);
    setError('');
    setAiPreview(null);
    setImageAiPreview(null);

    if (postContent.trim()) {
      try {
        const apiUrl = import.meta.env.VITE_FASTAPI_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/v1/moderate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: postContent }),
        });
        if (!response.ok) throw new Error('Không thể kết nối dịch vụ kiểm duyệt văn bản.');
        setAiPreview(await response.json());
      } catch (requestError) {
        setAiPreview({ error: requestError.message || 'Không thể kiểm tra văn bản lúc này.' });
      }
    }

    if (postImage) {
      try {
        const result = await previewPostImage(postImage, currentUser?.id);
        setImageAiPreview(result);
      } catch {
        setImageAiPreview({ category: 'PENDING_REVIEW', failed: true, source: 'unavailable' });
      }
    }
    setIsAiChecking(false);
  };

  const syncPostHashtagHighlightScroll = (event) => {
    if (!postHashtagHighlightRef.current) return;
    postHashtagHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
    postHashtagHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  const isReviewer = ['owner', 'admin', 'moderator'].includes(selectedGroup?.currentRole);
  const isAdmin = ['owner', 'admin'].includes(selectedGroup?.currentRole);
  const cooldownValue = currentUser?.cooldown_until || currentUser?.cooldownUntil;
  const cooldownDate = cooldownValue ? new Date(cooldownValue) : null;
  const isPostRestricted = currentUser?.status === 'banned'
    || (currentUser?.status === 'cooldown' && (!cooldownDate || cooldownDate > new Date()));
  const visibleGroups = useMemo(() => groups, [groups]);
  const moderationPreview = selectGroupModerationPreview(aiPreview, imageAiPreview);

  if (detailLoading && !selectedGroup) {
    return <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-10 text-center text-sm text-slate-500">Đang mở nhóm…</main>;
  }

  if (selectedGroup) {
    const isMember = selectedGroup.membershipStatus === 'active';
    const isPendingMember = selectedGroup.membershipStatus === 'pending';
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <button onClick={() => { setSelectedGroup(null); setError(''); loadGroups(); }} className="mb-5 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"><ArrowLeft size={17} />Tất cả nhóm</button>
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</div>}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative border-b border-slate-100 bg-[linear-gradient(115deg,#eaf2ff_0%,#f6f8fc_55%,#e9f4f1_100%)] px-5 py-7 sm:px-8 sm:py-9 dark:border-slate-800 dark:bg-[linear-gradient(115deg,#17243a_0%,#111827_55%,#102b2b_100%)]">
            <div className="absolute right-6 top-5 hidden h-20 w-20 rounded-full border-[14px] border-white/30 sm:block" />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div className="max-w-2xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:bg-slate-900/60 dark:text-blue-200">Cộng đồng</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">{selectedGroup.privacy === 'private' ? <LockKeyhole size={12} /> : <Globe2 size={12} />}{selectedGroup.privacy === 'private' ? 'Riêng tư' : 'Công khai'}</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">{selectedGroup.name}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedGroup.description || 'Không gian trao đổi của các thành viên.'}</p>
                <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><UsersRound size={15} />{Number(selectedGroup.memberCount || 0).toLocaleString('vi-VN')} thành viên{selectedGroup.currentRole ? ` · ${roleLabel(selectedGroup.currentRole)}` : ''}</p>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{selectedGroup.postApprovalMode === 'automatic' ? 'Bài thành viên an toàn được AI tự duyệt; bài cần xem xét sẽ chờ quản trị viên. Bài của quản trị viên đăng thẳng.' : 'Bài thành viên chờ quản trị viên duyệt; bài của quản trị viên đăng thẳng.'}</p>
                {isReviewer && selectedGroup.moderationScore != null && <p className="mt-2 text-xs font-semibold text-blue-800 dark:text-blue-200">Uy tín kiểm duyệt riêng trong nhóm: {selectedGroup.moderationScore}/100</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Chế độ duyệt<select aria-label="Chế độ duyệt bài viết" value={selectedGroup.postApprovalMode || 'manual'} onChange={(event) => handleApprovalModeChange(event.target.value)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="manual">Duyệt thủ công</option><option value="automatic">Tự động an toàn</option></select></label>}
                {!isMember && !isPendingMember && <button onClick={() => handleJoin(selectedGroup)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">{selectedGroup.privacy === 'private' ? 'Xin tham gia' : 'Tham gia nhóm'}</button>}
                {isPendingMember && <span className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Đang chờ duyệt thành viên</span>}
                {isMember && selectedGroup.currentRole !== 'owner' && <button onClick={handleLeave} disabled={busy} className="rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Rời nhóm</button>}
              </div>
            </div>
          </div>

          <div className="grid min-h-[60vh] lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 p-4 sm:p-6">
              {isMember && (
                <>
                <div className="mb-4 flex justify-end">
                  <button type="button" aria-expanded={postComposerOpen} aria-controls="community-group-post-composer" onClick={() => setPostComposerOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-300">
                    {postComposerOpen ? <X size={15} /> : <Plus size={15} />}
                    {postComposerOpen ? 'Đóng khung viết bài' : 'Thêm bài viết'}
                  </button>
                </div>
                <form id="community-group-post-composer" hidden={!postComposerOpen} onSubmit={handleCreatePost} className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                  <label htmlFor="community-group-post" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200"><MessageCircle size={15} />Chia sẻ với nhóm</label>
                  {isPostRestricted && <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Tài khoản hiện đang bị hạn chế đăng bài.</p>}
                  <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-950">
                    <div ref={postHashtagHighlightRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent px-3.5 py-3 text-sm leading-6 text-slate-800 dark:text-slate-100">
                      {getHashtagHighlightParts(postContent).map((part, index) => part.type === 'hashtag' ? (
                        <span key={`${part.tag}-${index}`} className={part.className}>{part.value}</span>
                      ) : <span key={`text-${index}`}>{part.value}</span>)}
                    </div>
                    <textarea
                      id="community-group-post"
                      value={postContent}
                      onChange={(event) => { setPostContent(event.target.value); setAiPreview(null); }}
                      onScroll={syncPostHashtagHighlightScroll}
                      maxLength={10000}
                      rows={4}
                      disabled={isPostRestricted}
                      placeholder={isAdmin ? 'Bài của quản trị viên đăng thẳng; AI vẫn kiểm tra nội dung.' : selectedGroup.postApprovalMode === 'automatic' ? 'Viết điều bạn muốn chia sẻ. Thêm #hashtag để mọi người dễ tìm.' : 'Viết điều bạn muốn chia sẻ. Bài viết cần được người quản lý nhóm duyệt.'}
                      className="relative block w-full resize-y rounded-xl border border-blue-100 bg-transparent px-3.5 py-3 text-sm leading-6 text-transparent caret-slate-800 placeholder-slate-400 selection:bg-blue-200 selection:text-transparent outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:caret-slate-100 dark:focus:ring-blue-950"
                    />
                  </div>
                  <div className="mt-1 text-right text-[11px] text-slate-500 dark:text-slate-400">{postContent.length.toLocaleString('vi-VN')}/10.000 ký tự</div>
                  {postImage && <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{postImage.name}{isUploadingImage ? ' · Đang tải lên…' : ''}</p>
                    <ImagePreview src={postImagePreview} alt="Ảnh xem trước bài viết nhóm" onRemove={() => { setPostImage(null); setImageAiPreview(null); }} />
                  </div>}
                  {moderationPreview ? <div role="status" className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${moderationPreview.severity === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'}`}>
                    {moderationPreview.severity === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    AI ưu tiên: <strong>{moderationPreview.type === 'image' ? imageLabel(moderationPreview.label) : aiLabel(moderationPreview.label)}</strong>{moderationPreview.confidence != null && ` · Độ tin cậy${moderationPreview.confidenceLabel ? ` (${moderationPreview.confidenceLabel})` : ''}: ${Math.round(moderationPreview.confidence * 100)}%`}{getGroupModerationSourceLabel(moderationPreview.source) && ` · ${getGroupModerationSourceLabel(moderationPreview.source)}`}
                  </div> : (aiPreview?.error || imageAiPreview?.failed) && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{aiPreview?.error || 'Không thể kiểm tra ảnh lúc này.'}</p>}
                  {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800">
                      <ImagePlus size={15} />{isUploadingImage ? 'Đang tải ảnh…' : 'Ảnh / Media'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={busy || isUploadingImage || isPostRestricted} onChange={handlePostImageChange} />
                    </label>
                    <button type="button" onClick={handleCheckPostSafety} disabled={isPostRestricted || busy || isAiChecking || (!postContent.trim() && !postImage)} title="Xem trước gợi ý kiểm duyệt AI" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-200 dark:hover:bg-blue-900/50">
                      <Sparkles size={15} />{isAiChecking ? 'AI đang kiểm tra…' : 'Duyệt thử AI'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-3 dark:border-blue-900/60">
                    <p className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><Sparkles size={14} className="text-blue-600" />{isAdmin ? 'Bài của bạn đăng thẳng; AI vẫn kiểm tra.' : selectedGroup.postApprovalMode === 'automatic' ? 'AI tự duyệt bài an toàn; người quản lý nhóm xem xét phần còn lại.' : 'AI chỉ gợi ý; người quản lý nhóm quyết định.'}</p>
                    <button disabled={busy || isUploadingImage || isPostRestricted || (!postContent.trim() && !postImage)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Send size={15} />{isUploadingImage ? 'Đang tải ảnh…' : isAiChecking ? 'Đang kiểm duyệt ảnh…' : busy ? 'Đang gửi…' : isAdmin ? 'Đăng thẳng' : selectedGroup.postApprovalMode === 'automatic' ? 'Đăng bài' : 'Gửi chờ duyệt'}</button>
                  </div>
                </form>
                </>
              )}

              {isReviewer && (
                <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <button onClick={() => setActivePanel('posts')} className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${activePanel === 'posts' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>Bài viết</button>
                  <button onClick={() => setActivePanel('review')} className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${activePanel === 'review' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>Chờ duyệt <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px]">{reviewQueue.length + groupReports.filter((r) => r.status === 'pending').length + groupAppeals.filter((a) => a.status === 'pending').length}</span></button>
                  {isAdmin && <button onClick={() => setActivePanel('requests')} className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${activePanel === 'requests' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>Xin tham gia <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px]">{memberRequests.length}</span></button>}
                  <button onClick={() => setActivePanel('members')} className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${activePanel === 'members' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>Thành viên</button>
                </div>
              )}

              {activePanel === 'review' && isReviewer ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"><ShieldCheck className="mr-2 inline" size={16} />Khi xử lý bài có nhãn vi phạm: người đăng bị trừ điểm theo nhãn; nếu bạn duyệt bài của thành viên, điểm kiểm duyệt riêng của bạn cũng giảm tương ứng. Từ chối bài không trừ điểm kiểm duyệt; bài do chính bạn đăng chỉ ảnh hưởng điểm người đăng.</div>
                  {reviewQueue.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Không có bài viết đang chờ duyệt.</p> : reviewQueue.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-sm font-bold text-slate-900 dark:text-white">{post.authorName || 'Thành viên'}</p><p className="mt-1 text-xs text-slate-500">{displayDate(post.createdAt)}</p></div>
                        <ModerationBadges post={post} className="mt-0" />
                      </div>
                      {post.imageUrl && <img src={post.imageUrl} alt="Ảnh bài viết đang chờ duyệt" loading="lazy" className="mt-3 max-h-[24rem] w-full rounded-xl object-contain" />}
                      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-100">{post.content}</p>
                      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <button disabled={busy} onClick={() => handleReviewPost(post.id, 'rejected')} className="rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300">Từ chối</button>
                        <button disabled={busy} onClick={() => handleReviewPost(post.id, 'approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={14} />Duyệt bài</button>
                      </div>
                    </article>
                  ))}

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Báo cáo vi phạm trong nhóm ({groupReports.filter((r) => r.status === 'pending').length})</h3>
                    {groupReports.filter((r) => r.status === 'pending').length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">Không có báo cáo đang chờ xử lý.</p>
                    ) : groupReports.filter((r) => r.status === 'pending').map((report) => (
                      <article key={report.id} className="mb-3 rounded-2xl border border-rose-200 bg-white p-4 dark:border-rose-900/50 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                            {report.targetType === 'comment' ? 'Báo cáo bình luận' : 'Báo cáo bài viết'} · Lý do: {report.reason}
                          </span>
                          <span className="text-[11px] text-slate-500">Người báo cáo: {report.reporterName}</span>
                        </div>
                        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{report.targetContent || '[Hình ảnh]'}</p>
                        {report.details && <p className="mt-2 text-xs text-slate-500">Chi tiết: {report.details}</p>}
                        <div className="mt-3 flex justify-end gap-2">
                          <button disabled={busy} onClick={() => handleReviewGroupReport(report.id, 'dismissed')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Bỏ qua</button>
                          <button disabled={busy} onClick={() => handleReviewGroupReport(report.id, 'resolved_violation')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">Xác nhận vi phạm</button>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Đơn kháng cáo trong nhóm ({groupAppeals.filter((a) => a.status === 'pending').length})</h3>
                    {groupAppeals.filter((a) => a.status === 'pending').length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">Không có đơn kháng cáo đang chờ xử lý.</p>
                    ) : groupAppeals.filter((a) => a.status === 'pending').map((appeal) => (
                      <article key={appeal.id} className="mb-3 rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/50 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{appeal.userName} kháng cáo bài viết</span>
                          <span className="text-[11px] text-slate-500">AI: {aiLabel(appeal.aiLabel)}</span>
                        </div>
                        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{appeal.postContent || '[Hình ảnh]'}</p>
                        <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">Giải trình: {appeal.appealReason}</p>
                        <div className="mt-3 flex justify-end gap-2">
                          <button disabled={busy} onClick={() => handleReviewGroupAppeal(appeal.id, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Từ chối</button>
                          <button disabled={busy} onClick={() => handleReviewGroupAppeal(appeal.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Chấp nhận & khôi phục</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : activePanel === 'requests' && isAdmin ? (
                <div className="space-y-3">
                  {memberRequests.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Không có yêu cầu tham gia.</p> : memberRequests.map((member) => (
                    <article key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div><p className="text-sm font-bold text-slate-900 dark:text-white">{member.name || member.username}</p><p className="mt-1 text-xs text-slate-500">Gửi yêu cầu {displayDate(member.requestedAt)}</p></div>
                      <div className="flex gap-2"><button disabled={busy} onClick={() => handleReviewMember(member.id, 'rejected')} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Từ chối</button><button disabled={busy} onClick={() => handleReviewMember(member.id, 'active')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">Duyệt</button></div>
                    </article>
                  ))}
                </div>
              ) : activePanel === 'members' && isReviewer ? (
                <div className="space-y-2">
                  {members.map((member) => <article key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{member.name || member.username}</p><p className="mt-1 text-xs text-slate-500">{roleLabel(member.role)}</p></div>{selectedGroup.currentRole === 'owner' && member.role !== 'owner' && <select aria-label={`Vai trò của ${member.name || member.username}`} value={member.role} onChange={(event) => handleRoleChange(member.id, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="member">Thành viên</option><option value="moderator">Điều phối viên</option><option value="admin">Quản trị viên</option></select>}</article>)}
                </div>
              ) : (
                <div className="space-y-4">
                  {detailLoading && <p className="py-6 text-center text-sm text-slate-500">Đang cập nhật…</p>}
                  {!detailLoading && posts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-slate-700"><BookOpen className="mx-auto text-slate-400" size={25} /><p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Chưa có bài viết nào</p><p className="mt-1 text-xs text-slate-500">Bài viết đã được duyệt sẽ hiển thị tại đây.</p></div>}
                  {posts.map((post) => post.status === 'approved'
                    ? (
                      <GroupPostCard
                        key={post.id}
                        post={post}
                        currentUser={currentUser}
                        canInteract={isMember}
                        currentGroupRole={selectedGroup.currentRole}
                        onRequireAuth={onRequireAuth}
                        onOpenProfile={onOpenProfile}
                        onPostUpdated={(updated) => {
                          setPosts((prev) => prev.map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item)));
                          loadGroup(selectedGroup.id);
                        }}
                        onPostDeleted={(deletedId) => {
                          setPosts((prev) => prev.filter((item) => String(item.id) !== String(deletedId)));
                        }}
                      />
                    )
                    : <GroupPost key={post.id} post={post} ownPost={String(post.authorId) === String(currentUser?.id)} onAppeal={(targetPost) => setAppealTargetPost(targetPost)} />)}
                </div>
              )}
            </div>

            <aside className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-6 lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-950/40">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><BookOpen size={16} className="text-blue-600" />Quy tắc nhóm</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedGroup.rules || 'Quản trị viên chưa thêm quy tắc riêng. Hãy trao đổi tôn trọng và tuân thủ tiêu chuẩn cộng đồng.'}</p>
              </section>
              <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                <h2 className="flex items-center gap-2 text-sm font-bold text-blue-950 dark:text-blue-100"><ShieldCheck size={16} />Kiểm duyệt minh bạch</h2>
                <p className="mt-2 text-xs leading-5 text-blue-900/80 dark:text-blue-200/80">Bài đăng mới chờ admin hoặc điều phối viên xem xét. AI chỉ đưa ra gợi ý; quyết định cuối cùng do người quản lý nhóm thực hiện.</p>
              </section>
              <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><UsersRound size={16} />Quản trị nhóm</h2><span className="text-xs text-slate-500">{members.length}</span></div>
                <div className="mt-3 space-y-3">
                  {members.slice(0, 5).map((member) => <div key={member.id} className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{member.name || member.username}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{roleLabel(member.role)}</span></div>)}
                  {members.length === 0 && <p className="text-xs text-slate-500">Thành viên chỉ hiển thị sau khi nhóm được mở.</p>}
                </div>
              </section>
            </aside>
          </div>
        </section>
        {error && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
        <AppealModal
          isOpen={Boolean(appealTargetPost)}
          contentItem={appealTargetPost ? {
            ...appealTargetPost,
            contentType: 'post',
            aiStatus: { label: appealTargetPost.aiLabel || 'Hate Speech', confidence: Number(appealTargetPost.aiConfidence || 0.9), action: appealTargetPost.aiAction || 'hide' },
          } : null}
          currentUser={currentUser}
          onClose={() => setAppealTargetPost(null)}
          onSubmitAppeal={handleSubmitRejectedPostAppeal}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative mb-7 overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white sm:px-9 sm:py-9">
        <div className="absolute -right-8 -top-12 h-56 w-56 rounded-full border-[34px] border-blue-500/20" />
        <div className="absolute bottom-0 right-24 h-20 w-20 rounded-t-full bg-emerald-400/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200"><UsersRound size={13} />Cộng đồng WINGS</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Tìm đúng nhóm,<br className="sm:hidden" /> gặp đúng người.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">Khám phá cộng đồng, cùng chia sẻ sở thích và xây dựng không gian có quy tắc rõ ràng.</p>
          </div>
          <button onClick={() => currentUser ? setCreateOpen(true) : onRequireAuth?.('Vui lòng đăng nhập để tạo nhóm.')} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"><Plus size={17} />Tạo nhóm</button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900 dark:text-white">Khám phá nhóm</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nhóm riêng tư chỉ hiện bài viết với thành viên được duyệt.</p></div>
        <label className="relative block w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mô tả" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:focus:ring-blue-950" /></label>
      </div>
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />)}</div> : visibleGroups.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleGroups.map((group) => <GroupCard key={group.id} group={group} onOpen={handleOpenGroup} onJoin={handleJoin} isJoining={joiningId === group.id} />)}</div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center dark:border-slate-700 dark:bg-slate-900"><UsersRound className="mx-auto text-slate-400" size={28} /><p className="mt-3 font-bold text-slate-800 dark:text-slate-100">Chưa tìm thấy nhóm phù hợp</p><p className="mt-1 text-sm text-slate-500">Hãy thử từ khóa khác hoặc tạo một cộng đồng mới.</p></div>
      )}
      {createOpen && <CreateGroupDialog onClose={() => setCreateOpen(false)} onCreate={handleCreateGroup} busy={busy} />}
    </main>
  );
}
