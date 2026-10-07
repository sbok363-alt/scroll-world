# Cinematic Web Redesign Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Implement task-by-task with tests before code.

**Goal:** Add a `cinematic-web` skill that keeps ordinary document scrolling authoritative, uses viewport-triggered autoplay video as the default cinematic primitive, and permits only local 1–3 viewport-height micro-scrubs.

**Architecture:** Progressive enhancement over semantic HTML. The runtime enhances existing media wrappers; it never creates primary copy/navigation/CTA content. Viewport video and micro-scrub are separate controllers. Normal video never maps scroll to `currentTime`; scrub work exists only for actual scrub sections. The original `skills/scroll-world/**` remains unchanged as legacy/reference material.

**Tech Stack:** Vanilla ES modules, semantic HTML/CSS, IntersectionObserver with static fallback, HTMLVideoElement, requestVideoFrameCallback with fallback, Playwright Chromium/WebKit, node:test, ffmpeg for a tiny real-media fixture and asset guidance.

**Spec:** `docs/superpowers/specs/2026-10-03-cinematic-web-design.md`

## Global Constraints

- Normal document flow is authoritative; no viewport-video section may add artificial scroll distance.
- Viewport autoplay targets the **media frame**, not the semantic section, so tall copy cannot make a 50% intersection mathematically impossible.
- Play entry threshold is `0.50`; pause threshold is `0.15`; source prefetch margin is `100% 0px`.
- Autoplay arbitration uses hysteresis: keep the current active clip while it remains >= `0.15`; a new candidate may preempt only after crossing `0.50` and exceeding the active ratio by at least `0.10`. At most one viewport clip plays.
- Prefetch assigns source with `preload="metadata"`; `preload="auto"` is used only when a clip becomes a serious play candidate. Do not eagerly download full offscreen clips.
- `prefers-reduced-motion: reduce` and `Save-Data` are static-poster modes: no source assignment, autoplay, scrub fetch, sticky scrub track, or decorative motion.
- Micro scrub default is `2`, hard clamp `1..3` viewport-heights of **progress**. The skill defaults to at most one scrub section per page; a second requires a distinct communication purpose and scrub sections must not be adjacent.
- Scrub track geometry uses a stable pixel viewport baseline captured at mount. Height-only mobile URL-bar resizes do not recompute the track; width/orientation changes do.
- No page-wide/permanent rAF loop. A scrub schedules at most one frame per relevant scroll/seek catch-up event.
- Every motion section has a poster/static visual and semantic copy. CTAs/navigation never depend on media success.
- Media wrappers reserve aspect ratio before video loads; first-frame takeover must not cause layout shift.
- Missing IntersectionObserver, missing source, autoplay rejection, decode failure, CORS failure, or absent mobile variant all degrade to usable static content.
- Scrub Blob loading requires same-origin or CORS-readable assets; the generation pipeline must copy scrub assets into the site or configure CORS. A failed Blob fetch leaves the poster/static state.
- Runtime is provider-blind. Generation is free-first only after current capability, quota, output rights, and commercial-use restrictions are checked.
- Existing `skills/scroll-world/**` stays byte-for-byte unchanged in this migration.

## Review Focus

1. Tall sections and overlapping sections: autoplay still starts from the media-frame observer and does not thrash between clips.
2. Mobile URL-bar collapse/expand: scrub track does not change length or yank scroll position.
3. Fast scrub while a seek is in flight: intermediate writes coalesce, and `seeked` performs one catch-up seek even if the user stopped scrolling.
4. Real media vs mocked media: at least one real tiny MP4 must prove inline muted playback/frame takeover; mocks alone are insufficient.
5. Repeated mount/unmount and unsupported APIs: no duplicate observers/listeners, object URLs are revoked, hidden tabs pause media, and static fallback remains intact.

---

## Task 1: Test Harness, Semantic Shell, and Real Media Fixture

**Files:** create `package.json`, `playwright.config.mjs`, `tests/server.mjs`, `tests/fixtures/cinematic-page.html`, `tests/fixtures/media/tiny.mp4`, `tests/progressive-enhancement.spec.mjs`, `skills/cinematic-web/references/cinematic-engine.js`, `cinematic.css`, `index-template.html`.

**Interfaces:** `mountCinematicWeb(root = document, options = {}) -> { destroy(): void }`. `root` can be Document or Element. Use `data-cw-kind`, `data-cw-media`, `data-cw-poster` markers; primary content already exists before JS.

- [ ] Write failing tests with JS disabled: h1, primary CTA, poster and ordinary content are visible; non-scrub section height is unchanged after mount.
- [ ] Add a test that media wrapper bounding box changes by <=1px from poster state to video-frame state.
- [ ] Generate and commit a ~1s silent H.264/yuv420p MP4 with ffmpeg for one real playback path; CI must install ffmpeg. Keep mocked media for deterministic controller edge cases.
- [ ] Implement minimal semantic shell and CSS aspect-ratio reservation. `index-template.html` loads `cinematic-engine.js` with `<script type="module">`.
- [ ] Make mount idempotent using a per-root registry (WeakMap or equivalent): a second mount returns/reuses the existing controller instead of duplicating observers. `destroy()` is idempotent and clears the registry.
- [ ] Run Chromium + WebKit progressive-enhancement tests and commit.

## Task 2: Viewport Video Controller With Stable Arbitration

**Files:** create `media-utils.js`, `viewport-video.js`, `tests/viewport-video.spec.mjs`; modify engine and fixture.

**Interfaces:**
- `selectMediaSource(video, isMobile) -> string|null`
- `prefersReducedMotion(win) -> boolean`
- `saveDataEnabled(nav) -> boolean`
- `mountViewportVideos(root, options) -> { destroy(): void }`
- Observe `[data-cw-media]` for visibility; video is `video[data-cw-video][data-src]`, optional `data-src-mobile`.

- [ ] Write failing tests for source lazy-load, metadata-only prefetch, play >=0.50, pause <0.15, hysteresis/no thrash, max one playing, missing source, play rejection, media error, controls=false, muted+playsinline, Save-Data, reduced motion, and **no `currentTime` writes on normal scroll**.
- [ ] Add a tall semantic section fixture (>2 viewport heights) whose media frame is 100vh; prove autoplay can still trigger.
- [ ] Add unsupported-IntersectionObserver test: mount does not throw; poster/content remain.
- [ ] Implement prefetch observer (`100% 0px`) that assigns source with `preload='metadata'`; do not set `auto` yet.
- [ ] Implement play observer on the media frame. Keep active while >=0.15. A challenger that crosses 0.50 preempts only when its ratio >= active ratio +0.10; otherwise retain active. This is intentionally stable rather than "always highest ratio".
- [ ] On activation set `preload='auto'`, enforce muted/playsinline/no-controls and call play. Hide poster only after a real frame (`requestVideoFrameCallback`; `playing`+`loadeddata` fallback when unavailable).
- [ ] Pause active media on `visibilitychange/pagehide`; when visible again, reevaluate rather than blindly resuming.
- [ ] Verify one real tiny MP4 actually paints in Chromium and WebKit in addition to mocked state tests.
- [ ] Run focused + regression tests and commit.

## Task 3: Bounded Micro-Scrub Without Mobile Viewport Jumps

**Files:** create `micro-scrub.js`, `tests/micro-scrub.spec.mjs`; modify engine/CSS/fixture.

**Interfaces:**
- `clampScrollVh(value)`: invalid ->2; <1 ->1; >3 ->3.
- `mountMicroScrubs(root, options) -> { destroy(): void }`
- scrub section contains `.cw-scrub__sticky`, `video[data-cw-scrub-video]`, poster, and optional mobile source.

- [ ] Write failing clamp tests plus resolved value marker.
- [ ] Write failing geometry test: progress budget N uses stable baseline `H` and track height `(N + 1) * H` pixels; height-only resize leaves it unchanged; width/orientation change recomputes it.
- [ ] Write reduced-motion/Save-Data test: natural section height, no sticky trap, no video fetch.
- [ ] Write fast-seek test: while `video.seeking` true, no extra currentTime writes; when `seeked` fires after the last user scroll, schedule exactly one catch-up update to the newest target.
- [ ] Guard duration: do not seek until finite `duration > 0`; clamp target below duration (`min(progress * duration, duration - 0.001)`).
- [ ] Fetch scrub clip as Blob only near viewport. Abort outstanding fetch on destroy; revoke every object URL. Blob/CORS failure keeps poster/static content.
- [ ] Use passive scroll + one-shot rAF only while at least one scrub is relevant. No recursive rAF. Zero scrub sections installs no scrub scroll machinery.
- [ ] Prime scrub video on first pointer/touch only if needed for mobile seek painting; do not prime ordinary viewport videos.
- [ ] Run focused + regression tests and commit.

## Task 4: Mobile, Accessibility, and Lifecycle Hardening

**Files:** modify CSS/controllers/template; create `tests/mobile-accessibility.spec.mjs`.

- [ ] Test mobile source wins when present; missing mobile source falls back to desktop.
- [ ] Test semantic DOM order stays readable on <=860px and CTAs remain reachable before media loads.
- [ ] Test safe-area CSS tokens and reduced-motion rules exist.
- [ ] Test repeated mount/destroy leaves no duplicate play calls/listeners; destroy pauses active videos and revokes scrub Blob URLs.
- [ ] Test tab hide pauses active media and no unhandled promise rejection appears on hide/show.
- [ ] Implement approved layouts only: hero, full-bleed, split, device/product, content/cards, scrub spotlight, CTA. No decorative particles.
- [ ] Run full browser suite and commit.

## Task 5: Agent Skill and Free-First Provider Pipeline

**Files:** create `skills/cinematic-web/SKILL.md`, `section-types.md`, `motion-rules.md`, `prompts.md`, `video-pipeline.md`, `tests/skill-contract.test.mjs`.

- [ ] Contract-test valid SKILL frontmatter (`name`, `description`, `allowed-tools`) and the runtime data-attribute contract.
- [ ] Encode normal-site-first selection: static by default; viewport video when motion has a clear communication/emotional job; scrub only for focused reveal.
- [ ] Encode scrub-density rule: one scrub by default, never adjacent; second only for a distinct purpose. Each remains 1–3 progress viewports.
- [ ] Explicitly reject continuous connector chains in the canonical cinematic-web path.
- [ ] Prompt each motion section independently while reusing shared brand/art direction.
- [ ] Provider checklist must verify live image-to-video capability, duration/aspect/resolution, current quota/price, current output/commercial rights, and whether native mobile composition is worth generating.
- [ ] Require scrub assets to be local/same-origin or CORS-readable because the runtime Blob-fetches them.
- [ ] Web optimization guidance: strip audio, yuv420p, faststart, report final file sizes, lighter mobile encode when useful, poster dimensions/aspect matching the video wrapper. No N-1 connector stage.
- [ ] Run contract tests and commit.

## Task 6: Packaging Without Rewriting Upstream History

**Files:** modify `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`; create `tests/manifest-contract.test.mjs`.

- [ ] Keep plugin install identity `scroll-world`; expose both `./skills/cinematic-web` and `./skills/scroll-world`.
- [ ] Bump fork version to `0.9.0`, point homepage to fork, preserve upstream author/owner attribution.
- [ ] README leads with normal scroll + viewport autoplay + bounded scrub; labels original continuous Scroll World as legacy/specialized.
- [ ] Contract-test both skill paths and attribution.
- [ ] Verify `git diff --exit-code main -- skills/scroll-world`.
- [ ] Commit.

## Task 7: CI and Acceptance

**Files:** create `.github/workflows/ci.yml`; adjust test config/scripts only as needed.

- [ ] CI uses Node 22, installs ffmpeg plus Playwright Chromium/WebKit dependencies, runs `npm ci` and `npm test`.
- [ ] Automated acceptance must cover: JS-off content, tall-section autoplay target, one-active hysteresis, real-media frame paint, missing/failed media fallback, no normal-video currentTime writes, scrub 1–3 clamp, URL-bar-style height-only resize stability, seek catch-up, reduced motion, Save-Data, mobile source fallback, duplicate mount/destroy, no permanent rAF, no console/unhandled errors.
- [ ] Manual/browser acceptance in Chromium desktop, Chromium phone viewport, WebKit phone viewport: ordinary scroll remains ordinary; no autoplay controls overlay; micro scrub never traps the page; media failure leaves useful content; copy/CTA remain immediate.
- [ ] Record limitation explicitly: Playwright WebKit phone emulation is an iOS-oriented engine check, **not proof of real-device iOS Safari**.
- [ ] Run `npm test` and `git diff --exit-code main -- skills/scroll-world`; require clean worktree before completion claim.

## Kill-Critique Decisions Carried Into v2

- Observer target changed from whole section to media frame.
- "Highest ratio always wins" changed to hysteretic arbitration to avoid thrash and threshold blind spots.
- Full-video offscreen prefetch removed; prefetch is metadata-first.
- Real media playback added so mocks cannot fake browser compatibility.
- Micro-scrub sizing made stable against mobile URL-bar height-only resizes.
- Seek coalescing now has a final catch-up path after `seeked`.
- Duplicate mounts, hidden tabs, missing IntersectionObserver, finite-duration guards, object-URL cleanup, CORS failure, and layout shift are explicit test cases.
- The skill gets a page-level scrub-density rule so many tiny scrubs cannot reconstruct the original 15-scroll problem in aggregate.

## Execution Rulings

- **2026-10-04 — Test runner:** the sandbox cannot resolve GitHub/npm, so RED/GREEN verification runs in GitHub Actions on the isolated `design/cinematic-web` branch. The workflow is introduced in Task 1 as test infrastructure rather than deferred to Task 7; Task 7 hardens the same workflow for final CI. This preserves real browser evidence instead of substituting unrun local claims.
