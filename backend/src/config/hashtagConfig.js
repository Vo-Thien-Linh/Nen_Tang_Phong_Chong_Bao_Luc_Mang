export const DEFAULT_HASHTAG_TRENDING_DAYS = 7;

export function getHashtagTrendingDays(env = process.env) {
  const value = Number(env.HASHTAG_TRENDING_DAYS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_HASHTAG_TRENDING_DAYS;
}
