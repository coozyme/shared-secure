<script lang="ts">
  import ExpirationStatus from '../security/ExpirationStatus.svelte';
  import Badge from '../ui/Badge.svelte';
  import Button from '../ui/Button.svelte';

  interface Props {
    burnAfterRead: boolean;
    expiresAt: number;
    opening: boolean;
    onopen: () => void;
    onexpire: () => void;
  }
  let { burnAfterRead, expiresAt, opening, onopen, onexpire }: Props = $props();
</script>

<section aria-labelledby="interstitial-heading" class="flex flex-col gap-6">
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <h1 id="interstitial-heading" class="text-2xl font-semibold tracking-tight sm:text-3xl">
        Someone shared a private note with you
      </h1>
    </div>
    <p class="text-foreground/85">
      It’s encrypted. Your browser will decrypt it with the key from your link; our server can’t
      read it.
    </p>
  </div>

  <div
    class="flex flex-col gap-3 rounded-(--radius-control) border border-line bg-sunken px-4 py-4"
  >
    {#if burnAfterRead}
      <div class="flex flex-wrap items-center gap-2">
        <Badge tone="warning">One-time</Badge>
        <p class="font-medium">This note will be deleted as soon as you open it.</p>
      </div>
      <p class="text-sm text-muted">
        Make sure you’re ready to read it now. You won’t be able to open it again, and neither will
        anyone else.
      </p>
    {:else}
      <p class="font-medium">You can open this note more than once until it expires.</p>
    {/if}
    <ExpirationStatus {expiresAt} {onexpire} />
  </div>

  <div>
    <Button onclick={onopen} loading={opening}>
      {opening ? 'Decrypting…' : burnAfterRead ? 'Open and delete note' : 'Open note'}
    </Button>
  </div>
</section>
