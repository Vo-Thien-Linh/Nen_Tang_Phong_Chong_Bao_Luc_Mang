let dropConstraintAttempted = false;
async function dropUniqueStoryReactionConstraint(pool) {
  if (dropConstraintAttempted || !pool || typeof pool.query !== 'function') return;
  try {
    await pool.query(`
      ALTER TABLE story_reactions DROP CONSTRAINT IF EXISTS unique_story_reaction;
      ALTER TABLE story_reactions DROP CONSTRAINT IF EXISTS story_reactions_story_id_user_id_key;
    `);
    dropConstraintAttempted = true;
  } catch (err) {
    // bỏ qua nếu mock pool hoặc không có quyền
  }
}

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

      // Kiểm tra quyền riêng tư (Privacy) & kiểm duyệt nếu người xem không phải tác giả
      if (String(story.author_id) !== String(viewerId)) {
        if (story.ai_status === 'hidden') {
          return null;
        }
        if (story.media_moderation_status && !['safe', 'sensitive'].includes(story.media_moderation_status)) {
          return null;
        }
        if (story.privacy === 'private') {
          return null;
        }
        if (story.privacy === 'friends') {
          if (!viewerId) return null;
          const friendCheck = await pool.query(
            `SELECT 1 FROM friendships 
             WHERE status = 'accepted' 
               AND ((requester_id = $1 AND addressee_id = $2) OR (addressee_id = $1 AND requester_id = $2))`,
            [story.author_id, viewerId]
          );
          if (friendCheck.rows.length === 0) {
            return null;
          }
        }
      }

      let isViewed = false;
      let myReaction = null;

      if (viewerId) {
        const viewRes = await pool.query(
          'SELECT 1 FROM story_views WHERE story_id = $1 AND viewer_id = $2',
          [storyId, viewerId]
        );
        isViewed = viewRes.rows.length > 0;

        const reactRes = await pool.query(
          'SELECT reaction_type FROM story_reactions WHERE story_id = $1 AND user_id = $2 ORDER BY created_at ASC',
          [storyId, viewerId]
        );
        if (reactRes.rows.length > 0) {
          myReaction = reactRes.rows[reactRes.rows.length - 1].reaction_type;
        }
        story.my_reactions = reactRes.rows.map(r => r.reaction_type);
      }

      const isToxic = story.ai_label === 'Toxic' || story.ai_status === 'sensitive';
      const isNsfw = story.media_moderation_status === 'sensitive' || story.media_moderation_label === 'nsfw' || (Number(story.media_moderation_nsfw) >= 0.7);
      const isHardHidden = story.ai_status === 'hidden' || story.ai_label === 'Violence' || story.ai_label === 'Hate Speech';

      const parsedBackgroundStyle = typeof story.background_style === 'string'
        ? (() => { try { return JSON.parse(story.background_style); } catch { return story.background_style; } })()
        : story.background_style;

      return {
        ...story,
        id: String(story.id),
        storyType: story.story_type,
        mediaUrl: story.media_url,
        textContent: story.text_content,
        backgroundStyle: parsedBackgroundStyle,
        author: {
          id: story.author_id,
          name: story.full_name || story.username || 'Người dùng',
          username: story.username || '',
          avatar: story.avatar_url,
          isVerified: Boolean(story.is_verified),
        },
        author_name: story.full_name || story.username || 'Người dùng',
        author_username: story.username || '',
        author_avatar: story.avatar_url,
        isViewed,
        myReaction,
        viewsCount: Number(story.views_count || 0),
        reactionsCount: Number(story.reactions_count || 0),
        aiStatus: story.ai_status,
        aiLabel: story.ai_label,
        mediaModerationStatus: story.media_moderation_status,
        mediaModerationLabel: story.media_moderation_label,
        isToxic,
        isNsfw,
        isSensitive: (isToxic || isNsfw) && !isHardHidden,
        isHardHidden,
        is_viewed: isViewed,
        my_reaction: myReaction,
        my_reactions: story.my_reactions || (myReaction ? [myReaction] : []),
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
        LEFT JOIN (
          SELECT story_id, 
                 (array_agg(reaction_type ORDER BY created_at DESC))[1] AS reaction_type
          FROM story_reactions
          WHERE user_id = $1
          GROUP BY story_id
        ) sr ON sr.story_id = s.id
        WHERE s.expires_at > CURRENT_TIMESTAMP
          AND s.is_deleted = FALSE
          AND s.is_archived = FALSE
          AND (
            s.author_id = $1
            OR (
              s.ai_status != 'hidden'
              AND (s.media_moderation_status IS NULL OR s.media_moderation_status IN ('safe', 'sensitive'))
              AND s.privacy != 'private'
              AND $1 IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM friendships f
                WHERE f.status = 'accepted'
                  AND ((f.requester_id = s.author_id AND f.addressee_id = $1)
                    OR (f.addressee_id = s.author_id AND f.requester_id = $1))
              )
            )
          )
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

        const isToxic = row.ai_label === 'Toxic' || row.ai_status === 'sensitive';
        const isNsfw = row.media_moderation_status === 'sensitive' || row.media_moderation_label === 'nsfw' || (Number(row.media_moderation_nsfw) >= 0.7);
        const isHardHidden = row.ai_status === 'hidden' || row.ai_label === 'Violence' || row.ai_label === 'Hate Speech';

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
          ai_status: row.ai_status,
          aiLabel: row.ai_label,
          ai_label: row.ai_label,
          mediaModerationStatus: row.media_moderation_status,
          media_moderation_status: row.media_moderation_status,
          mediaModerationLabel: row.media_moderation_label,
          media_moderation_label: row.media_moderation_label,
          isToxic,
          isNsfw,
          isSensitive: (isToxic || isNsfw) && !isHardHidden,
          isHardHidden,
          viewsCount: Number(row.views_count || 0),
          reactionsCount: Number(row.reactions_count || 0),
          isViewed: Boolean(row.is_viewed),
          myReaction: row.my_reaction || null,
        });
      }

      // Xếp tác giả: Ưu tiên các tin chưa xem lên trước, tin đã xem hết xếp về sau
      const trays = Array.from(userTrayMap.values());
      trays.sort((a, b) => {
        // 1. Nhóm tin chưa xem luôn hiển thị lên đầu trước tin đã xem hết
        if (a.hasUnviewedStories && !b.hasUnviewedStories) return -1;
        if (!a.hasUnviewedStories && b.hasUnviewedStories) return 1;

        // 2. Nếu cùng trạng thái xem: tin của bản thân xếp trước
        if (a.isSelf && !b.isSelf) return -1;
        if (!a.isSelf && b.isSelf) return 1;

        // 3. Tin có cập nhật mới nhất xếp trước
        return new Date(b.latestStoryTime) - new Date(a.latestStoryTime);
      });

      return trays;
    },

    async listUserStories({ targetUserId, viewerId = null }) {
      if (!targetUserId) return null;

      // Kiểm tra quan hệ bạn bè giữa viewerId và targetUserId
      let isFriend = false;
      const isSelf = viewerId ? String(viewerId) === String(targetUserId) : false;

      if (viewerId && !isSelf) {
        const friendCheck = await pool.query(
          `SELECT 1 FROM friendships 
           WHERE status = 'accepted' 
             AND ((requester_id = $1 AND addressee_id = $2) OR (addressee_id = $1 AND requester_id = $2))`,
          [viewerId, targetUserId]
        );
        isFriend = friendCheck.rows.length > 0;
      }

      // Điều kiện quyền riêng tư:
      // - Nếu là chính mình: xem tất cả tin
      // - Nếu là bạn bè: xem tin public và friends
      // - Nếu là người lạ: chỉ xem tin public
      let privacyCondition = "AND s.privacy = 'public'";
      if (isSelf) {
        privacyCondition = "";
      } else if (isFriend) {
        privacyCondition = "AND s.privacy IN ('public', 'friends')";
      }

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
        LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = $2
        LEFT JOIN (
          SELECT story_id, 
                 (array_agg(reaction_type ORDER BY created_at DESC))[1] AS reaction_type
          FROM story_reactions
          WHERE user_id = $2
          GROUP BY story_id
        ) sr ON sr.story_id = s.id
        WHERE s.author_id = $1
          AND s.expires_at > CURRENT_TIMESTAMP
          AND s.is_deleted = FALSE
          AND s.is_archived = FALSE
          ${isSelf ? "" : "AND s.ai_status != 'hidden' AND (s.media_moderation_status IS NULL OR s.media_moderation_status IN ('safe', 'sensitive'))"}
          ${privacyCondition}
        ORDER BY s.created_at ASC
      `;

      const { rows } = await pool.query(query, [targetUserId, viewerId]);
      if (rows.length === 0) return null;

      const firstRow = rows[0];
      const tray = {
        author: {
          id: firstRow.author_id,
          name: firstRow.full_name,
          username: firstRow.username,
          avatar: firstRow.avatar_url,
          isVerified: Boolean(firstRow.is_verified),
        },
        isSelf,
        hasUnviewedStories: false,
        latestStoryTime: rows[rows.length - 1].created_at,
        stories: [],
      };

      for (const row of rows) {
        if (!row.is_viewed) {
          tray.hasUnviewedStories = true;
        }

        const isToxic = row.ai_label === 'Toxic' || row.ai_status === 'sensitive';
        const isNsfw = row.media_moderation_status === 'sensitive' || row.media_moderation_label === 'nsfw' || (Number(row.media_moderation_nsfw) >= 0.7);
        const isHardHidden = row.ai_status === 'hidden' || row.ai_label === 'Violence' || row.ai_label === 'Hate Speech';

        tray.stories.push({
          id: String(row.id),
          storyType: row.story_type,
          mediaUrl: row.media_url,
          textContent: row.text_content,
          backgroundStyle: typeof row.background_style === 'string' ? JSON.parse(row.background_style) : row.background_style,
          privacy: row.privacy,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          viewsCount: Number(row.views_count || 0),
          reactionsCount: Number(row.reactions_count || 0),
          isViewed: Boolean(row.is_viewed),
          myReaction: row.my_reaction || null,
          isToxic,
          isNsfw,
          isSensitive: (isToxic || isNsfw) && !isHardHidden,
          isHardHidden,
        });
      }

      return tray;
    },

    async listUserArchiveStories({ authorId, limit = 50, offset = 0 }) {
      const query = `
        ${storySelect}
        WHERE s.author_id = $1 AND s.is_deleted = FALSE
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const { rows } = await pool.query(query, [authorId, limit, offset]);
      return rows.map((story) => {
        const isToxic = story.ai_label === 'Toxic' || story.ai_status === 'sensitive';
        const isNsfw = story.media_moderation_status === 'sensitive' || story.media_moderation_label === 'nsfw' || (Number(story.media_moderation_nsfw) >= 0.7);
        const isHardHidden = story.ai_status === 'hidden' || story.ai_label === 'Violence' || story.ai_label === 'Hate Speech';
        return {
          ...story,
          aiStatus: story.ai_status,
          aiLabel: story.ai_label,
          mediaModerationStatus: story.media_moderation_status,
          mediaModerationLabel: story.media_moderation_label,
          isToxic,
          isNsfw,
          isSensitive: (isToxic || isNsfw) && !isHardHidden,
          isHardHidden,
        };
      });
    },

    async markStoryAsViewed({ storyId, viewerId }) {
      if (!storyId || !viewerId) return false;

      // Kiểm tra xem viewer có phải tác giả của tin không
      const storyRes = await pool.query('SELECT author_id FROM stories WHERE id = $1', [storyId]);
      const isAuthor = storyRes.rows.length > 0 && String(storyRes.rows[0].author_id) === String(viewerId);

      // Đảm bảo không đếm trùng lượt xem từ cùng 1 người
      const insertQuery = `
        INSERT INTO story_views (story_id, viewer_id, viewed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (story_id, viewer_id) DO NOTHING
        RETURNING id
      `;
      const res = await pool.query(insertQuery, [storyId, viewerId]);

      if (res.rows.length > 0) {
        // Chỉ tăng views_count nếu không phải tác giả tự xem tin của mình
        if (!isAuthor) {
          await pool.query(
            'UPDATE stories SET views_count = views_count + 1 WHERE id = $1',
            [storyId]
          );
        }
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
      if (String(storyCheck.rows[0].author_id) !== String(authorId)) {
        const error = new Error('Bạn không có quyền xem danh sách người xem của tin này');
        error.statusCode = 403;
        throw error;
      }

      const query = `
        SELECT
          COALESCE(sv.id::text, concat('react-', COALESCE(sv.viewer_id, sr_agg.user_id))) AS view_id,
          COALESCE(sv.viewed_at, sr_agg.last_reaction_at, CURRENT_TIMESTAMP) AS viewed_at,
          u.id AS viewer_id,
          u.username,
          u.full_name,
          u.avatar_url,
          u.is_verified,
          sr_agg.reaction_type,
          COALESCE(sr_agg.reactions, '[]'::json) AS reactions
        FROM (
          SELECT id, story_id, viewer_id, viewed_at FROM story_views WHERE story_id = $1
        ) sv
        FULL OUTER JOIN (
          SELECT
            story_id,
            user_id,
            MAX(created_at) AS last_reaction_at,
            (array_agg(reaction_type ORDER BY created_at DESC))[1] AS reaction_type,
            json_agg(
              json_build_object(
                'type', reaction_type,
                'created_at', created_at
              ) ORDER BY created_at ASC
            ) AS reactions
          FROM story_reactions
          WHERE story_id = $1
          GROUP BY story_id, user_id
        ) sr_agg ON sr_agg.user_id = sv.viewer_id
        JOIN users u ON u.id = COALESCE(sv.viewer_id, sr_agg.user_id)
        WHERE COALESCE(sv.viewer_id, sr_agg.user_id) != $2
        ORDER BY viewed_at DESC
      `;
      const { rows } = await pool.query(query, [storyId, authorId]);
      return rows;
    },

    async reactToStory({ storyId, userId, reactionType = 'like' }) {
      const allowedReactions = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
      if (!allowedReactions.includes(reactionType)) {
        throw new Error(`Loại cảm xúc không hợp lệ: ${reactionType}`);
      }

      await dropUniqueStoryReactionConstraint(pool);

      let res;
      try {
        // Cho phép lưu nhiều lần thả cảm xúc hoặc nhiều loại cảm xúc như Facebook Story
        res = await pool.query(
          `INSERT INTO story_reactions (story_id, user_id, reaction_type, created_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           RETURNING id, reaction_type`,
          [storyId, userId, reactionType]
        );
      } catch (insertErr) {
        // Dự phòng trường hợp DB còn ràng buộc UNIQUE (story_id, user_id)
        res = await pool.query(
          `INSERT INTO story_reactions (story_id, user_id, reaction_type, created_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (story_id, user_id)
           DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP
           RETURNING id, reaction_type`,
          [storyId, userId, reactionType]
        );
      }

      // Tự động ghi nhận lượt xem nếu chưa có để đảm bảo hiển thị đầy đủ trong danh sách người xem tin
      try {
        await this.markStoryAsViewed({ storyId, viewerId: userId });
      } catch (viewErr) {
        // bỏ qua nếu đã xem
      }

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

      // Lấy toàn bộ danh sách reaction của người này trên tin
      let myReactions = [reactionType];
      try {
        const reactionsRes = await pool.query(
          `SELECT reaction_type FROM story_reactions WHERE story_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
          [storyId, userId]
        );
        if (reactionsRes.rows.length > 0) {
          myReactions = reactionsRes.rows.map(r => r.reaction_type);
        }
      } catch {}

      return {
        reactionType: res.rows[0]?.reaction_type,
        reactions: myReactions,
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
      if (String(authorId) !== String(userId) && !isAdmin) {
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

    async interactWidget({ storyId, userId, widgetType, stickerId, option, value, text, userName, userAvatar }) {
      const checkRes = await pool.query(
        'SELECT id, background_style FROM stories WHERE id = $1 AND is_deleted = FALSE',
        [storyId]
      );
      if (checkRes.rows.length === 0) {
        const error = new Error('Không tìm thấy tin');
        error.statusCode = 404;
        throw error;
      }

      let bgStyle = checkRes.rows[0].background_style;
      if (typeof bgStyle === 'string') {
        try { bgStyle = JSON.parse(bgStyle); } catch { bgStyle = {}; }
      }
      bgStyle = bgStyle || {};
      const stickers = Array.isArray(bgStyle.stickers) ? [...bgStyle.stickers] : [];

      let targetSticker = stickers.find(s => String(s.id) === String(stickerId));
      if (!targetSticker && widgetType) {
        targetSticker = stickers.find(s => s.widgetType === widgetType);
      }

      if (!targetSticker) {
        targetSticker = { id: stickerId || `widget-${Date.now()}`, type: 'widget', widgetType };
        stickers.push(targetSticker);
      }

      if (widgetType === 'poll') {
        targetSticker.pollData = targetSticker.pollData || { countA: 0, countB: 0, votes: {} };
        const votes = targetSticker.pollData.votes || {};
        const prevVote = votes[userId];
        if (!prevVote) {
          if (option === 'A') targetSticker.pollData.countA = (targetSticker.pollData.countA || 0) + 1;
          if (option === 'B') targetSticker.pollData.countB = (targetSticker.pollData.countB || 0) + 1;
          votes[userId] = option;
          targetSticker.pollData.votes = votes;
        }
      } else if (widgetType === 'slider') {
        targetSticker.sliderData = targetSticker.sliderData || { totalScore: 0, scoreCount: 0, averageScore: 50, votes: {} };
        const votes = targetSticker.sliderData.votes || {};
        const numericVal = Math.min(100, Math.max(0, Number(value) || 0));
        const prevVal = votes[userId];
        if (prevVal === undefined) {
          targetSticker.sliderData.totalScore = (targetSticker.sliderData.totalScore || 0) + numericVal;
          targetSticker.sliderData.scoreCount = (targetSticker.sliderData.scoreCount || 0) + 1;
        } else {
          targetSticker.sliderData.totalScore = (targetSticker.sliderData.totalScore || 0) - prevVal + numericVal;
        }
        votes[userId] = numericVal;
        targetSticker.sliderData.votes = votes;
        targetSticker.sliderData.averageScore = targetSticker.sliderData.scoreCount > 0
          ? Math.round(targetSticker.sliderData.totalScore / targetSticker.sliderData.scoreCount)
          : numericVal;
      } else if (widgetType === 'question') {
        targetSticker.questionData = targetSticker.questionData || { answers: [] };
        const answers = Array.isArray(targetSticker.questionData.answers) ? targetSticker.questionData.answers : [];
        answers.push({
          userId,
          userName: userName || 'Người dùng',
          userAvatar: userAvatar || null,
          text: String(text || '').slice(0, 500),
          createdAt: new Date().toISOString(),
        });
        targetSticker.questionData.answers = answers;
      }

      bgStyle.stickers = stickers;
      await pool.query(
        'UPDATE stories SET background_style = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(bgStyle), storyId]
      );

      return {
        storyId,
        stickerId: targetSticker.id,
        widgetType,
        pollData: targetSticker.pollData || null,
        sliderData: targetSticker.sliderData || null,
        questionData: targetSticker.questionData || null,
      };
    },
  };
}

