export function createAuthMiddleware({ userRepository }) {
  const requireAuth = async (req, res, next) => {
    try {
      // TODO: Replace this temporary development auth with JWT when US-2 is implemented.
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          message: 'Bạn cần đăng nhập để thả icon',
        });
      }

      const userId = req.header('x-user-id');
      const user = userId ? await userRepository.findById(userId) : null;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Bạn cần đăng nhập để thả icon',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };

  return { requireAuth };
}
