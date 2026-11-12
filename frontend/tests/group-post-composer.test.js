import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getHashtagHighlightParts } from '../src/utils/hashtagHighlight.js';
import { validateImageFile } from '../src/utils/imageLogic.js';
import { getGroupModerationSourceLabel, selectGroupModerationPreview } from '../src/utils/groupModerationPreview.js';

const composerSource = readFileSync(new URL('../src/components/CommunityGroupsView.jsx', import.meta.url), 'utf8');
const interactionSource = readFileSync(new URL('../src/components/GroupPostCard.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/components/HomeView.jsx', import.meta.url), 'utf8');

test('group composer highlights hashtags in drafts and published posts', () => {
  const text = 'Chia sẻ #CộngĐồng';
  const parts = getHashtagHighlightParts(text);

  assert.equal(parts.find((part) => part.type === 'hashtag').value, '#CộngĐồng');
  assert.match(composerSource, /getHashtagHighlightParts\(postContent\)/);
  assert.match(composerSource, /<HashtagText text=\{post\.content\}/);
  assert.match(interactionSource, /<HashtagText text=\{post\.content\}/);
});

test('group feed is the default view and the post composer stays collapsed until requested', () => {
  assert.match(composerSource, /const \[activePanel, setActivePanel\] = useState\('posts'\)/);
  assert.match(composerSource, /const \[postComposerOpen, setPostComposerOpen\] = useState\(false\)/);
  assert.match(composerSource, /aria-expanded=\{postComposerOpen\}/);
  assert.match(composerSource, /hidden=\{!postComposerOpen\}/);
  assert.match(composerSource, /Bài viết đã được duyệt sẽ hiển thị tại đây/);
});

test('group view reports a failed post feed instead of silently showing an empty list', () => {
  assert.match(composerSource, /postsResult\.status === 'fulfilled' && Array\.isArray\(postsResult\.value\.data\)/);
  assert.match(composerSource, /setError\(postsResult\.reason\?\.message \|\| 'Không tải được bài viết của nhóm/);
});

test('group composer validates image formats and keeps selected files local until posting', () => {
  assert.equal(validateImageFile({ name: 'photo.webp', type: 'image/webp', size: 1024 }).valid, true);
  assert.equal(validateImageFile({ name: 'archive.zip', type: 'application/zip', size: 1024 }).valid, false);
  assert.match(composerSource, /validateImageFile\(file\)/);
  const imageChangeHandler = composerSource.match(/const handlePostImageChange = \(event\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.match(imageChangeHandler, /setPostImage\(file\)/);
  assert.doesNotMatch(imageChangeHandler, /uploadPostImage/);
  const submitHandler = composerSource.match(/const handleCreatePost = async \(event\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.ok(submitHandler.indexOf('previewPostImage(postImage') < submitHandler.indexOf('uploadCommunityGroupPostImage(postImage)'));
  assert.match(submitHandler, /imageCheck\?\.failed/);
  assert.match(submitHandler, /cleanupCommunityGroupPostImage/);
  assert.match(composerSource, /<ImagePreview src=\{postImagePreview\}/);
});

test('group composer offers text and image AI previews without bypassing group approval', () => {
  assert.match(composerSource, /previewPostImage\(postImage, currentUser\?\.id\)/);
  assert.match(composerSource, /apiUrl\}\/api\/v1\/moderate/);
  assert.match(composerSource, /selectGroupModerationPreview\(aiPreview, imageAiPreview\)/);
  assert.match(composerSource, /Độ tin cậy/);
  assert.match(composerSource, /setImageAiPreview\(result\)/);
  assert.doesNotMatch(composerSource, /setImageAiPreview\(result\?\.category/);
  assert.match(composerSource, /createCommunityGroupPost\(\{ groupId: selectedGroup\.id, content: postContent, imageUrl, imageCleanupToken \}\)/);
  assert.match(composerSource, /AI chỉ gợi ý; người quản lý nhóm quyết định\./);
});

test('group preview selects the more severe text or image label and keeps its confidence', () => {
  const textViolation = { label: 'Violence', confidence: 0.81, model_source: 'phobert' };
  const sensitiveImage = { category: 'SENSITIVE', confidence: 0.94, confidenceLabel: 'Nội dung nhạy cảm' };
  const imageViolation = { category: 'VIOLATION', confidence: 0.87, confidenceLabel: 'Bạo lực' };

  assert.deepEqual(selectGroupModerationPreview({ label: 'Normal', confidence: 0.99 }, sensitiveImage), {
    type: 'image', label: 'SENSITIVE', severity: 3, confidence: 0.94, confidenceLabel: 'Nội dung nhạy cảm', source: 'efficientnet-b1',
  });
  assert.deepEqual(selectGroupModerationPreview({ label: 'Toxic', confidence: 0.99 }, imageViolation), {
    type: 'image', label: 'VIOLATION', severity: 4, confidence: 0.87, confidenceLabel: 'Bạo lực', source: 'efficientnet-b1',
  });
  assert.deepEqual(selectGroupModerationPreview(textViolation, { category: 'SAFE', confidence: 0.99 }), {
    type: 'text', label: 'Violence', severity: 4, confidence: 0.81, source: 'phobert',
  });
  assert.equal(selectGroupModerationPreview({ error: 'Không kiểm tra được' }, { category: 'PENDING_REVIEW', failed: true }).confidence, null);
});

test('group composer shows only known model sources in its detailed AI preview', () => {
  assert.equal(getGroupModerationSourceLabel('legacy'), '');
  assert.equal(getGroupModerationSourceLabel('not_applicable'), '');
  assert.equal(getGroupModerationSourceLabel('phobert'), 'PhoBERT');
  assert.match(composerSource, /getGroupModerationSourceLabel\(moderationPreview\.source\) &&/);
  assert.doesNotMatch(composerSource, /getGroupModerationSourceLabel\(post\.aiSource\)/);
  assert.doesNotMatch(composerSource, /moderationSourceLabel\(/);
});

test('group review cards show one highest-severity text or image label with its confidence', () => {
  const moderationBadge = composerSource.match(/function ModerationBadges\([\s\S]*?\n\}/)?.[0] || '';

  assert.match(moderationBadge, /selectGroupModerationPreview\(\s*\{\s*label:\s*post\.aiLabel/);
  assert.match(moderationBadge, /moderation\.type === 'image'/);
  assert.match(moderationBadge, /Math\.round\(moderation\.confidence \* 100\)/);
  assert.match(composerSource, /activePanel === 'review'[\s\S]*?<ModerationBadges post=\{post\} className="mt-0" \/>/);
  assert.doesNotMatch(composerSource, /aiLabel\(post\.aiLabel\)\}\{post\.aiConfidence/);
  assert.doesNotMatch(composerSource, /Gợi ý AI: \{post\.aiAction/);
});

test('group moderation badges hide a safe-only result', () => {
  const moderationBadge = composerSource.match(/function ModerationBadges\([\s\S]*?\n\}/)?.[0] || '';

  assert.match(moderationBadge, /if \(!moderation \|\| moderation\.severity === 0\) return null/);
});

test('approved group posts have persisted reactions, comments, and sharing in group and home feeds', () => {
  assert.match(composerSource, /post\.status === 'approved'[\s\S]*?<GroupPostCard/);
  assert.match(homeSource, /<GroupPostCard[\s\S]*?showGroup/);
  assert.match(interactionSource, /updateCommunityGroupPostReaction\(/);
  assert.match(interactionSource, /fetchCommunityGroupPostComments\(/);
  assert.match(interactionSource, /createCommunityGroupPostComment\(/);
  assert.match(interactionSource, /shareCommunityGroupPost\(/);
  assert.match(interactionSource, /applyReactionCounts,[\s\S]*REACTIONS/);
  assert.match(interactionSource, /REACTIONS\.map\(\(item\) =>/);
  assert.match(interactionSource, /reactionCounts/);
  assert.match(interactionSource, />Thích/);
  assert.match(interactionSource, />Bình luận/);
  assert.match(interactionSource, /<SharePostModal/);
  assert.match(interactionSource, /postUrl=\{shareUrl\.toString\(\)\}/);
  assert.match(interactionSource, /Chia sẻ<\/button>/);
  assert.match(interactionSource, /aria-expanded=\{commentsOpen\}/);
  assert.match(interactionSource, /disabled=\{submittingComment \|\| \(!commentText\.trim\(\) && !commentImageFile\)\}/);
  assert.match(interactionSource, /toggleSaveCommunityGroupPost/);
  assert.match(interactionSource, /updateCommunityGroupPost/);
  assert.match(interactionSource, /deleteCommunityGroupPost/);
  assert.match(interactionSource, /createCommunityGroupReport/);
  assert.match(interactionSource, /createCommunityGroupPostAppeal/);
  assert.match(interactionSource, /VerifiedBadge/);
  assert.match(homeSource, /id: post\.id/);
});

test('group posts and comments use profile photos with the shared avatar fallback', () => {
  assert.match(interactionSource, /import \{ DEFAULT_AVATAR \} from '\.\.\/constants\/defaults'/);
  assert.match(interactionSource, /src=\{authorAvatar \|\| DEFAULT_AVATAR\}/);
  assert.match(interactionSource, /src=\{comment\.authorAvatar \|\| DEFAULT_AVATAR\}/);
  assert.match(interactionSource, /onError=\{\(event\) => \{ event\.currentTarget\.src = DEFAULT_AVATAR; \}\}/);
});
