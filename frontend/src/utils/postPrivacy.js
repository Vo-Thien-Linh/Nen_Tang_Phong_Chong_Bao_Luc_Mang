export const POST_PRIVACY_LABELS = Object.freeze({
  public: 'Công khai',
  friends: 'Bạn bè',
  only_me: 'Chỉ mình tôi',
});

export function normalizePostPrivacy(value) {
  if (value === 'private') return 'only_me';
  return Object.prototype.hasOwnProperty.call(POST_PRIVACY_LABELS, value) ? value : 'public';
}

export function getPostPrivacyLabel(value) {
  return POST_PRIVACY_LABELS[normalizePostPrivacy(value)];
}
