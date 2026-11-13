import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<typeof mongoose> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Set it before starting FluentLens.');
  }
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    throw new Error('MongoDB connection failed. Check MONGODB_URI and database availability.');
  }
}
