import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nexussocial_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    transformation: [{ width: 1920, height: 1920, crop: 'limit', quality: 'auto' }],
  },
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const storyStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype && file.mimetype.startsWith('video/');
    if (isVideo) {
      return {
        folder: 'nexussocial_stories',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm', 'm4v'],
      };
    }
    return {
      folder: 'nexussocial_stories',
      resource_type: 'image',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
      transformation: [{ width: 1080, height: 1920, crop: 'limit', quality: 'auto' }],
    };
  },
});

export const uploadStoryMedia = multer({
  storage: storyStorage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB max cho video tối đa 60s
  fileFilter: (req, file, cb) => {
    if (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file định dạng hình ảnh hoặc video!'), false);
    }
  },
});

export default cloudinary;

