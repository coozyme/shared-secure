<script lang="ts">
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import Prose from '#lib/components/layout/Prose.svelte';
</script>

<svelte:head>
  <title>Terms · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  <h1 class="mb-6 text-3xl font-semibold tracking-tight">Terms of use</h1>
  <Prose>
    <p>Shared is a small, free service run by one person. By using it you agree to these terms.</p>

    <h2>Acceptable use</h2>
    <ul>
      <li>Don’t share anything illegal, or use Shared to harass, defraud or harm anyone.</li>
      <li>Don’t distribute malware or use Shared to host phishing content.</li>
      <li>Don’t try to overload the service or get around its limits.</li>
    </ul>

    <h2>Abuse</h2>
    <p>
      We can’t see what’s in a note. If someone sends you a link to harmful content, you can
      <a href="/report">report it</a>. With the link you provide we can confirm the content and
      remove it.
    </p>

    <h2>No guarantees</h2>
    <p>
      Notes are temporary by design and can’t be recovered once they expire or are deleted. Don’t
      use Shared as the only copy of anything. The service may be unavailable or change at any time,
      and is provided as is, without warranty of any kind.
    </p>
  </Prose>
</PageContainer>
