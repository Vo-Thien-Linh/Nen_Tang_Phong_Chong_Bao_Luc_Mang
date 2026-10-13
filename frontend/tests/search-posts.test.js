import test from 'node:test';
import assert from 'node:assert/strict';

function filterPostsByQuery(posts, query) {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return posts;
  return posts.filter(p => {
    const contentMatch = p.content && p.content.toLowerCase().includes(trimmed);
    const tagMatch = p.tag && p.tag.toLowerCase().includes(trimmed);
    const authorMatch = p.author && (
      (p.author.name && p.author.name.toLowerCase().includes(trimmed)) ||
      (p.author.username && p.author.username.toLowerCase().includes(trimmed))
    );
    return contentMatch || tagMatch || authorMatch;
  });
}

test('search filters posts by keyword in content', () => {
  const posts = [
    { id: 1, content: 'Học lập trình React và FastAPI', tag: '#tech', author: { name: 'Alice' } },
    { id: 2, content: 'Hôm nay trời rất đẹp', tag: '#life', author: { name: 'Bob' } },
  ];

  const results = filterPostsByQuery(posts, 'FastAPI');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 1);
});

test('search filters posts by hashtag', () => {
  const posts = [
    { id: 1, content: 'Bài viết số 1', tag: '#AI', author: { name: 'Alice' } },
    { id: 2, content: 'Bài viết số 2', tag: '#PhoBERT', author: { name: 'Bob' } },
  ];

  const results = filterPostsByQuery(posts, '#phobert');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 2);
});

test('search filters posts by author name', () => {
  const posts = [
    { id: 1, content: 'Nội dung bất kỳ', tag: '#general', author: { name: 'Nguyen Van A', username: 'anguyen' } },
    { id: 2, content: 'Nội dung khác', tag: '#general', author: { name: 'Tran Thi B', username: 'btran' } },
  ];

  const results = filterPostsByQuery(posts, 'nguyen');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 1);
});
