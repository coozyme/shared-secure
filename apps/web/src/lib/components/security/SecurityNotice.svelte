<script lang="ts">
  interface Props {
    /** sender: after creating a link. recipient: after opening a note. */
    audience: 'sender' | 'recipient';
  }
  let { audience }: Props = $props();
</script>

<aside
  class="rounded-(--radius-control) border border-line bg-sunken px-4 py-3 text-sm text-foreground/85"
>
  {#if audience === 'sender'}
    <p class="font-medium text-foreground">The link is the key</p>
    <p class="mt-1">
      Anyone with the full link can read this note, so share it only with the person it’s for. The
      key is the part after <code class="rounded bg-surface px-1 font-mono">#</code>; it never
      reaches our server, but your browser history, clipboard manager or chat app may keep a copy.
    </p>
  {:else}
    <p class="font-medium text-foreground">Decrypted in your browser</p>
    <p class="mt-1">
      The key from the link was removed from the address bar. Your browser history may still contain
      the full link; clear it if this device is shared.
    </p>
  {/if}
</aside>
