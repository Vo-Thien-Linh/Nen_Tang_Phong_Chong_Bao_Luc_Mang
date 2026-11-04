import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { hasRole, normalizeRole } from '../utils/rbac.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

function getJwtSecret() {
  const secret = process.env.JWT_SECRET_KEY?.trim();
  if (!secret || secret.length < 32 || secret === 'nexussocial-super-secret-jwt-key-2026-very-secure') {
    throw new Error('JWT_SECRET_KEY must be configured with at least 32 characters.');
  }
  return secret;
}

export function createAuthMiddleware({ userRepository }) {
  if (process.env.NODE_ENV === 'production') getJwtSecret();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const authMessage = 'Bạn cần đăng nhập để tiếp tục';

  const authError = () => {
    const error = new Error(authMessage);
    error.statusCode = 401;
    return error;
  };

  const warnRejectedAuth = (reason) => {
    console.warn(`Từ chối xác thực: ${reason}`);
  };

  const resolveUser = async (req, { required = false } = {}) => {
    let userId = null;

    // JWT là nguồn danh tính chính. Không hạ cấp sang header/query nếu token sai.
    const authHeader = req.header('authorization')?.trim();
    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        throw authError();
      }
      const token = authHeader.substring(7).trim();
      if (!token) throw authError();
      try {
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
        if (!decoded || typeof decoded !== 'object' || !decoded.exp || decoded.exp * 1000 <= Date.now()) {
          throw authError();
        }
        userId = decoded.sub || decoded.user_id || decoded.id || null;
        if (!userId) throw authError();
      } catch {
        warnRejectedAuth('Bearer token không hợp lệ, hết hạn hoặc thiếu cấu hình secret');
        throw authError();
      }
    }

    // x-user-id/query chỉ phục vụ phát triển; production bắt buộc JWT đã xác minh.
    if (!userId && process.env.NODE_ENV !== 'production') {
      userId = req.header('x-user-id')?.trim();
      if (!userId && req.query?.userId) userId = String(req.query.userId).trim();
    }

    if (!userId) {
      if (required) {
        warnRejectedAuth('thiếu Bearer token hợp lệ');
      }
      return null;
    }

    if (!uuidPattern.test(userId)) {
      warnRejectedAuth('sai định dạng UUID');
      if (required) {
        throw authError();
      }
      return null;
    }

    let user = await userRepository.findById(userId);
    if (!user && process.env.NODE_ENV !== 'production' && uuidPattern.test(userId)) {
      try {
        const headerName = req.header('x-user-name')
          ? decodeURIComponent(req.header('x-user-name'))
          : null;
        const headerAvatar = req.header('x-user-avatar')
          ? decodeURIComponent(req.header('x-user-avatar'))
          : null;
        user = await userRepository.ensureUserExists({
          id: userId,
          username: `user_${userId.replace(/-/g, '').slice(0, 8)}`,
          fullName: headerName || 'Người dùng mới',
          avatarUrl: headerAvatar || null,
        });
      } catch (err) {
        warnRejectedAuth(`Lỗi tạo dev user: ${err.message}`);
      }
    }

    if (!user) {
      warnRejectedAuth('không tìm thấy user trong DB');
      if (required) {
        throw authError();
      }
      return null;
    }

    // Đảm bảo role được chuẩn hóa chữ thường
    user.role = normalizeRole(user.role);
    return user;
  };

  const requireAuth = async (req, res, next) => {
    try {
      const user = await resolveUser(req, { required: true });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: authMessage,
        });
      }

      if (user.status === 'banned') {
        if (user.banned_until) {
          const now = new Date();
          const bannedUntil = new Date(user.banned_until);
          if (bannedUntil > now) {
            const diffMs = bannedUntil - now;
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            const timeStr = hours > 0 ? `${hours} giờ ${minutes} phút` : `${Math.max(1, minutes)} phút`;
            const reasonStr = user.ban_reason ? ` Lý do: ${user.ban_reason}` : '';
            return res.status(403).json({
              success: false,
              message: `Tài khoản của bạn tạm thời bị khóa. Vui lòng thử lại sau ${timeStr}.${reasonStr}`,
            });
          } else {
            user.status = 'active';
            user.banned_until = null;
            user.ban_reason = null;
          }
        } else {
          const reasonStr = user.ban_reason ? ` Lý do: ${user.ban_reason}` : '';
          return res.status(403).json({
            success: false,
            message: `Tài khoản của bạn đã bị khóa vĩnh viễn do vi phạm nghiêm trọng.${reasonStr}`,
          });
        }
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.statusCode === 401) {
        return res.status(401).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  };

  const optionalAuth = async (req, res, next) => {
    try {
      req.user = await resolveUser(req);
      next();
    } catch (error) {
      if (error.statusCode === 401) {
        return res.status(401).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  };

  /**
   * Middleware kiểm tra vai trò người dùng (RBAC Guard)
   * Luôn đọc lại vai trò trực tiếp từ DB để đảm bảo dữ liệu mới nhất (chống giả mạo qua token/cache)
   */
  const requireRole = (requiredRole) => {
    return async (req, res, next) => {
      try {
        const user = await resolveUser(req, { required: true });
        if (!user) {
          return res.status(401).json({
            success: false,
            message: authMessage,
          });
        }

        // Đọc lại vai trò tươi mới nhất từ Database
        const freshUser = await userRepository.findById(user.id);
        if (!freshUser) {
          return res.status(401).json({
            success: false,
            message: authMessage,
          });
        }

        freshUser.role = normalizeRole(freshUser.role);

        if (!hasRole(freshUser, requiredRole)) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền thực hiện thao tác này.',
          });
        }

        if (freshUser.status === 'banned' && (!freshUser.banned_until || new Date(freshUser.banned_until) > new Date())) {
          return res.status(403).json({ success: false, message: 'Tài khoản đang bị khóa và không thể thực hiện thao tác này.' });
        }

        req.user = freshUser;
        next();
      } catch (error) {
        if (error.statusCode === 401) {
          return res.status(401).json({
            success: false,
            message: error.message,
          });
        }

        next(error);
      }
    };
  };

  return { requireAuth, optionalAuth, requireRole };
}
