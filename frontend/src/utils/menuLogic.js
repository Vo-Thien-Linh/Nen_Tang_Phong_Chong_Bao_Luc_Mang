export function togglePostMenu(openMenuPostId, postId) {
  return String(openMenuPostId || '') === String(postId) ? null : String(postId);
}

export function closePostMenu() {
  return null;
}

export function shouldClosePostMenuForPointer({ target, menuElement, triggerElement }) {
  if (!target) return true;
  if (menuElement?.contains(target)) return false;
  if (triggerElement?.contains(target)) return false;
  return true;
}
