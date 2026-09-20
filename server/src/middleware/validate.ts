import type { ZodType, ZodTypeDef } from 'zod';
import { badRequest } from '../lib/errors.js';

/** Validate `data` against a zod schema; throws a 400 HttpError with a friendly message on failure. */
export function parse<Output, Input = unknown>(schema: ZodType<Output, ZodTypeDef, Input>, data: unknown): Output {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    throw badRequest(`${path}${issue?.message ?? 'Invalid input'}`, result.error.flatten());
  }
  return result.data;
}
