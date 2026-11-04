<script lang="ts">
  import { onMount } from 'svelte';
  import { loadTurnstile } from '../../services/turnstile';
  import { currentTheme } from '../../theme';

  interface Props {
    siteKey: string;
    action: string;
    /** Receives the single-use token, or null when it expires or fails. */
    ontoken: (token: string | null) => void;
  }

  let { siteKey, action, ontoken }: Props = $props();
  let container: HTMLDivElement | undefined = $state();
  let status = $state<'loading' | 'ready' | 'failed'>('loading');
  let widgetId: string | undefined;
  let api: Awaited<ReturnType<typeof loadTurnstile>> | undefined;

  onMount(() => {
    let cancelled = false;
    loadTurnstile()
      .then((loaded) => {
        if (cancelled || container === undefined) return;
        api = loaded;
        widgetId = loaded.render(container, {
          sitekey: siteKey,
          action,
          theme: currentTheme(),
          size: 'flexible',
          callback: (value) => {
            ontoken(value);
          },
          'expired-callback': () => {
            ontoken(null);
          },
          'error-callback': () => {
            ontoken(null);
            status = 'failed';
          },
        });
        status = 'ready';
      })
      .catch(() => {
        if (!cancelled) status = 'failed';
      });
    return () => {
      cancelled = true;
      if (api !== undefined && widgetId !== undefined) api.remove(widgetId);
    };
  });
</script>

<div class="flex flex-col gap-1.5">
  <div bind:this={container} class="min-h-16.5"></div>
  {#if status === 'loading'}
    <p class="text-sm text-muted">Loading a quick human check from Cloudflare…</p>
  {:else if status === 'failed'}
    <p class="text-sm text-danger" role="alert">
      The human check couldn’t load. Disable blockers for challenges.cloudflare.com or reload the
      page.
    </p>
  {/if}
</div>
