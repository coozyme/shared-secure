import type { Bindings, Config } from '../env';

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    config: Config;
  };
}
