export function moderationViolationNotice(contentType = 'post') {
  return contentType === 'comment'
    ? 'Bình luận của bạn vi phạm quy định cộng đồng'
    : 'Bài viết của bạn vi phạm quy định cộng đồng';
}
