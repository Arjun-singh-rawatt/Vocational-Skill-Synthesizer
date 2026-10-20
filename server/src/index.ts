import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[Server] FluentLens server running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
