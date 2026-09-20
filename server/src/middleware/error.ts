import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';
import { config } from '../config.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  const anyErr = err as { status?: number; message?: string; type?: string };
  if (anyErr?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (anyErr?.status && anyErr.status < 500) return res.status(anyErr.status).json({ error: anyErr.message });
  console.error('[api] unhandled error', err);
  res.status(500).json({ error: config.isProd ? 'Something went wrong' : (anyErr?.message ?? 'Internal error') });
}

/** Wrap async handlers so rejected promises reach the error middleware (Express 5 does this natively, kept for clarity/compat). */
export const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
