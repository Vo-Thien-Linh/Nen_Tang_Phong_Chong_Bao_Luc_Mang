export function createPostService({ postRepository, moderationHook, clock = () => new Date() }) {
  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

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
  };
}
