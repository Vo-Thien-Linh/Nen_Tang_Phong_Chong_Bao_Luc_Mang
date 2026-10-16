const clients = new Set();

export const realtimeService = {
  addClient(res) {
    clients.add(res);
  },
  removeClient(res) {
    clients.delete(res);
  },
  broadcast(event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
};
