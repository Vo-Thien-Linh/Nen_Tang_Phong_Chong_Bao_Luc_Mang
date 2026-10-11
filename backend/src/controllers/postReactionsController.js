export function createPostReactionsController({ reactionService }) {
  return {
    async reactToPost(req, res, next) {
      try {
        const result = await reactionService.reactToPost({
          user: req.user,
          postId: req.params.postId,
          type: req.body?.type,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
