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
};

