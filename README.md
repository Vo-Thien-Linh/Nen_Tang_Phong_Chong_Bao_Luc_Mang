# WINGS - Nền Tảng Mạng Xã Hội Phòng Chống Bạo Lực Mạng Và Kiểm Duyệt Nội Dung Thông Minh

> **Đồ án môn học:** Xây dựng mạng xã hội thế hệ mới tích hợp Trí tuệ Nhân tạo (AI) bảo vệ người dùng, nhận diện ngôn từ độc hại tiếng Việt và kiểm duyệt hình ảnh đa phương tiện theo thời gian thực.

---

## 1. Giới Thiệu Dự Án

Trong bối cảnh bạo lực mạng, ngôn từ thù địch (*Hate Speech*), quấy rối và bình luận độc hại (*Toxic Comments*) đang gia tăng nhanh chóng trên các nền tảng trực tuyến, việc kiểm duyệt thủ công đã bộc lộ giới hạn rõ rệt về tốc độ và quy mô. Đặc biệt, việc xử lý ngôn ngữ tiếng Việt gặp nhiều thách thức lớn do đặc thù từ lóng, teencode, viết tắt, không dấu và ngữ cảnh mỉa mai.

**WINGS** được phát triển nhằm giải quyết triệt để bài toán trên thông qua:
1. **Kiểm duyệt Đa phương tiện Thời gian thực (Multimodal Moderation):** Kết hợp mô hình ngôn ngữ lớn **PhoBERT** (fine-tuned trên tập dữ liệu tiếng Việt ViHSD) và mô hình **Vision AI** phát hiện hình ảnh nhạy cảm/bạo lực.
2. **Quy trình Can thiệp Tự động Khép kín (Automated Enforcement):** Không dừng lại ở việc gắn nhãn đơn thuần, hệ thống tự động thực thi các hành động phù hợp: **Ẩn mềm** (*Soft-hide* cho Toxic/NSFW), **Ẩn cứng** (*Hard-hide* cho Bạo lực), và **Tạm dừng quyền đăng/bình luận** (*Posting Cooldown*).
3. **Cơ chế Kháng cáo & Minh bạch (Appeals & Auto-Heal):** Cho phép người dùng gửi khiếu nại hai chiều khi bị gắn nhãn nhầm, tự động gỡ phạt oan khi Moderator phê duyệt, và tự động phục hồi tài khoản khi hết thời gian phạt.
4. **Bảo vệ Quyền riêng tư (Privacy Preservation):** Hộp thư tin nhắn 1-1 hoạt động độc lập, không bị phong tỏa ngay cả khi tài khoản công khai đang chịu án phạt.

---

## 2. Kiến Trúc Hệ Thống (System Architecture)

Dự án áp dụng kiến trúc **Dual-Backend Microservice** chuyên biệt hóa nhằm tối ưu hiệu năng:

```
                                  ┌──────────────────────────────┐
                                  │      Client Web Browser      │
                                  │    React + Vite (Port 5173)  │
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │                                                 │
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │       FastAPI Backend         │                 │      Express.js Backend       │
        │       (Python - Port 8000)    │                 │      (Node.js - Port 5000)    │
        ├───────────────────────────────┤                 ├───────────────────────────────┤
        │ • AI NLP: PhoBERT (4 nhãn)    │                 │ • Core Social Network APIs    │
        │ • Vision Moderation Client    │                 │ • Feed, Posts, Comments CRUD  │
        │ • Authentication (JWT, OTP)   │                 │ • Reactions (6 emojis), Share │
        │ • Real-time Direct Messaging  │                 │ • Appeals & Reports Workflow  │
        │ • Account Security & Ban logic│                 │ • Moderation Harmonizer       │
        └───────────────┬───────────────┘                 └───────────────┬───────────────┘
                        │                                                 │
                        └────────────────────────┬────────────────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │      Supabase PostgreSQL     │
                                  │   (Shared Cloud Database)    │
                                  └──────────────────────────────┘
```

### Công Nghệ Sử Dụng (Tech Stack)

| Phân hệ | Công nghệ | Vai trò chi tiết |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind/Vanilla CSS, Lucide Icons | Ứng dụng SPA hiện đại, Dark/Light Mode, đồng hồ đếm ngược Cooldown thời gian thực, giao diện responsive. |
| **Backend AI & Auth** | Python, FastAPI, PyTorch, HuggingFace Transformers, SQLAlchemy, Pydantic | Xử lý suy luận mô hình PhoBERT, kiểm duyệt đa phương tiện, bảo mật phiên làm việc và OTP Gmail. |
| **Backend Nghiệp vụ** | Node.js, Express.js, pg (PostgreSQL Client) | Quản lý vòng đời bài viết, bình luận đa cấp, xử lý nghiệp vụ kiểm duyệt, cơ chế Auto-Heal CSDL. |
| **Cơ sở dữ liệu** | Supabase PostgreSQL (Cloud Database) | Lưu trữ tập trung quan hệ người dùng, bài viết, bình luận, tương tác, khiếu nại, báo cáo và logs. |
| **Lưu trữ Đa phương tiện** | Cloudinary CDN | Lưu trữ và phân phối hình ảnh bài viết, ảnh đại diện, ảnh bìa và ảnh bình luận. |
| **Huấn luyện Mô hình** | Google Colab, GPU CUDA, Scikit-learn, ViHSD Dataset | Fine-tuning mô hình ngôn ngữ tiếng Việt PhoBERT 4 nhãn phân loại. |

---

## 3. Các Tính Năng Nổi Bật

### 3.1. Hệ Thống Kiểm Duyệt Trí Tuệ Nhân Tạo Song Hành (Text & Vision AI)

Hệ thống tích hợp song hành **2 Mô hình Học sâu (Deep Learning)** chuyên biệt cho 2 loại dữ liệu:

#### A. Mô hình AI Kiểm duyệt Văn bản (NLP): PhoBERT
* **Kiến trúc mô hình:** **PhoBERT** (`vinai/phobert-base-v2`), dựa trên kiến trúc RoBERTa được huấn luyện trước trên tập dữ liệu tiếng Việt khổng lồ.
* **Tập dữ liệu huấn luyện:** **ViHSD (Vietnamese Hate Speech Detection)** kết hợp tiền xử lý chuẩn hóa Unicode dựng sẵn, khử nhiễu và xử lý teencode/viết tắt.
* **4 Nhãn phân loại đầu ra:**
  * `Normal` (Bình thường): Nội dung tích cực, an toàn, được hiển thị công khai ngay lập tức.
  * `Toxic` (Độc hại / Xúc phạm): Tự động **Ẩn mềm** (thu gọn nội dung và dán nhãn cảnh báo ở chân bài viết/bình luận).
  * `Violence` (Bạo lực / Đe dọa): Tự động **Ẩn cứng** toàn diện, chỉ tác giả mới xem được để gửi khiếu nại.
  * `Hate Speech` (Ngôn từ kích động thù hận): Đánh dấu cảnh báo nghiêm trọng.
* **Tính năng "Duyệt Thử AI" (Pre-check):** Cho phép người dùng kiểm tra trước độ an toàn và điểm tự tin (*confidence score*) trước khi đăng.

#### B. Mô hình AI Kiểm duyệt Hình ảnh (Computer Vision): EfficientNet-B1
* **Kiến trúc mô hình:** **EfficientNet-B1** (`torchvision.models.efficientnet_b1`), mạng nơ-ron tích chập (CNN) tối ưu hóa cân bằng giữa độ chính xác và tốc độ suy luận.
* **Trọng số đã huấn luyện:** File checkpoint `efficientnet_b1_best.pt` (~26.5 MB) đặt tại `backend/app/image_moderation/`.
* **Tiền xử lý hình ảnh:**
  * Giới hạn kích thước tải lên tối đa **10MB**, bảo vệ máy chủ chống tấn công SSRF.
  * Tự động điều chỉnh góc xoay theo chuẩn **EXIF Transpose**.
  * Chuyển đổi không gian màu RGB, Resize cạnh ngắn về **273px**, Center Crop về **240x240px** (chuẩn đầu vào EfficientNet-B1).
  * Chuẩn hóa ma trận điểm ảnh theo ImageNet (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`).
* **3 Lớp nhãn kiểm tra hình ảnh:**
  1. `safe`: Ảnh an toàn, thông thường (ngưỡng tự động duyệt `safe_min >= 0.80`).
  2. `nsfw`: Ảnh nhạy cảm, người lớn, khiêu dâm, hở hang (ngưỡng làm mờ `nsfw_blur >= 0.70`).
  3. `violence`: Ảnh bạo lực, máu me, kinh dị, vũ khí nguy hiểm (ngưỡng chặn `violence_reject >= 0.80`).
  4. Vùng nghi vấn (`review_floor` từ 0.40 - 0.70): Chuyển vào trạng thái `pending_review` để Kiểm duyệt viên xem xét thủ công.
* **Cơ chế hiển thị trên giao diện:**
  * Nếu phát hiện `nsfw`: Áp dụng lớp che mờ cảnh báo nhạy cảm (*Sensitive Content Blur Overlay* kèm nút *"Nhấp để xem ảnh"*).
  * Nếu phát hiện `violence`: Lập tức ẩn cứng bài viết khỏi bảng tin công khai, đồng thời đưa tác giả vào diện xử phạt Cooldown.

#### C. Bộ Điều Hòa Kiểm Duyệt Đa Phương Tiện (Moderation Harmonizer)
* Tự động dung hòa quyết định giữa Văn bản và Hình ảnh:
  * Nếu **Chữ HOẶC Ảnh** vi phạm Bạo lực (`Violence`) $\rightarrow$ **Ẩn cứng toàn diện cả bài viết**, phạt Cooldown 10 phút.
  * Nếu phát hiện Độc hại (`Toxic`) hoặc Ảnh nhạy cảm (`NSFW`) $\rightarrow$ **Ẩn mềm** (che mờ ảnh, hiển thị cảnh báo nhãn vi phạm ở chân bài viết).

### 3.2. Cơ Chế Xử Phạt Cooldown Tự Động Phục Hồi (Auto-Heal)
* **Vô hiệu hóa Chủ động (Proactive UI):** Khi tài khoản vi phạm bạo lực, hệ thống hiển thị banner màu hổ phách nổi bật với **đồng hồ đếm ngược trực tiếp** (`Thời gian gỡ phạt còn lại: X phút Y giây`), đồng thời khóa sẵn toàn bộ ô nhập văn bản và nút gửi bài / bình luận.
* **Duy trì Bền vững (Persistence):** Án phạt được lưu trữ an toàn trong cả Database và Session, **không bao giờ bị mất khi người dùng reload (F5) trang**.
* **Tự động Giải phóng (Auto-Heal):** Ngay khi bộ đếm giờ về 0, hệ thống tự động cập nhật CSDL Supabase về trạng thái `active` và mở lại quyền đăng bài/bình luận mà không cần admin can thiệp hay người dùng phải đăng xuất.
* **Bảo vệ Tin Nhắn Riêng Tư:** Hộp thư trò chuyện 1-1 (`#messages`) hoạt động độc lập và không bao giờ bị phong tỏa khi người dùng đang chịu án phạt công khai.

### 3.3. Quy Trình Kháng Cáo & Xóa Phạt Oan (Appeals & Moderator Workflow)
* **Quyền Khiếu Nại Minh Bạch:** Chỉ chủ sở hữu nội dung bị ẩn mới có quyền gửi đơn kháng cáo kèm lời giải trình.
* **Cổng Kiểm Duyệt Viên / Quản Trị Viên (Admin & Moderator Dashboard):**
  * Tiếp nhận danh sách báo cáo vi phạm từ cộng đồng.
  * Xem xét danh sách khiếu nại của người dùng: Duyệt khôi phục nội dung hoặc Từ chối khiếu nại.
  * **Tự động xóa sạch án phạt Cooldown:** Khi duyệt khiếu nại thành công, hệ thống lập tức khôi phục trạng thái trong sạch cho tài khoản bị phạt oan.

### 3.4. Các Tính Năng Mạng Xã Hội Cốt Lõi (Social Network)
* **Bản tin & Bài viết:** Đăng bài kèm ảnh, chỉnh sửa, xóa, tìm kiếm từ khóa/hashtag, xem chi tiết qua URL hashtag (`#post/:id`).
* **Hệ thống Bình luận Đa cấp:** Bình luận kèm ảnh, trả lời lồng nhau (@mention), có nút hủy trả lời tiện lợi.
* **Tương tác Cảm xúc:** 6 loại reaction sinh động (Thích, Yêu thích, Haha, Wow, Buồn, Phẫn nộ).
* **Chia sẻ & Lưu trữ:** Chia sẻ bài viết lên dòng thời gian cá nhân kèm lời dẫn; đánh dấu lưu bài viết.
* **Mạng lưới Bạn bè & Chat 1-1:** Gửi/nhận lời mời kết bạn, hiển thị bạn chung, nhắn tin trực tiếp thời gian thực.
* **Trang cá nhân:** Tùy biến hồ sơ cá nhân và hiển thị huy hiệu tích xanh xác minh (*Royal Blue Verified Badge*).

---

## 4. Hướng Dẫn Cài Đặt & Khởi Động Nhanh

### Yêu cầu tiên quyết
* **Node.js:** Phiên bản `>= 18.x` (khuyến nghị `20.x` hoặc `22.x`)
* **Python:** Phiên bản `>= 3.10` (khuyến nghị `3.11`)
* Hệ điều hành: Windows, macOS hoặc Linux

---

### Cách 1: Khởi động 1-Click (Khuyến nghị cho Windows)
Tại thư mục gốc dự án, chỉ cần nhấp đúp hoặc chạy script:
```cmd
run_all.bat
```
Script sẽ tự động:
1. Giải phóng các cổng `8000`, `5000`, `5173` nếu đang bị chiếm dụng.
2. Khởi động Backend FastAPI Python trên cổng `8000`.
3. Khởi động Backend Express Node.js trên cổng `5000`.
4. Khởi động Frontend React Vite trên cổng `5173`.
5. Tự động mở trình duyệt truy cập: `http://localhost:5173`.

---

### Cách 2: Khởi động Thủ công từng dịch vụ

#### 1. Cài đặt và chạy Backend FastAPI (Python):
```bash
cd backend
python -m venv .venv
# Trên Windows:
.venv\Scripts\activate
# Trên Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python main.py
```
*Swagger API Docs:* [http://localhost:8000/docs](http://localhost:8000/docs)

#### 2. Cài đặt và chạy Backend Express (Node.js):
```bash
cd backend
npm install
npm start
```
*Express API Health Check:* [http://localhost:5000/api/health](http://localhost:5000/api/health)

#### 3. Cài đặt và chạy Frontend (React Vite):
```bash
cd frontend
npm install
npm run dev
```
*Giao diện người dùng:* [http://localhost:5173](http://localhost:5173)

---

## 5. Danh Sách Tài Khoản Mẫu Phục Vụ Kiểm Thử (Demo Accounts)

| Tên hiển thị | Vai trò (Role) | Email đăng nhập | Trạng thái / Mục đích kiểm thử |
| :--- | :---: | :--- | :--- |
| **Quản Trị Viên Hệ Thống** | `ADMIN` | `linh.vothien@example.com` | `Password123`| Quản trị tối cao, cấp tích xanh, khóa tài khoản, duyệt khiếu nại. |
| **Kiểm Duyệt Viên** | `MODERATOR` | `Moderator01@gmail.com` | `Moderator01@gmail.com`| Tiếp nhận báo cáo vi phạm, duyệt khiếu nại và can thiệp nội dung. |
| **Võ Thiện Linh** | `USER` | `Test1@gmail.com` | `Test1@gmail.com`| Tài khoản chính chủ, có tích xanh xác minh, dùng thử các tính năng. |

---

## 6. Kịch Bản Demo Đề Xuất Khi Báo Cáo / Bảo Vệ

1. **Kịch bản 1: Đăng bài bình thường (Normal)**
   * Đăng nhập `linh.vothien@example.com`.
   * Nhập: *"Chúc cả nhà một ngày mới tốt lành và nhiều niềm vui!"*.
   * Bấm *"Duyệt thử AI"* $
ightarrow$ Nhãn `Normal` (độ tin cậy > 90%).
   * Bấm *"Đăng bài"* $
ightarrow$ Bài viết xuất hiện ngay trên Feed.

2. **Kịch bản 2: Đăng nội dung độc hại (Toxic - Ẩn mềm)**
   * Đăng một câu nói xúc phạm nhẹ hoặc dùng ảnh nhạy cảm.
   * Hệ thống tự động **Ẩn mềm** nội dung, che mờ ảnh và hiển thị nhãn vi phạm ở chân bài viết.

3. **Kịch bản 3: Đăng nội dung bạo lực & Xử phạt Cooldown (Violence - Ẩn cứng)**
   * Đăng câu mang tính đe dọa bạo lực (ví dụ: *"đấm chết cha tụi bay bây giờ"*).
   * Hệ thống tự động **Ẩn cứng** nội dung khỏi bảng tin công khai.
   * Kích hoạt án phạt **Cooldown 10 phút**: Hiện banner màu hổ phách đếm ngược trực tiếp; khóa ô nhập văn bản và nút đăng bài/bình luận.
   * **Bấm F5 (Reload trang):** Chứng minh trạng thái phạt vẫn duy trì bền vững, không bị mất phiên.
   * **Bấm vào tab Tin nhắn (`#messages`):** Chứng minh quyền trò chuyện riêng tư vẫn được bảo vệ, người dùng vẫn gửi tin nhắn được bình thường.

4. **Kịch bản 4: Gửi Khiếu nại & Xóa phạt oan tự động**
   * Tại bài viết bị ẩn, người dùng bấm nút **"Kháng cáo"** $
ightarrow$ Nhập lý do giải trình.
   * Đăng xuất, đăng nhập tài khoản `admin@nexussocial.vn` $
ightarrow$ Vào tab **"Kiểm duyệt"** (`#moderation`).
   * Xem xét đơn khiếu nại và bấm **"Chấp thuận khiếu nại"**.
   * Hệ thống tự động khôi phục bài viết công khai và **xóa sạch toàn bộ án phạt Cooldown** cho người dùng.

---

## 7. Cấu Trúc Thư Mục Dự Án (Project Structure)

```
D:/BTL_Project1/
├── backend/
│   ├── app/                      # FastAPI Python Application
│   │   ├── routes/               # API Routers (auth, moderate, admin, friend, message)
│   │   ├── models/               # SQLAlchemy Models (user, post, message, appeal, report)
│   │   ├── schemas/              # Pydantic Schemas (request/response validation)
│   │   ├── services/             # Business Logic (PhoBERT AI service, auth, mail)
│   │   └── database.py           # Database connection setup
│   ├── src/                      # Express.js Node.js Application
│   │   ├── controllers/          # Controllers (posts, comments, appeals, reports)
│   │   ├── repositories/         # Database Repositories (queries to Supabase)
│   │   ├── services/             # Post & Comment Services
│   │   ├── utils/                # moderationHarmonizer.js (kết hợp text + image)
│   │   └── middleware/           # auth.js, rbac.js
│   ├── ml_models/                # PhoBERT & Vision model checkpoints
│   ├── main.py                   # Điểm khởi chạy FastAPI (Port 8000)
│   ├── server.js                 # Điểm khởi chạy Express.js (Port 5000)
│   └── run_all.bat               # Script khởi động toàn bộ hệ thống
├── database/
│   ├── schema.sql                # Cấu trúc CSDL Supabase PostgreSQL
│   └── seed.sql                  # Dữ liệu khởi tạo mẫu
├── frontend/
│   ├── src/
│   │   ├── components/           # React Components (CreatePostCard, PostCard, ModeratorView, etc.)
│   │   ├── services/             # API Services (authService, profileService)
│   │   ├── hooks/                # Custom React Hooks
│   │   ├── App.jsx               # Main React Application Router & Cooldown Engine
│   │   └── main.jsx              # Entry point React Vite
│   └── vite.config.js            # Cấu hình Vite
└── README.md                     # Tài liệu hướng dẫn dự án (File này)
```
