/**
 * Reads the URL fragment (the key) once and removes it from the address bar and the current
 * history entry, so it doesn't sit in view or get copied along with the page URL later.
 * Browsers may still have recorded the full URL in history before this runs; the UI says so.
 */
export function takeFragment(
  location: Location = window.location,
  history: History = window.history,
): string {
  const value = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (value !== '') {
    // Keep SvelteKit's own history state object so its router stays consistent.
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  }
  return value;
}

/** The id segment from `/n/<id>` or `/n/<id>/delete`. Prerendered shells don't know it at build time. */
export function idFromPath(pathname: string, prefix: '/n/' | '/f/'): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const id = pathname.slice(prefix.length).split('/')[0] ?? '';
  return /^[A-Za-z0-9_-]{22}$/.test(id) ? id : null;
}
