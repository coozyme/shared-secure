<script lang="ts">
  import { formatTtl, formatTtlShort } from '../../utils/format';
  import SegmentedControl from '../ui/SegmentedControl.svelte';
  import Switch from '../ui/Switch.svelte';

  interface Props {
    ttlOptions: readonly number[];
    ttlSeconds?: number;
    burnAfterRead?: boolean;
    disabled: boolean;
  }

  let {
    ttlOptions,
    ttlSeconds = $bindable(3600),
    burnAfterRead = $bindable(true),
    disabled,
  }: Props = $props();

  const options = $derived(ttlOptions.map((value) => ({ value, label: formatTtlShort(value) })));
</script>

<div class="flex flex-col gap-5">
  <SegmentedControl
    legend="Expires after"
    name="note-ttl"
    bind:value={ttlSeconds}
    {options}
    {disabled}
    hint="Deleted from our storage after {formatTtl(ttlSeconds)}, read or not."
  />
  <Switch
    id="note-burn"
    label="Delete after first read"
    description="The note is deleted the moment the recipient opens it."
    bind:checked={burnAfterRead}
    {disabled}
  />
</div>
