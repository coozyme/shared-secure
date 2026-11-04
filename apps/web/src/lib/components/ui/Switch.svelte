<script lang="ts">
  interface Props {
    id: string;
    label: string;
    description?: string;
    checked?: boolean;
    disabled?: boolean;
  }

  let { id, label, description, checked = $bindable(false), disabled = false }: Props = $props();
</script>

<div class="flex items-start justify-between gap-4">
  <div class="flex flex-col gap-0.5">
    <label for={id} class="text-sm font-medium text-foreground">{label}</label>
    {#if description}<p id="{id}-description" class="text-sm text-muted">{description}</p>{/if}
  </div>
  <input
    {id}
    type="checkbox"
    role="switch"
    bind:checked
    {disabled}
    aria-describedby={description ? `${id}-description` : undefined}
    class="relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-sunken transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-4.5 before:rounded-full before:bg-muted before:transition-transform checked:border-primary checked:bg-primary checked:before:translate-x-5 checked:before:bg-on-primary disabled:cursor-not-allowed disabled:opacity-55"
  />
</div>
