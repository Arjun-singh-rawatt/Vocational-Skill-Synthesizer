import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function main() {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required. Set it in server/.env before starting FluentLens.');
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required. Set it in server/.env before starting FluentLens.');
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[Server] FluentLens server running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
