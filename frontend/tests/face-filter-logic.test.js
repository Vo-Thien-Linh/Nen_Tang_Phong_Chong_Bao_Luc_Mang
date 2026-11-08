import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALL_FILTERS,
  FILTER_CATEGORIES,
  getFilterConfig,
  isArFilter,
  getColorFilterCss,
  estimateDefaultFace,
  extractLandmarkPositions,
  lerp,
  lerpAngle,
  FaceFilterManager
} from '../src/utils/faceFilterLogic.js';
import { applyVideoTrackToPeer } from '../src/utils/callMediaLogic.js';

test('CALL_FILTERS: contains all essential AR and color filters with proper metadata', () => {
  assert.ok(CALL_FILTERS.length >= 8);
  const ids = CALL_FILTERS.map(f => f.id);

  // Essential filters exist
  assert.ok(ids.includes('none'));
  assert.ok(ids.includes('sunglasses'));
  assert.ok(ids.includes('cat_ears'));
  assert.ok(ids.includes('party_hat'));
  assert.ok(ids.includes('mustache'));
  assert.ok(ids.includes('crown'));
  assert.ok(ids.includes('hearts'));
  assert.ok(ids.includes('sunset'));
  assert.ok(ids.includes('cyberpunk'));
  assert.ok(ids.includes('vintage'));
  assert.ok(ids.includes('beauty'));

  // Each filter has required UI fields
  CALL_FILTERS.forEach(f => {
    assert.ok(typeof f.id === 'string' && f.id.length > 0);
    assert.ok(typeof f.name === 'string' && f.name.length > 0);
    assert.ok(typeof f.icon === 'string' && f.icon.length > 0);
    assert.ok(typeof f.category === 'string');
    assert.ok(typeof f.description === 'string');
  });
});

test('getFilterConfig: finds filter by id or returns default none', () => {
  const catFilter = getFilterConfig('cat_ears');
  assert.equal(catFilter.id, 'cat_ears');
  assert.equal(catFilter.category, 'ar');
  assert.equal(catFilter.name, 'Tai Mèo');

  const sunsetFilter = getFilterConfig('sunset');
  assert.equal(sunsetFilter.id, 'sunset');
  assert.equal(sunsetFilter.category, 'color');

  const unknownFilter = getFilterConfig('invalid_filter_xyz');
  assert.equal(unknownFilter.id, 'none');
});

test('isArFilter: correctly identifies AR sticker vs color/standard filters', () => {
  assert.equal(isArFilter('sunglasses'), true);
  assert.equal(isArFilter('cat_ears'), true);
  assert.equal(isArFilter('party_hat'), true);
  assert.equal(isArFilter('mustache'), true);
  assert.equal(isArFilter('crown'), true);
  assert.equal(isArFilter('hearts'), true);

  assert.equal(isArFilter('none'), false);
  assert.equal(isArFilter('sunset'), false);
  assert.equal(isArFilter('cyberpunk'), false);
  assert.equal(isArFilter('vintage'), false);
  assert.equal(isArFilter('beauty'), false);
});

test('getColorFilterCss: returns valid CSS filter property strings', () => {
  assert.ok(getColorFilterCss('sunset').includes('sepia'));
  assert.ok(getColorFilterCss('cyberpunk').includes('hue-rotate'));
  assert.ok(getColorFilterCss('vintage').includes('grayscale'));
  assert.ok(getColorFilterCss('beauty').includes('brightness'));
  assert.equal(getColorFilterCss('none'), 'none');
  assert.equal(getColorFilterCss('sunglasses'), 'none');
});

test('estimateDefaultFace: generates proportional facial landmarks from dimensions', () => {
  const face = estimateDefaultFace(640, 480);

  assert.equal(typeof face.faceWidth, 'number');
  assert.ok(face.faceWidth > 100);

  // Eyes should be horizontally symmetric around centerX (320)
  assert.equal(face.eyeCenter.x, 320);
  assert.ok(face.eyeLeft.x < 320);
  assert.ok(face.eyeRight.x > 320);
  assert.equal(face.eyeLeft.y, face.eyeRight.y);

  // HeadTop should be above eyes, Nose below eyes, Mouth below nose
  assert.ok(face.headTop.y < face.eyeCenter.y);
  assert.ok(face.nose.y > face.eyeCenter.y);
  assert.ok(face.mouth.y > face.nose.y);
});

test('applyVideoTrackToPeer: replaces video track in PeerConnection sender', async () => {
  let replacedTrack = null;
  const fakeOldTrack = { kind: 'video' };
  const fakeNewTrack = { kind: 'video', id: 'new-filtered-track-id' };
  const fakeSender = {
    track: fakeOldTrack,
    replaceTrack: async (track) => {
      replacedTrack = track;
    }
  };
  const fakePeerConnection = {
    getSenders: () => [fakeSender]
  };

  const result = await applyVideoTrackToPeer(fakePeerConnection, fakeNewTrack);
  assert.equal(result, true);
  assert.equal(replacedTrack, fakeNewTrack);

  // Safety checks
  assert.equal(await applyVideoTrackToPeer(null, fakeNewTrack), false);
  assert.equal(await applyVideoTrackToPeer(fakePeerConnection, null), false);
  assert.equal(await applyVideoTrackToPeer({}, fakeNewTrack), false);
});

test('FaceFilterManager: state transitions and filter switching', () => {
  const manager = new FaceFilterManager();
  assert.equal(manager.getActiveFilterId(), 'none');

  manager.setFilter('cat_ears');
  assert.equal(manager.getActiveFilterId(), 'cat_ears');

  manager.setFilter('sunset');
  assert.equal(manager.getActiveFilterId(), 'sunset');

  manager.setFilter(null);
  assert.equal(manager.getActiveFilterId(), 'none');

  manager.destroy();
  assert.equal(manager.isDestroyed, true);
});

test('extractLandmarkPositions: converts normalized MediaPipe landmarks to canvas pixel coordinates', () => {
  // Mock 468 landmarks array with key points
  const mockLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Set specific landmarks
  mockLandmarks[33] = { x: 0.35, y: 0.4, z: 0 }; // left eye outer
  mockLandmarks[133] = { x: 0.45, y: 0.4, z: 0 }; // left eye inner -> eyeLX = 0.4 * 640 = 256
  mockLandmarks[263] = { x: 0.65, y: 0.4, z: 0 }; // right eye outer
  mockLandmarks[362] = { x: 0.55, y: 0.4, z: 0 }; // right eye inner -> eyeRX = 0.6 * 640 = 384
  mockLandmarks[10] = { x: 0.5, y: 0.2, z: 0 }; // headTop -> y = 0.2 * 480 = 96
  mockLandmarks[1] = { x: 0.5, y: 0.5, z: 0 }; // nose -> y = 0.5 * 480 = 240
  mockLandmarks[13] = { x: 0.5, y: 0.65, z: 0 }; // mouth -> y = 0.65 * 480 = 312
  mockLandmarks[234] = { x: 0.2, y: 0.45, z: 0 }; // left cheek
  mockLandmarks[454] = { x: 0.8, y: 0.45, z: 0 }; // right cheek -> faceWidth = 0.6 * 640 = 384

  const face = extractLandmarkPositions(mockLandmarks, 640, 480);
  assert.ok(face !== null);
  assert.equal(Math.round(face.eyeLeft.x), 256);
  assert.equal(Math.round(face.eyeRight.x), 384);
  assert.equal(Math.round(face.eyeCenter.x), 320);
  assert.equal(Math.round(face.eyeCenter.y), 192);
  assert.equal(Math.round(face.headTop.x), 320);
  assert.equal(Math.round(face.headTop.y), 96);
  assert.equal(Math.round(face.nose.x), 320);
  assert.equal(Math.round(face.nose.y), 240);
  assert.equal(Math.round(face.mouth.x), 320);
  assert.equal(Math.round(face.mouth.y), 312);
  assert.equal(face.angle, 0); // No tilt
});

test('lerp and lerpAngle: smooths values without overshoot', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(lerp(100, 200, 0.2), 120);

  const angle1 = lerpAngle(0, Math.PI / 2, 0.5);
  assert.ok(Math.abs(angle1 - Math.PI / 4) < 0.001);
});


