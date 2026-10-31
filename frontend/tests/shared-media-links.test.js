import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSharedMediaAndLinks } from '../src/utils/messageMediaLogic.js';

test('extractSharedMediaAndLinks: extracts media urls from valid messages', () => {
  const messages = [
    { id: 1, text: 'Hello', mediaUrl: null, isRecalled: false, time: '10:00' },
    { id: 2, text: 'Photo 1', mediaUrl: 'https://images.com/pic1.jpg', mediaType: 'image', isRecalled: false, time: '10:05' },
    { id: 3, text: 'Photo 2', mediaUrl: 'https://images.com/pic2.png', mediaType: 'image', isRecalled: false, time: '10:10' }
  ];

  const result = extractSharedMediaAndLinks(messages);
  assert.equal(result.media.length, 2);
  // Newest first
  assert.equal(result.media[0].id, 3);
  assert.equal(result.media[0].url, 'https://images.com/pic2.png');
  assert.equal(result.media[1].id, 2);
  assert.equal(result.links.length, 0);
});

test('extractSharedMediaAndLinks: extracts links and parses domains from message text', () => {
  const messages = [
    { id: 1, text: 'Tham khảo tài liệu tại https://developer.mozilla.org/en-US/', isRecalled: false, time: '09:00' },
    { id: 2, text: 'Tin tức https://vnexpress.net và repo https://github.com/wings', isRecalled: false, time: '09:15' }
  ];

  const result = extractSharedMediaAndLinks(messages);
  assert.equal(result.links.length, 3);
  // Newest first
  assert.equal(result.links[0].url, 'https://github.com/wings');
  assert.equal(result.links[0].domain, 'github.com');
  assert.equal(result.links[1].domain, 'vnexpress.net');
  assert.equal(result.links[2].domain, 'developer.mozilla.org');
});

test('extractSharedMediaAndLinks: ignores media and links from recalled messages', () => {
  const messages = [
    { id: 1, text: 'Secret https://secret-link.com', mediaUrl: 'https://secret-photo.jpg', isRecalled: true, status: 'recalled', time: '11:00' },
    { id: 2, text: 'Public https://wings.social', mediaUrl: 'https://public-photo.jpg', isRecalled: false, status: 'sent', time: '11:05' }
  ];

  const result = extractSharedMediaAndLinks(messages);
  assert.equal(result.media.length, 1);
  assert.equal(result.media[0].url, 'https://public-photo.jpg');
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].url, 'https://wings.social');
});

test('extractSharedMediaAndLinks: returns empty arrays when no media or links exist', () => {
  const messages = [
    { id: 1, text: 'Xin chào', isRecalled: false },
    { id: 2, text: 'Tôi là sinh viên', isRecalled: false }
  ];

  const result = extractSharedMediaAndLinks(messages);
  assert.deepEqual(result.media, []);
  assert.deepEqual(result.links, []);
});
