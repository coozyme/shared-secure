<script lang="ts">
  import { onMount } from 'svelte';
  import { formatExpiry, formatRemaining } from '../../utils/format';

  interface Props {
    expiresAt: number;
    /** Called once when the countdown reaches zero. */
    onexpire?: () => void;
  }
  let { expiresAt, onexpire }: Props = $props();

  let now = $state(Date.now());
  const remaining = $derived(expiresAt - now);

  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
      if (expiresAt - now <= 0) {
        clearInterval(timer);
        onexpire?.();
      }
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  });
</script>

<!-- Updates every second visually, but isn't a live region: a ticking announcement would be noise. -->
<p class="text-sm text-muted">
  {#if remaining > 0}
    Expires in <span class="font-medium text-foreground">{formatRemaining(remaining)}</span>
    <span class="whitespace-nowrap">({formatExpiry(expiresAt)})</span>
  {:else}
    Expired
  {/if}
</p>
