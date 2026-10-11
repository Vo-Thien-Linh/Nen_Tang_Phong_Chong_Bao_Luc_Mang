export function createPostService({ postRepository, moderationHook, clock = () => new Date() }) {
  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

  return {
    async createPost({ user, title, content, imageUrl }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để đăng bài');
        error.statusCode = 401;
        throw error;
      }

      const normalizedTitle = normalizeText(title);
      const normalizedContent = normalizeText(content);

      if (!normalizedTitle || !normalizedContent) {
        const error = new Error('Tiêu đề và nội dung là bắt buộc');
        error.statusCode = 400;
        throw error;
      }

      const post = await postRepository.createPost({
        authorId: user.id,
        title: normalizedTitle,
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
  };
}
