import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import mongoose from 'mongoose';
import { createServer, Server } from 'node:http';

vi.mock('../middleware/auth', () => ({ authMiddleware: (req: any, _res: any, next: any) => { req.userId = 'user-id'; next(); } }));
vi.mock('../models/User', () => ({ User: { findById: vi.fn() } }));
vi.mock('../models/VocabWord', () => ({ VocabWord: { countDocuments: vi.fn().mockResolvedValue(0) } }));
vi.mock('../models/Session', () => ({ Session: { find: vi.fn() } }));

import router from '../routes/progress';
import { User } from '../models/User';
import { Session } from '../models/Session';

describe('GET /api/progress practice dates', () => {
  let server: Server | undefined;
  const oldReadyState = mongoose.connection.readyState;

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    (mongoose.connection as any).readyState = oldReadyState;
  });

  async function getProgress(sessions: any[]) {
    (mongoose.connection as any).readyState = 1;
    vi.mocked(User.findById).mockResolvedValue({ timezone: 'Asia/Kolkata' } as any);
    vi.mocked(Session.find).mockImplementation(((filter: any) => ({ sort: () => Promise.resolve(sessions.filter((session) => session.status === filter.status)) })) as any);
    const app = express();
    app.use('/api/progress', router);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not start test server');
    return fetch(`http://127.0.0.1:${address.port}/api/progress`).then((response) => response.json());
  }

  it('returns sorted distinct done dates converted using the user timezone', async () => {
    const body = await getProgress([
      { _id: { toString: () => 'a' }, createdAt: new Date('2026-11-03T00:00:00Z'), status: 'done' },
      { _id: { toString: () => 'b' }, createdAt: new Date('2026-11-01T23:30:00Z'), status: 'done' },
      { _id: { toString: () => 'c' }, createdAt: new Date('2026-11-02T02:00:00Z'), status: 'done' },
      { _id: { toString: () => 'd' }, createdAt: new Date('2026-11-05T12:00:00Z'), status: 'failed' },
    ]);
    expect(body.practiceDates).toEqual(['2026-11-02', '2026-11-03']);
    expect(body.history).toHaveLength(3);
  });

  it('returns an empty practiceDates array for a new account', async () => {
    const body = await getProgress([]);
    expect(body.practiceDates).toEqual([]);
    expect(body.totalSessions).toBe(0);
  });
});
