export const uploadController = {
  /**
   * POST /api/upload
   * Nhận file ảnh tải lên và trả về URL Cloudinary
   */
  uploadImage(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Chưa có file nào được tải lên!' });
    }

    console.log('Đã upload ảnh thành công lên Cloudinary:', req.file.path);

    res.json({
      success: true,
      url: req.file.path,
      filename: req.file.filename,
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

