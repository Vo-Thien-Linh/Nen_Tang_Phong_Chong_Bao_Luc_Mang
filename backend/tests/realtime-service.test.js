import test from 'node:test';
import assert from 'node:assert/strict';
import { realtimeService } from '../src/services/realtimeService.js';

function createMockClient() {
  const writes = [];
  return {
    writes,
    write(chunk) {
      writes.push(chunk);
    },
  };
}

function createFailingClient(errorMessage = 'Socket destroyed') {
  let attempts = 0;
  return {
    get attempts() {
      return attempts;
    },
    write() {
      attempts++;
      throw new Error(errorMessage);
    },
  };
}

test('realtimeService: broadcasts SSE formatted message to a registered client', () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const event = { type: 'CONNECTED', message: 'SSE connection established' };
    realtimeService.broadcast(event);

    assert.equal(client.writes.length, 1);
    assert.equal(client.writes[0], `data: ${JSON.stringify(event)}\n\n`);
  } finally {
    realtimeService.removeClient(client);
  }
});

test('realtimeService: broadcasts message to all registered clients', () => {
  const client1 = createMockClient();
  const client2 = createMockClient();
  const client3 = createMockClient();

  realtimeService.addClient(client1);
  realtimeService.addClient(client2);
  realtimeService.addClient(client3);

  try {
    const event = {
      type: 'POST_CREATED',
      post: { id: 'p-100', content: 'Bài viết thử nghiệm realtime' },
    };
    realtimeService.broadcast(event);

    const expectedPayload = `data: ${JSON.stringify(event)}\n\n`;
    assert.equal(client1.writes.length, 1);
    assert.equal(client1.writes[0], expectedPayload);
    assert.equal(client2.writes.length, 1);
    assert.equal(client2.writes[0], expectedPayload);
    assert.equal(client3.writes.length, 1);
    assert.equal(client3.writes[0], expectedPayload);
  } finally {
    realtimeService.removeClient(client1);
    realtimeService.removeClient(client2);
    realtimeService.removeClient(client3);
  }
});

test('realtimeService: does not send messages to removed clients', () => {
  const activeClient = createMockClient();
  const removedClient = createMockClient();

  realtimeService.addClient(activeClient);
  realtimeService.addClient(removedClient);

  try {
    realtimeService.removeClient(removedClient);

    const event = { type: 'POST_DELETED', postId: 'p-999' };
    realtimeService.broadcast(event);

    assert.equal(activeClient.writes.length, 1);
    assert.equal(removedClient.writes.length, 0);
  } finally {
    realtimeService.removeClient(activeClient);
  }
});

test('realtimeService: automatically purges failing/disconnected client on write error', () => {
  const healthyClient = createMockClient();
  const failingClient = createFailingClient('Connection closed by peer');

  realtimeService.addClient(healthyClient);
  realtimeService.addClient(failingClient);

  try {
    const event1 = { type: 'COMMENT_CREATED', postId: 'p-1', comment: { id: 'c-1' } };
    assert.doesNotThrow(() => {
      realtimeService.broadcast(event1);
    });

    assert.equal(healthyClient.writes.length, 1);
    assert.equal(failingClient.attempts, 1);

    const event2 = { type: 'POST_UPDATED', post: { id: 'p-1', content: 'Updated' } };
    realtimeService.broadcast(event2);

    assert.equal(healthyClient.writes.length, 2);
    // failingClient should have been purged, so attempts remains 1
    assert.equal(failingClient.attempts, 1);
  } finally {
    realtimeService.removeClient(healthyClient);
    realtimeService.removeClient(failingClient);
  }
});

test('realtimeService: handles broadcast when no clients are connected without throwing', () => {
  assert.doesNotThrow(() => {
    realtimeService.broadcast({ type: 'PING' });
  });
});

test('realtimeService: removeClient is idempotent and safe for unregistered client', () => {
  const unregisteredClient = createMockClient();
  assert.doesNotThrow(() => {
    realtimeService.removeClient(unregisteredClient);
  });
});

test('realtimeService: correctly encodes unicode Vietnamese characters and complex objects in SSE payload', () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const event = {
      type: 'POST_CREATED',
      post: {
        id: 'p-vi-1',
        content: 'Chào mừng bạn đến với Mạng xã hội phòng chống bạo lực mạng! 🛡️',
        author: {
          name: 'Võ Thiện Linh',
          role: 'Quản trị viên',
        },
        tags: ['#anninh', '#antoan'],
      },
    };

    realtimeService.broadcast(event);

    assert.equal(client.writes.length, 1);
    const rawPayload = client.writes[0];
    assert.ok(rawPayload.startsWith('data: '));
    assert.ok(rawPayload.endsWith('\n\n'));

    const jsonStr = rawPayload.slice(6, -2);
    const parsed = JSON.parse(jsonStr);
    assert.deepEqual(parsed, event);
  } finally {
    realtimeService.removeClient(client);
  }
});
