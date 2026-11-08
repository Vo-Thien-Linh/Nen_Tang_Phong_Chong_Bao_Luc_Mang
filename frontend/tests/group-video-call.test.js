import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshCallManager, getMeshGridLayoutClass } from '../src/utils/meshCallManager.js';

// Polyfills cho môi trường kiểm thử Node.js
if (typeof globalThis.RTCSessionDescription === 'undefined') {
  globalThis.RTCSessionDescription = class RTCSessionDescription {
    constructor(init) {
      this.type = init?.type || 'offer';
      this.sdp = init?.sdp || '';
    }
  };
}

if (typeof globalThis.RTCIceCandidate === 'undefined') {
  globalThis.RTCIceCandidate = class RTCIceCandidate {
    constructor(init) {
      this.candidate = init?.candidate || '';
      this.sdpMid = init?.sdpMid || '';
      this.sdpMLineIndex = init?.sdpMLineIndex || 0;
    }
  };
}

if (typeof globalThis.RTCPeerConnection === 'undefined') {
  globalThis.RTCPeerConnection = class MockRTCPeerConnection {
    constructor(config) {
      this.config = config;
      this.signalingState = 'stable';
      this.connectionState = 'connected';
      this.localDescription = null;
      this.remoteDescription = null;
      this.senders = [];
      this.tracks = [];
      this.ontrack = null;
      this.onicecandidate = null;
    }

    addTrack(track, stream) {
      const sender = {
        track,
        replaceTrack: async (newTrack) => {
          sender.track = newTrack;
        }
      };
      this.senders.push(sender);
      this.tracks.push(track);
      return sender;
    }

    getSenders() {
      return this.senders;
    }

    async createOffer() {
      return { type: 'offer', sdp: 'mock_offer_sdp' };
    }

    async createAnswer() {
      return { type: 'answer', sdp: 'mock_answer_sdp' };
    }

    async setLocalDescription(desc) {
      this.localDescription = desc;
    }

    async setRemoteDescription(desc) {
      this.remoteDescription = desc;
    }

    async addIceCandidate(cand) {
      return true;
    }

    close() {
      this.signalingState = 'closed';
      this.connectionState = 'closed';
    }
  };
}

test('getMeshGridLayoutClass: calculates optimal CSS grid columns & rows for 1-6 participants', () => {
  assert.equal(getMeshGridLayoutClass(1), 'grid-cols-1 grid-rows-1');
  assert.ok(getMeshGridLayoutClass(2).includes('sm:grid-cols-2'));
  assert.ok(getMeshGridLayoutClass(3).includes('md:grid-cols-3'));
  assert.equal(getMeshGridLayoutClass(4), 'grid-cols-2 grid-rows-2');
  assert.ok(getMeshGridLayoutClass(5).includes('grid-cols-2 sm:grid-cols-3'));
  assert.ok(getMeshGridLayoutClass(6).includes('grid-cols-2 sm:grid-cols-3'));
});

test('MeshCallManager: initializes correctly and tracks localStream', () => {
  const mesh = new MeshCallManager();
  assert.equal(mesh.getPeersCount(), 0);
  assert.equal(mesh.isDestroyed, false);

  const mockStream = {
    getTracks: () => [{ kind: 'video', id: 'v1' }, { kind: 'audio', id: 'a1' }]
  };

  mesh.init({
    localStream: mockStream,
    onSignal: () => {},
    onRemoteStream: () => {},
    onPeerLeft: () => {}
  });

  assert.equal(mesh.localStream, mockStream);
});

test('MeshCallManager: createPeer sends offer when isInitiator=true', async () => {
  const mesh = new MeshCallManager();
  const sentSignals = [];

  mesh.init({
    localStream: { getTracks: () => [{ kind: 'video', id: 'vid1' }] },
    onSignal: (toUserId, signal) => {
      sentSignals.push({ toUserId, signal });
    },
    onRemoteStream: () => {},
    onPeerLeft: () => {}
  });

  const pc = await mesh.createPeer('user-456', true);
  assert.ok(pc);
  assert.equal(mesh.getPeersCount(), 1);

  // Initiator generates an offer and dispatches via onSignal
  assert.equal(sentSignals.length, 1);
  assert.equal(sentSignals[0].toUserId, 'user-456');
  assert.equal(sentSignals[0].signal.sdp.type, 'offer');
});

test('MeshCallManager: handleSignal processes offer and dispatches answer', async () => {
  const mesh = new MeshCallManager();
  const sentSignals = [];

  mesh.init({
    localStream: { getTracks: () => [{ kind: 'video', id: 'vid1' }] },
    onSignal: (toUserId, signal) => {
      sentSignals.push({ toUserId, signal });
    },
    onRemoteStream: () => {},
    onPeerLeft: () => {}
  });

  // Receive offer from remote peer
  await mesh.handleSignal('user-789', {
    sdp: { type: 'offer', sdp: 'remote_offer_sdp' }
  });

  assert.equal(mesh.getPeersCount(), 1);
  assert.equal(sentSignals.length, 1);
  assert.equal(sentSignals[0].toUserId, 'user-789');
  assert.equal(sentSignals[0].signal.sdp.type, 'answer');
});

test('MeshCallManager: replaceVideoTrack updates video sender on all active peers in the mesh', async () => {
  const mesh = new MeshCallManager();

  mesh.init({
    localStream: { getTracks: () => [{ kind: 'video', id: 'v1' }, { kind: 'audio', id: 'a1' }] },
    onSignal: () => {},
    onRemoteStream: () => {},
    onPeerLeft: () => {}
  });

  await mesh.createPeer('peer-1', false);
  await mesh.createPeer('peer-2', false);
  assert.equal(mesh.getPeersCount(), 2);

  const newFilterTrack = { kind: 'video', id: 'filtered-ar-track-id' };
  const replaced = await mesh.replaceVideoTrack(newFilterTrack);
  assert.equal(replaced, true);

  // Check each peer sender has been updated
  for (const [, { pc }] of mesh.peers.entries()) {
    const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    assert.equal(videoSender.track.id, 'filtered-ar-track-id');
  }
});

test('MeshCallManager: when sharing screen, newly created peer receives active screen track', async () => {
  const mesh = new MeshCallManager();
  const cameraTrack = { kind: 'video', id: 'camera-video-1' };
  const audioTrack = { kind: 'audio', id: 'mic-audio-1' };
  const screenTrack = { kind: 'video', id: 'screen-share-track-99' };

  mesh.init({
    localStream: {
      getTracks: () => [cameraTrack, audioTrack],
      getVideoTracks: () => [cameraTrack],
      getAudioTracks: () => [audioTrack]
    },
    onSignal: () => {},
    onRemoteStream: () => {},
    onPeerLeft: () => {}
  });

  // User starts screen sharing
  await mesh.replaceVideoTrack(screenTrack);
  assert.equal(mesh.currentVideoTrack.id, 'screen-share-track-99');

  // Now a NEW member joins the call later!
  const newPeerPc = await mesh.createPeer('new-joiner-uuid', false);
  assert.ok(newPeerPc);

  // Verify the new peer's video track is the SCREEN track, NOT the old camera track!
  const videoSender = newPeerPc.getSenders().find(s => s.track && s.track.kind === 'video');
  assert.ok(videoSender);
  assert.equal(videoSender.track.id, 'screen-share-track-99');
});

test('MeshCallManager: removePeer and destroy cleanly tear down all connections', async () => {
  const mesh = new MeshCallManager();
  const leftUsers = [];

  mesh.init({
    localStream: null,
    onSignal: () => {},
    onRemoteStream: () => {},
    onPeerLeft: (userId) => {
      leftUsers.push(userId);
    }
  });

  await mesh.createPeer('user-a', false);
  await mesh.createPeer('user-b', false);
  assert.equal(mesh.getPeersCount(), 2);

  // Remove single peer
  mesh.removePeer('user-a');
  assert.equal(mesh.getPeersCount(), 1);
  assert.ok(leftUsers.includes('user-a'));

  // Destroy remaining
  mesh.destroy();
  assert.equal(mesh.getPeersCount(), 0);
  assert.equal(mesh.isDestroyed, true);
  assert.ok(leftUsers.includes('user-b'));
});

test('Group Call Pin and Spotlight: separates pinned tile and organizes filmstrip thumbnails', () => {
  const allTiles = [
    { userId: 'u1', participant: { name: 'Alice' }, isLocal: true, isScreenShare: false },
    { userId: 'u2', participant: { name: 'Bob' }, isLocal: false, isScreenShare: false },
    { userId: 'screen_u2', participant: { name: 'Màn hình của Bob' }, isLocal: false, isScreenShare: true },
    { userId: 'u3', participant: { name: 'Charlie' }, isLocal: false, isScreenShare: false }
  ];

  // 1. When no tile is pinned
  let pinnedId = null;
  let pinnedTile = pinnedId ? allTiles.find(t => t.userId === pinnedId) : null;
  let otherTiles = pinnedId ? allTiles.filter(t => t.userId !== pinnedId) : [];
  assert.equal(pinnedTile, null);
  assert.equal(otherTiles.length, 0);

  // 2. Pin Bob's screen share
  pinnedId = 'screen_u2';
  pinnedTile = allTiles.find(t => t.userId === pinnedId);
  otherTiles = allTiles.filter(t => t.userId !== pinnedId);

  assert.ok(pinnedTile);
  assert.equal(pinnedTile.userId, 'screen_u2');
  assert.equal(pinnedTile.isScreenShare, true);
  assert.equal(otherTiles.length, 3);
  assert.ok(!otherTiles.some(t => t.userId === 'screen_u2'));

  // 3. Switch pin to Alice
  pinnedId = 'u1';
  pinnedTile = allTiles.find(t => t.userId === pinnedId);
  otherTiles = allTiles.filter(t => t.userId !== pinnedId);

  assert.equal(pinnedTile.userId, 'u1');
  assert.equal(otherTiles.length, 3);
  assert.ok(otherTiles.some(t => t.userId === 'screen_u2'));

  // 4. Unpin returns to balanced state
  pinnedId = null;
  pinnedTile = pinnedId ? allTiles.find(t => t.userId === pinnedId) : null;
  assert.equal(pinnedTile, null);
});

test('MeshCallManager.createPeer: re-sends offer if called again with isInitiator=true on existing peer', async () => {
  const mesh = new MeshCallManager();
  const signals = [];

  mesh.init({
    localStream: {
      getTracks: () => [{ kind: 'video', id: 'v1' }]
    },
    onSignal: (toUserId, sig) => {
      signals.push({ toUserId, sig });
    }
  });

  // 1. Initial call creates peer and dispatches offer
  const pc = await mesh.createPeer('remote-user-1', true);
  assert.ok(pc);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].toUserId, 'remote-user-1');
  assert.equal(signals[0].sig.sdp.type, 'offer');

  // 2. Second call with isInitiator=true on same peer re-dispatches offer cleanly
  const pc2 = await mesh.createPeer('remote-user-1', true);
  assert.equal(pc, pc2);
  assert.equal(signals.length, 2);
  assert.equal(signals[1].toUserId, 'remote-user-1');
  assert.equal(signals[1].sig.sdp.type, 'offer');

  mesh.destroy();
});

