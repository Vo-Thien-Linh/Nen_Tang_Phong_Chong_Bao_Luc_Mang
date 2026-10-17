/**
 * Định nghĩa vai trò và thứ bậc quyền trong hệ thống NexusSocial
 * Thứ bậc: admin (3) > moderator (2) > user (1)
 */
export const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
};

export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 3,
  [ROLES.MODERATOR]: 2,
  [ROLES.USER]: 1,
};

export const VALID_ROLES = [ROLES.USER, ROLES.MODERATOR, ROLES.ADMIN];

/**
 * Chuẩn hóa giá trị vai trò sang chữ thường hợp lệ
 * @param {string} role 
 * @returns {'admin' | 'moderator' | 'user'}
 */
export function normalizeRole(role) {
  if (!role) return ROLES.USER;
  const clean = String(role).trim().toLowerCase();
  return ROLE_HIERARCHY[clean] !== undefined ? clean : ROLES.USER;
}

/**
 * Kiểm tra xem người dùng có đạt cấp bậc quyền yêu cầu hay không.
 * Nếu yêu cầu 'moderator', admin cũng trả về true.
 * @param {object} user - Object người dùng chứa thuộc tính role
 * @param {'admin' | 'moderator' | 'user'} requiredRole - Vai trò tối thiểu yêu cầu
 * @returns {boolean}
 */
export function hasRole(user, requiredRole) {
  if (!user || !user.role) return false;
  const userLevel = ROLE_HIERARCHY[normalizeRole(user.role)] || 0;
  const requiredLevel = ROLE_HIERARCHY[normalizeRole(requiredRole)] || 0;
  return userLevel >= requiredLevel;
}
