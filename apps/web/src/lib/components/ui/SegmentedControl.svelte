<script lang="ts" generics="T extends string | number">
  import type { SegmentOption } from './control';

  interface Props {
    legend: string;
    name: string;
    options: readonly SegmentOption<T>[];
    value?: T | undefined;
    disabled?: boolean;
    hint?: string;
  }

  let { legend, name, options, value = $bindable(), disabled = false, hint }: Props = $props();
</script>

<!-- Native radio group: arrow keys, focus and screen-reader semantics come for free. -->
<fieldset
  class="flex flex-col gap-1.5"
  {disabled}
  aria-describedby={hint ? `${name}-hint` : undefined}
>
  <legend class="mb-1.5 text-sm font-medium text-foreground">{legend}</legend>
  <div class="flex flex-wrap gap-1 rounded-(--radius-control) border border-line bg-sunken p-1">
    {#each options as option (option.value)}
      <label
        class="relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-0.125rem)] px-3 text-sm text-muted transition-colors select-none hover:text-foreground has-checked:bg-surface has-checked:font-medium has-checked:text-foreground has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-focus has-disabled:cursor-not-allowed"
      >
        <input class="sr-only" type="radio" {name} value={option.value} bind:group={value} />
        {option.label}
      </label>
    {/each}
  </div>
  {#if hint}<p id="{name}-hint" class="text-sm text-muted">{hint}</p>{/if}
</fieldset>
