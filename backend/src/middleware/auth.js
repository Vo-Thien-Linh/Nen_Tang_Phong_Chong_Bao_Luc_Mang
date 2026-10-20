import jwt from 'jsonwebtoken';
import { hasRole, normalizeRole } from '../utils/rbac.js';

export function createAuthMiddleware({ userRepository }) {
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

    // 1. Thử lấy từ Bearer Token (nếu có)
    const authHeader = req.header('authorization')?.trim();
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwt.decode(token);
        if (decoded && (decoded.sub || decoded.user_id || decoded.id)) {
          userId = decoded.sub || decoded.user_id || decoded.id;
        }
      } catch (err) {
        warnRejectedAuth(`Lỗi giải mã token: ${err.message}`);
      }
    }

    // 2. Nếu chưa có userId từ token, lấy từ header x-user-id (hỗ trợ dev / frontend hiện có)
    if (!userId) {
      userId = req.header('x-user-id')?.trim();
    }

    // 3. Nếu chưa có từ header, cho phép lấy từ query param userId (hỗ trợ direct link download/export)
    if (!userId && req.query?.userId) {
      userId = String(req.query.userId).trim();
    }

    if (!userId) {
      if (required) {
        warnRejectedAuth('thiếu header x-user-id');
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
