import app from './app';
import { connectDB } from './config/db';
import { validateEnvironment, env } from './config/env';
import path from 'path';
import { sweepUploadsDirectory } from './services/sessionMedia';

async function main() {
  validateEnvironment();
  sweepUploadsDirectory(path.join(__dirname, '../uploads'));
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[Server] FluentLens server running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
