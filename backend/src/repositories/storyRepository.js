export function createStoryRepository({ pool }) {
  const storySelect = `
    SELECT
      s.id,
      s.author_id,
      s.story_type,
      s.media_url,
      s.text_content,
      s.background_style,
      s.privacy,
      s.expires_at,
      s.is_archived,
      s.is_deleted,
      s.ai_status,
      s.ai_label,
      s.ai_confidence,
      s.media_moderation_status,
      s.media_moderation_label,
      s.media_moderation_safe,
      s.media_moderation_nsfw,
      s.media_moderation_violence,
      s.media_moderation_thresholds,
      s.media_moderation_appealed_at,
      s.views_count,
      s.reactions_count,
      s.created_at,
      s.updated_at,
      u.username,
      u.full_name,
      u.avatar_url,
      u.is_verified
    FROM stories s
    JOIN users u ON u.id = s.author_id
  `;

  return {
    pool,

    async createStory({
      authorId,
      storyType = 'image',
      mediaUrl = null,
      textContent = null,
      backgroundStyle = null,
      privacy = 'public',
      expiresAt,
      aiStatus = 'approved',
      aiLabel = 'Normal',
      aiConfidence = 0.99,
      mediaModeration = null,
      createdAt = new Date(),
    }) {
      const expirationDate = expiresAt || new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
      const scores = mediaModeration?.scores || {};
      const thresholds = mediaModeration?.thresholds || null;

      const query = `
        INSERT INTO stories (
          author_id,
          story_type,
          media_url,
          text_content,
          background_style,
          privacy,
          expires_at,
          ai_status,
          ai_label,
          ai_confidence,
          media_moderation_status,
          media_moderation_label,
          media_moderation_safe,
          media_moderation_nsfw,
          media_moderation_violence,
          media_moderation_thresholds,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
        RETURNING id
      `;

      const values = [
        authorId,
        storyType,
        mediaUrl,
        textContent,
        backgroundStyle ? JSON.stringify(backgroundStyle) : null,
        privacy,
        expirationDate.toISOString(),
        aiStatus,
        aiLabel,
        aiConfidence,
        mediaModeration?.decision || mediaModeration?.status || null,
        mediaModeration?.label || null,
        scores.safe !== undefined ? scores.safe : null,
        scores.nsfw !== undefined ? scores.nsfw : null,
        scores.violence !== undefined ? scores.violence : null,
        thresholds ? JSON.stringify(thresholds) : null,
        createdAt.toISOString(),
      ];

      const { rows } = await pool.query(query, values);
      return this.getStoryById(rows[0].id, authorId);
    },

    async getStoryById(storyId, viewerId = null) {
      const query = `
        ${storySelect}
        WHERE s.id = $1 AND s.is_deleted = FALSE
      `;
      const { rows } = await pool.query(query, [storyId]);
      if (rows.length === 0) return null;

      const story = rows[0];

      let isViewed = false;
      let myReaction = null;

      if (viewerId) {
        const viewRes = await pool.query(
          'SELECT 1 FROM story_views WHERE story_id = $1 AND viewer_id = $2',
          [storyId, viewerId]
        );
        isViewed = viewRes.rows.length > 0;

        const reactRes = await pool.query(
          'SELECT reaction_type FROM story_reactions WHERE story_id = $1 AND user_id = $2',
          [storyId, viewerId]
        );
        if (reactRes.rows.length > 0) {
          myReaction = reactRes.rows[0].reaction_type;
        }
      }

      return {
        ...story,
        is_viewed: isViewed,
        my_reaction: myReaction,
      };
    },

    async listFeedStories({ viewerId = null }) {
      // 1. Lấy các tin còn hiệu lực (chưa quá 24h, chưa bị xóa)
      // Nếu là tin của viewerId: hiện ngay cả khi ai_status = 'hidden'
      // Nếu là tin của người khác: chỉ lấy ai_status != 'hidden'
      const query = `
        SELECT
          s.id,
          s.author_id,
          s.story_type,
          s.media_url,
          s.text_content,
          s.background_style,
          s.privacy,
          s.expires_at,
          s.ai_status,
          s.ai_label,
          s.media_moderation_status,
          s.media_moderation_label,
          s.media_moderation_safe,
          s.media_moderation_nsfw,
          s.media_moderation_violence,
          s.views_count,
          s.reactions_count,
          s.created_at,
          u.username,
          u.full_name,
          u.avatar_url,
          u.is_verified,
          CASE WHEN sv.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_viewed,
          sr.reaction_type AS my_reaction
        FROM stories s
        JOIN users u ON u.id = s.author_id
        LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = $1
        LEFT JOIN story_reactions sr ON sr.story_id = s.id AND sr.user_id = $1
        WHERE s.expires_at > CURRENT_TIMESTAMP
          AND s.is_deleted = FALSE
          AND s.is_archived = FALSE
          AND (s.author_id = $1 OR s.ai_status != 'hidden')
        ORDER BY s.created_at ASC
      `;

      const { rows } = await pool.query(query, [viewerId]);

      // Gom nhóm tin theo từng tác giả (User Story Tray giống Facebook)
      const userTrayMap = new Map();

      for (const row of rows) {
        const authorId = row.author_id;
        if (!userTrayMap.has(authorId)) {
          userTrayMap.set(authorId, {
            author: {
              id: authorId,
              name: row.full_name,
              username: row.username,
              avatar: row.avatar_url,
              isVerified: Boolean(row.is_verified),
            },
            isSelf: viewerId ? authorId === viewerId : false,
            hasUnviewedStories: false,
            latestStoryTime: row.created_at,
            stories: [],
          });
        }

        const tray = userTrayMap.get(authorId);
        tray.latestStoryTime = row.created_at;
        if (!row.is_viewed) {
          tray.hasUnviewedStories = true;
        }

        tray.stories.push({
          id: String(row.id),
          storyType: row.story_type,
          mediaUrl: row.media_url,
          textContent: row.text_content,
          backgroundStyle: typeof row.background_style === 'string' ? JSON.parse(row.background_style) : row.background_style,
          privacy: row.privacy,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          aiStatus: row.ai_status,
          aiLabel: row.ai_label,
          mediaModerationStatus: row.media_moderation_status,
          mediaModerationLabel: row.media_moderation_label,
          isSensitive: row.media_moderation_status === 'sensitive',
          viewsCount: Number(row.views_count || 0),
          reactionsCount: Number(row.reactions_count || 0),
          isViewed: Boolean(row.is_viewed),
          myReaction: row.my_reaction || null,
        });
      }

      // Xếp tác giả: Bản thân lên đầu tiên, tiếp theo là những người có tin chưa xem, cuối cùng là đã xem hết
      const trays = Array.from(userTrayMap.values());
      trays.sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        if (a.hasUnviewedStories && !b.hasUnviewedStories) return -1;
        if (!a.hasUnviewedStories && b.hasUnviewedStories) return 1;
        return new Date(b.latestStoryTime) - new Date(a.latestStoryTime);
      });

      return trays;
    },

    async listUserArchiveStories({ authorId, limit = 50, offset = 0 }) {
      const query = `
        ${storySelect}
        WHERE s.author_id = $1 AND s.is_deleted = FALSE
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const { rows } = await pool.query(query, [authorId, limit, offset]);
      return rows;
    },

    async markStoryAsViewed({ storyId, viewerId }) {
      if (!storyId || !viewerId) return false;

      // Đảm bảo không đếm trùng lượt xem từ cùng 1 người
      const insertQuery = `
        INSERT INTO story_views (story_id, viewer_id, viewed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (story_id, viewer_id) DO NOTHING
        RETURNING id
      `;
      const res = await pool.query(insertQuery, [storyId, viewerId]);

      if (res.rows.length > 0) {
        await pool.query(
          'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
          [storyId]
        );
        return true;
      }
      return false;
    },

    async getStoryViewers({ storyId, authorId }) {
      // Chỉ tác giả mới có quyền xem ai đã xem tin của mình
      const storyCheck = await pool.query(
        'SELECT author_id FROM stories WHERE id = $1 AND is_deleted = FALSE',
        [storyId]
      );
      if (storyCheck.rows.length === 0) return null;
      if (storyCheck.rows[0].author_id !== authorId) {
        const error = new Error('Bạn không có quyền xem danh sách người xem của tin này');
        error.statusCode = 403;
        throw error;
      }

      const query = `
        SELECT
          sv.id AS view_id,
          sv.viewed_at,
          u.id AS viewer_id,
          u.username,
          u.full_name,
          u.avatar_url,
          u.is_verified,
          sr.reaction_type
        FROM story_views sv
        JOIN users u ON u.id = sv.viewer_id
        LEFT JOIN story_reactions sr ON sr.story_id = sv.story_id AND sr.user_id = sv.viewer_id
        WHERE sv.story_id = $1
        ORDER BY sv.viewed_at DESC
      `;
      const { rows } = await pool.query(query, [storyId]);
      return rows;
    },

    async reactToStory({ storyId, userId, reactionType = 'like' }) {
      const allowedReactions = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
      if (!allowedReactions.includes(reactionType)) {
        throw new Error(`Loại cảm xúc không hợp lệ: ${reactionType}`);
      }

      const upsertQuery = `
        INSERT INTO story_reactions (story_id, user_id, reaction_type, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (story_id, user_id)
        DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP
        RETURNING id, reaction_type
      `;
      const res = await pool.query(upsertQuery, [storyId, userId, reactionType]);

      // Cập nhật lại số lượng cảm xúc
      const countRes = await pool.query(
        'SELECT COUNT(*)::INT AS total FROM story_reactions WHERE story_id = $1',
        [storyId]
      );
      const totalReactions = countRes.rows[0]?.total || 0;
      await pool.query(
        'UPDATE stories SET reactions_count = $1 WHERE id = $2',
        [totalReactions, storyId]
      );

      return {
        reactionType: res.rows[0]?.reaction_type,
        reactionsCount: totalReactions,
      };
    },

    async deleteStory({ storyId, userId, isAdmin = false }) {
      const checkRes = await pool.query(
        'SELECT author_id FROM stories WHERE id = $1 AND is_deleted = FALSE',
        [storyId]
      );
      if (checkRes.rows.length === 0) {
        return null;
      }

      const authorId = checkRes.rows[0].author_id;
      if (authorId !== userId && !isAdmin) {
        const error = new Error('Bạn không có quyền xóa tin này');
        error.statusCode = 403;
        throw error;
      }

      await pool.query(
        'UPDATE stories SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [storyId]
      );
      return true;
    },

    async archiveExpiredStories() {
      const res = await pool.query(`
        UPDATE stories
        SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE expires_at <= CURRENT_TIMESTAMP
          AND is_archived = FALSE
          AND is_deleted = FALSE
        RETURNING id
      `);
      return res.rowCount;
    },
  };
}
