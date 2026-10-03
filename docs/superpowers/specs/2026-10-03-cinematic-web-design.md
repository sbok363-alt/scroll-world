# Cinematic Web Redesign — Design Specification

## Purpose

Turn the fork from a page-wide scroll-scrub gimmick into a reusable cinematic web-design skill that keeps normal document flow as the default and uses motion only where it improves communication.

The desired result is a site that can feel as polished and cinematic as strong product/AI landing pages without making visitors drag a movie forward with 15+ swipes. Mobile usability, fast access to useful content, graceful degradation, and provider flexibility are first-class requirements.

## Current State

The upstream skill is built around one continuous scroll-driven film:

- `skills/scroll-world/SKILL.md` defines the product as a scroll-scrubbed camera journey.
- `references/scrub-engine.js` creates an artificial tall scroll track and maps `scrollY` to `video.currentTime`.
- `references/pipeline.md` assumes N scene clips plus N-1 connector clips.
- `references/prompts.md` is optimized around seamless camera continuity and frame-matched connector generation.
- Mobile handling, poster behavior, `playsInline`, reduced-motion handling, safe-area CSS, lazy loading, and iOS priming are useful and should be preserved where applicable.

Recent upstream history is heavily invested in seam quality, continuous camera motion, and paid video-chain infrastructure. Those are no longer the primary product goals of this fork.

## Core Product Decision

The page is a normal website first.

Motion is an enhancement layer with three primary behaviors:

1. **Viewport video** — default cinematic behavior. A section plays an independent muted inline clip when it becomes visible.
2. **Micro scrub** — optional short scroll-controlled moment for a focused reveal. It may consume roughly 1-3 viewport heights, never the whole page.
3. **Static** — ordinary image/poster content, also used as fallback for motion reduction, failed media, or deliberate low-motion composition.

No user should need to finish an animation in order to reach text, navigation, product information, or calls to action.

## Non-Goals

This redesign does not aim to:

- preserve the original continuous-world experience as the default;
- force every page into a 3D/diorama aesthetic;
- require connectors between cinematic sections;
- hard-code a single video-generation provider;
- reproduce third-party websites pixel-for-pixel or reuse their branded assets;
- make every section cinematic;
- turn the skill into a general-purpose visual page builder with unlimited layout primitives.

## Experience Rules

### 1. Normal scroll is sacred

The browser's document flow remains authoritative. A normal scroll gesture advances the page normally.

Viewport video sections must not modify scroll distance.

Micro scrub sections may temporarily map scroll progress to clip progress, but only inside a bounded local section.

### 2. Micro scrub budget

A scrub section accepts a scroll budget in viewport heights.

- minimum: `1`
- default: `2`
- maximum: `3`

The runtime clamps values outside this range. Agents must not be able to recreate a 10-20 viewport experience by configuration alone.

A scrub section is independent. It does not use connector videos to bridge to the next page section.

### 3. Content independence

Every motion section has a poster/static visual and ordinary HTML copy.

If video loading fails, autoplay is blocked, the browser is in reduced-motion mode, JavaScript is unavailable, or the user scrolls too quickly, the page must still communicate the intended message.

Primary navigation and CTAs cannot depend on video state.

### 4. Motion should earn its space

The skill should choose a cinematic section only when motion adds explanatory or emotional value.

Ordinary text, feature cards, comparison content, pricing, forms, legal copy, and dense product information should remain normal document content unless there is a specific reason otherwise.

## Section Model

The canonical page model is an ordered list of independent sections.

Recommended section types:

- `hero`
- `video`
- `scrub`
- `content`
- `cards`
- `device-showcase`
- `cta`

The engine should not attempt to encode every possible layout. These types are intentionally limited so generated pages stay coherent.

A minimal conceptual config:

```js
{
  sections: [
    { type: 'hero', ... },
    { type: 'video', poster: '...', src: '...', layout: 'full-bleed', ... },
    { type: 'content', ... },
    { type: 'scrub', poster: '...', src: '...', scrollVh: 2, ... },
    { type: 'cards', ... },
    { type: 'video', poster: '...', src: '...', layout: 'split', ... },
    { type: 'cta', ... }
  ]
}
```

The final implementation may adapt the exact property names, but the architecture must preserve independent sections and bounded scrub behavior.

## Viewport Video Behavior

Viewport-triggered video is the default motion primitive.

Required behavior:

- `muted`
- `playsInline`
- no visible playback controls by default
- poster visible before first painted video frame
- lazy-load before/near visibility rather than loading all clips at page start
- autoplay only when the section is meaningfully visible
- pause when the section is clearly offscreen
- do not continuously seek `currentTime`
- do not alter document height for playback
- preserve final/poster visual during loading or failure

Recommended visibility thresholds:

- prefetch/load around the section entering a generous root margin
- play when approximately 40-60% visible
- pause after visibility falls substantially below the play threshold

Exact thresholds should be centralized as runtime defaults rather than scattered through generated pages.

### Replay behavior

Default: resume from the paused position when re-entering the viewport.

Optional modes may allow `restart` or `play-once`, but YAGNI applies: implement only if the section brief needs them.

## Micro Scrub Behavior

A micro scrub is a local spotlight, not navigation.

Required behavior:

- one independent clip;
- poster fallback;
- normal content before and after it;
- bounded `scrollVh` clamped to `1..3`;
- local sticky/pinned presentation is allowed while inside the section;
- scrolling out of the section immediately returns to normal document flow;
- no cross-section connectors;
- no continuous scene chain;
- reduced-motion uses the poster/static state rather than scrubbing video.

The existing seek-coalescing logic may be reused selectively for micro scrub sections because it directly addresses phone decode stalls. The old page-wide scroll track and section-chain math should not be reused.

## Layout System

The skill should prefer a small library of strong compositions:

### Hero

- concise message;
- immediate product/brand identity;
- optional cinematic media but no forced interaction;
- CTA available immediately.

### Full-bleed cinematic

- large media surface;
- minimal supporting copy;
- best for emotional/product reveals.

### Split text/media

- useful explanation on one side, motion on the other;
- stacks into a sensible mobile order.

### Device/product showcase

- focused product UI/device mockup or product animation;
- may use looping viewport video.

### Content/cards

- standard HTML layout;
- motion optional and subordinate.

### Micro scrub spotlight

- sticky media surface inside a 1-3vh scroll budget;
- focused transformation/reveal only.

### CTA

- ordinary accessible content;
- no animation completion requirement.

## Mobile Rules

Mobile is not desktop squeezed narrower.

Required rules:

- layout may reorder text/media for readability;
- preserve safe-area handling;
- use `playsInline` and muted playback;
- preserve poster-until-painted behavior;
- keep iOS priming/fallback techniques where they remain necessary;
- avoid running decorative particles/effects that meaningfully compete with video decode;
- prefer native portrait or mobile-composed clips when supplied;
- otherwise use a deliberate crop/fallback and keep critical subjects centered;
- no micro scrub may exceed `3` viewport heights on mobile;
- all primary copy and CTAs must be reachable with ordinary scrolling.

The site must remain usable on lower-end phones even when video enhancement is reduced or skipped.

## Reduced Motion and Accessibility

`prefers-reduced-motion: reduce` disables autoplay and scrubbed motion.

Fallback behavior:

- show poster/static visual;
- no forced motion;
- no decorative particles whose only purpose is motion;
- maintain the same text and CTA content;
- preserve semantic HTML and keyboard access for interactive controls.

Autoplay media is decorative/supporting unless explicitly described otherwise. Meaning that exists only inside a video must also be present in nearby accessible text.

## Performance Rules

The redesign should remove work that only exists to serve page-wide scrubbing.

Required direction:

- independent clips instead of `2N-1` chained assets;
- lazy loading;
- video pause offscreen;
- poster-first rendering;
- no page-wide requestAnimationFrame loop if no scrub section is active;
- no blob-fetch requirement for normal viewport playback unless needed for a specific browser/hosting issue;
- micro scrub may use a seek-optimized encode and localized rAF loop;
- generated assets should be compressed for web delivery;
- mobile variants may use lighter encodes when useful.

A page with no scrub sections should not pay the runtime cost of a scrub engine.

## Video Generation Architecture

The website runtime must not know which model/provider generated a clip.

Generation is a build-time pipeline with a provider adapter boundary.

Conceptual interface:

```text
input brief + poster/still + motion intent
        -> provider adapter
        -> generated clip
        -> web optimization
        -> section asset
```

Provider selection is free-first, but not hard-coded.

Initial adapters may target providers such as Wan, MiniMax, Seedance, or a custom/local route when available. The skill should make capability/cost checks at generation time and choose from currently configured providers.

The provider contract should be based on capabilities the skill actually needs, such as:

- image-to-video support;
- target aspect ratio;
- duration;
- resolution;
- optional first/last frame control for rare micro-scrub cases;
- cost/quota visibility when available.

The design must not assume today's free quota is permanent.

## Video Prompting Rules

Prompts should describe each section independently.

Reuse shared brand/art-direction context for visual cohesion, but do not force a literal continuous camera path across the page.

The generation brief for each motion section should include:

- section purpose;
- desired subject/action;
- camera/motion style;
- desired duration;
- composition/aspect target;
- brand palette/style constraints;
- no unwanted text/logos unless intentionally part of the source design.

Independent sections can use different camera grammar when that improves communication, as long as the overall visual language stays coherent.

## Migration Strategy

Do not destroy the original implementation immediately.

The fork should introduce a new canonical cinematic engine and skill flow while keeping the original scrub-world references available as legacy/source material during migration.

Suggested target shape:

```text
skills/
  cinematic-web/
    SKILL.md
    references/
      cinematic-engine.js
      section-types.md
      motion-rules.md
      prompts.md
      video-pipeline.md
      index-template.html

  scroll-world/
    ...legacy original files...
```

After the new skill is stable and tested, the README may present cinematic-web as the primary fork direction and label scroll-world as the legacy continuous-scroll variant.

## Engine Boundaries

The new runtime should separate responsibilities:

### `cinematic-engine.js`

Coordinates section mounting and shared runtime defaults.

### Viewport video controller

Owns:

- lazy-load/prefetch;
- visibility observation;
- play/pause;
- poster transition;
- error fallback.

### Micro scrub controller

Owns:

- local scroll progress;
- clamp to 1-3 viewport heights;
- seek-coalescing;
- localized rAF lifecycle;
- reduced-motion bypass.

### Layout/CSS layer

Owns:

- supported section compositions;
- responsive stacking;
- safe areas;
- typography/theme tokens.

Controllers should not depend on the video-generation provider.

## Error Handling

### Video load/play failure

Keep the poster visible and leave ordinary content interactive.

### Autoplay rejection

Keep the poster visible. Do not show a blocking overlay or force the user to press Play unless the section explicitly needs interactive playback.

### Missing mobile asset

Fall back to the desktop asset/poster with deliberate crop behavior.

### Invalid scrub budget

Clamp to `1..3` at runtime. Development builds/tests should make the clamp observable so accidental oversized configuration is caught.

### Missing source clip

Render the poster/static section rather than collapsing the section or breaking layout.

## Testing Requirements

The implementation plan must include tests for at least:

1. viewport video plays when sufficiently visible and pauses offscreen;
2. poster remains if media fails;
3. reduced-motion prevents autoplay and scrub behavior;
4. scrub `scrollVh` clamps below 1 and above 3;
5. normal sections do not gain artificial scroll height;
6. a page with no scrub sections does not run a permanent scrub rAF loop;
7. content and CTA remain accessible without successful media playback;
8. mobile layout preserves readable content order and safe-area spacing;
9. missing mobile variant falls back cleanly;
10. normal viewport video does not seek continuously based on scroll.

Browser-level verification should include a phone viewport and at least one Safari/iOS-oriented check for inline muted playback/poster behavior.

## Success Criteria

The redesign is successful when:

- a generated page can be browsed normally without motion feeling like a navigation mechanism;
- cinematic clips begin automatically when encountered and stop consuming resources when irrelevant;
- a scrub interaction can exist without exceeding a 3-viewport local budget;
- useful page content remains available if all videos fail;
- the runtime is materially simpler for pages that do not use scrub sections;
- generation cost/complexity scales approximately with the number of cinematic sections instead of requiring connector assets between them;
- provider changes do not require runtime changes;
- mobile visitors can reach useful content quickly with ordinary scrolling.

## Critical Risks / Kill Critique

### Risk 1: "Cinematic" becomes an excuse to autoplay everything

If the skill treats every section as video-worthy, the redesign recreates the same usability problem in a different form. The generation instructions must explicitly prefer normal content unless motion has a job.

### Risk 2: Autoplay burns data and battery

Independent autoplay clips can still be abusive on phones. Lazy loading, offscreen pause, poster-first behavior, optional mobile variants, and a conservative number of simultaneous loaded clips are required. The runtime should never play multiple offscreen/overlapping sections at once.

### Risk 3: A 3vh scrub can still feel too long

Three viewport heights is an upper safety bound, not a target. Default is 2; one viewport is preferred for simple reveals. The skill should justify 3 rather than automatically using it.

### Risk 4: Provider abstraction becomes fake architecture

Do not invent a large plugin framework. A provider adapter only needs the small capability surface required for generation. The runtime receives finished web assets and remains provider-blind.

### Risk 5: Supporting both old and new systems doubles maintenance

The old scroll-world engine remains legacy/reference code during migration, not a co-equal default forever. New features should go into cinematic-web unless they specifically fix a legacy bug.

### Risk 6: Generated video looks impressive but says nothing

Every motion section must have a stated communication purpose. Decorative movement alone is insufficient reason for a large video asset.

### Risk 7: "Copy good websites" turns into imitation

The skill may study composition, pacing, motion patterns, hierarchy, and interaction conventions, but must synthesize them into the user's brand rather than cloning a recognizable page wholesale.

### Risk 8: Mobile video composition is an afterthought

Desktop-first source clips can crop badly on portrait screens. The generation flow must explicitly decide whether a section needs a mobile-specific render or whether centered composition/cropping is acceptable.

### Risk 9: Overengineering section types

A small set of section roles is a feature. Do not add a generic DSL, visual editor, or dozens of variants until real builds prove a need.

### Risk 10: Scrub code leaks cost into every page

The new architecture must lazy-initialize scrub logic only for actual scrub sections. A pure autoplay/static page should have no continuous scroll-to-video work.

## Decision Summary

- Normal document scrolling is the default interaction model.
- Viewport-triggered autoplay video is the default cinematic behavior.
- Micro scrub is optional and hard-limited to 1-3 viewport heights, default 2.
- Motion never gates useful content.
- Independent clips replace connector chains for normal sections.
- Existing useful mobile/poster/reduced-motion techniques are preserved selectively.
- Video generation becomes provider-agnostic and free-first at build time.
- The original scroll-world implementation stays as legacy/reference material during migration.
