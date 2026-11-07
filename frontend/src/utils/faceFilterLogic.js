/**
 * faceFilterLogic.js
 * Quản lý danh sách filter, hiệu ứng AR khuôn mặt thời gian thực sử dụng MediaPipe FaceLandmarker
 * và Canvas 2D Pipeline cho WebRTC Video Call
 */

export const FILTER_CATEGORIES = {
  ALL: 'all',
  AR: 'ar',
  COLOR: 'color'
};

export const CALL_FILTERS = [
  {
    id: 'none',
    name: 'Gốc',
    category: 'all',
    icon: '✨',
    description: 'Camera gốc không hiệu ứng'
  },
  {
    id: 'sunglasses',
    name: 'Kính Râm',
    category: 'ar',
    icon: '🕶️',
    description: 'Kính râm sành điệu bám sát mắt theo góc nghiêng'
  },
  {
    id: 'cat_ears',
    name: 'Tai Mèo',
    category: 'ar',
    icon: '🐱',
    description: 'Tai mèo cử động trên đỉnh đầu và râu mèo hai bên má'
  },
  {
    id: 'party_hat',
    name: 'Mũ Tiệc',
    category: 'ar',
    icon: '🎉',
    description: 'Mũ sinh nhật trên trán kèm pháo hoa giấy'
  },
  {
    id: 'mustache',
    name: 'Ria Mép',
    category: 'ar',
    icon: '🥸',
    description: 'Ria mép quý ông bám ngay dưới sống mũi'
  },
  {
    id: 'crown',
    name: 'Vương Miện',
    category: 'ar',
    icon: '👑',
    description: 'Vương miện hoàng gia vàng đính ngọc lấp lánh'
  },
  {
    id: 'hearts',
    name: 'Trái Tim',
    category: 'ar',
    icon: '💖',
    description: 'Hiệu ứng trái tim bay lượn quanh đầu'
  },
  {
    id: 'sunset',
    name: 'Hoàng Hôn',
    category: 'color',
    icon: '🌅',
    description: 'Tông màu hoàng hôn ấm áp lãng mạn'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'color',
    icon: '🔮',
    description: 'Ánh sáng neon viễn tưởng tím xanh'
  },
  {
    id: 'vintage',
    name: 'Phim Cổ',
    category: 'color',
    icon: '🎞️',
    description: 'Đen trắng nghệ thuật tương phản cao'
  },
  {
    id: 'beauty',
    name: 'Da Mịn',
    category: 'color',
    icon: '🌸',
    description: 'Làm sáng và mịn màng tự nhiên'
  }
];

export function getFilterConfig(filterId) {
  return CALL_FILTERS.find(f => f.id === filterId) || CALL_FILTERS[0];
}

export function isArFilter(filterId) {
  const config = getFilterConfig(filterId);
  return config.category === 'ar';
}

export function getColorFilterCss(filterId) {
  switch (filterId) {
    case 'sunset':
      return 'sepia(0.35) saturate(1.4) contrast(1.1) hue-rotate(-15deg)';
    case 'cyberpunk':
      return 'contrast(1.25) saturate(1.6) hue-rotate(170deg)';
    case 'vintage':
      return 'grayscale(1) contrast(1.2) brightness(0.95)';
    case 'beauty':
      return 'brightness(1.08) contrast(1.03) saturate(1.15)';
    default:
      return 'none';
  }
}

/**
 * Hàm nội suy tuyến tính (Linear Interpolation) để làm mượt chuyển động khuôn mặt
 */
export function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

/**
 * Hàm nội suy góc xoay tránh bị giật khi góc chuyển qua mốc +/- PI
 */
export function lerpAngle(start, end, factor) {
  const diff = (end - start + Math.PI) % (Math.PI * 2) - Math.PI;
  return start + diff * factor;
}

/**
 * Trình ước lượng mặc định khi chưa tìm thấy khuôn mặt
 */
export function estimateDefaultFace(width, height) {
  const centerX = width * 0.5;
  const eyeY = height * 0.45;
  const faceWidth = width * 0.36;

  return {
    faceWidth,
    eyeCenter: { x: centerX, y: eyeY },
    eyeLeft: { x: centerX - faceWidth * 0.28, y: eyeY },
    eyeRight: { x: centerX + faceWidth * 0.28, y: eyeY },
    headTop: { x: centerX, y: eyeY - faceWidth * 0.45 },
    nose: { x: centerX, y: eyeY + faceWidth * 0.2 },
    mouth: { x: centerX, y: eyeY + faceWidth * 0.42 },
    angle: 0
  };
}

/**
 * Trích xuất các vị trí mốc đặc trưng từ 468 landmarks của MediaPipe
 */
export function extractLandmarkPositions(landmarks, width, height) {
  if (!landmarks || landmarks.length === 0) return null;

  // Left eye center (trung điểm mí ngoài 33 & mí trong 133)
  const eyeLX = ((landmarks[33].x + landmarks[133].x) / 2) * width;
  const eyeLY = ((landmarks[33].y + landmarks[133].y) / 2) * height;

  // Right eye center (trung điểm mí ngoài 263 & mí trong 362)
  const eyeRX = ((landmarks[263].x + landmarks[362].x) / 2) * width;
  const eyeRY = ((landmarks[263].y + landmarks[362].y) / 2) * height;

  // Điểm giữa 2 mắt (Eye Center)
  const eyeCenterX = (eyeLX + eyeRX) / 2;
  const eyeCenterY = (eyeLY + eyeRY) / 2;

  // Góc nghiêng đầu (Angle of head tilt)
  const dx = eyeRX - eyeLX;
  const dy = eyeRY - eyeLY;
  const angle = Math.atan2(dy, dx);

  // Chiều rộng khuôn mặt (khoảng cách 2 thái dương/má: 234 & 454)
  const cheekLX = landmarks[234].x * width;
  const cheekLY = landmarks[234].y * height;
  const cheekRX = landmarks[454].x * width;
  const cheekRY = landmarks[454].y * height;
  const faceWidth = Math.max(Math.hypot(cheekRX - cheekLX, cheekRY - cheekLY), Math.hypot(dx, dy) * 2.2);

  // Điểm đỉnh trán / chân tóc (Landmark 10)
  const headTopX = landmarks[10].x * width;
  const headTopY = landmarks[10].y * height;

  // Đầu mũi (Landmark 1)
  const noseX = landmarks[1].x * width;
  const noseY = landmarks[1].y * height;

  // Môi trên / miệng (Landmark 13)
  const mouthX = landmarks[13].x * width;
  const mouthY = landmarks[13].y * height;

  return {
    faceWidth,
    eyeCenter: { x: eyeCenterX, y: eyeCenterY },
    eyeLeft: { x: eyeLX, y: eyeLY },
    eyeRight: { x: eyeRX, y: eyeRY },
    headTop: { x: headTopX, y: headTopY },
    nose: { x: noseX, y: noseY },
    mouth: { x: mouthX, y: mouthY },
    angle
  };
}

/**
 * 1. Vẽ Kính râm đen sành điệu chuẩn tọa độ 2 mắt
 */
export function renderSunglasses(ctx, face) {
  const { eyeCenter, faceWidth, angle = 0 } = face;
  const glassWidth = faceWidth * 0.95;
  const glassHeight = glassWidth * 0.38;
  const singleLensWidth = glassWidth * 0.44;

  ctx.save();
  ctx.translate(eyeCenter.x, eyeCenter.y);
  ctx.rotate(angle);

  // Viền ngoài gọng kính
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;

  // Tròng kính trái
  ctx.beginPath();
  ctx.roundRect(-glassWidth / 2, -glassHeight / 2, singleLensWidth, glassHeight, [14, 14, 26, 26]);
  ctx.fill();
  ctx.stroke();

  // Tròng kính phải
  ctx.beginPath();
  ctx.roundRect(glassWidth / 2 - singleLensWidth, -glassHeight / 2, singleLensWidth, glassHeight, [14, 14, 26, 26]);
  ctx.fill();
  ctx.stroke();

  // Cầu kính nối giữa 2 tròng
  ctx.beginPath();
  ctx.moveTo(-glassWidth * 0.08, -glassHeight * 0.15);
  ctx.quadraticCurveTo(0, -glassHeight * 0.32, glassWidth * 0.08, -glassHeight * 0.15);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Vệt sáng phản quang tròng kính
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-glassWidth / 2 + 10, -glassHeight / 2 + 8);
  ctx.lineTo(-glassWidth / 2 + singleLensWidth - 14, -glassHeight / 2 + 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(glassWidth / 2 - singleLensWidth + 10, -glassHeight / 2 + 8);
  ctx.lineTo(glassWidth / 2 - 14, -glassHeight / 2 + 8);
  ctx.stroke();

  ctx.restore();
}

/**
 * 2. Vẽ Tai mèo đáng yêu trên đỉnh đầu và râu mèo hai bên má
 */
export function renderCatEars(ctx, face, time = 0) {
  const { headTop, nose, faceWidth, angle = 0 } = face;
  const earSize = faceWidth * 0.45;
  const earWiggle = Math.sin(time / 350) * 0.04;

  ctx.save();
  ctx.translate(headTop.x, headTop.y);
  ctx.rotate(angle);

  // Tai trái
  ctx.save();
  ctx.translate(-faceWidth * 0.32, -earSize * 0.35);
  ctx.rotate(-0.25 + earWiggle);
  ctx.beginPath();
  ctx.moveTo(-earSize / 2, earSize / 2);
  ctx.quadraticCurveTo(-earSize * 0.2, -earSize * 0.75, 0, -earSize * 0.75);
  ctx.quadraticCurveTo(earSize * 0.2, -earSize * 0.75, earSize / 2, earSize / 2);
  ctx.closePath();
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f472b6';
  ctx.stroke();

  // Lòng tai hồng trái
  ctx.beginPath();
  ctx.moveTo(-earSize * 0.3, earSize * 0.35);
  ctx.quadraticCurveTo(0, -earSize * 0.5, earSize * 0.3, earSize * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#f472b6';
  ctx.fill();
  ctx.restore();

  // Tai phải
  ctx.save();
  ctx.translate(faceWidth * 0.32, -earSize * 0.35);
  ctx.rotate(0.25 - earWiggle);
  ctx.beginPath();
  ctx.moveTo(-earSize / 2, earSize / 2);
  ctx.quadraticCurveTo(-earSize * 0.2, -earSize * 0.75, 0, -earSize * 0.75);
  ctx.quadraticCurveTo(earSize * 0.2, -earSize * 0.75, earSize / 2, earSize / 2);
  ctx.closePath();
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f472b6';
  ctx.stroke();

  // Lòng tai hồng phải
  ctx.beginPath();
  ctx.moveTo(-earSize * 0.3, earSize * 0.35);
  ctx.quadraticCurveTo(0, -earSize * 0.5, earSize * 0.3, earSize * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#f472b6';
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Mũi hồng & Râu mèo
  ctx.save();
  ctx.translate(nose.x, nose.y);
  ctx.rotate(angle);

  // Mũi mèo hồng
  ctx.beginPath();
  ctx.moveTo(-11, -6);
  ctx.lineTo(11, -6);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fillStyle = '#f472b6';
  ctx.fill();

  // Râu mèo 2 bên má
  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  const whiskerLen = faceWidth * 0.4;

  [-12, 0, 12].forEach((offsetY) => {
    ctx.beginPath();
    ctx.moveTo(-25, offsetY * 0.5);
    ctx.quadraticCurveTo(-whiskerLen * 0.5, offsetY * 1.5, -whiskerLen, offsetY * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(25, offsetY * 0.5);
    ctx.quadraticCurveTo(whiskerLen * 0.5, offsetY * 1.5, whiskerLen, offsetY * 2);
    ctx.stroke();
  });

  ctx.restore();
}

/**
 * 3. Vẽ Mũ tiệc sinh nhật (Party Hat) với pháo giấy
 */
export function renderPartyHat(ctx, face, time = 0) {
  const { headTop, faceWidth, angle = 0 } = face;
  const hatWidth = faceWidth * 0.55;
  const hatHeight = hatWidth * 1.35;

  ctx.save();
  ctx.translate(headTop.x, headTop.y);
  ctx.rotate(angle - 0.1);

  // Nón chóp
  ctx.beginPath();
  ctx.moveTo(-hatWidth / 2, 0);
  ctx.lineTo(0, -hatHeight);
  ctx.lineTo(hatWidth / 2, 0);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-hatWidth / 2, 0, hatWidth / 2, 0);
  grad.addColorStop(0, '#f43f5e');
  grad.addColorStop(0.33, '#fbbf24');
  grad.addColorStop(0.66, '#38bdf8');
  grad.addColorStop(1, '#a855f7');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Quả bông tròn đỉnh mũ
  ctx.beginPath();
  ctx.arc(0, -hatHeight - 6, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Viền dưới mũ
  ctx.beginPath();
  ctx.ellipse(0, 0, hatWidth / 2, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();

  ctx.restore();

  // Pháo hoa bay quanh
  ctx.save();
  const confettiColors = ['#f43f5e', '#fbbf24', '#38bdf8', '#34d399', '#a855f7'];
  for (let i = 0; i < 14; i++) {
    const a = (i * 0.45) + (time / 1200);
    const radius = faceWidth * (0.65 + (i % 3) * 0.2);
    const cx = headTop.x + Math.cos(a) * radius;
    const cy = headTop.y + Math.sin(a) * radius * 0.7 - 20;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a * 2);
    ctx.fillStyle = confettiColors[i % confettiColors.length];
    if (i % 2 === 0) {
      ctx.fillRect(-4, -4, 8, 8);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/**
 * 4. Vẽ Ria mép quý ông (Gentleman Mustache)
 */
export function renderMustache(ctx, face) {
  const { nose, mouth, faceWidth, angle = 0 } = face;
  const mustacheWidth = faceWidth * 0.55;
  const mustacheHeight = mustacheWidth * 0.32;
  const posX = (nose.x + mouth.x) / 2;
  const posY = (nose.y * 0.35 + mouth.y * 0.65);

  ctx.save();
  ctx.translate(posX, posY);
  ctx.rotate(angle);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2;

  // Cánh trái
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-mustacheWidth * 0.2, -mustacheHeight * 0.6, -mustacheWidth * 0.4, -mustacheHeight * 0.4, -mustacheWidth / 2, -mustacheHeight * 0.8);
  ctx.bezierCurveTo(-mustacheWidth * 0.45, 0, -mustacheWidth * 0.25, mustacheHeight * 0.8, 0, mustacheHeight * 0.2);
  ctx.fill();
  ctx.stroke();

  // Cánh phải
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(mustacheWidth * 0.2, -mustacheHeight * 0.6, mustacheWidth * 0.4, -mustacheHeight * 0.4, mustacheWidth / 2, -mustacheHeight * 0.8);
  ctx.bezierCurveTo(mustacheWidth * 0.45, 0, mustacheWidth * 0.25, mustacheHeight * 0.8, 0, mustacheHeight * 0.2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * 5. Vẽ Vương miện hoàng gia vàng (Golden Crown)
 */
export function renderCrown(ctx, face, time = 0) {
  const { headTop, faceWidth, angle = 0 } = face;
  const crownWidth = faceWidth * 0.7;
  const crownHeight = crownWidth * 0.55;

  ctx.save();
  ctx.translate(headTop.x, headTop.y - crownHeight * 0.3);
  ctx.rotate(angle);

  // Thân vương miện 5 chóp
  ctx.beginPath();
  ctx.moveTo(-crownWidth / 2, 0);
  ctx.lineTo(-crownWidth / 2, -crownHeight * 0.7);
  ctx.lineTo(-crownWidth * 0.25, -crownHeight * 0.4);
  ctx.lineTo(0, -crownHeight); // Chóp giữa
  ctx.lineTo(crownWidth * 0.25, -crownHeight * 0.4);
  ctx.lineTo(crownWidth / 2, -crownHeight * 0.7);
  ctx.lineTo(crownWidth / 2, 0);
  ctx.closePath();

  const goldGrad = ctx.createLinearGradient(0, -crownHeight, 0, 0);
  goldGrad.addColorStop(0, '#fef08a');
  goldGrad.addColorStop(0.5, '#eab308');
  goldGrad.addColorStop(1, '#ca8a04');
  ctx.fillStyle = goldGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Đính ngọc ruby
  [-crownWidth / 2, 0, crownWidth / 2].forEach((rx, idx) => {
    ctx.beginPath();
    const ry = idx === 1 ? -crownHeight : -crownHeight * 0.7;
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fillStyle = idx === 1 ? '#ef4444' : '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Ánh sáng lấp lánh
  const sparkle = Math.sin(time / 250);
  if (sparkle > 0.4) {
    ctx.save();
    ctx.translate(0, -crownHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 6. Vẽ Trái tim bay lơ lửng quanh đầu
 */
export function renderFloatingHearts(ctx, face, time = 0) {
  const { headTop, faceWidth } = face;

  const hearts = [
    { offsetAngle: 0, radiusMult: 0.6, size: 24, speed: 1 },
    { offsetAngle: 2, radiusMult: 0.8, size: 20, speed: 0.8 },
    { offsetAngle: 4, radiusMult: 0.65, size: 28, speed: 1.2 },
    { offsetAngle: 5.2, radiusMult: 0.9, size: 18, speed: 0.9 }
  ];

  hearts.forEach((h, idx) => {
    const a = h.offsetAngle + (time / 1000) * h.speed;
    const radius = faceWidth * h.radiusMult;
    const x = headTop.x + Math.cos(a) * radius;
    const y = headTop.y + Math.sin(a) * (radius * 0.5) - 30 + Math.sin(time / 300 + idx) * 8;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(h.size / 20, h.size / 20);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -10, -20, 5, 0, 20);
    ctx.bezierCurveTo(20, 5, 10, -10, 0, 0);
    ctx.fillStyle = idx % 2 === 0 ? '#f43f5e' : '#ec4899';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  });
}

// Singleton FaceLandmarker promise & instance
let faceLandmarkerInstance = null;
let faceLandmarkerPromise = null;

export async function getFaceLandmarker() {
  if (typeof window === 'undefined') return null;
  if (faceLandmarkerInstance) return faceLandmarkerInstance;
  if (faceLandmarkerPromise) return faceLandmarkerPromise;

  faceLandmarkerPromise = (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      // Nạp WASM từ local static thư mục public/mediapipe/wasm
      let filesetResolver = null;
      try {
        filesetResolver = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      } catch (localWasmErr) {
        filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
      }

      // Nạp model AI nhẹ (3.7MB) từ local public/mediapipe/face_landmarker.task
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: '/mediapipe/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      });

      faceLandmarkerInstance = landmarker;
      return landmarker;
    } catch (err) {
      console.warn('[FaceLandmarker] Không thể nạp MediaPipe model:', err);
      return null;
    }
  })();

  return faceLandmarkerPromise;
}

/**
 * Lớp điều khiển FaceFilterManager: quản lý Canvas xử lý, nhận diện khuôn mặt và captureStream
 */
export class FaceFilterManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.videoElement = null;
    this.rawStream = null;
    this.filteredStream = null;
    this.activeFilterId = 'none';
    this.animationFrameId = null;
    this.isDestroyed = false;
    this.time = 0;
    this.lastVideoTime = -1;
    this.faceLandmarker = null;
    this.smoothedFace = null;
    this.isInitializingAi = false;
  }

  async init(rawStream) {
    if (!rawStream) return null;
    this.rawStream = rawStream;

    if (typeof document === 'undefined') return null;

    // 1. Tạo video element ngầm để đọc khung hình từ webcam
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.srcObject = rawStream;

    await new Promise((resolve) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play().catch(() => {});
        resolve(true);
      };
      setTimeout(resolve, 1000);
    });

    const vWidth = this.videoElement.videoWidth || 640;
    const vHeight = this.videoElement.videoHeight || 480;

    // 2. Tạo canvas xử lý
    this.canvas = document.createElement('canvas');
    this.canvas.width = vWidth;
    this.canvas.height = vHeight;
    this.ctx = this.canvas.getContext('2d');

    // 3. Nạp MediaPipe AI FaceLandmarker không đồng bộ
    this.loadAiModel();

    // 4. Bắt đầu vòng lặp render
    this.startRenderLoop();

    // 5. Xuất MediaStream từ canvas (30 FPS)
    if (this.canvas.captureStream) {
      this.filteredStream = this.canvas.captureStream(30);
    } else if (this.canvas.mozCaptureStream) {
      this.filteredStream = this.canvas.mozCaptureStream(30);
    } else {
      this.filteredStream = rawStream;
    }

    return this.filteredStream;
  }

  async loadAiModel() {
    if (this.isInitializingAi || this.faceLandmarker) return;
    this.isInitializingAi = true;
    try {
      this.faceLandmarker = await getFaceLandmarker();
    } catch (e) {
      console.warn('Lỗi khởi tạo AI FaceLandmarker:', e);
    } finally {
      this.isInitializingAi = false;
    }
  }

  setFilter(filterId) {
    this.activeFilterId = filterId || 'none';
    if (isArFilter(this.activeFilterId) && !this.faceLandmarker) {
      this.loadAiModel();
    }
  }

  getActiveFilterId() {
    return this.activeFilterId;
  }

  getFilteredStream() {
    return this.filteredStream || this.rawStream;
  }

  startRenderLoop() {
    const render = (timestamp) => {
      if (this.isDestroyed) return;
      this.time = timestamp || Date.now();

      if (this.ctx && this.videoElement && this.videoElement.readyState >= 2) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.save();
        const colorFilter = getColorFilterCss(this.activeFilterId);
        if (colorFilter !== 'none') {
          this.ctx.filter = colorFilter;
        }

        // Vẽ video gốc lên canvas
        this.ctx.drawImage(this.videoElement, 0, 0, width, height);
        this.ctx.restore();

        // Nếu là AR Filter, dò tìm khuôn mặt và vẽ sticker
        if (isArFilter(this.activeFilterId)) {
          let currentFace = null;

          if (this.faceLandmarker && this.videoElement.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.videoElement.currentTime;
            try {
              const now = performance.now();
              const results = this.faceLandmarker.detectForVideo(this.videoElement, now);
              if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                currentFace = extractLandmarkPositions(results.faceLandmarks[0], width, height);
              }
            } catch (err) {
              // detectForVideo catch
            }
          }

          // Cập nhật tọa độ nội suy mượt mà (Exponential Smoothing)
          if (currentFace) {
            if (!this.smoothedFace) {
              this.smoothedFace = currentFace;
            } else {
              const alpha = 0.75; // 75% vị trí mới, 25% vị trí cũ để bám sát và khử rung
              this.smoothedFace = {
                faceWidth: lerp(this.smoothedFace.faceWidth, currentFace.faceWidth, alpha),
                eyeCenter: {
                  x: lerp(this.smoothedFace.eyeCenter.x, currentFace.eyeCenter.x, alpha),
                  y: lerp(this.smoothedFace.eyeCenter.y, currentFace.eyeCenter.y, alpha)
                },
                eyeLeft: {
                  x: lerp(this.smoothedFace.eyeLeft.x, currentFace.eyeLeft.x, alpha),
                  y: lerp(this.smoothedFace.eyeLeft.y, currentFace.eyeLeft.y, alpha)
                },
                eyeRight: {
                  x: lerp(this.smoothedFace.eyeRight.x, currentFace.eyeRight.x, alpha),
                  y: lerp(this.smoothedFace.eyeRight.y, currentFace.eyeRight.y, alpha)
                },
                headTop: {
                  x: lerp(this.smoothedFace.headTop.x, currentFace.headTop.x, alpha),
                  y: lerp(this.smoothedFace.headTop.y, currentFace.headTop.y, alpha)
                },
                nose: {
                  x: lerp(this.smoothedFace.nose.x, currentFace.nose.x, alpha),
                  y: lerp(this.smoothedFace.nose.y, currentFace.nose.y, alpha)
                },
                mouth: {
                  x: lerp(this.smoothedFace.mouth.x, currentFace.mouth.x, alpha),
                  y: lerp(this.smoothedFace.mouth.y, currentFace.mouth.y, alpha)
                },
                angle: lerpAngle(this.smoothedFace.angle, currentFace.angle, alpha)
              };
            }
          }

          const targetFace = this.smoothedFace || estimateDefaultFace(width, height);

          switch (this.activeFilterId) {
            case 'sunglasses':
              renderSunglasses(this.ctx, targetFace);
              break;
            case 'cat_ears':
              renderCatEars(this.ctx, targetFace, this.time);
              break;
            case 'party_hat':
              renderPartyHat(this.ctx, targetFace, this.time);
              break;
            case 'mustache':
              renderMustache(this.ctx, targetFace);
              break;
            case 'crown':
              renderCrown(this.ctx, targetFace, this.time);
              break;
            case 'hearts':
              renderFloatingHearts(this.ctx, targetFace, this.time);
              break;
            default:
              break;
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.remove();
      this.videoElement = null;
    }
    if (this.filteredStream && typeof this.filteredStream.getTracks === 'function') {
      this.filteredStream.getTracks().forEach(t => t.stop && t.stop());
    }
    this.canvas = null;
    this.ctx = null;
    this.smoothedFace = null;
  }
}
