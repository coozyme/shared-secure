<script lang="ts">
  import { copyText } from '../../services/clipboard';
  import { showToast } from '../../stores/toast.svelte';
  import Button from './Button.svelte';
  import { controlClass } from './control';

  interface Props {
    id: string;
    label: string;
    value: string;
    copyLabel?: string;
    copiedMessage?: string;
    hint?: string;
  }

  let { id, label, value, copyLabel = 'Copy', copiedMessage = 'Copied', hint }: Props = $props();
  let input: HTMLInputElement | undefined = $state();

  async function copy(): Promise<void> {
    if (await copyText(value)) {
      showToast(copiedMessage);
    } else {
      input?.select();
      showToast('Copy blocked by the browser. The text is selected: press Ctrl+C or ⌘C.');
    }
  }
</script>

<div class="flex flex-col gap-1.5">
  <label for={id} class="text-sm font-medium text-foreground">{label}</label>
  <div class="flex flex-col gap-2 sm:flex-row">
    <input
      bind:this={input}
      {id}
      type="text"
      readonly
      {value}
      spellcheck="false"
      autocomplete="off"
      aria-describedby={hint ? `${id}-hint` : undefined}
      onfocus={(event) => {
        event.currentTarget.select();
      }}
      class="{controlClass} min-w-0 font-mono text-sm"
    />
    <Button variant="secondary" onclick={copy} class="shrink-0">{copyLabel}</Button>
  </div>
  {#if hint}<p id="{id}-hint" class="text-sm text-muted">{hint}</p>{/if}
</div>
