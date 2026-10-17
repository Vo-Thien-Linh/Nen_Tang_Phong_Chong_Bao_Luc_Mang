export function createPostReactionsController({ reactionService }) {
  return {
    async reactToPost(req, res, next) {
      try {
        const result = await reactionService.reactToPost({
          user: req.user,
          postId: req.params.postId,
          type: req.body?.type,
          action: req.body?.action,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },

    async listPostReactions(req, res, next) {
      try {
        const reactions = await reactionService.getPostReactions({
          postId: req.params.postId,
        });
        res.json({
          success: true,
          data: reactions || [],
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
