export function createAuthMiddleware({ userRepository }) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const authMessage = 'Bạn cần đăng nhập để tiếp tục';

  const authError = () => {
    const error = new Error(authMessage);
    error.statusCode = 401;
    return error;
  };

  const warnRejectedAuth = (reason) => {
    console.warn(`Từ chối xác thực x-user-id: ${reason}`);
  };

  const resolveUser = async (req, { required = false } = {}) => {
    // TODO: Replace this temporary development auth with JWT when US-2 is implemented.
    if (process.env.NODE_ENV === 'production') {
      if (required) {
        warnRejectedAuth('cơ chế x-user-id đang tắt do NODE_ENV=production');
      }
      return null;
    }

    const userId = req.header('x-user-id')?.trim();
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

  return { requireAuth, optionalAuth };
}
