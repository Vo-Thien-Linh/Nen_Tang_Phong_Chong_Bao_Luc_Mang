const clients = new Map();
let publisher = null;

function canDeliver(event, userId) {
  if (!Array.isArray(event?.audienceUserIds)) return true;
  return event.audienceUserIds.some((id) => String(id) === String(userId));
}

function publicEvent(event) {
  if (!event || !Object.prototype.hasOwnProperty.call(event, 'audienceUserIds')) return event;
  const { audienceUserIds: _audienceUserIds, ...safeEvent } = event;
  return safeEvent;
}

function broadcastLocal(event) {
  const payload = `data: ${JSON.stringify(publicEvent(event))}\n\n`;
  for (const [client, userId] of clients) {
    if (!canDeliver(event, userId)) continue;
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export const realtimeService = {
  addClient(res, userId = null) {
    clients.set(res, userId);
  },
  removeClient(res) {
    clients.delete(res);
  },
  setPublisher(nextPublisher) {
    publisher = typeof nextPublisher === 'function' ? nextPublisher : null;
  },
  broadcastLocal,
  broadcast(event) {
    broadcastLocal(event);
    if (publisher) {
      Promise.resolve(publisher(event)).catch((error) => {
        console.warn('[Realtime] Event publish failed:', error.message);
      });
    }
  }
};
