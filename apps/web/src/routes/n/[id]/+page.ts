// One prerendered client-only shell serves every note id; _redirects maps /n/<id> to /n/_ (ADR 0009).
export const ssr = false;
export const entries = () => [{ id: '_' }];
