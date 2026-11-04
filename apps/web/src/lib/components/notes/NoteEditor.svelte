<script lang="ts">
  import Field from '../ui/Field.svelte';
  import Input from '../ui/Input.svelte';
  import SegmentedControl from '../ui/SegmentedControl.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import type { NotePayload } from '@shared/crypto';

  interface Props {
    title?: string;
    body?: string;
    format?: NotePayload['format'];
    /** Set by the page when the encrypted note would exceed the server limit. */
    tooLong: boolean;
    /** Shown after a submit attempt with an empty body. */
    bodyError: string | null;
    disabled: boolean;
  }

  let {
    title = $bindable(''),
    body = $bindable(''),
    format = $bindable('text'),
    tooLong,
    bodyError,
    disabled,
  }: Props = $props();

  // Code points, not UTF-16 units, so an emoji counts as one character.
  const characters = $derived(Array.from(body).length);
  const error = $derived(
    tooLong ? 'This note is too long to share. Shorten it a little.' : bodyError,
  );
</script>

<div class="flex flex-col gap-5">
  <Field id="note-title" label="Title" optional hint="Encrypted along with the note.">
    <Input
      id="note-title"
      bind:value={title}
      maxlength={200}
      autocomplete="off"
      placeholder="Untitled note"
      {disabled}
      aria-describedby="note-title-hint"
    />
  </Field>

  <Field id="note-body" label="Note" {error} hint="Plain text, or Markdown if you choose it below.">
    {#snippet aside()}
      <span class="text-sm tabular-nums {tooLong ? 'text-danger' : 'text-muted'}" aria-live="off">
        {characters.toLocaleString()}
        {characters === 1 ? 'character' : 'characters'}
      </span>
    {/snippet}
    <Textarea
      id="note-body"
      bind:value={body}
      rows={14}
      spellcheck="true"
      placeholder="Write something only the recipient should read…"
      invalid={error !== null}
      aria-describedby={error === null ? 'note-body-hint' : 'note-body-error'}
      aria-required="true"
      {disabled}
      class="font-[inherit]"
    />
  </Field>

  <SegmentedControl
    legend="Format"
    name="note-format"
    bind:value={format}
    {disabled}
    options={[
      { value: 'text', label: 'Plain text' },
      { value: 'markdown', label: 'Markdown' },
    ]}
  />
</div>
