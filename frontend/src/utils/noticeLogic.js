export function markPostWithNotice(post, notice) {
  return {
    ...post,
    inlineNotice: notice,
  };
}

export function markDeletedPostNotice(post, message = 'Xóa bài viết thành công') {
  return markPostWithNotice(post, {
    type: 'delete',
    tone: 'danger',
    message,
  });
}

export function markEditPostNotice(post, message = 'Cập nhật bài viết thành công') {
  return markPostWithNotice(post, {
    type: 'edit',
    tone: 'success',
    message,
  });
}

export function isDeletedNoticePost(post) {
  return post?.inlineNotice?.type === 'delete';
}

export function countVisiblePosts(posts = []) {
  return posts.filter((post) => !isDeletedNoticePost(post)).length;
}

export function clearPostNotice(posts = [], postId) {
  return posts.map((post) => (
    String(post.id) === String(postId)
      ? { ...post, inlineNotice: null }
      : post
  ));
}

export function removeDeletedNotice(posts = [], postId) {
  return posts.filter((post) => !(String(post.id) === String(postId) && isDeletedNoticePost(post)));
}
