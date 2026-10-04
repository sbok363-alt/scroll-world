# Section types and semantic HTML contract

`cinematic-web` is progressive enhancement over **semantic HTML**. The runtime enhances media wrappers; it does not create the page's primary copy, navigation, forms, or CTAs.

Every motion section includes a **poster** or other static visual that remains useful when JavaScript, autoplay, or media loading fails.

## Runtime markers

Use these attributes exactly:

- `data-cw-kind` — section role: `hero`, `video`, `scrub`, `content`, `cards`, `device-showcase`, or `cta`.
- `data-cw-media` — the reserved media frame that viewport autoplay observes.
- `data-cw-poster` — the poster/static visual shown before a real video frame and on failure.
- `data-cw-video` — viewport-autoplay `<video>` element.
- `data-cw-scrub-video` — micro-scrub `<video>` element.
- `data-src` — desktop/default video source. The runtime assigns it lazily instead of relying on an eager `src` attribute.
- `data-src-mobile` — optional mobile-specific source. When absent, `data-src` is used.
- `data-cw-scroll-vh` — requested micro-scrub progress budget. Runtime default is `2` and clamp is `1..3`.

Keep semantic copy before media in DOM order when that order also makes sense on mobile.

## `hero`

```html
<header class="cw-section cw-hero" data-cw-kind="hero">
  <p class="cw-eyebrow">Product category</p>
  <h1>Useful message before spectacle.</h1>
  <p>Visitors can understand the offer before any media plays.</p>
  <a href="#product">Primary CTA</a>
</header>
```

A hero may include media, but it must not require media to communicate the primary message or expose the CTA.

## `video`

Use for an independent viewport-triggered cinematic section.

```html
<section class="cw-section cw-layout--split" data-cw-kind="video">
  <div class="cw-copy">
    <h2>Show the product change</h2>
    <p>This explanation remains readable when the video is unavailable.</p>
  </div>

  <div class="cw-media" data-cw-media>
    <img data-cw-poster src="media/feature-poster.webp" alt="Product preview">
    <video
      data-cw-video
      muted
      playsinline
      data-src="media/feature.mp4"
      data-src-mobile="media/feature-mobile.mp4"></video>
  </div>
</section>
```

`data-src-mobile` is optional. Do not put a normal autoplay video on a scroll-controlled timeline.

## `scrub`

Use only for a focused local reveal. One scrub is the page-level default; scrub sections must not be adjacent.

```html
<section
  class="cw-section"
  data-cw-kind="scrub"
  data-cw-scroll-vh="2">
  <div class="cw-copy">
    <h2>Reveal one transformation</h2>
    <p>The message is still present without the interaction.</p>
  </div>

  <div class="cw-scrub__sticky">
    <div class="cw-media" data-cw-media>
      <img data-cw-poster src="media/reveal-poster.webp" alt="Transformation preview">
      <video
        data-cw-scrub-video
        muted
        playsinline
        data-src="media/reveal.mp4"
        data-src-mobile="media/reveal-mobile.mp4"></video>
    </div>
  </div>
</section>
```

Scrub video should be same-origin or CORS-readable because the runtime Blob-fetches it for seekability.

## `content`

```html
<section class="cw-section" data-cw-kind="content">
  <h2>Explain something normally</h2>
  <p>Dense product information does not need cinematic behavior.</p>
</section>
```

## `cards`

```html
<section class="cw-section" data-cw-kind="cards" aria-labelledby="features-title">
  <h2 id="features-title">Features</h2>
  <article><h3>Fast</h3><p>Ordinary HTML content.</p></article>
  <article><h3>Reliable</h3><p>Ordinary HTML content.</p></article>
</section>
```

Cards may contain small supporting media, but the cards themselves stay normal document content.

## `device-showcase`

```html
<section class="cw-section cw-layout--device" data-cw-kind="device-showcase">
  <div class="cw-copy">
    <h2>Show the interface in context</h2>
    <p>Device or product media supports the explanation.</p>
  </div>
  <div class="cw-media" data-cw-media>
    <img data-cw-poster src="media/device-poster.webp" alt="App interface preview">
  </div>
</section>
```

Add `data-cw-video` only if motion has a defined purpose; a device-showcase can remain entirely static.

## `cta`

```html
<footer class="cw-section" data-cw-kind="cta">
  <h2>Ready to act?</h2>
  <p>The call to action never waits for an animation.</p>
  <a href="/start">Start now</a>
</footer>
```

## Approved layout classes

- `.cw-layout--full-bleed` — media-led section; supporting copy stays semantic.
- `.cw-layout--split` — copy + media; collapses to one column on mobile in DOM order.
- `.cw-layout--device` — centered device/product showcase.

Use normal `content`, `cards`, hero, scrub spotlight, and CTA layouts for the rest. Avoid inventing a generic layout DSL until real pages prove one is needed.
