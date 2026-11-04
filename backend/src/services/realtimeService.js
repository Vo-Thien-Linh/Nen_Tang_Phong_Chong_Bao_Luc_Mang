const clients = new Set();
let publisher = null;

function broadcastLocal(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export const realtimeService = {
  addClient(res) {
    clients.add(res);
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
