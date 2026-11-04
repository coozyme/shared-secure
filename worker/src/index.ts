import { publicConfigSchema, type HealthResponse } from '@shared/schema';
import { Hono } from 'hono';
import { z } from 'zod';
import { FileItemDurableObject } from './modules/files/do';
import { filesRoutes } from './modules/files/routes';
import { NoteItemDurableObject } from './modules/notes/do';
import { notesAdminRoutes, notesRoutes } from './modules/notes/routes';
import type { AppEnv } from './shared/context';
import { handleError, handleNotFound, loadConfig, requestContext } from './shared/http';
import { rateLimit } from './shared/ratelimit';

// Workers forbid eval/new Function; tell Zod not to probe for its JIT fast path.
z.config({ jitless: true });

const app = new Hono<AppEnv>();

app.use('*', requestContext);
app.use('/api/*', loadConfig);
app.use('/api/*', rateLimit('RL_READ', 'api'));

app.get('/api/v1/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse));
app.get('/api/v1/config', (c) => {
  const { features, limits, turnstile } = c.get('config');
  return c.json(
    publicConfigSchema.parse({
      features,
      notes: {
        ttlOptionsSeconds: limits.guestNoteTtlOptionsSeconds,
        maxBlobBytes: limits.maxNoteBytes,
      },
      files: {
        ttlOptionsSeconds: limits.guestFileTtlOptionsSeconds,
        maxBytes: limits.maxFileBytesGuest,
      },
      turnstileSiteKey: turnstile.siteKey,
    }),
  );
});
app.route('/api/v1/notes', notesRoutes);
app.route('/api/v1/admin/notes', notesAdminRoutes);
app.route('/api/v1/files', filesRoutes);

app.notFound(handleNotFound);
app.onError(handleError);

export default app;
export { FileItemDurableObject, NoteItemDurableObject };
