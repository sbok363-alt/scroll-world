---
name: cinematic-web
description: >
  Build cinematic product and brand websites that keep normal document scrolling
  authoritative, use viewport-triggered autoplay media only where motion has a clear
  communication purpose, and optionally use a tightly bounded micro-scrub for a focused
  reveal. The skill designs semantic HTML first, keeps posters and useful content available
  when media or JavaScript fails, and uses a provider-agnostic free-first video pipeline
  whose current capabilities, quotas, output rights, and commercial-use terms are verified
  before generation.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, Skill
---

# cinematic-web

Build a **normal website first**. Motion is progressive enhancement, not navigation.
The browser's normal document flow remains authoritative from the hero to the final CTA.

The canonical motion primitive is **viewport-triggered autoplay**: an independent muted,
inline video begins when its media frame becomes meaningfully visible and pauses when it
leaves. A short micro-scrub is allowed only when a focused transformation or reveal is
better explained by direct scroll control.

## Non-negotiable rules

- **Static is the default.** A section earns video only when motion has a clear communication
  purpose or a deliberate emotional/product-storytelling job.
- Useful information, navigation, forms, and CTAs must exist as semantic HTML before the
  runtime mounts. Never make animation completion a prerequisite for reaching them.
- Viewport video is independent per section. Do not generate connector clips between normal
  sections and do not reconstruct a continuous camera chain in the canonical path.
- A micro-scrub defaults to **2 viewport heights of progress** and has a hard maximum of
  **3 viewport heights** and a minimum of 1.
- Use **at most one scrub by default**. Scrubs must never be adjacent. A second scrub is
  allowed only for a **distinct communication purpose** that cannot be served as well by
  static content or viewport video.
- `prefers-reduced-motion: reduce` and `Save-Data` are static-poster modes. Do not fetch or
  autoplay decorative media in those modes.
- Mobile is designed intentionally. Prefer semantic copy before media in DOM order, choose a
  native portrait/mobile render only when composition needs it, and otherwise use a deliberate
  crop of the desktop asset.
- The website runtime is provider-blind. Providers are a build-time concern only.
- Provider choice is **free-first**, but re-check current model capability, quota/price,
  watermark/output rights, regional availability, and commercial-use rights before spending
  quota or generating final assets. Never encode a temporary free allowance as permanent.
- Inspiration may reuse interaction, pacing, hierarchy, and composition patterns. Do not copy
  third-party branded assets or reproduce a recognizable site pixel-for-pixel.

## Workflow

### 1. Understand the useful page before thinking about motion

Collect the product/brand purpose, audience, primary message, required sections, CTA, brand
kit, and any reference sites. Separate what the visitor must understand from what is merely
visual atmosphere.

Draft the page hierarchy as ordinary semantic content first: hero, product explanation,
features/cards, device/product showcase, proof or comparison content, and CTA as needed.
Do not start from a video sequence and force content into it.

### 2. Classify every section: static, viewport video, or scrub

Use `references/motion-rules.md`.

- Choose **static** unless motion adds real value.
- Choose **viewport video** for a product reveal, spatial/camera move, UI transformation,
  emotional beat, or visual explanation that benefits from automatic playback.
- Choose **scrub** only for a focused reveal where the visitor benefits from directly mapping
  a short scroll distance to progress.

If a proposed scrub would require more than 3 viewport heights, convert it to viewport video
or simplify the idea. If several scrub ideas accumulate, keep the strongest one and make the
others static or autoplay unless each extra scrub has a clearly distinct communication purpose.

### 3. Build semantic HTML first

Follow `references/section-types.md` and the runtime's exact data-attribute contract.
Primary copy, links, buttons, and forms already exist before JavaScript. Each motion section
includes a poster/static visual. The page should still make sense with JavaScript disabled or
with every video request failing.

Use the approved compositions only unless the brief truly requires something else:

- hero
- full-bleed cinematic
- split text/media
- device/product showcase
- normal content/cards
- micro-scrub spotlight
- CTA

### 4. Plan independent motion assets

Use `references/prompts.md`. Share brand and art-direction context across sections for cohesion,
but prompt each motion section independently. Do not require one continuous camera path or
frame-identical seams between page sections.

For every animated section, state its **communication purpose** before generating media.
If that sentence is weak, keep the section static.

### 5. Choose a provider at build time

Use `references/video-pipeline.md`. Provider candidates can include Wan, MiniMax, Seedance,
or another currently suitable service/model. The selection process is **free-first**, not
provider-first: verify current capability, current quota/price, output/commercial rights, and
any watermark or regional restrictions before generation.

The runtime receives finished poster/video assets and never knows which provider produced them.

### 6. Optimize and wire the page

Use the runtime references:

- `references/cinematic-engine.js`
- `references/cinematic.css`
- `references/index-template.html`

Viewport video uses the media frame as its visibility target. Normal viewport video must never
map scroll position to `currentTime`. Micro-scrub logic stays local to actual scrub sections.

Scrub media is Blob-fetched for reliable seeking, so ship it same-origin or ensure it is
CORS-readable.

### 7. QA the failure paths, not only the wow path

Verify:

- ordinary scrolling still feels ordinary;
- useful content is immediate with JavaScript disabled;
- media failure leaves posters, copy, navigation, and CTAs usable;
- autoplay is muted, inline, and control-free by default;
- only one viewport-autoplay video plays at a time;
- reduced-motion and Save-Data remain static and natural-height;
- mobile content order is readable and no cinematic section causes horizontal overflow;
- each scrub resolves to 1–3 progress viewports, default 2;
- scrub sections are not adjacent and one scrub remains the page-level default;
- no long connector chain or page-wide scroll timeline has slipped back in.

## What to preserve from legacy scroll-world

The legacy `skills/scroll-world` implementation remains useful for the specialized case where
a user explicitly wants one continuous scroll-scrubbed world. Do not silently import that
interaction model into `cinematic-web`. Reuse only ideas that still serve this skill — poster
fallbacks, mobile safety, seek-coalescing techniques for local scrubs, and disciplined visual
prompting.
