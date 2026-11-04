<script lang="ts">
  import { onMount } from 'svelte';
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import Alert from '#lib/components/ui/Alert.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import LinkButton from '#lib/components/ui/LinkButton.svelte';
  import { ApiError } from '#lib/services/api.ts';
  import { idFromPath, takeFragment } from '#lib/services/fragment.ts';
  import { deleteNote, isValidDeleteToken } from '#lib/services/notes.ts';
  import { describeError, type ErrorMessage } from '#lib/utils/errors.ts';

  type View =
    | { readonly kind: 'starting' }
    | { readonly kind: 'incomplete-link' }
    | { readonly kind: 'confirm'; readonly error: ErrorMessage | null }
    | { readonly kind: 'deleted' }
    | { readonly kind: 'gone' };

  let view = $state<View>({ kind: 'starting' });
  let deleting = $state(false);
  let id: string | null = null;
  let token = '';

  onMount(() => {
    id = idFromPath(window.location.pathname, '/n/');
    token = takeFragment();
    view =
      id !== null && isValidDeleteToken(token)
        ? { kind: 'confirm', error: null }
        : { kind: 'incomplete-link' };
  });

  async function remove(): Promise<void> {
    if (id === null) return;
    deleting = true;
    try {
      await deleteNote(id, token);
      view = { kind: 'deleted' };
    } catch (error) {
      view =
        error instanceof ApiError && error.code === 'not_found'
          ? { kind: 'gone' }
          : { kind: 'confirm', error: describeError(error) };
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:head>
  <title>Delete note · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  {#if view.kind === 'incomplete-link'}
    <h1 class="text-2xl font-semibold tracking-tight">This delete link is incomplete</h1>
    <p class="mt-4 text-foreground/85">
      The delete token after <code class="font-mono">#</code> is missing or damaged. Copy the full delete
      link again from where you saved it.
    </p>
  {:else if view.kind === 'confirm'}
    <div class="flex flex-col gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">Delete this note?</h1>
      <p class="text-foreground/85">
        It will be removed from our storage right away, and the sharing link will stop working. This
        can’t be undone.
      </p>
      {#if view.error}<Alert tone="danger" title={view.error.title} live>{view.error.detail}</Alert
        >{/if}
      <div><Button variant="danger" onclick={remove} loading={deleting}>Delete note</Button></div>
    </div>
  {:else if view.kind === 'deleted'}
    <div class="flex flex-col gap-5">
      <Alert tone="success" title="Note deleted" live
        >It’s gone from our storage. The link no longer works.</Alert
      >
      <div><LinkButton href="/notes" variant="secondary">Write a new note</LinkButton></div>
    </div>
  {:else if view.kind === 'gone'}
    <div class="flex flex-col gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">Nothing to delete</h1>
      <p class="text-foreground/85">
        This note doesn’t exist any more. It expired, was already opened as a one-time note, or was
        deleted. Or the delete link doesn’t match it.
      </p>
    </div>
  {/if}
</PageContainer>
