export function createPostService({ postRepository, moderationHook, clock = () => new Date() }) {
  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
  const normalizeImageUrl = (value) => {
    if (value === null) return null;
    return normalizeText(value) || null;
  };

  const isRestrictedUser = (user) => {
    if (!user) return false;
    if (user.status === 'banned' || user.status === 'cooldown') return true;
    if (!user.cooldown_until) return false;
    const cooldownUntil = new Date(user.cooldown_until);
    return !Number.isNaN(cooldownUntil.getTime()) && cooldownUntil > clock();
  };

  return {
    async createPost({ user, content, imageUrl }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để đăng bài');
        error.statusCode = 401;
        throw error;
      }

      const normalizedContent = normalizeText(content);

      if (!normalizedContent) {
        const error = new Error('Nội dung là bắt buộc');
        error.statusCode = 400;
        throw error;
      }

      const post = await postRepository.createPost({
        authorId: user.id,
        content: normalizedContent,
        imageUrl: normalizeText(imageUrl) || null,
        createdAt: clock(),
      });

      await moderationHook.afterPostCreated(post);
      return post;
    },

    async listVisiblePosts({ user }) {
      return postRepository.findVisiblePosts({ viewerId: user?.id || null });
    },

    async getVisiblePost({ user, postId }) {
      const post = await postRepository.findById(postId);
      if (!post || (post.ai_status !== 'approved' && post.author_id !== user?.id)) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }
      return post;
    },

    async editPost({ user, postId, content, imageUrl }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để tiếp tục');
        error.statusCode = 401;
        throw error;
      }

      const existingPost = await postRepository.findById(postId);
      if (!existingPost) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      if (existingPost.author_id !== user.id) {
        const error = new Error('Bạn không có quyền chỉnh sửa bài viết này');
        error.statusCode = 403;
        throw error;
      }

      if (existingPost.ai_status === 'hidden') {
        const error = new Error('Bài viết đang bị ẩn nên không thể chỉnh sửa');
        error.statusCode = 403;
        throw error;
      }

      if (isRestrictedUser(user)) {
        const error = new Error('Tài khoản của bạn đang bị hạn chế');
        error.statusCode = 403;
        throw error;
      }

      const normalizedContent = normalizeText(content);
      if (!normalizedContent) {
        const error = new Error('Nội dung không được để trống');
        error.statusCode = 400;
        throw error;
      }

      const post = await postRepository.updatePost({
        postId,
        authorId: user.id,
        content: normalizedContent,
        imageUrl: normalizeImageUrl(imageUrl),
      });

      await moderationHook.afterPostEdited(post);
      return post;
    },

    async deletePost({ user, postId }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để tiếp tục');
        error.statusCode = 401;
        throw error;
      }

      const existingPost = await postRepository.findById(postId);
      if (!existingPost) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      if (existingPost.author_id !== user.id) {
        const error = new Error('Bạn không có quyền xóa bài viết này');
        error.statusCode = 403;
        throw error;
      }

      await postRepository.deletePost({ postId, authorId: user.id });
      return { id: String(postId) };
    },

    async sharePost({ user, originalPostId, content }) {
      // 1. Kiểm tra đăng nhập
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để chia sẻ bài viết');
        error.statusCode = 401;
        throw error;
      }

      // 2. Kiểm tra tài khoản không bị hạn chế
      if (isRestrictedUser(user)) {
        const error = new Error('Tài khoản của bạn đang bị hạn chế, không thể chia sẻ bài viết');
        error.statusCode = 403;
        throw error;
      }

      // 3. Kiểm tra bài gốc tồn tại và không bị ẩn
      const originalPost = await postRepository.findById(originalPostId);
      if (!originalPost) {
        const error = new Error('Bài viết gốc không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      if (originalPost.ai_status === 'hidden') {
        const error = new Error('Không thể chia sẻ bài viết đã bị ẩn');
        error.statusCode = 403;
        throw error;
      }

      // 4. Thực hiện chia sẻ
      const sharedPost = await postRepository.sharePost({
        sharerId: user.id,
        originalPostId,
        content: (content || '').trim(),
      });

      return sharedPost;
    },
  };
}
