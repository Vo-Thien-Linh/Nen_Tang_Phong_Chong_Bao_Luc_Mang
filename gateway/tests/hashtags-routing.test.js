import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findRouteTarget } from '../src/routeMatcher.js';

const gatewaySource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const postServiceSource = readFileSync(new URL('../../services/post-service/server.js', import.meta.url), 'utf8');

const routes = [
  { prefix: '/api/posts', target: 'posts' },
  { prefix: '/api/hashtags', target: 'posts' },
];

test('gateway maps hashtag endpoints to the post service', () => {
  for (const path of [
    '/api/hashtags/trending?limit=5',
    '/api/hashtags/linhvabien/posts?page=1&limit=20',
    '/api/hashtags/sinhvien/posts?page=1&limit=20',
    '/api/hashtags/linhva%20bien/posts?page=1&limit=20',
  ]) {
    assert.equal(findRouteTarget(path, routes)?.target, 'posts', path);
  }
});

test('gateway hashtag route does not interfere with post routes', () => {
  assert.equal(findRouteTarget('/api/posts?page=1', routes)?.target, 'posts');
  assert.equal(findRouteTarget('/api/hashtags', routes)?.target, 'posts');
  assert.equal(findRouteTarget('/api/unknown', routes), null);
});

test('gateway and post service register the hashtag route', () => {
  assert.match(gatewaySource, /prefix: '\/api\/hashtags', target: SERVICE_URLS\.posts/);
  assert.match(postServiceSource, /app\.use\('\/api\/hashtags', createHashtagsRouter/);
  assert.match(postServiceSource, /createHashtagsRouter.*postRepository/);
});

test('gateway preserves request context, query string, method, and status', () => {
  assert.match(gatewaySource, /const targetUrl = new URL\(req\.url, targetBaseUrl\)/);
  assert.match(gatewaySource, /path: targetUrl\.pathname \+ targetUrl\.search/);
  assert.match(gatewaySource, /method: req\.method/);
  assert.match(gatewaySource, /\.\.\.req\.headers/);
  assert.match(gatewaySource, /res\.writeHead\(proxyRes\.statusCode, proxyRes\.headers\)/);
});
