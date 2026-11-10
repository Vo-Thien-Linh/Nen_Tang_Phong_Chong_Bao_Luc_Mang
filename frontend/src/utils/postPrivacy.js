export const POST_PRIVACY_LABELS = Object.freeze({
  public: 'Công khai',
  friends: 'Bạn bè',
  only_me: 'Chỉ mình tôi',
});

export const POST_PRIVACY_OPTIONS = Object.freeze([
  Object.freeze({ value: 'public', label: POST_PRIVACY_LABELS.public }),
  Object.freeze({ value: 'friends', label: POST_PRIVACY_LABELS.friends }),
  Object.freeze({ value: 'only_me', label: POST_PRIVACY_LABELS.only_me }),
]);

export function normalizePostPrivacy(value) {
  if (value === 'private') return 'only_me';
  return Object.prototype.hasOwnProperty.call(POST_PRIVACY_LABELS, value) ? value : 'public';
}

export function getPostPrivacyLabel(value) {
  return POST_PRIVACY_LABELS[normalizePostPrivacy(value)];
}
