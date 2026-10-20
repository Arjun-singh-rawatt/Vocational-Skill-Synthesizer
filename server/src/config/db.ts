import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<typeof mongoose | null> {
  if (!env.MONGODB_URI) {
    console.warn('[MongoDB] MONGODB_URI is not defined. Database operations will fail unless provided.');
    return null;
  }
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    console.warn('[MongoDB] Continuing server execution; database dependent features will return errors until MongoDB is available.');
    return null;
  }
}
