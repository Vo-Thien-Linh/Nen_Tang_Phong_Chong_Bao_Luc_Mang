import { buildPostVisibilityPredicate } from './postVisibility.js';

export function createHashtagRepository({ pool, postRepository }) {
  return {
    async findTrending({ limit = 5, days = 7 }) {
      const safeLimit = Math.min(10, Math.max(1, Number(limit) || 5));
      const safeDays = Number(days) > 0 ? Number(days) : 7;
      const result = await pool.query(
        `WITH counted AS (
           SELECT h.tag, h.display_tag, p.id, p.author_id, p.created_at
           FROM post_hashtags h
           JOIN posts p ON p.id = h.post_id
           WHERE p.created_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
             AND ${buildPostVisibilityPredicate(null, { publicOnly: true })}
         ), stats AS (
           SELECT tag, COUNT(DISTINCT id)::int AS post_count,
                  COUNT(DISTINCT author_id)::int AS author_count,
                  MAX(created_at) AS latest_use
           FROM counted
           GROUP BY tag
         ), display AS (
           SELECT tag, display_tag,
                  ROW_NUMBER() OVER (
                    PARTITION BY tag
                    ORDER BY COUNT(*) DESC, MAX(created_at) DESC, display_tag
                  ) AS display_rank
           FROM counted
           GROUP BY tag, display_tag
         )
         SELECT stats.tag, display.display_tag, stats.post_count,
                stats.author_count, stats.latest_use
         FROM stats
         JOIN display ON display.tag = stats.tag AND display.display_rank = 1
         ORDER BY stats.author_count DESC, stats.post_count DESC,
                  stats.latest_use DESC, stats.tag
         LIMIT $2`,
        [safeDays, safeLimit]
      );
      return result.rows.map((row) => ({
        tag: row.tag,
        displayTag: row.display_tag || row.tag,
        postCount: Number(row.post_count || 0),
        authorCount: Number(row.author_count || 0),
      }));
    },

    async findPosts({ tag, page = 1, limit = 20, viewerId = null }) {
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
      const params = [];
      let viewerParam = null;
      if (viewerId) {
        params.push(viewerId);
        viewerParam = '$1';
      }
      params.push(tag);
      const tagParam = `$${params.length}`;
      const limitParam = `$${params.length + 1}`;
      const offsetParam = `$${params.length + 2}`;
      params.push(safeLimit, (safePage - 1) * safeLimit);

      const result = await pool.query(
        `SELECT p.id, COUNT(*) OVER()::int AS total_count
         FROM post_hashtags h
         JOIN posts p ON p.id = h.post_id
         WHERE h.tag = ${tagParam}
           AND ${buildPostVisibilityPredicate(viewerParam, { publicOnly: true })}
         ORDER BY p.created_at DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
      );
      const posts = [];
      for (const row of result.rows) {
        const post = await postRepository.findById(row.id, viewerId);
        if (post) posts.push(post);
      }
      return {
        posts,
        total: Number(result.rows[0]?.total_count || 0),
        page: safePage,
        limit: safeLimit,
      };
    },
  };
}
