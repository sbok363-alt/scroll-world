# Cinematic Web Redesign — Design Specification

## Purpose

Turn the fork from a page-wide scroll-scrub gimmick into a reusable cinematic web-design skill that keeps normal document flow as the default and uses motion only where it improves communication.

The target is the feel of strong product/AI landing pages: polished motion, large visual moments, and automatic playback when useful — without forcing visitors to drag a movie forward with 15+ swipes. Mobile usability, fast access to useful content, graceful degradation, and provider flexibility are first-class requirements.

## Current State

The upstream skill is centered on one continuous scroll-driven film:

- `skills/scroll-world/SKILL.md` defines the product as a scroll-scrubbed camera journey.
- `references/scrub-engine.js` creates an artificial tall scroll track and maps `scrollY` to `video.currentTime`.
- `references/pipeline.md` assumes N scene clips plus N-1 connector clips.
- `references/prompts.md` is optimized around seamless camera continuity and frame-matched connectors.
- The existing mobile safe-area handling, poster-until-painted behavior, `playsInline`, reduced-motion handling, lazy loading ideas, seek coalescing, and iOS priming are useful source material.

Recent upstream history is heavily invested in seam quality, continuous camera motion, and chain-generation infrastructure. Those are no longer the primary product goals of this fork.

## Core Product Decision

The page is a normal website first.

Motion is progressive enhancement with three behaviors:

1. **Viewport video** — default cinematic behavior. An independent muted inline clip plays automatically when its section is meaningfully visible.
2. **Micro scrub** — optional short scroll-controlled reveal. It may consume roughly 1-3 viewport heights, never the whole page.
3. **Static** — ordinary image/poster content, also used for reduced motion, failed media, low-data fallback, or intentionally static composition.

No visitor must finish an animation to reach navigation, copy, product information, or CTAs.

## Non-Goals

This redesign does not aim to:

- preserve the original continuous-world experience as the default;
- force every page into a 3D/diorama aesthetic;
- require connectors between cinematic sections;
- hard-code a single video-generation provider;
- reproduce third-party sites pixel-for-pixel or reuse their branded assets;
- make every section cinematic;
- create a general-purpose visual page-builder DSL.

## Experience Rules

### Normal scroll is sacred

The browser's document flow remains authoritative. A normal scroll gesture advances the page normally.

Viewport-video sections never add artificial scroll distance.

Micro-scrub sections may locally map scroll progress to clip progress, but only inside their own bounded section.

### Micro-scrub budget

`scrollVh` means the amount of scroll distance over which a sticky scrub surface advances from clip start to clip end.

- minimum: `1`
- default: `2`
- maximum: `3`

The runtime clamps to `1..3`. Three is a safety ceiling, not a target; simple reveals should prefer `1`, and `2` is the default.

A scrub section is independent. It never uses connector videos to bridge into another section.

### Content independence

Every motion section has a poster/static visual plus ordinary semantic HTML copy.

If JavaScript is unavailable, media fails, autoplay is rejected, reduced motion is enabled, data-saving mode suppresses motion, or the user scrolls quickly past the section, the page must still communicate the intended message.

Primary navigation and CTAs cannot depend on video state.

### Motion must earn its space

The skill should choose motion only when it adds explanatory or emotional value. Pricing, legal copy, dense feature text, forms, comparisons, and ordinary product information should remain normal HTML unless there is a specific reason to animate them.

## Progressive-Enhancement Runtime Contract

This was the key correction found during critique: **the new runtime must not become a JavaScript page renderer.**

Generated pages contain complete semantic HTML before the runtime loads. The engine enhances marked media regions only.

Conceptually:

```html
<section class="cw-section cw-split">
  <div class="cw-copy">
    <h2>Useful content already in HTML</h2>
    <p>Still readable if every script and video fails.</p>
  </div>

  <figure data-cw-video>
    <img src="poster.webp" alt="" />
    <video muted playsinline preload="none" data-src="demo.mp4"></video>
  </figure>
</section>
```

and:

```html
<section data-cw-scrub data-scroll-vh="2">
  ...static poster + ordinary HTML copy...
</section>
```

The skill may use section roles such as `hero`, `video`, `scrub`, `content`, `cards`, `device-showcase`, and `cta` as design vocabulary, but the runtime only owns motion behavior. It does not generate or own the page's business content.

This guarantees that JavaScript failure cannot erase useful content and prevents the engine from growing into a generic page builder.

## Layout Vocabulary

The skill should prefer a small set of strong compositions:

- **Hero** — immediate identity, concise value proposition, CTA available immediately.
- **Full-bleed cinematic** — large media surface, minimal copy, emotional/product reveal.
- **Split text/media** — explanation beside motion; sensible stacked order on mobile.
- **Device/product showcase** — focused product UI/device animation.
- **Content/cards** — ordinary semantic HTML; motion subordinate or absent.
- **Micro-scrub spotlight** — one focused transformation/reveal within the `1..3` scroll budget.
- **CTA** — accessible normal content, never dependent on animation completion.

These are authoring patterns, not a runtime schema.

## Viewport Video Behavior

Viewport-triggered video is the default motion primitive.

Required behavior:

- `muted` and `playsInline`;
- no visible controls by default;
- poster remains visible until a real video frame paints;
- lazy-load near visibility rather than at page start;
- play automatically when meaningfully visible;
- pause when clearly offscreen;
- never continuously seek `currentTime` from page scroll;
- never alter document height for playback;
- retain poster/static state on load or play failure.

### Default observation policy

Centralize these defaults in the runtime:

- prefetch observer root margin: `100% 0px`;
- playback threshold: intersection ratio `>= 0.50`;
- pause threshold: intersection ratio `< 0.15`;
- at most **one viewport video may be actively playing at a time**; if two satisfy the play threshold, the one with the greater intersection ratio wins.

The two-threshold policy avoids rapid play/pause thrashing around a single boundary.

### Replay behavior

Default: pause offscreen and resume from the paused position when re-entering.

Looping is opt-in per media element/section. `restart` and `play-once` modes are deferred until a real build requires them.

## Micro-Scrub Behavior

A micro scrub is a local spotlight, not navigation.

Required behavior:

- one independent clip;
- poster fallback;
- normal content before and after;
- `scrollVh` clamped to `1..3`;
- a sticky/pinned media surface is allowed only inside the scrub wrapper;
- leaving the wrapper immediately restores ordinary document flow;
- no cross-section connectors or scene chain;
- reduced-motion and data-saver modes show the static state instead of scrubbing video.

The existing seek-coalescing technique may be reused because it directly addresses phone decoder stalls. The original page-wide track/segment chain must not be reused.

The scrub controller should create a requestAnimationFrame loop only while at least one scrub section is active/near-active, and stop it when none is relevant.

## Mobile Rules

Mobile is not desktop squeezed narrower.

Required rules:

- layout may reorder text/media for readability;
- preserve safe-area handling;
- use muted inline playback;
- preserve poster-until-painted behavior;
- keep iOS priming/fallback techniques where they are still necessary;
- avoid decorative per-frame effects that compete with video decode;
- prefer mobile-composed/native portrait media when supplied;
- otherwise use deliberate crop/fallback behavior with critical subjects centered;
- micro scrub may never exceed `3` viewport heights on mobile;
- all primary copy and CTAs remain reachable through ordinary scrolling.

If `navigator.connection?.saveData === true`, the default behavior is poster/static media only unless a future explicit opt-in overrides it.

## Reduced Motion and Accessibility

`prefers-reduced-motion: reduce` disables autoplay and scrubbed motion.

Fallback behavior:

- show the poster/static visual;
- do not start video playback;
- do not run scrub seeking;
- do not run decorative motion whose only purpose is animation;
- preserve identical copy and CTA availability;
- preserve semantic HTML and keyboard access for interactive controls.

Autoplay media is supporting/decorative unless explicitly described otherwise. Information that exists only inside a clip must also be represented in nearby accessible text.

## Performance Rules

The redesign removes work that exists only for page-wide scrubbing.

Required direction:

- independent clips instead of `2N-1` chained assets;
- lazy loading and offscreen pause;
- poster-first rendering;
- one actively playing viewport clip maximum by default;
- no permanent page-wide rAF loop when no scrub is relevant;
- no Blob-fetch requirement for ordinary autoplay video unless a real host/browser constraint requires it;
- micro scrub may use seek-optimized encodes and a localized rAF loop;
- generated assets should be compressed for web delivery;
- mobile-specific/lighter encodes may be supplied where useful;
- data-saver mode defaults to static media.

A page with no scrub sections should pay no scrub runtime cost.

## Video Generation Architecture

The website runtime must be provider-blind. It receives finished assets and does not know which model generated them.

Generation is a build-time concern:

```text
section brief + source/poster + motion intent
        -> chosen generator/provider
        -> generated clip
        -> web optimization
        -> ordinary web asset
```

Provider selection is free-first but not hard-coded.

The skill should check currently available providers for the small capability surface actually required:

- image-to-video support;
- target aspect ratio;
- duration;
- resolution;
- optional first/last-frame control when a specific micro-scrub brief needs it;
- cost/quota information when available.

Do **not** build a large provider plugin framework. Provider recipes/capability checks may live in the generation documentation. The runtime receives MP4/WebM/poster URLs only.

The design must not assume any current free quota remains permanent.

## Video Prompting Rules

Prompts describe each cinematic section independently.

Reuse shared brand/art-direction context for visual cohesion, but do not force one literal camera path across the whole page.

Each motion brief should state:

- communication purpose;
- subject/action;
- camera/motion style;
- duration;
- aspect/composition target;
- brand palette/style constraints;
- whether a mobile-specific render is required;
- avoidance of unwanted generated text/logos unless intentionally present in a supplied source design.

Independent sections may use different camera grammar when that helps communication, provided the overall visual language remains coherent.

## Migration Strategy

Do not delete the original implementation during the first redesign slice.

Introduce a new canonical skill while retaining the upstream skill as legacy/reference material:

```text
skills/
  cinematic-web/
    SKILL.md
    references/
      cinematic-engine.js
      cinematic.css
      section-patterns.md
      motion-rules.md
      prompts.md
      video-pipeline.md
      index-template.html

  scroll-world/
    ...legacy original files...
```

After cinematic-web is stable and verified, the root README should present it as the primary fork direction and label scroll-world as the legacy continuous-scroll variant.

New features should target cinematic-web unless they specifically fix a legacy scroll-world defect.

## Runtime Boundaries

### `cinematic-engine.js`

Progressively enhances existing DOM. It discovers marked viewport-video and scrub regions and delegates behavior.

### Viewport-video controller

Owns:

- lazy source activation/prefetch;
- intersection observation;
- single-active-video arbitration;
- play/pause;
- poster transition;
- autoplay/load failure fallback.

### Micro-scrub controller

Owns:

- local scroll progress;
- `scrollVh` clamp;
- localized sticky-track sizing;
- seek coalescing;
- localized rAF lifecycle;
- reduced-motion/data-saver bypass.

### CSS/layout layer

Owns:

- supported presentation patterns;
- responsive stacking;
- safe areas;
- theme/typography tokens;
- poster/video layering.

No runtime controller depends on the generation provider.

## Error Handling

### Video load/play failure

Keep the poster visible and ordinary content interactive.

### Autoplay rejection

Keep the poster visible. Do not show a blocking overlay or force a play button unless a future explicitly interactive media type requires one.

### Missing mobile asset

Fall back to desktop media/poster with deliberate crop behavior.

### Invalid scrub budget

Clamp to `1..3`. Tests must verify both ends of the clamp.

### Missing source clip

Leave the section in its static/poster state rather than collapsing layout or throwing.

### Multiple visible videos

Play only the most visible qualifying section and pause the rest.

## Testing Requirements

The implementation plan must include tests for at least:

1. complete useful HTML exists before JavaScript enhancement;
2. viewport video loads near visibility, plays at `>= 0.50`, and pauses below `0.15`;
3. only one qualifying viewport video plays at a time;
4. poster remains if media loading/play fails;
5. reduced-motion prevents autoplay and scrub behavior;
6. `saveData` prevents autoplay/scrub behavior by default;
7. scrub `scrollVh` clamps below `1` and above `3`;
8. ordinary sections gain no artificial scroll height;
9. a page with no scrub sections has no persistent scrub rAF loop;
10. content and CTAs remain available when every video fails;
11. missing mobile variant falls back cleanly;
12. normal viewport video does not seek continuously from scroll;
13. mobile layout preserves readable content order and safe-area spacing.

Browser-level verification should include a phone viewport and at least one Safari/iOS-oriented check for muted inline playback/poster behavior.

## Success Criteria

The redesign is successful when:

- the page is useful with JavaScript disabled and with every video unavailable;
- normal scrolling remains normal across the page;
- cinematic clips start automatically when encountered and stop consuming active playback resources when irrelevant;
- no more than one autoplay clip runs at once by default;
- a scrub interaction cannot exceed a `3`-viewport local budget;
- a no-scrub page has no scrub loop or artificial track;
- generation complexity scales roughly with the number of cinematic sections instead of requiring connector assets between them;
- changing the video generator does not require runtime changes;
- mobile visitors can reach useful content quickly with ordinary scrolling.

## Kill Critique — Failure Modes We Must Prevent

### 1. Cinematic becomes autoplay-everything

That would recreate the same usability problem with a different mechanism. Motion requires a communication purpose.

### 2. Autoplay burns data/battery

Lazy loading, single-active playback, offscreen pause, mobile variants, poster fallback, and `saveData` static mode are requirements rather than polish.

### 3. Three viewport heights still feels long

`3` is the hard ceiling, not the recommended value. Default `2`, simple reveal `1`.

### 4. A config-driven renderer erases the progressive-enhancement goal

This was the most serious flaw in the first draft. The runtime now enhances existing semantic DOM instead of generating page content.

### 5. Provider abstraction becomes fake architecture

Do not build provider classes merely to look extensible. Generation docs can describe provider recipes; runtime consumes ordinary assets.

### 6. Keeping both engines doubles maintenance

Legacy scroll-world is reference/fallback during migration, not a co-equal long-term product direction.

### 7. Generated motion looks impressive but says nothing

Every cinematic section states its purpose before generation. Decorative motion alone does not justify a heavy asset.

### 8. "Copy good websites" becomes recognizable imitation

Study composition, pacing, hierarchy, motion patterns, and interaction conventions; synthesize them into the target brand rather than cloning a specific page wholesale.

### 9. Mobile composition is an afterthought

Each cinematic section must decide whether it needs a dedicated mobile render or whether centered crop/fallback is acceptable.

### 10. Scrub logic leaks into ordinary pages

No scrub section means no scrub track and no persistent scrub rAF work.

### 11. Two videos overlap and both autoplay

Single-active arbitration is mandatory.

### 12. JavaScript failure removes the page

Semantic content exists in HTML before enhancement. The engine owns motion, not business content.

## Decision Summary

- Normal document scrolling is the default interaction model.
- Viewport-triggered autoplay video is the default cinematic behavior.
- Micro scrub is optional and hard-limited to `1..3` viewport heights, default `2`.
- Motion never gates useful content.
- HTML is complete before JavaScript enhancement.
- The runtime enhances media; it does not render the whole page.
- Independent clips replace connector chains for normal sections.
- Only one viewport video plays at a time by default.
- Reduced-motion and data-saver modes fall back to static media.
- Existing useful mobile/poster/seek techniques are reused selectively.
- Video generation is provider-agnostic and free-first at build time, without a heavyweight adapter framework.
- The original scroll-world implementation remains legacy/reference material during migration.
