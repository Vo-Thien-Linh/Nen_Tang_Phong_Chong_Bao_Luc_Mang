export function createUserRepository({ pool }) {
  return {
    async findById(userId) {
      const result = await pool.query(
        `SELECT id, username, full_name, avatar_url, role, is_verified, status, cooldown_until
         FROM users
         WHERE id = $1`,
        [userId]
      );

      return result.rows[0] || null;
    },
  };
}
