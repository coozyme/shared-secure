<script lang="ts">
  import { onMount } from 'svelte';
  import type { CreatedNote } from '../../services/notes';
  import { describeError } from '../../utils/errors';
  import { deleteNote } from '../../services/notes';
  import ExpirationStatus from '../security/ExpirationStatus.svelte';
  import SecurityNotice from '../security/SecurityNotice.svelte';
  import Alert from '../ui/Alert.svelte';
  import Badge from '../ui/Badge.svelte';
  import Button from '../ui/Button.svelte';
  import CopyField from '../ui/CopyField.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import LinkButton from '../ui/LinkButton.svelte';

  interface Props {
    note: CreatedNote;
    oncreateanother: () => void;
  }
  let { note, oncreateanother }: Props = $props();

  let confirmOpen = $state(false);
  let deleting = $state(false);
  let deleted = $state(false);
  let expired = $state(false);
  let deleteError = $state<string | null>(null);
  let heading: HTMLHeadingElement | undefined = $state();

  // The form this replaces had focus; move it to the result so screen readers announce it.
  onMount(() => heading?.focus());

  const idAndToken = $derived.by(() => {
    const url = new URL(note.deleteUrl);
    return { id: url.pathname.split('/')[2] ?? '', token: url.hash.slice(1) };
  });

  async function deleteNow(): Promise<void> {
    deleting = true;
    deleteError = null;
    try {
      await deleteNote(idAndToken.id, idAndToken.token);
      deleted = true;
      confirmOpen = false;
    } catch (error) {
      deleteError = describeError(error).title;
    } finally {
      deleting = false;
    }
  }
</script>

<section aria-labelledby="share-heading" class="flex flex-col gap-6">
  {#if deleted}
    <Alert tone="success" title="Note deleted" live>
      It’s gone from our storage. The link no longer works.
    </Alert>
  {:else}
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <h2
          id="share-heading"
          bind:this={heading}
          tabindex="-1"
          class="text-xl font-semibold tracking-tight focus:outline-none"
        >
          Your private link is ready
        </h2>
        {#if note.burnAfterRead}<Badge tone="warning">One-time</Badge>{/if}
      </div>
      {#if expired}
        <p class="text-sm text-muted">This note has expired and was deleted.</p>
      {:else}
        <ExpirationStatus expiresAt={note.expiresAt} onexpire={() => (expired = true)} />
      {/if}
    </div>

    <CopyField
      id="share-link"
      label="Private sharing link"
      value={note.shareUrl}
      copyLabel="Copy link"
      copiedMessage="Link copied"
      hint={note.burnAfterRead
        ? 'Works once. Opening it yourself would use it up.'
        : 'Works until it expires or you delete it.'}
    />

    <SecurityNotice audience="sender" />

    <details class="group rounded-(--radius-control) border border-line">
      <summary
        class="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium select-none"
      >
        Delete this note later
      </summary>
      <div class="flex flex-col gap-4 border-t border-line px-4 py-4">
        <CopyField
          id="delete-link"
          label="Private delete link"
          value={note.deleteUrl}
          copyLabel="Copy"
          copiedMessage="Delete link copied"
          hint="Keep this for yourself. It lets anyone holding it delete the note, nothing else."
        />
        <div>
          <Button variant="secondary" onclick={() => (confirmOpen = true)} disabled={expired}>
            Delete now
          </Button>
        </div>
      </div>
    </details>
  {/if}

  <div class="flex flex-wrap gap-2">
    <Button variant={deleted ? 'primary' : 'ghost'} onclick={oncreateanother}
      >Create another note</Button
    >
    {#if deleted}<LinkButton href="/" variant="ghost">Home</LinkButton>{/if}
  </div>
</section>

<Dialog
  bind:open={confirmOpen}
  title="Delete this note?"
  description="It will be removed from our storage right away. Anyone you sent the link to won’t be able to open it."
>
  {#if deleteError}<p class="text-sm text-danger" role="alert">{deleteError}</p>{/if}
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (confirmOpen = false)} disabled={deleting}
      >Keep note</Button
    >
    <Button variant="danger" onclick={deleteNow} loading={deleting}>Delete note</Button>
  {/snippet}
</Dialog>
