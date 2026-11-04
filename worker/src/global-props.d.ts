// Types `exports` from `cloudflare:workers` (used by integration tests) from the real entry module.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import('./index');
  }
}
