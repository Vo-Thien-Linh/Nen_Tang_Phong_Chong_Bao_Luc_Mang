export function createStoriesController({ storyService }) {
  return {
    async createStory(req, res, next) {
      try {
        const result = await storyService.createStory({
          user: req.user,
          storyType: req.body?.storyType || 'image',
          mediaUrl: req.body?.mediaUrl || null,
          textContent: req.body?.textContent || null,
          backgroundStyle: req.body?.backgroundStyle || null,
          privacy: req.body?.privacy || 'public',
          forcePost: Boolean(req.body?.forcePost),
        });

        if (result?.nudge) {
          return res.status(200).json({
            success: true,
            nudge: true,
            warningType: result.warningType || 'violence',
            predictedLabel: result.predictedLabel || 'Violence',
            message: result.message || 'Tin của bạn có thể chứa nội dung không phù hợp. Bạn có muốn xem lại trước khi chia sẻ?',
          });
        }

        const isHidden = result.ai_status === 'hidden';
        res.status(201).json({
          success: true,
          message: isHidden
            ? 'Tin đã được tạo nhưng bị ẩn do vi phạm tiêu chuẩn cộng đồng.'
            : 'Đăng tin thành công',
          data: result,
        });
      } catch (error) {
        if (error.cooldown) {
          return res.status(403).json({
            success: false,
            message: error.message,
            cooldown: error.cooldown,
          });
        }
        next(error);
      }
    },

    async listFeedStories(req, res, next) {
      try {
        const trays = await storyService.listFeedStories({ user: req.user });
        res.json({
          success: true,
          data: trays,
        });
      } catch (error) {
        next(error);
      }
    },

    async listMyArchive(req, res, next) {
      try {
        const limit = Number(req.query?.limit) || 50;
        const offset = Number(req.query?.offset) || 0;
        const stories = await storyService.listMyArchive({ user: req.user, limit, offset });
        res.json({
          success: true,
          data: stories,
        });
      } catch (error) {
        next(error);
      }
    },

    async getStory(req, res, next) {
      try {
        const story = await storyService.getStoryById({
          user: req.user,
          storyId: req.params.storyId,
        });
        res.json({
          success: true,
          data: story,
        });
      } catch (error) {
        next(error);
      }
    },

    async markViewed(req, res, next) {
      try {
        const result = await storyService.viewStory({
          user: req.user,
          storyId: req.params.storyId,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    async getViewers(req, res, next) {
      try {
        const viewers = await storyService.getStoryViewers({
          user: req.user,
          storyId: req.params.storyId,
        });
        res.json({
          success: true,
          data: viewers,
        });
      } catch (error) {
        next(error);
      }
    },

    async reactToStory(req, res, next) {
      try {
        const reactionType = req.body?.reactionType || 'like';
        const result = await storyService.reactToStory({
          user: req.user,
          storyId: req.params.storyId,
          reactionType,
        });
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },

    async deleteStory(req, res, next) {
      try {
        await storyService.deleteStory({
          user: req.user,
          storyId: req.params.storyId,
        });
        res.json({
          success: true,
          message: 'Xóa tin thành công',
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
