import type { MiddlewareHandler } from 'hono';
import type { Feature } from '../env';
import type { AppEnv } from './context';
import { FeatureDisabledError } from './errors';

/** Kill switch for risky features, controlled by FEATURE_* vars without a code rollback. */
export function requireFeature(feature: Feature): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('config').features[feature]) throw new FeatureDisabledError();
    await next();
  };
}
