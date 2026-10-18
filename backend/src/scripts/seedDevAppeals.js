/**
 * SCRIPT SEED DỮ LIỆU KHIẾU NẠI MẪU - CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN / KIỂM THỬ
 * CẢNH BÁO: KHÔNG SỬ DỤNG TRÊN MÔI TRƯỜNG PRODUCTION!
 */
import pool from '../config/db.js';

async function seedDevAppeals() {
  console.log('--- KHỞI TẠO DỮ LIỆU KHIẾU NẠI MẪU CHO KIỂM THỬ (DEV ONLY) ---');
  try {
    // 1. Lấy danh sách user thực tế
    const usersRes = await pool.query("SELECT id, username, email FROM users ORDER BY id LIMIT 5");
    if (usersRes.rows.length === 0) {
      console.error('Không tìm thấy người dùng nào trong CSDL để tạo bài viết mẫu.');
      return;
    }
    const u1 = usersRes.rows[0];
    const u2 = usersRes.rows[1] || u1;

    // 2. Tạo một số bài viết & bình luận với các nhãn vi phạm (Toxic, Violence, Hate speech)
    // Post 1: Toxic (để test Từ chối)
    const p1 = await pool.query(
      `INSERT INTO posts (author_id, content, ai_label, ai_status, ai_confidence)
       VALUES ($1, $2, 'Toxic', 'rejected', 0.88)
       RETURNING id, content, ai_label`,
      [u1.id, 'Tôi ghét cay ghét đắng cái thời tiết ẩm ương này vãi, làm người ta bực mình phát điên!']
    );

    // Post 2: Toxic (để test Chấp nhận -> Bình thường)
    const p2 = await pool.query(
      `INSERT INTO posts (author_id, content, ai_label, ai_status, ai_confidence)
       VALUES ($1, $2, 'Toxic', 'rejected', 0.79)
       RETURNING id, content, ai_label`,
      [u1.id, 'Bộ phim này kịch bản dở tệ hại, phí cả tiền mua vé rạp, không thể nuốt nổi!']
    );

    // Post 3: Violence (để test Chấp nhận -> Bình thường, gỡ Cooldown 10 phút)
    const p3 = await pool.query(
      `INSERT INTO posts (author_id, content, ai_label, ai_status, ai_confidence)
       VALUES ($1, $2, 'Violence', 'rejected', 0.94)
       RETURNING id, content, ai_label`,
      [u2.id, 'Hôm nay quyết tâm ra sân đè bẹp và tiêu diệt đối thủ để mang cúp vô địch về trường!']
    );
    // Gán cooldown cho u2 do bài viết Violence này
    const cooldownTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await pool.query(
      `UPDATE users
       SET status = 'cooldown', cooldown_until = $1, cooldown_reason = 'Vi phạm bạo lực trong bài viết', cooldown_violation_text = $2
       WHERE id = $3`,
      [cooldownTime, 'Hôm nay quyết tâm ra sân đè bẹp và tiêu diệt đối thủ để mang cúp vô địch về trường!', u2.id]
    );

    // Post 4: Violence (để test Chuyển từ Violence -> Toxic)
    const p4 = await pool.query(
      `INSERT INTO posts (author_id, content, ai_label, ai_status, ai_confidence)
       VALUES ($1, $2, 'Violence', 'rejected', 0.85)
       RETURNING id, content, ai_label`,
      [u2.id, 'Đập tan mọi sự lười biếng, chiến đấu hết mình tới giọt mồ hôi cuối cùng!']
    );

    // Post 5: Có hình ảnh (để test Thumbnail trên bảng giao diện)
    const p5 = await pool.query(
      `INSERT INTO posts (author_id, content, image_url, ai_label, ai_status, ai_confidence)
       VALUES ($1, $2, $3, 'Toxic', 'rejected', 0.82)
       RETURNING id, content, ai_label`,
      [u1.id, 'Hình ảnh meme phản biện gay gắt các hiện tượng tiêu cực trong giới trẻ', 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400']
    );

    // Comment 1: Hate speech (để test khiếu nại Bình luận)
    const c1 = await pool.query(
      `INSERT INTO comments (post_id, author_id, content, ai_label, is_hidden)
       VALUES ($1, $2, $3, 'Hate speech', true)
       RETURNING id, content, ai_label`,
      [p1.rows[0].id, u1.id, 'Mấy thành phần chuyên đi lừa đảo chiếm đoạt tài sản trên mạng cần phải tống vào tù hết!']
    );

    // 3. Tạo các khiếu nại (Appeals) tương ứng
    await pool.query(
      `INSERT INTO appeals (user_id, content_type, content_id, original_text, ai_predicted_label, ai_confidence, ai_action_taken, appeal_reason, status)
       VALUES 
       ($1, 'post', $2, $3, 'Toxic', 0.88, 'hidden', 'Tôi chỉ đang than phiền về thời tiết chứ không hề nhắm vào bất kỳ cá nhân nào, mong admin xem xét lại.', 'pending'),
       ($1, 'post', $4, $5, 'Toxic', 0.79, 'hidden', 'Đây là đánh giá nhận xét tác phẩm nghệ thuật cá nhân, không vi phạm tiêu chuẩn cộng đồng.', 'pending'),
       ($6, 'post', $7, $8, 'Violence', 0.94, 'cooldown', 'Thuật ngữ thể thao trong bóng đá thi đấu, không cổ xúy bạo lực ngoài đời thực.', 'pending'),
       ($6, 'post', $9, $10, 'Violence', 0.85, 'cooldown', 'Lời kêu gọi tự động viên bản thân cố gắng rèn luyện, dùng từ ẩn dụ.', 'pending'),
       ($1, 'post', $11, $12, 'Toxic', 0.82, 'hidden', 'Meme châm biếm hài hước lành mạnh có hình ảnh minh họa.', 'pending'),
       ($1, 'comment', $13, $14, 'Hate speech', 0.91, 'hidden', 'Bình luận lên án tội phạm lừa đảo, không thù ghét bất kỳ nhóm người được bảo vệ nào.', 'pending')`,
      [
        u1.id, p1.rows[0].id, p1.rows[0].content,
        p2.rows[0].id, p2.rows[0].content,
        u2.id, p3.rows[0].id, p3.rows[0].content,
        p4.rows[0].id, p4.rows[0].content,
        p5.rows[0].id, p5.rows[0].content,
        c1.rows[0].id, c1.rows[0].content
      ]
    );

    console.log(' Đã seed thành công 6 khiếu nại mẫu (pending) đầy đủ các loại nhãn và nội dung!');
  } catch (err) {
    console.error('Lỗi khi seed dữ liệu khiếu nại:', err.message);
  } finally {
    await pool.end();
  }
}

seedDevAppeals();
