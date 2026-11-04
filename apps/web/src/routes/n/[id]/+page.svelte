<script lang="ts">
  import { onMount } from 'svelte';
  import type { NotePayload } from '@shared/crypto';
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import NoteInterstitial from '#lib/components/notes/NoteInterstitial.svelte';
  import NoteViewer from '#lib/components/notes/NoteViewer.svelte';
  import Alert from '#lib/components/ui/Alert.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import LinkButton from '#lib/components/ui/LinkButton.svelte';
  import Spinner from '#lib/components/ui/Spinner.svelte';
  import { ApiError } from '#lib/services/api.ts';
  import { idFromPath, takeFragment } from '#lib/services/fragment.ts';
  import { getNoteStatus, isValidKey, openNote } from '#lib/services/notes.ts';
  import { describeError, type ErrorMessage } from '#lib/utils/errors.ts';

  type View =
    | { readonly kind: 'checking' }
    | { readonly kind: 'incomplete-link' }
    | { readonly kind: 'ready'; readonly burnAfterRead: boolean; readonly expiresAt: number }
    | {
        readonly kind: 'opened';
        readonly note: NotePayload;
        readonly burnAfterRead: boolean;
        readonly expiresAt: number;
      }
    | { readonly kind: 'expired' }
    | { readonly kind: 'unavailable'; readonly message: ErrorMessage }
    | { readonly kind: 'undecryptable'; readonly message: ErrorMessage; readonly burned: boolean }
    | { readonly kind: 'failed'; readonly message: ErrorMessage; readonly retry: () => void };

  let view = $state<View>({ kind: 'checking' });
  let opening = $state(false);
  let id: string | null = null;
  // Held only in this closure for the life of the page; never stored or sent.
  let key = '';

  async function check(): Promise<void> {
    if (id === null) return;
    view = { kind: 'checking' };
    try {
      const status = await getNoteStatus(id);
      view = { kind: 'ready', ...status };
    } catch (error) {
      view = classify(error, check);
    }
  }

  async function open(): Promise<void> {
    if (id === null || view.kind !== 'ready') return;
    const { burnAfterRead } = view;
    opening = true;
    try {
      const opened = await openNote(id, key);
      view = { kind: 'opened', ...opened };
    } catch (error) {
      if (error instanceof ApiError) view = classify(error, open);
      else view = { kind: 'undecryptable', message: describeError(error), burned: burnAfterRead };
    } finally {
      opening = false;
    }
  }

  function classify(error: unknown, retry: () => Promise<void>): View {
    const message = describeError(error);
    if (error instanceof ApiError && error.code === 'not_found')
      return { kind: 'unavailable', message };
    return {
      kind: 'failed',
      message,
      retry: () => {
        void retry();
      },
    };
  }

  onMount(() => {
    id = idFromPath(window.location.pathname, '/n/');
    key = takeFragment();
    // Validate the key before any request: a broken link must never consume a one-time note.
    if (id === null || !isValidKey(key)) {
      view = { kind: 'incomplete-link' };
      return;
    }
    void check();
  });
</script>

<svelte:head>
  <title>Private note · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  {#if view.kind === 'checking'}
    <p class="flex items-center gap-3 text-muted" role="status">
      <Spinner /> Checking the link…
    </p>
  {:else if view.kind === 'incomplete-link'}
    <div class="flex flex-col gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">This link is incomplete</h1>
      <p class="text-foreground/85">
        The key that unlocks the note is the part after <code class="font-mono">#</code> in the link,
        and it’s missing or damaged. Some apps cut links short when they wrap. Ask the sender to send
        the full link again. Nothing was opened, so a one-time note is still waiting.
      </p>
    </div>
  {:else if view.kind === 'ready'}
    <NoteInterstitial
      burnAfterRead={view.burnAfterRead}
      expiresAt={view.expiresAt}
      {opening}
      onopen={() => {
        void open();
      }}
      onexpire={() => {
        view = { kind: 'expired' };
      }}
    />
  {:else if view.kind === 'opened'}
    <NoteViewer note={view.note} burnAfterRead={view.burnAfterRead} expiresAt={view.expiresAt} />
  {:else if view.kind === 'expired'}
    <div class="flex flex-col gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">This note has expired</h1>
      <p class="text-foreground/85">
        Its time ran out and it was deleted from our storage. It can’t be recovered.
      </p>
      <div><LinkButton href="/notes" variant="secondary">Write a new note</LinkButton></div>
    </div>
  {:else if view.kind === 'unavailable'}
    <div class="flex flex-col gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">{view.message.title}</h1>
      <p class="text-foreground/85">{view.message.detail}</p>
      <div><LinkButton href="/notes" variant="secondary">Write a new note</LinkButton></div>
    </div>
  {:else if view.kind === 'undecryptable'}
    <div class="flex flex-col gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">{view.message.title}</h1>
      <p class="text-foreground/85">{view.message.detail}</p>
      {#if view.burned}
        <Alert tone="warning" title="The note was deleted">
          It was a one-time note, so opening it removed it from our storage even though it couldn’t
          be decrypted.
        </Alert>
      {/if}
    </div>
  {:else}
    <div class="flex flex-col gap-4">
      <Alert tone="danger" title={view.message.title} live>{view.message.detail}</Alert>
      <div><Button variant="secondary" onclick={view.retry}>Try again</Button></div>
    </div>
  {/if}
</PageContainer>
