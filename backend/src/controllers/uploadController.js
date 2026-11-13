import { createCloudinaryCleanupTicket } from '../utils/cloudinaryCleanupTicket.js';
import cloudinary from '../config/cloudinary.js';

export const uploadController = {
  /**
   * POST /api/upload
   * Nhận file ảnh tải lên và trả về URL Cloudinary
   */
  async uploadImage(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Chưa có file nào được tải lên!' });
    }

    const cleanupToken = createCloudinaryCleanupTicket({ userId: req.user?.id, publicId: req.file.filename });
    if (!cleanupToken) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (error) {
        console.error('Không thể xóa ảnh tải lên khi không tạo được mã dọn ảnh:', error.message);
      }
      return res.status(503).json({ success: false, error: 'Không thể bảo vệ ảnh tải lên; vui lòng thử lại.' });
    }

    console.log('Đã upload ảnh thành công lên Cloudinary:', req.file.path);

    res.json({
      success: true,
      url: req.file.path,
      filename: req.file.filename,
      cleanupToken,
    });
  },

  /**
   * POST /api/upload/story-media
   * Nhận file ảnh hoặc video ngắn tải lên cho Tin và trả về URL
   */
  uploadStoryMedia(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Chưa có file nào được tải lên!' });
    }

    const isVideo = req.file.mimetype ? req.file.mimetype.startsWith('video/') : false;
    console.log(`Đã upload ${isVideo ? 'video' : 'ảnh'} Story thành công lên Cloudinary:`, req.file.path);

    res.json({
      success: true,
      url: req.file.path,
      filename: req.file.filename,
      mediaType: isVideo ? 'video' : 'image',
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  },
};

