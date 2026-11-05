import express from 'express';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { createStoryRepository } from '../../../../backend/src/repositories/storyRepository.js';
import { createStoryService } from '../../../../backend/src/services/storyService.js';
import { createStoriesController } from '../../../../backend/src/controllers/storiesController.js';
import { moderateImageUrl } from '../../../../backend/src/services/imageModerationClient.js';

export function createStoriesRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const storyRepository = createStoryRepository({ pool });
  const storyService = createStoryService({
    storyRepository,
    imageModerationClient: moderateImageUrl,
  });
  const storiesController = createStoriesController({ storyService });
  const { requireAuth, optionalAuth } = createAuthMiddleware({ userRepository });

  // 1. Lấy danh sách tin đang hoạt động trên Feed (gom nhóm theo từng người)
  router.get('/feed', optionalAuth, storiesController.listFeedStories);

  // 2. Lấy kho lưu trữ tin cá nhân của người dùng hiện tại
  router.get('/my-archive', requireAuth, storiesController.listMyArchive);

  // 3. Lấy chi tiết một tin cụ thể
  router.get('/:storyId', optionalAuth, storiesController.getStory);

  // 4. Đăng tin mới (hỗ trợ Nudge, Cooldown bạo lực, kiểm duyệt AI đa phương thức)
  router.post('/', requireAuth, storiesController.createStory);

  // 5. Ghi nhận người dùng đã xem tin (tăng view count không trùng lặp)
  router.post('/:storyId/view', requireAuth, storiesController.markViewed);

  // 6. Xem danh sách những ai đã xem tin của mình (chỉ tác giả mới có quyền)
  router.get('/:storyId/viewers', requireAuth, storiesController.getViewers);

  // 7. Thả/cập nhật cảm xúc cho tin
  router.post('/:storyId/reactions', requireAuth, storiesController.reactToStory);

  // 8. Xóa tin
  router.delete('/:storyId', requireAuth, storiesController.deleteStory);

  return router;
}
