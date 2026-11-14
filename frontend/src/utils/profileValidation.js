export const RELATIONSHIP_OPTIONS = [
  'Độc thân',
  'Đang hẹn hò',
  'Đã đính hôn',
  'Đã kết hôn',
  'Đang tìm hiểu',
  'Có mối quan hệ phức tạp',
];

const ALL_VALID_RELATIONSHIPS = new Set([
  ...RELATIONSHIP_OPTIONS,
  'Single',
  'In a relationship',
  'Engaged',
  'Married',
  "It's complicated",
]);

const FIELD_META = {
  name: { label: 'Họ và tên', labelEn: 'Full Name', minLength: 2, maxLength: 70, kind: 'name' },
  bio: { label: 'Tiểu sử', labelEn: 'Bio', minLength: 2, maxLength: 200, kind: 'bio' },
  workplace: { label: 'Nơi làm việc', labelEn: 'Workplace', minLength: 2, maxLength: 150, kind: 'work_edu' },
  jobTitle: { label: 'Chức vụ / Nghề nghiệp', labelEn: 'Job Title / Role', minLength: 2, maxLength: 150, kind: 'work_edu' },
  location: { label: 'Nơi ở hiện tại', labelEn: 'Current City', minLength: 2, maxLength: 100, kind: 'place' },
  hometown: { label: 'Quê quán', labelEn: 'Hometown', minLength: 2, maxLength: 100, kind: 'place' },
  education: { label: 'Đại học / Chuyên ngành', labelEn: 'College / University', minLength: 2, maxLength: 150, kind: 'work_edu' },
  highSchool: { label: 'Trường THPT', labelEn: 'High School', minLength: 2, maxLength: 150, kind: 'work_edu' },
};

const PLACE_CHAR_REGEX = /^[\p{L}\p{N}\s,.\-/()'’]+$/u;
const WORK_EDU_CHAR_REGEX = /^[\p{L}\p{N}\s,.\-&/()'’:+#]+$/u;
const REPEATED_CHAR_REGEX = /(.)\1{3,}/u;
const KEYBOARD_MASH_REGEX = /(qwerty|asdf|zxcv|ghjkl|poiuyt|lkjhgf|mnbvcx|qazwsx|wsxedc)/i;
const CONSONANT_RUN_REGEX = /[bcdfghjklmnpqrstvwxz]{6,}/i;
const VOWEL_REGEX = /[aeiouyàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/iu;

export function normalizeSingleLine(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeBio(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasGibberishWord(text) {
  if (KEYBOARD_MASH_REGEX.test(text) || CONSONANT_RUN_REGEX.test(text)) {
    return true;
  }
  const words = text.split(/[^\p{L}]+/u).filter(Boolean);
  for (const word of words) {
    if (word.length >= 6 && !VOWEL_REGEX.test(word)) {
      return true;
    }
  }
  return false;
}

export function validateProfileField(fieldName, rawValue, isEn = false) {
  if (fieldName === 'relationship') {
    const normalized = normalizeSingleLine(rawValue);
    if (normalized && !ALL_VALID_RELATIONSHIPS.has(normalized)) {
      return isEn ? 'Please choose a valid relationship status.' : 'Vui lòng chọn tình trạng mối quan hệ hợp lệ.';
    }
    return '';
  }

  if (fieldName === 'avatar_url' || fieldName === 'cover_url') {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) return '';
    if (trimmed.length > 1000 || /\s/.test(trimmed) || (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/'))) {
      return isEn ? 'Image URL must start with https://, http://, or /.' : 'Link ảnh phải bắt đầu bằng https://, http:// hoặc /.';
    }
    return '';
  }

  const meta = FIELD_META[fieldName];
  if (!meta) return '';

  const normalized = meta.kind === 'bio' ? normalizeBio(rawValue) : normalizeSingleLine(rawValue);
  if (!normalized) {
    if (meta.kind === 'name') {
      return isEn ? 'Full name cannot be empty.' : 'Họ và tên không được để trống.';
    }
    return '';
  }

  const label = isEn ? meta.labelEn : meta.label;

  if (normalized.length < meta.minLength) {
    return isEn
      ? `${label} must be at least ${meta.minLength} characters.`
      : `${label} phải có ít nhất ${meta.minLength} ký tự có nghĩa.`;
  }

  if (normalized.length > meta.maxLength) {
    return isEn
      ? `${label} cannot exceed ${meta.maxLength} characters.`
      : `${label} không được vượt quá ${meta.maxLength} ký tự.`;
  }

  if (REPEATED_CHAR_REGEX.test(normalized)) {
    return isEn
      ? `${label} cannot contain repeated nonsense characters.`
      : `${label} không được chứa ký tự lặp lại bất thường.`;
  }

  const letters = normalized.match(/\p{L}/gu) || [];
  if (meta.kind === 'bio') {
    if (letters.length === 0) {
      return isEn
        ? `${label} must contain meaningful words, not only numbers or symbols.`
        : `${label} phải chứa chữ cái có nghĩa, không chỉ nhập số hoặc ký hiệu.`;
    }
    if (hasGibberishWord(normalized)) {
      return isEn
        ? `${label} contains invalid random characters.`
        : `${label} chứa chuỗi ký tự gõ ngẫu nhiên không hợp lệ.`;
    }
    return '';
  }

  if (letters.length < 2) {
    return isEn
      ? `${label} must include at least 2 letters.`
      : `${label} phải nhập thông tin thật (ít nhất 2 chữ cái, không chỉ số hoặc ký hiệu).`;
  }

  if (meta.kind === 'name') {
    const NAME_CHAR_REGEX = /^[\p{L}\s.'’\-]+$/u;
    if (!NAME_CHAR_REGEX.test(normalized)) {
      return isEn
        ? 'Full name contains unsupported special characters.'
        : 'Họ và tên chỉ được chứa chữ cái, khoảng trắng và dấu gạch nối.';
    }
    if (hasGibberishWord(normalized)) {
      return isEn
        ? 'Full name appears to be invalid.'
        : 'Họ và tên không hợp lệ.';
    }
    return '';
  }

  const charRegex = meta.kind === 'place' ? PLACE_CHAR_REGEX : WORK_EDU_CHAR_REGEX;
  if (!charRegex.test(normalized)) {
    return isEn
      ? `${label} contains unsupported special characters.`
      : `${label} chỉ được chứa chữ cái, chữ số và dấu câu cơ bản.`;
  }

  if (hasGibberishWord(normalized)) {
    return isEn
      ? `${label} appears to be random gibberish. Please enter real details.`
      : `${label} có vẻ là ký tự gõ ngẫu nhiên, vui lòng nhập thông tin rõ ràng.`;
  }

  return '';
}

export function validateProfileForm(formData = {}, isEn = false) {
  const sanitized = {
    ...(formData.name !== undefined ? { name: normalizeSingleLine(formData.name) } : {}),
    avatar_url: String(formData.avatar_url || '').trim(),
    cover_url: String(formData.cover_url || '').trim(),
    bio: normalizeBio(formData.bio),
    workplace: normalizeSingleLine(formData.workplace),
    jobTitle: normalizeSingleLine(formData.jobTitle),
    location: normalizeSingleLine(formData.location),
    hometown: normalizeSingleLine(formData.hometown),
    education: normalizeSingleLine(formData.education),
    highSchool: normalizeSingleLine(formData.highSchool),
    relationship: normalizeSingleLine(formData.relationship),
  };

  const errors = {};
  for (const key of Object.keys(sanitized)) {
    const err = validateProfileField(key, sanitized[key], isEn);
    if (err) errors[key] = err;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}
