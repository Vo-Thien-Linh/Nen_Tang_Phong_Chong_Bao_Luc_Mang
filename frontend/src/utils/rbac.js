/**
 * Quản lý vai trò và phân quyền tập trung cho Frontend NexusSocial
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

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Quản trị viên',
  [ROLES.MODERATOR]: 'Điều hành viên',
  [ROLES.USER]: 'Người dùng',
};

/**
 * Chuẩn hóa chuỗi vai trò sang định dạng chữ thường hợp lệ
 * @param {string} role
 * @returns {'admin' | 'moderator' | 'user'}
 */
export function normalizeRole(role) {
  if (!role) return ROLES.USER;
  const clean = String(role).trim().toLowerCase();
  return ROLE_HIERARCHY[clean] !== undefined ? clean : ROLES.USER;
}

/**
 * Kiểm tra xem người dùng có đạt vai trò tối thiểu hay không
 * @param {object} user - Object người dùng chứa role hoặc isAdmin
 * @param {'admin' | 'moderator' | 'user'} requiredRole
 * @returns {boolean}
 */
export function hasRole(user, requiredRole) {
  if (!user) return false;
  
  // Tương thích ngược với các cờ boolean cũ nếu có
  let userRole = user.role ? normalizeRole(user.role) : ROLES.USER;
  if (!user.role && (user.isAdmin || user.is_admin)) {
    userRole = ROLES.ADMIN;
  }

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[normalizeRole(requiredRole)] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Lấy trang đích phù hợp với vai trò của người dùng khi đăng nhập hoặc truy cập sai quyền
 * @param {object} user
 * @returns {'admin' | 'moderation' | 'home'}
 */
export function getDefaultTabForUser(user) {
  if (!user) return 'home';
  if (hasRole(user, ROLES.ADMIN)) return 'admin';
  if (hasRole(user, ROLES.MODERATOR)) return 'moderation';
  return 'home';
}
