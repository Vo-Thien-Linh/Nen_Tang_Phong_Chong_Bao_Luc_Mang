export function handleRealtimeFeedEvent(prevPosts, payload) {
  if (!Array.isArray(prevPosts) || !payload || !payload.type) return prevPosts;

  if (payload.type === 'POST_SHARED') {
    const { post: sharedPost, originalPostId } = payload;
    if (!sharedPost) return prevPosts;
    const exists = prevPosts.some((p) => String(p.id) === String(sharedPost.id));
    const updated = prevPosts.map((p) =>
      String(p.id) === String(originalPostId)
        ? { ...p, sharesCount: (p.sharesCount || 0) + 1 }
        : p
    );
    return exists ? updated : [sharedPost, ...updated];
  }

  if (payload.type === 'POST_CREATED') {
    const newPost = payload.post;
    if (!newPost || prevPosts.some((p) => String(p.id) === String(newPost.id))) {
      return prevPosts;
    }
    return [newPost, ...prevPosts];
  }

  if (payload.type === 'POST_DELETED') {
    const deletedId = payload.postId;
    return prevPosts.filter((p) => String(p.id) !== String(deletedId));
  }

  if (payload.type === 'COMMENT_CREATED') {
    const { postId, comment } = payload;
    if (!comment) return prevPosts;
    return prevPosts.map((p) => {
      if (String(p.id) === String(postId)) {
        const commentExists = (p.comments || []).some((c) => String(c.id) === String(comment.id));
        if (commentExists) return p;
        return {
          ...p,
          commentsCount: (p.commentsCount || 0) + 1,
          comments: [...(p.comments || []), comment],
        };
      }
      return p;
    });
  }

  return prevPosts;
}
