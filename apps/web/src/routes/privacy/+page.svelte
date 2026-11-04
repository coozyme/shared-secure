<script lang="ts">
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import Prose from '#lib/components/layout/Prose.svelte';
</script>

<svelte:head>
  <title>Privacy · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  <h1 class="mb-6 text-3xl font-semibold tracking-tight">Privacy</h1>
  <Prose>
    <p>
      Shared is end-to-end encrypted and zero-knowledge by design. Notes are encrypted in your
      browser with a key that lives only in the link, after the <code class="font-mono">#</code>.
      Browsers don’t send that part of a link to any server, so we never receive the key and can’t
      read your notes.
    </p>

    <h2>What our server stores</h2>
    <ul>
      <li>A random note id.</li>
      <li>The encrypted note. Its size is rounded up so the exact length isn’t revealed.</li>
      <li>When it expires, and whether it’s a one-time note.</li>
      <li>A hash of the delete token, so whoever holds the delete link can remove the note.</li>
    </ul>
    <p>
      The note is deleted from storage when it expires, when it’s opened (one-time notes), or when
      it’s deleted with its delete link.
    </p>

    <h2>What we don’t store</h2>
    <ul>
      <li>The content, title or format of a note, or its key.</li>
      <li>Accounts, names or email addresses. There are none.</li>
      <li>Cookies. Your theme choice is kept in your own browser’s storage.</li>
      <li>Analytics, ads or tracking scripts.</li>
    </ul>

    <h2>Network data</h2>
    <p>
      Shared runs on Cloudflare, which processes your IP address to deliver the site. To limit abuse
      we derive a keyed hash of your IP address that changes every day, and use it only for rate
      limiting. Our logs keep a request id, the route pattern (never the full URL), the status code
      and timing, for a few days.
    </p>
    <p>
      The page where you create a note loads Cloudflare Turnstile, a privacy-preserving human check.
      It isn’t loaded on pages that open notes.
    </p>

    <h2>What encryption can’t protect</h2>
    <ul>
      <li>
        Anyone who has the full link can read the note. Share it only with the intended person.
      </li>
      <li>Your browser history, clipboard manager or chat app may keep a copy of the link.</li>
      <li>A device with malware, or a recipient who copies or screenshots the note.</li>
      <li>
        You trust the code this site sends to your browser. We publish the source and review every
        change, but a web app can’t remove that trust entirely.
      </li>
    </ul>
  </Prose>
</PageContainer>
