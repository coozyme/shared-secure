<script lang="ts">
  import { onMount } from 'svelte';
  import type { PublicConfig } from '@shared/schema';
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import NoteEditor from '#lib/components/notes/NoteEditor.svelte';
  import NoteSettings from '#lib/components/notes/NoteSettings.svelte';
  import NoteShareResult from '#lib/components/notes/NoteShareResult.svelte';
  import TurnstileWidget from '#lib/components/security/TurnstileWidget.svelte';
  import Alert from '#lib/components/ui/Alert.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import { loadConfig } from '#lib/services/config.ts';
  import {
    createNote,
    draftBlobBytes,
    type CreatedNote,
    type NoteDraft,
  } from '#lib/services/notes.ts';
  import { describeError, type ErrorMessage } from '#lib/utils/errors.ts';

  type ConfigState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'failed'; readonly message: ErrorMessage }
    | { readonly kind: 'disabled' }
    | { readonly kind: 'ready'; readonly config: PublicConfig };

  let configState = $state<ConfigState>({ kind: 'loading' });
  let title = $state('');
  let body = $state('');
  let format = $state<NoteDraft['format']>('text');
  let ttlSeconds = $state(3600);
  let burnAfterRead = $state(true);
  let turnstileToken = $state<string | null>(null);
  // Turnstile tokens are single-use: bumping this re-mounts the widget for a fresh challenge.
  let turnstileGeneration = $state(0);
  let submitting = $state(false);
  let attempted = $state(false);
  let submitError = $state<ErrorMessage | null>(null);
  let created = $state<CreatedNote | null>(null);

  const maxBlobBytes = $derived(
    configState.kind === 'ready' ? configState.config.notes.maxBlobBytes : 0,
  );
  const tooLong = $derived(
    maxBlobBytes > 0 && draftBlobBytes({ title, body, format }) > maxBlobBytes,
  );
  const bodyError = $derived(
    attempted && body.trim() === '' ? 'Write something before creating a link.' : null,
  );

  async function fetchConfig(): Promise<void> {
    configState = { kind: 'loading' };
    try {
      const config = await loadConfig();
      if (!config.features.notes) {
        configState = { kind: 'disabled' };
        return;
      }
      const options = config.notes.ttlOptionsSeconds;
      if (!options.includes(ttlSeconds))
        ttlSeconds = options.includes(3600) ? 3600 : (options[0] ?? 3600);
      configState = { kind: 'ready', config };
    } catch (error) {
      configState = { kind: 'failed', message: describeError(error) };
    }
  }

  onMount(() => {
    void fetchConfig();
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    attempted = true;
    submitError = null;
    if (body.trim() === '' || tooLong) return;
    if (turnstileToken === null) {
      submitError = {
        title: 'Complete the human check first',
        detail: 'It appears above the button. It helps keep this free service from being abused.',
      };
      return;
    }
    submitting = true;
    try {
      created = await createNote(
        { title, body, format },
        { ttlSeconds, burnAfterRead },
        turnstileToken,
      );
      // The plaintext isn't needed any more; don't keep it around in page memory.
      title = '';
      body = '';
      attempted = false;
    } catch (error) {
      submitError = describeError(error);
      turnstileToken = null;
      turnstileGeneration += 1;
    } finally {
      submitting = false;
    }
  }

  function createAnother(): void {
    created = null;
    submitError = null;
    turnstileToken = null;
  }
</script>

<svelte:head>
  <title>New note · Shared</title>
</svelte:head>

<PageContainer width="wide">
  {#if created !== null}
    <div class="mx-auto max-w-2xl">
      <NoteShareResult note={created} oncreateanother={createAnother} />
    </div>
  {:else}
    <div class="max-w-2xl">
      <h1 class="text-3xl font-semibold tracking-tight">New private note</h1>
      <p class="mt-2 text-foreground/80">
        Encrypted locally in your browser before it’s sent. You’ll get a private link to share.
      </p>
    </div>

    {#if configState.kind === 'loading'}
      <div class="mt-8 flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <div class="h-11 max-w-2xl animate-pulse rounded-(--radius-control) bg-sunken"></div>
        <div class="h-72 animate-pulse rounded-(--radius-control) bg-sunken"></div>
      </div>
    {:else if configState.kind === 'failed'}
      <div class="mt-8 flex max-w-2xl flex-col gap-4">
        <Alert tone="danger" title={configState.message.title} live
          >{configState.message.detail}</Alert
        >
        <div><Button variant="secondary" onclick={fetchConfig}>Try again</Button></div>
      </div>
    {:else if configState.kind === 'disabled'}
      <div class="mt-8 max-w-2xl">
        <Alert tone="warning" title="Creating notes is paused" live>
          Shared Notes is temporarily switched off. Existing links still work. Please try again
          later.
        </Alert>
      </div>
    {:else}
      <form
        class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
        onsubmit={submit}
        novalidate
      >
        <NoteEditor bind:title bind:body bind:format {tooLong} {bodyError} disabled={submitting} />

        <aside
          class="flex flex-col gap-6 rounded-(--radius-panel) border border-line bg-surface p-5 shadow-(--shadow-panel) lg:sticky lg:top-6"
        >
          <h2 class="text-base font-semibold">Settings</h2>
          <NoteSettings
            ttlOptions={configState.config.notes.ttlOptionsSeconds}
            bind:ttlSeconds
            bind:burnAfterRead
            disabled={submitting}
          />
          {#key turnstileGeneration}
            <TurnstileWidget
              ontoken={(token: string | null) => {
                turnstileToken = token;
              }}
              siteKey={configState.config.turnstileSiteKey}
              action="create-note"
            />
          {/key}
          {#if submitError}
            <Alert tone="danger" title={submitError.title} live>{submitError.detail}</Alert>
          {/if}
          <Button type="submit" loading={submitting} class="w-full">
            {submitting ? 'Encrypting and creating link…' : 'Create private link'}
          </Button>
        </aside>
      </form>
    {/if}
  {/if}
</PageContainer>
