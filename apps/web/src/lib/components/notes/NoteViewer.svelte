<script lang="ts">
  import type { NotePayload } from '@shared/crypto';
  import ExpirationStatus from '../security/ExpirationStatus.svelte';
  import SecurityNotice from '../security/SecurityNotice.svelte';
  import Alert from '../ui/Alert.svelte';
  import Button from '../ui/Button.svelte';
  import SegmentedControl from '../ui/SegmentedControl.svelte';
  import { copyText } from '../../services/clipboard';
  import { showToast } from '../../stores/toast.svelte';
  import MarkdownView from './MarkdownView.svelte';

  interface Props {
    note: NotePayload;
    burnAfterRead: boolean;
    expiresAt: number;
  }
  let { note, burnAfterRead, expiresAt }: Props = $props();

  let view = $state<'rendered' | 'source'>('rendered');
  let expired = $state(false);

  async function copyNote(): Promise<void> {
    showToast((await copyText(note.body)) ? 'Note copied' : 'Copy blocked by the browser');
  }
</script>

<article aria-labelledby="note-heading" class="flex flex-col gap-6">
  {#if burnAfterRead}
    <Alert tone="warning" title="This note has been deleted from our storage" live>
      This is the only time it can be read. Copy anything you need before leaving the page.
    </Alert>
  {/if}

  <header class="flex flex-col gap-2">
    <h1 id="note-heading" class="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
      {note.title ?? 'Untitled note'}
    </h1>
    {#if !burnAfterRead}
      {#if expired}
        <p class="text-sm text-muted">
          This note has now expired. It stays on this page until you leave.
        </p>
      {:else}
        <ExpirationStatus {expiresAt} onexpire={() => (expired = true)} />
      {/if}
    {/if}
  </header>

  <div class="flex flex-wrap items-end justify-between gap-3">
    {#if note.format === 'markdown'}
      <div class="w-56">
        <SegmentedControl
          legend="View"
          name="note-view"
          bind:value={view}
          options={[
            { value: 'rendered', label: 'Formatted' },
            { value: 'source', label: 'Source' },
          ]}
        />
      </div>
    {/if}
    <Button variant="secondary" size="sm" onclick={copyNote} class="ml-auto">Copy text</Button>
  </div>

  <div class="rounded-(--radius-panel) border border-line bg-surface px-5 py-5 sm:px-7 sm:py-6">
    {#if note.format === 'markdown' && view === 'rendered'}
      <MarkdownView source={note.body} />
    {:else}
      <pre class="font-sans leading-relaxed break-words whitespace-pre-wrap">{note.body}</pre>
    {/if}
  </div>

  <SecurityNotice audience="recipient" />
</article>
