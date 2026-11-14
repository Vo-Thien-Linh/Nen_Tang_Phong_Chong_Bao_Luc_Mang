const API_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const token = localStorage.getItem('nexussocial_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Tự động bổ sung x-user-id từ phiên đăng nhập nếu chưa có trong headers
  let autoUserHeader = {};
  try {
    const rawUser = localStorage.getItem('nexussocial_user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser?.id) {
        autoUserHeader = { 'x-user-id': parsedUser.id };
      }
    }
  } catch { }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...autoUserHeader,
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Yêu cầu thất bại');
    error.status = response.status;
    if (import.meta.env.DEV) {
      console.error('API request failed', {
        path,
        status: response.status,
        message: data.message || data.error || error.message,
      });
    }
    throw error;
  }

  return data;
}

export async function fetchPosts({ userId } = {}) {
  return request('/api/posts', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchCommunityGroups({ search = '' } = {}) {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  return request(`/api/groups${query.size ? `?${query}` : ''}`);
}

export async function fetchCommunityGroupFeed({ search = '' } = {}) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const groupsResponse = await fetchCommunityGroups();
  const groups = Array.isArray(groupsResponse?.data) ? groupsResponse.data : [];
  const visibleGroups = groups.filter((group) => (
    group.membershipStatus === 'active' || (normalizedSearch && group.privacy === 'public')
  ));
  const postLists = await Promise.all(visibleGroups.map(async (group) => {
    try {
      const response = await fetchCommunityGroupPosts(group.id);
      const posts = Array.isArray(response?.data) ? response.data : [];
      return posts
        .filter((post) => post.status === 'approved')
        .filter((post) => {
          if (!normalizedSearch) return true;
          return [post.content, post.authorName, post.username, group.name]
            .some((value) => String(value || '').toLocaleLowerCase().includes(normalizedSearch));
        })
        .map((post) => ({ ...post, groupName: group.name, canRecommend: false, canInteract: group.membershipStatus === 'active' }));
    } catch {
      return [];
    }
  }));

  return {
    success: true,
    data: postLists.flat().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
  };
}

export async function createCommunityGroup({ name, description, rules, privacy, isDiscoverable, postApprovalMode }) {
  return request('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description, rules, privacy, isDiscoverable, postApprovalMode }),
  });
}

export async function updateCommunityGroupPostApprovalMode({ groupId, postApprovalMode }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/post-approval-mode`, {
    method: 'PUT',
    body: JSON.stringify({ postApprovalMode }),
  });
}

export async function fetchCommunityGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}`);
}

export async function joinCommunityGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/join`, { method: 'POST', body: '{}' });
}

export async function leaveCommunityGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/leave`, { method: 'POST', body: '{}' });
}

export async function fetchCommunityGroupPosts(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts`);
}

export async function fetchCommunityGroupPostComments({ groupId, postId }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/comments`);
}

export async function fetchCommunityGroupPostReactions({ groupId, postId }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/reactions`);
}

export async function createCommunityGroupPostComment({ groupId, postId, content, parentId = null, imageUrl = null, imageCleanupToken = null }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parentId, imageUrl, imageCleanupToken }),
  });
}

export async function updateCommunityGroupPostReaction({ groupId, postId, type, action }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/reaction`, {
    method: 'PUT',
    body: JSON.stringify({ type: type || null, action }),
  });
}

export async function updateCommunityGroupCommentReaction({ groupId, postId, commentId, type, action }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/reaction`, {
    method: 'PUT',
    body: JSON.stringify({ type: type || null, action }),
  });
}

export async function shareCommunityGroupPost({ groupId, postId }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/share`, {
    method: 'POST',
    body: '{}',
  });
}

export async function createCommunityGroupPost({ groupId, content, imageUrl = null, imageCleanupToken = null }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts`, {
    method: 'POST',
    body: JSON.stringify({ content, imageUrl, imageCleanupToken }),
  });
}

export async function updateCommunityGroupPost({ groupId, postId, content, imageUrl = null, imageCleanupToken = null }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`, {
    method: 'PUT',
    body: JSON.stringify({ content, imageUrl, imageCleanupToken }),
  });
}

export async function deleteCommunityGroupPost({ groupId, postId, reason = '' }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export async function toggleSaveCommunityGroupPost({ groupId, postId }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/save`, {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchSavedCommunityGroupPosts() {
  return request('/api/groups/saved');
}

export async function createCommunityGroupReport({ groupId, targetType, targetId, parentPostId = null, reason, details = '' }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/reports`, {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, parentPostId, reason, details }),
  });
}

export async function fetchCommunityGroupReports(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/reports`);
}

export async function reviewCommunityGroupReport({ groupId, reportId, decision, adminNotes = '' }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/reports/${encodeURIComponent(reportId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, adminNotes }),
  });
}

export async function createCommunityGroupPostAppeal({ groupId, postId, appealReason }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ appealReason }),
  });
}

export async function fetchCommunityGroupAppeals(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/appeals`);
}

export async function reviewCommunityGroupAppeal({ groupId, appealId, decision, adminNotes = '' }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/appeals/${encodeURIComponent(appealId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, adminNotes }),
  });
}

export async function fetchCommunityGroupReviewQueue(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/review-queue`);
}

export async function reviewCommunityGroupPost({ groupId, postId, decision, reason = '' }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  });
}

export async function fetchCommunityGroupMembers(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/members`);
}

export async function fetchCommunityGroupMemberRequests(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/member-requests`);
}

export async function reviewCommunityGroupMember({ groupId, userId, decision }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/member-requests/${encodeURIComponent(userId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export async function updateCommunityGroupMemberRole({ groupId, userId, role }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export async function removeCommunityGroupMember({ groupId, userId }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function updateCommunityGroupPrivacy({ groupId, privacy }) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/privacy`, {
    method: 'PUT',
    body: JSON.stringify({ privacy }),
  });
}

export async function fetchTrendingHashtags({ userId, limit = 5 } = {}) {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  return request(`/api/hashtags/trending?${query}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchHashtagPosts({ userId, tag, page = 1, limit = 20 } = {}) {
  const encodedTag = encodeURIComponent(String(tag || '').replace(/^#/, ''));
  const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
  return request(`/api/hashtags/${encodedTag}/posts?${query}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchPostById({ postId, userId } = {}) {
  const cleanId = String(postId || '').replace(/^post-/, '');
  return request(`/api/posts/${cleanId}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createPost({ userId, content, imageUrl, privacy = 'public', forcePost }) {
  return request('/api/posts', {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ content, imageUrl, privacy: privacy || 'public', forcePost: Boolean(forcePost) }),
  });
}

export async function updatePost({ userId, postId, content, imageUrl, privacy, forcePost }) {
  if (forcePost) {
    return request(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: userId ? { 'x-user-id': userId } : {},
      body: JSON.stringify({ content, imageUrl, privacy, forcePost: true }),
    });
  }
  if (privacy === undefined) {
    return request(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: userId ? { 'x-user-id': userId } : {},
      body: JSON.stringify({ content, imageUrl }),
    });
  }
  return request(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ content, imageUrl, privacy }),
  });
}

export async function deletePost({ userId, postId }) {
  return request(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createComment({ userId, postId, parentId = null, content, imageUrl, forceComment, authorFilterKeywords }) {
  return request(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({
      parentId: parentId || null,
      content,
      imageUrl: imageUrl || null,
      forceComment: Boolean(forceComment),
      authorFilterKeywords: authorFilterKeywords || undefined,
    }),
  });
}

export async function updatePostReaction({ userId, postId, type, action }) {
  const resolvedAction = action || (type ? 'set' : 'remove');
  return request(`/api/posts/${postId}/reaction`, {
    method: 'PUT',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({
      type: type || null,
      action: resolvedAction,
    }),
  });
}

export async function fetchPostReactions({ userId, postId }) {
  return request(`/api/posts/${postId}/reactions`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function updateCommentReaction({ userId, postId, commentId, type, action }) {
  const resolvedAction = action || (type ? 'set' : 'remove');
  return request(`/api/posts/${postId}/comments/${commentId}/reaction`, {
    method: 'PUT',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({
      type: type || null,
      action: resolvedAction,
    }),
  });
}

export async function toggleSavePostApi(postId) {
  return request(`/api/posts/${postId}/save`, {
    method: 'POST',
  });
}

export async function fetchSavedPostsApi() {
  return request('/api/posts/saved');
}

async function uploadPostImageAsset(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: localStorage.getItem('nexussocial_token')
      ? { Authorization: `Bearer ${localStorage.getItem('nexussocial_token')}` }
      : {},
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    if (import.meta.env.DEV) {
      console.error('API upload failed', {
        path: '/api/upload',
        status: response.status,
        message: data.message || data.error || 'Tải ảnh thất bại',
      });
    }
    throw new Error(data.error || 'Tải ảnh thất bại');
  }

  return data;
}

export async function uploadPostImage(file) {
  return (await uploadPostImageAsset(file)).url;
}

export async function uploadCommunityGroupPostImage(file) {
  const data = await uploadPostImageAsset(file);
  return { url: data.url, cleanupToken: data.cleanupToken };
}

export async function cleanupCommunityGroupPostImage({ imageUrl, cleanupToken }) {
  return request('/api/upload/cleanup', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, cleanupToken }),
  });
}

export async function previewPostImage(file, userId) {
  const formData = new FormData();
  formData.append('image', file);
  const token = localStorage.getItem('nexussocial_token');
  const response = await fetch(`${API_URL}/api/posts/preview-image`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể duyệt ảnh');
  return data.data;
}

export async function fetchPendingImageModeration(userId) {
  return request('/api/admin/image-moderation/pending?type=all&page=1&limit=100', { headers: userId ? { 'x-user-id': userId } : {} });
}

export async function fetchImageAppealQueue(userId) {
  return request('/api/admin/image-moderation/appeals?type=all&page=1&limit=100', { headers: userId ? { 'x-user-id': userId } : {} });
}

export async function reviewImageModeration({ userId, contentType, id, decision, stage = 'first' }) {
  const normalizedDecision = decision === 'approve' ? 'safe' : decision === 'reject' ? 'violence' : decision;
  return request(`/api/admin/image-moderation/${contentType}/${id}/decide`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ stage, decision: normalizedDecision }),
  });
}

export async function appealPostModeration({ userId, postId }) {
  return request(`/api/posts/${postId}/appeal`, { method: 'POST', headers: userId ? { 'x-user-id': userId } : {} });
}

export async function appealCommentModeration({ userId, postId, commentId }) {
  return request(`/api/posts/${postId}/comments/${commentId}/appeal`, { method: 'POST', headers: userId ? { 'x-user-id': userId } : {} });
}

export async function sharePost({ userId, postId, content = '', user = null }) {
  const headers = {};
  if (userId) {
    headers['x-user-id'] = userId;
  }

  return request(`/api/posts/${postId}/share`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
}

export async function fetchNotifications({ userId, limit = 30, offset = 0, filter = 'all' } = {}) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    filter,
  }).toString();

  return request(`/api/notifications?${query}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchUnreadNotificationsCount({ userId } = {}) {
  return request('/api/notifications/unread-count', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function markNotificationAsRead({ userId, notificationId }) {
  return request(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function markAllNotificationsAsRead({ userId }) {
  return request('/api/notifications/read-all', {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function deleteNotificationApi({ userId, notificationId }) {
  return request(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function clearReadNotificationsApi({ userId }) {
  return request('/api/notifications/read', {
    method: 'DELETE',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchUsersList({ search = '', role = 'all', page = 1, limit = 10, userId } = {}) {
  const query = new URLSearchParams({
    search: search || '',
    role: role || 'all',
    page: String(page || 1),
    limit: String(limit || 10),
  });
  return request(`/api/users?${query.toString()}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function updateUserRoleApi({ targetUserId, newRole, userId }) {
  return request(`/api/users/${targetUserId}/role`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ role: newRole }),
  });
}

export async function updateUserVerificationApi({ targetUserId, isVerified, userId }) {
  return request(`/api/users/${targetUserId}/verification`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ isVerified }),
  });
}

export async function updateUserSanctionApi({ targetUserId, action, durationDays = null, reason = '', userId }) {
  return request(`/api/users/${targetUserId}/sanction`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ action, durationDays, reason }),
  });
}

export async function createReportApi(reportData, userId) {
  const effectiveUserId = userId || reportData.reporter?.id;
  return request('/api/reports', {
    method: 'POST',
    headers: effectiveUserId ? { 'x-user-id': effectiveUserId } : {},
    body: JSON.stringify(reportData),
  });
}

export async function fetchReportsList(userId) {
  return request('/api/reports', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function resolveReportApi({ reportId, status, newLabel, oldLabel, adminNotes, userId }) {
  return request(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ status, newLabel, oldLabel, adminNotes }),
  });
}

export async function fetchAppealsList(userId) {
  return request('/api/appeals', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createAppealApi(appealData, userId) {
  const effectiveUserId = userId || appealData.user?.id;
  return request('/api/appeals', {
    method: 'POST',
    headers: effectiveUserId ? { 'x-user-id': effectiveUserId } : {},
    body: JSON.stringify(appealData),
  });
}

export async function resolveAppealApi({ appealId, status, newLabel, adminNotes, userId }) {
  return request(`/api/appeals/${appealId}`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ status, newLabel, adminNotes }),
  });
}

export async function fetchAiOverridesList(userId) {
  return request('/api/admin/ai-overrides', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createAiOverrideApi({ data, userId }) {
  return request('/api/admin/override-ai-label', {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify(data),
  });
}

export async function fetchUserTrustHistory(userId) {
  return request(`/api/users/${userId}/trust-history`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

// =====================================================
// STORIES APIS (Chức năng đăng tin 24h chuẩn Facebook)
// =====================================================

export async function uploadStoryMedia(file) {
  const formData = new FormData();
  formData.append('media', file);

  const token = localStorage.getItem('nexussocial_token');
  const isImage = file && typeof file.type === 'string' && file.type.startsWith('image/');

  const fileToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh trên thiết bị'));
      reader.readAsDataURL(blob);
    });

  try {
    const response = await fetch(`${API_URL}/api/upload/story-media`, {
      method: 'POST',
      headers: {
        ...autoUserHeader(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      if (isImage && file.size <= 4 * 1024 * 1024) {
        const fallbackUrl = await fileToDataUrl(file);
        return { url: fallbackUrl, mediaType: 'image' };
      }
      throw new Error(data.message || data.error || 'Tải tệp đa phương tiện lên thất bại');
    }

    return {
      url: data.url,
      mediaType: data.mediaType || (file.type?.startsWith('video/') ? 'video' : 'image'),
    };
  } catch (err) {
    // Dự phòng trên điện thoại khi mạng di động / Cloudflare tunnel ngắt kết nối multipart upload
    if (isImage && file.size <= 4 * 1024 * 1024) {
      try {
        const fallbackUrl = await fileToDataUrl(file);
        return { url: fallbackUrl, mediaType: 'image' };
      } catch {
        // ignore fallback error and throw original
      }
    }
    throw new Error(
      err?.message === 'Failed to fetch'
        ? 'Kết nối mạng bị gián đoạn khi tải tệp lên. Vui lòng thử lại.'
        : (err?.message || 'Tải tệp đa phương tiện lên thất bại')
    );
  }
}

export async function fetchStories() {
  return request('/api/stories/feed');
}

export async function createStoryApi({
  storyType = 'image',
  mediaUrl = null,
  textContent = null,
  backgroundStyle = null,
  privacy = 'public',
  forcePost = false,
}) {
  return request('/api/stories', {
    method: 'POST',
    body: JSON.stringify({
      storyType,
      mediaUrl,
      textContent,
      backgroundStyle,
      privacy,
      forcePost: Boolean(forcePost),
    }),
  });
}

export async function fetchStoryByIdApi(storyId, userId) {
  return request(`/api/stories/${storyId}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchUserStoriesApi(userId) {
  return request(`/api/stories/user/${userId}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function viewStoryApi(storyId, userId) {
  return request(`/api/stories/${storyId}/view`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchStoryViewersApi(storyId, userId) {
  return request(`/api/stories/${storyId}/viewers`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function reactToStoryApi(storyId, reactionType = 'like') {
  return request(`/api/stories/${storyId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  });
}

export async function interactStoryWidgetApi(storyId, { widgetType, stickerId, option, value, text }) {
  return request(`/api/stories/${storyId}/interact`, {
    method: 'POST',
    body: JSON.stringify({ widgetType, stickerId, option, value, text }),
  });
}

export async function deleteStoryApi(storyId) {
  return request(`/api/stories/${storyId}`, {
    method: 'DELETE',
  });
}

export async function fetchStoryArchiveApi(limit = 50, offset = 0) {
  return request(`/api/stories/my-archive?limit=${limit}&offset=${offset}`);
}
