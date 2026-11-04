<script lang="ts">
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import LinkButton from '#lib/components/ui/LinkButton.svelte';
</script>

<svelte:head>
  <title>Shared · Share privately. Leave nothing behind.</title>
</svelte:head>

<PageContainer width="wide">
  <section aria-labelledby="hero-heading" class="max-w-3xl">
    <h1 id="hero-heading" class="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      Share privately. Leave nothing behind.
    </h1>
    <p class="mt-5 max-w-2xl text-lg text-foreground/80">
      Write a note, get a private link, send it. The note is encrypted in your browser before it
      leaves your device, and it’s deleted when it expires. No account needed.
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <LinkButton href="/notes">Write a note</LinkButton>
    </div>
  </section>

  <section aria-labelledby="start-heading" class="mt-16">
    <h2 id="start-heading" class="sr-only">What you can share</h2>
    <div class="grid gap-4 md:grid-cols-2">
      <a
        href="/notes"
        class="group flex flex-col gap-2 rounded-(--radius-panel) border border-line bg-surface p-6 shadow-(--shadow-panel) transition-colors hover:border-primary/60"
      >
        <span class="text-lg font-semibold group-hover:text-primary">Shared Notes</span>
        <span class="text-foreground/80">
          Text or Markdown. Expires in 5 minutes to 7 days, or right after it’s read once.
        </span>
      </a>
      <div
        class="flex flex-col gap-2 rounded-(--radius-panel) border border-dashed border-line-strong/60 p-6"
      >
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold">Shared Files</span>
          <Badge>Coming soon</Badge>
        </div>
        <span class="text-foreground/80">
          Encrypted file transfer with download limits. It’s being built next;
          <a href="/files" class="text-primary underline underline-offset-2">see what’s planned</a>.
        </span>
      </div>
    </div>
  </section>

  <section
    aria-labelledby="how-heading"
    class="mt-20 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start"
  >
    <div>
      <h2 id="how-heading" class="text-2xl font-semibold tracking-tight">
        How a private link works
      </h2>
      <p class="mt-3 text-foreground/80">
        Every link has two parts. Only one of them ever reaches our server.
      </p>
      <figure class="mt-6 rounded-(--radius-panel) border border-line bg-surface p-5">
        <p class="font-mono text-sm break-all sm:text-[0.9375rem]">
          <span class="text-muted">shared.arysetyap.com/n/</span><span
            class="rounded bg-sunken px-1 text-foreground">q8XbN2rT0vYw4LmA6sJd1Q</span
          ><span class="text-muted">#</span><span class="rounded bg-accent-soft px-1 text-primary"
            >Kp3rV7zQ…h29Lw</span
          >
        </p>
        <figcaption class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p class="font-medium">Note id</p>
            <p class="text-muted">
              Sent to our server to find the encrypted note. Useless on its own.
            </p>
          </div>
          <div>
            <p class="font-medium text-primary">Key, after the #</p>
            <p class="text-muted">
              Browsers never send this part to a server. It stays with you and the recipient.
            </p>
          </div>
        </figcaption>
      </figure>
    </div>

    <dl class="flex flex-col gap-6 lg:pt-14">
      <div>
        <dt class="font-semibold">Encrypted locally in your browser</dt>
        <dd class="mt-1 text-foreground/80">
          AES-256-GCM with a fresh random key for every note. The title and format are encrypted
          too. We store ciphertext, an expiry time and nothing else about the content.
        </dd>
      </div>
      <div>
        <dt class="font-semibold">The link is the only way in</dt>
        <dd class="mt-1 text-foreground/80">
          There’s no password reset and no copy we can read. Lose the link and the note is gone;
          leak it and whoever has it can read the note.
        </dd>
      </div>
      <div>
        <dt class="font-semibold">Automatically expires</dt>
        <dd class="mt-1 text-foreground/80">
          When time runs out the note is deleted from storage, not just hidden. One-time notes are
          deleted the moment they’re opened.
        </dd>
      </div>
    </dl>
  </section>

  <p class="mt-16 max-w-3xl text-sm text-muted">
    End-to-end encrypted, zero-knowledge by design. That doesn’t protect against a compromised
    device or a recipient who forwards the link. <a
      href="/privacy"
      class="underline underline-offset-2 hover:text-foreground">What we can and can’t see</a
    >.
  </p>
</PageContainer>
