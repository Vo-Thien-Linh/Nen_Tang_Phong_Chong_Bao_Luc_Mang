import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrustDeduction,
  getTrustTier,
  TRUST_TIERS,
  applyTrustPenalty,
  refundTrustPoints,
  checkAndRecoverTrustScore,
} from '../src/services/trustScoreService.js';

test('calculateTrustDeduction: correctly calculates single and multimodal deductions', () => {
  // Safe / Normal
  assert.equal(calculateTrustDeduction('Normal', 'safe'), 0);
  assert.equal(calculateTrustDeduction('Normal', 'pending_review'), 0);

  // Single violations
  assert.equal(calculateTrustDeduction('Toxic', 'safe'), 5);
  assert.equal(calculateTrustDeduction('Hate Speech', 'safe'), 20);
  assert.equal(calculateTrustDeduction('Violence', 'safe'), 35);
  assert.equal(calculateTrustDeduction('Normal', 'sensitive'), 10);
  assert.equal(calculateTrustDeduction('Normal', 'rejected_hold'), 35);

  // Multimodal double violations (1.4x multiplier)
  assert.equal(calculateTrustDeduction('Violence', 'rejected_hold'), 49);
  assert.equal(calculateTrustDeduction('Toxic', 'sensitive'), 14);
});

test('getTrustTier: categorizes scores into tiers correctly', () => {
  assert.equal(getTrustTier(100), TRUST_TIERS.GOOD);
  assert.equal(getTrustTier(90), TRUST_TIERS.GOOD);
  assert.equal(getTrustTier(89), TRUST_TIERS.FAIR);
  assert.equal(getTrustTier(70), TRUST_TIERS.FAIR);
  assert.equal(getTrustTier(69), TRUST_TIERS.WARNING);
  assert.equal(getTrustTier(50), TRUST_TIERS.WARNING);
  assert.equal(getTrustTier(49), TRUST_TIERS.RESTRICTED);
  assert.equal(getTrustTier(0), TRUST_TIERS.RESTRICTED);
});

test('applyTrustPenalty: deducts score and records log', async () => {
  const queries = [];
  const mockPool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        return { rows: [{ id: 'u1', trust_score: 65, status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  const res = await applyTrustPenalty({
    pool: mockPool,
    userId: 'u1',
    amount: 35,
    reason: 'Đăng bài viết bạo lực',
    actionType: 'post_violation',
    contentId: 123,
  });

  assert.equal(res.trustScore, 65);
  assert.equal(res.deducted, 35);
  assert.equal(res.trustTier, TRUST_TIERS.WARNING);
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO user_trust_logs')));
});

test('refundTrustPoints: restores points up to 100 on successful appeal', async () => {
  const queries = [];
  const mockPool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/UPDATE users[\s\S]*trust_score = LEAST/i.test(sql)) {
        return { rows: [{ id: 'u1', trust_score: 85 }] };
      }
      return { rows: [] };
    },
  };

  const res = await refundTrustPoints({
    pool: mockPool,
    userId: 'u1',
    amount: 20,
    reason: 'Minh oan',
    contentId: 123,
  });

  assert.equal(res.trustScore, 85);
  assert.equal(res.refunded, 20);
  assert.equal(res.trustTier, TRUST_TIERS.FAIR);
  assert.ok(queries.some(q => q.sql.includes('appeal_refund')));
});

test('checkAndRecoverTrustScore: recovers +3 points after 3 days without violation', async () => {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const mockPool = {
    async query(sql) {
      if (sql.includes('SELECT id, trust_score')) {
        return { rows: [{ id: 'u1', current_score: 80, last_trust_recovery_at: fourDaysAgo }] };
      }
      if (sql.includes('SELECT id FROM user_trust_logs')) {
        return { rows: [] }; // No recent violations
      }
      if (/UPDATE users[\s\S]*trust_score = LEAST/i.test(sql)) {
        return { rows: [{ trust_score: 83 }] };
      }
      return { rows: [] };
    },
  };

  const res = await checkAndRecoverTrustScore({
    pool: mockPool,
    userId: 'u1',
  });

  assert.equal(res.recovered, true);
  assert.equal(res.added, 3);
  assert.equal(res.trustScore, 83);
});
