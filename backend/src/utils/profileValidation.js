export const PROFILE_RELATIONSHIP_OPTIONS = [
  'Độc thân',
  'Đang hẹn hò',
  'Đã đính hôn',
  'Đã kết hôn',
  'Đang tìm hiểu',
  'Có mối quan hệ phức tạp',
  'Single',
  'In a relationship',
  'Engaged',
  'Married',
  "It's complicated",
];

export const PROFILE_FIELD_RULES = {
  bio: { label: 'Tiểu sử', minLength: 2, maxLength: 200, kind: 'bio' },
  workplace: { label: 'Nơi làm việc', minLength: 2, maxLength: 150, kind: 'work_edu' },
  job_title: { label: 'Chức vụ / Nghề nghiệp', minLength: 2, maxLength: 150, kind: 'work_edu' },
  location: { label: 'Nơi ở hiện tại', minLength: 2, maxLength: 100, kind: 'place' },
  hometown: { label: 'Quê quán', minLength: 2, maxLength: 100, kind: 'place' },
  education: { label: 'Đại học / Chuyên ngành', minLength: 2, maxLength: 150, kind: 'work_edu' },
  high_school: { label: 'Trường THPT', minLength: 2, maxLength: 150, kind: 'work_edu' },
};

const PLACE_CHAR_REGEX = /^[\p{L}\p{N}\s,.\-/()'’]+$/u;
const WORK_EDU_CHAR_REGEX = /^[\p{L}\p{N}\s,.\-&/()'’:+#]+$/u;
const REPEATED_CHAR_REGEX = /(.)\1{3,}/u;
const KEYBOARD_MASH_REGEX = /(qwerty|asdf|zxcv|ghjkl|poiuyt|lkjhgf|mnbvcx|qazwsx|wsxedc)/i;
const CONSONANT_RUN_REGEX = /[bcdfghjklmnpqrstvwxz]{6,}/i;
const VOWEL_REGEX = /[aeiouyàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/iu;

export function normalizeSingleLineText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeBioText(value) {
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

export function validateStructuredProfileField(fieldKey, rawValue) {
  const rule = PROFILE_FIELD_RULES[fieldKey];
  if (!rule) return { valid: true, value: normalizeSingleLineText(rawValue), error: '' };

  if (rawValue !== null && rawValue !== undefined && typeof rawValue !== 'string') {
    return { valid: false, value: '', error: `${rule.label} không hợp lệ.` };
  }

  const normalized = rule.kind === 'bio'
    ? normalizeBioText(rawValue)
    : normalizeSingleLineText(rawValue);

  if (!normalized) {
    return { valid: true, value: '', error: '' };
  }

  if (normalized.length < rule.minLength) {
    return {
      valid: false,
      value: normalized,
      error: `${rule.label} phải có ít nhất ${rule.minLength} ký tự có nghĩa.`,
    };
  }

  if (normalized.length > rule.maxLength) {
    return {
      valid: false,
      value: normalized,
      error: `${rule.label} không được vượt quá ${rule.maxLength} ký tự.`,
    };
  }

  if (REPEATED_CHAR_REGEX.test(normalized)) {
    return {
      valid: false,
      value: normalized,
      error: `${rule.label} không được chứa ký tự lặp lại bất thường.`,
    };
  }

  const letters = normalized.match(/\p{L}/gu) || [];
  if (rule.kind === 'bio') {
    if (letters.length === 0) {
      return {
        valid: false,
        value: normalized,
        error: `${rule.label} phải chứa chữ cái có nghĩa, không chỉ số hoặc ký tự đặc biệt.`,
      };
    }
    if (hasGibberishWord(normalized)) {
      return {
        valid: false,
        value: normalized,
        error: `${rule.label} chứa chuỗi ký tự không hợp lệ.`,
      };
    }
    return { valid: true, value: normalized, error: '' };
  }

  if (letters.length < 2) {
    return {
      valid: false,
      value: normalized,
      error: `${rule.label} phải là thông tin thật có ít nhất 2 chữ cái (không chỉ nhập số hoặc ký hiệu).`,
    };
  }

  const charRegex = rule.kind === 'place' ? PLACE_CHAR_REGEX : WORK_EDU_CHAR_REGEX;
  if (!charRegex.test(normalized)) {
    return {
      valid: false,
      value: normalized,
      error: `${rule.label} chỉ được chứa chữ cái, chữ số và dấu câu cơ bản.`,
    };
  }

  if (hasGibberishWord(normalized)) {
    return {
      valid: false,
      value: normalized,
      error: `${rule.label} có vẻ là ký tự gõ ngẫu nhiên, vui lòng nhập thông tin rõ ràng.`,
    };
  }

  return { valid: true, value: normalized, error: '' };
}

export function validateRelationshipStatus(rawValue) {
  if (rawValue === null || rawValue === undefined) return { valid: true, value: '', error: '' };
  if (typeof rawValue !== 'string') {
    return { valid: false, value: '', error: 'Tình trạng mối quan hệ không hợp lệ.' };
  }
  const normalized = normalizeSingleLineText(rawValue);
  if (!normalized) return { valid: true, value: '', error: '' };
  if (!PROFILE_RELATIONSHIP_OPTIONS.includes(normalized)) {
    return { valid: false, value: normalized, error: 'Tình trạng mối quan hệ không nằm trong danh sách hợp lệ.' };
  }
  return { valid: true, value: normalized, error: '' };
}

export function validateProfileImageUrl(fieldLabel, rawValue) {
  if (rawValue === null || rawValue === undefined) return { valid: true, value: rawValue, error: '' };
  if (typeof rawValue !== 'string') {
    return { valid: false, value: '', error: `${fieldLabel} không hợp lệ.` };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) return { valid: true, value: '', error: '' };
  if (trimmed.length > 1000 || /\s/.test(trimmed)) {
    return { valid: false, value: trimmed, error: `Đường dẫn ${fieldLabel.toLowerCase()} không hợp lệ.` };
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return { valid: true, value: trimmed, error: '' };
  }
  return { valid: false, value: trimmed, error: `Đường dẫn ${fieldLabel.toLowerCase()} phải bắt đầu bằng http(s):// hoặc /.` };
}

/**
 * Validate and normalize incoming profile update fields for backend PATCH /api/users/:userId/profile.
 * Only validates fields that are defined (`!== undefined`) so partial updates (e.g. avatar only) work cleanly.
 */
export function validateBackendProfileUpdate(rawBody = {}) {
  const mapped = {};
  const errors = {};

  const assignIfDefined = (targetKey, rawVal) => {
    if (rawVal !== undefined) mapped[targetKey] = rawVal;
  };

  assignIfDefined('bio', rawBody.bio);
  assignIfDefined('workplace', rawBody.workplace);
  assignIfDefined('job_title', rawBody.job_title !== undefined ? rawBody.job_title : rawBody.jobTitle);
  assignIfDefined('location', rawBody.location);
  assignIfDefined('hometown', rawBody.hometown);
  assignIfDefined('education', rawBody.education);
  assignIfDefined('high_school', rawBody.high_school !== undefined ? rawBody.high_school : rawBody.highSchool);
  assignIfDefined(
    'relationship_status',
    rawBody.relationship_status !== undefined ? rawBody.relationship_status : rawBody.relationship
  );
  assignIfDefined('avatar_url', rawBody.avatar_url);
  assignIfDefined('cover_url', rawBody.cover_url);

  const sanitized = {};

  for (const fieldKey of Object.keys(PROFILE_FIELD_RULES)) {
    if (mapped[fieldKey] === undefined) continue;
    const res = validateStructuredProfileField(fieldKey, mapped[fieldKey]);
    if (!res.valid) {
      errors[fieldKey] = res.error;
    } else {
      sanitized[fieldKey] = res.value;
    }
  }

  if (mapped.relationship_status !== undefined) {
    const res = validateRelationshipStatus(mapped.relationship_status);
    if (!res.valid) {
      errors.relationship_status = res.error;
    } else {
      sanitized.relationship_status = res.value;
    }
  }

  if (mapped.avatar_url !== undefined) {
    const res = validateProfileImageUrl('Ảnh đại diện', mapped.avatar_url);
    if (!res.valid) {
      errors.avatar_url = res.error;
    } else if (res.value !== undefined && res.value !== '') {
      sanitized.avatar_url = res.value;
    }
  }

  if (mapped.cover_url !== undefined) {
    const res = validateProfileImageUrl('Ảnh bìa', mapped.cover_url);
    if (!res.valid) {
      errors.cover_url = res.error;
    } else if (res.value !== undefined && res.value !== '') {
      sanitized.cover_url = res.value;
    }
  }

  const firstError = Object.values(errors)[0] || '';
  return {
    valid: Object.keys(errors).length === 0,
    sanitized,
    errors,
    message: firstError,
  };
}
