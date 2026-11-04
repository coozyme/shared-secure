import type { z } from 'zod';
import { BadRequestError, PayloadTooLargeError, UnsupportedMediaTypeError } from './errors';

/**
 * Reads and validates a JSON body with a hard byte cap. Rejects early on Content-Length, then
 * enforces the cap while streaming in case the header is missing or wrong.
 */
export async function readJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes: number,
): Promise<z.output<S>> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!/^application\/json(\s*;|$)/i.test(contentType)) throw new UnsupportedMediaTypeError();

  const declared = request.headers.get('Content-Length');
  if (declared !== null && Number(declared) > maxBytes) throw new PayloadTooLargeError();

  const text = await readTextWithLimit(request, maxBytes);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new BadRequestError('Malformed JSON', error);
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new BadRequestError('Invalid request body', result.error);
  return result.data;
}

async function readTextWithLimit(request: Request, maxBytes: number): Promise<string> {
  if (request.body === null) return '';
  // Workers types declare Request.body as ReadableStream<any>; request bodies are always bytes.
  const reader = (request.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch (error) {
    throw new BadRequestError('Body is not valid UTF-8', error);
  }
}
