# Cinematic section prompt grammar

Generate each motion section as an **independent** asset. Cohesion comes from a shared brand brief and shared art direction, not from forcing the entire page into one continuous shot.

## Shared context

Define this once for the page and reuse it in every section prompt:

- brand identity: palette, materials, lighting, typography mood, product surfaces;
- art direction: realism/stylization, contrast, lens language, texture, pacing;
- visual invariants: product proportions, logo treatment, UI/device appearance;
- negative constraints: unwanted text, watermarks, extra logos, malformed UI, unrelated objects.

Do not ask a generator to render important body copy or CTA text into video. Useful text remains semantic HTML.

## Per-section prompt

For every animated section, specify:

1. **Section purpose** — one sentence describing what motion communicates. If the purpose is weak, keep the section static.
2. **Starting composition** — subject placement, framing, foreground/background, and intended crop.
3. **Action / motion style** — what changes, how quickly, and what must stay visually stable.
4. **Camera** — static, dolly, orbit, push-in, macro move, or another deliberate camera behavior. Avoid camera movement that adds no communication value.
5. **Duration** — short enough to read immediately in the viewport; state the target duration explicitly.
6. **Aspect ratio and composition** — desktop target and, when necessary, a separate portrait/mobile composition.
7. **Ending state** — the clear visual state the clip should resolve to. It does not need to match the next section frame-for-frame.
8. **Negative constraints** — no unwanted text, no unrelated branding, no accidental scene changes, and no unnecessary particles.

## Template

```text
Shared brand: [brand identity + visual invariants]
Art direction: [lighting, material, palette, lens/style]
Section purpose: [what this motion communicates]
Starting composition: [subject + framing]
Action / motion style: [movement or transformation]
Camera: [camera behavior]
Duration: [seconds]
Aspect ratio / composition: [desktop target; mobile target if separately generated]
Ending state: [resolved visual state]
Negative: no unwanted text, no watermark, no extra logos, no malformed UI, no unrelated objects
```

## Independence rule

Prompt each section independently. Reuse the shared brand and art direction for visual continuity, but do not require connector clips, exact seam matching, or a continuous page-wide camera timeline. Normal document scrolling remains authoritative between sections.
