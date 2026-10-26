export function getProfilePosts({ isOwnProfile, posts = [], profilePosts = null, targetUserId }) {
  const source = isOwnProfile || profilePosts === null ? posts : profilePosts;
  return (source || []).filter((post) =>
    String(post.author?.id ?? post.author_id) === String(targetUserId)
  );
}
