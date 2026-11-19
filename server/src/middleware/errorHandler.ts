import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Global Error Handler]', err);

  const rawStatusCode = err.status || err.statusCode || 500;
  const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : Number.isInteger(rawStatusCode) && rawStatusCode >= 400 && rawStatusCode <= 599 ? rawStatusCode : 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? `Uploaded file exceeds the ${env.MAX_UPLOAD_MB} MB limit.`
    : !isDevelopment && statusCode >= 500 ? 'Internal Server Error' : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(isDevelopment ? { stack: err.stack } : {}),
  });
}
