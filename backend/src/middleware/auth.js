export function createAuthMiddleware({ userRepository }) {
  const resolveUser = async (req) => {
    // TODO: Replace this temporary development auth with JWT when US-2 is implemented.
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    const userId = req.header('x-user-id');
    if (!userId) {
      return null;
    }

    return userRepository.findById(userId);
  };

  const requireAuth = async (req, res, next) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Bạn cần đăng nhập để đăng bài',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };

  const optionalAuth = async (req, _res, next) => {
    try {
      req.user = await resolveUser(req);
      next();
    } catch (error) {
      next(error);
    }
  };

  return { requireAuth, optionalAuth };
}
