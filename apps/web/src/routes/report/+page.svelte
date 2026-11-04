<script lang="ts">
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import Prose from '#lib/components/layout/Prose.svelte';
  import { ABUSE_CONTACT_EMAIL } from '#lib/contact.ts';
</script>

<svelte:head>
  <title>Report abuse · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  <h1 class="mb-6 text-3xl font-semibold tracking-tight">Report abuse</h1>
  <Prose>
    <p>
      Notes are encrypted, so we can’t find harmful content on our own. To report a note, email
      <a href="mailto:{ABUSE_CONTACT_EMAIL}">{ABUSE_CONTACT_EMAIL}</a> with:
    </p>
    <ul>
      <li>
        The full link, including the part after <code class="font-mono">#</code>. Without it we
        can’t open the note.
      </li>
      <li>A short description of the problem.</li>
    </ul>
    <p>
      By sending the full link you let us read that one note, so we can confirm it and delete it. A
      one-time note that has already been opened can’t be read any more, by you or by us.
    </p>
    <p>If someone is in immediate danger, contact your local emergency services first.</p>
  </Prose>
</PageContainer>
