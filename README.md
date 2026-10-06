# scroll-world

This fork ships two web-design skills under the same `scroll-world` plugin identity.

## `cinematic-web` — default

Use `skills/cinematic-web` for cinematic product and brand pages that still behave like normal websites.

- **Normal document scroll** stays authoritative. No page-wide scroll hijacking and no requirement to render one giant continuous movie.
- **Static HTML is the default.** Useful copy, navigation, and CTAs remain semantic and usable before media loads.
- **Viewport-triggered autoplay video** is progressive enhancement: muted, inline, lazy, and without native playback controls.
- **Micro-scrubs are bounded.** A scrub uses **1–3 viewport heights** of local scroll budget, defaults to 2, and should be rare rather than the whole page.
- `prefers-reduced-motion` and Save-Data fall back to the static/natural-height experience.
- Desktop media can be cropped for phones; a separate portrait render is only justified when the composition actually needs one.
- The runtime is provider-agnostic. Generation guidance is free-first and requires current capability, quota/price, and commercial-rights checks before spending or shipping.

The main runtime/reference files live in:

```text
skills/cinematic-web/
├── SKILL.md
└── references/
    ├── cinematic-engine.js
    ├── cinematic.css
    ├── index-template.html
    ├── media-utils.js
    ├── micro-scrub.js
    ├── motion-rules.md
    ├── prompts.md
    ├── section-types.md
    ├── video-pipeline.md
    └── viewport-video.js
```

## Legacy continuous Scroll World

`skills/scroll-world` is the **legacy continuous Scroll World** workflow from the original project and is preserved for the specialized “fly through one connected generated world” experience. It keeps the original continuous scroll-scrub / connector-clip approach rather than the bounded `cinematic-web` model.

That legacy workflow may depend on external generation services and their current terms, pricing, quotas, and model availability. Treat any provider-specific claims inside the preserved legacy material as something to re-check before use.

## Install

### Claude Code plugin

```text
/plugin marketplace add sbok363-alt/scroll-world
/plugin install scroll-world@scroll-world
```

The plugin exposes both `cinematic-web` and `scroll-world`.

### Skills CLI

```bash
npx skills add sbok363-alt/scroll-world
npx skills add sbok363-alt/scroll-world -a codex
```

### Manual

```bash
git clone https://github.com/sbok363-alt/scroll-world
cp -R scroll-world/skills/cinematic-web ~/.claude/skills/
cp -R scroll-world/skills/scroll-world ~/.claude/skills/
```

Choose only the folder(s) your agent needs.

## Tests

The fork includes Node contract tests and Playwright browser coverage for the cinematic runtime, including progressive enhancement, viewport autoplay, bounded scrub behavior, mobile layout/accessibility, reduced motion, Save-Data, and lifecycle cleanup.

```bash
npm test
```

CI targets Chromium and WebKit. **Playwright WebKit phone emulation is not proof of real-device iOS Safari behavior.** Real-device testing is still the final check for Safari-specific media and viewport quirks.

## Attribution

This fork builds on the original upstream project **`oso95/scroll-world`** by cyw. The original `skills/scroll-world` workflow is intentionally retained while the fork adds the separate bounded `cinematic-web` workflow.

Upstream: https://github.com/oso95/scroll-world

## License

MIT — see [LICENSE](LICENSE).
