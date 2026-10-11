export function createAuthMiddleware({ userRepository }) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const authError = () => {
    const error = new Error('Bạn cần đăng nhập để tiếp tục');
    error.statusCode = 401;
    return error;
  };

  const resolveUser = async (req) => {
    // TODO: Replace this temporary development auth with JWT when US-2 is implemented.
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    const userId = req.header('x-user-id')?.trim();
    if (!userId) {
      return null;
    }

    if (!uuidPattern.test(userId)) {
      throw authError();
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw authError();
    }

    return user;
  };

  const requireAuth = async (req, res, next) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Bạn cần đăng nhập để tiếp tục',
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
