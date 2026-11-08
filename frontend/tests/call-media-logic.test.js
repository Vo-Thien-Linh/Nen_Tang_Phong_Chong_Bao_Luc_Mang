import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALL_STATUS,
  CALL_LOG_REASON,
  DEFAULT_ICE_SERVERS,
  formatCallDuration,
  formatCallLogText,
  createCallSession,
  toggleMediaTrack,
  stopMediaStream
} from '../src/utils/callMediaLogic.js';

test('CALL_STATUS: has all expected states', () => {
  assert.equal(CALL_STATUS.IDLE, 'idle');
  assert.equal(CALL_STATUS.OUTGOING, 'outgoing');
  assert.equal(CALL_STATUS.INCOMING, 'incoming');
  assert.equal(CALL_STATUS.CONNECTED, 'connected');
  assert.equal(CALL_STATUS.ENDED, 'ended');
});

test('DEFAULT_ICE_SERVERS: contains google STUN servers', () => {
  assert.ok(DEFAULT_ICE_SERVERS.length >= 2);
  assert.ok(DEFAULT_ICE_SERVERS.some(s => s.urls.includes('stun.l.google.com')));
});

test('formatCallDuration: formats seconds into mm:ss and hh:mm:ss correctly', () => {
  assert.equal(formatCallDuration(0), '00:00');
  assert.equal(formatCallDuration(5), '00:05');
  assert.equal(formatCallDuration(59), '00:59');
  assert.equal(formatCallDuration(60), '01:00');
  assert.equal(formatCallDuration(125), '02:05');
  assert.equal(formatCallDuration(3599), '59:59');
  assert.equal(formatCallDuration(3600), '01:00:00');
  assert.equal(formatCallDuration(3665), '01:01:05');
  assert.equal(formatCallDuration(-10), '00:00');
});

test('createCallSession: initializes valid session metadata', () => {
  const session = createCallSession({
    callerId: 'user-1',
    receiverId: 'user-2',
    callType: 'video',
    partnerName: 'Le Thi B',
    partnerAvatar: 'https://example.com/avatar.jpg'
  });

  assert.ok(session.sessionId.startsWith('call_'));
  assert.equal(session.callerId, 'user-1');
  assert.equal(session.receiverId, 'user-2');
  assert.equal(session.callType, 'video');
  assert.equal(session.partnerName, 'Le Thi B');
  assert.equal(session.partnerAvatar, 'https://example.com/avatar.jpg');
});

test('toggleMediaTrack: enables and disables audio/video tracks', () => {
  const fakeAudioTrack = { kind: 'audio', enabled: true };
  const fakeVideoTrack = { kind: 'video', enabled: true };
  const fakeStream = {
    getAudioTracks: () => [fakeAudioTrack],
    getVideoTracks: () => [fakeVideoTrack]
  };

  const audioRes = toggleMediaTrack(fakeStream, 'audio', false);
  assert.equal(audioRes, true);
  assert.equal(fakeAudioTrack.enabled, false);

  const videoRes = toggleMediaTrack(fakeStream, 'video', false);
  assert.equal(videoRes, true);
  assert.equal(fakeVideoTrack.enabled, false);

  toggleMediaTrack(fakeStream, 'audio', true);
  assert.equal(fakeAudioTrack.enabled, true);

  assert.equal(toggleMediaTrack(null, 'audio', true), false);
});

test('stopMediaStream: stops all tracks safely', () => {
  let stopped1 = false;
  let stopped2 = false;
  const fakeStream = {
    getTracks: () => [
      { stop: () => { stopped1 = true; } },
      { stop: () => { stopped2 = true; } }
    ]
  };

  stopMediaStream(fakeStream);
  assert.equal(stopped1, true);
  assert.equal(stopped2, true);

  // Safe when stream is null or throws
  assert.doesNotThrow(() => stopMediaStream(null));
});

test('CALL_LOG_REASON: has all required call event types', () => {
  assert.equal(CALL_LOG_REASON.DECLINED, 'declined');
  assert.equal(CALL_LOG_REASON.MISSED, 'missed');
  assert.equal(CALL_LOG_REASON.CANCELLED, 'cancelled');
  assert.equal(CALL_LOG_REASON.COMPLETED, 'completed');
  assert.equal(CALL_LOG_REASON.BUSY, 'busy');
  assert.equal(CALL_LOG_REASON.OFFLINE, 'offline');
});

test('formatCallLogText: formats video and audio call messages correctly', () => {
  // Declined
  assert.equal(formatCallLogText({ callType: 'video', reason: 'declined' }), 'Cuộc gọi video bị từ chối');
  assert.equal(formatCallLogText({ callType: 'audio', reason: 'declined' }), 'Cuộc gọi thoại bị từ chối');

  // Missed / no-answer
  assert.equal(formatCallLogText({ callType: 'video', reason: 'missed' }), 'Cuộc gọi video nhỡ');
  assert.equal(formatCallLogText({ callType: 'video', reason: 'no_answer' }), 'Cuộc gọi video nhỡ');
  assert.equal(formatCallLogText({ callType: 'audio', reason: 'missed' }), 'Cuộc gọi thoại nhỡ');

  // Cancelled
  assert.equal(formatCallLogText({ callType: 'video', reason: 'cancelled' }), 'Cuộc gọi video đã hủy');
  assert.equal(formatCallLogText({ callType: 'audio', reason: 'cancelled' }), 'Cuộc gọi thoại đã hủy');

  // Completed with duration
  assert.equal(formatCallLogText({ callType: 'video', reason: 'completed', duration: 75 }), 'Cuộc gọi video • 01:15');
  assert.equal(formatCallLogText({ callType: 'audio', reason: 'completed', duration: 3665 }), 'Cuộc gọi thoại • 01:01:05');

  // Busy and offline
  assert.equal(formatCallLogText({ callType: 'video', reason: 'busy' }), 'Cuộc gọi video • Người nhận bận');
  assert.equal(formatCallLogText({ callType: 'video', reason: 'offline' }), 'Cuộc gọi video • Người nhận không trực tuyến');
});

