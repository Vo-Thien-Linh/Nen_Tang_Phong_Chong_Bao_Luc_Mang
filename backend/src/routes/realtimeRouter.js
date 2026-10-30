import express from 'express';
import { realtimeService } from '../services/realtimeService.js';

export function createRealtimeRouter() {
  const router = express.Router();

  /**
   * GET /api/realtime/stream
   * Server-Sent Events (SSE) Stream
   */
  router.get('/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);
    realtimeService.addClient(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      realtimeService.removeClient(res);
    });
  });

  return router;
}

