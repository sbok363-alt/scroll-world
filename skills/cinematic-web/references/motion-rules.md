# Motion rules

Motion is an enhancement layer over **normal scroll**. Never make the visitor scrub through a long movie to reach ordinary content.

## Decision order

1. **Static first.** Use text, images, posters, cards, and normal product UI whenever motion would add little explanatory or emotional value.
2. **Viewport video second.** Use an independent autoplay clip when movement clearly improves the communication purpose.
3. **Micro scrub last.** Use a local scroll-controlled reveal only when direct control helps explain a transformation.

## Viewport-triggered autoplay

The runtime observes the media frame (`data-cw-media`), not a potentially tall semantic section.

- Prefetch begins near the viewport with a `100% 0px` observer margin.
- Prefetch is metadata-first rather than eagerly downloading full offscreen video.
- Playback becomes eligible at **0.50 / 50%** intersection.
- The active clip pauses after it drops below **0.15 / 15%** intersection.
- Keep **at most one video playing at a time**.
- Hysteresis prevents thrashing: retain the active video while it remains above the 15% exit threshold; a new candidate must cross 50% and materially beat the active ratio before taking over.
- Viewport video is muted, inline, and control-free by default.
- The poster remains visible until a real video frame is painted.
- Ordinary viewport video never maps scroll position to `currentTime`.

If `IntersectionObserver` is unavailable, use the static poster rather than installing a heavy fallback scroll loop.

## Reduced motion and data saving

`prefers-reduced-motion: reduce` and `Save-Data` mean static mode by default:

- do not assign or fetch decorative video sources;
- do not autoplay;
- do not create sticky scrub height;
- keep posters and semantic copy visible;
- keep all navigation and CTAs usable.

## Micro scrub budget

A micro scrub controls one independent clip and one focused reveal.

- Minimum: **1 viewport** of progress.
- Default: **2 viewport heights** of progress.
- Maximum: **3 viewport heights** of progress.
- The runtime hard-clamps values outside `1..3`.
- Use **at most one scrub by default** on a page.
- Scrubs must not be adjacent.
- A second scrub requires a distinct communication purpose that cannot be served as well by static content or viewport video.

The extra sticky viewport needed to display the scrub is implementation geometry, not permission to increase the configured progress budget.

## Mobile behavior

Mobile is not desktop squeezed narrower.

- Keep useful copy before media when that order is semantically sensible.
- Use native mobile/portrait media only when the desktop composition would crop badly.
- Otherwise use a deliberate centered crop and lighter encode where helpful.
- Height-only mobile URL-bar changes must not stretch or shrink an active scrub track.
- Width/orientation changes may recompute scrub geometry.
- Avoid simultaneous decorative effects that compete with video decode.

## Failure behavior

Autoplay rejection, decode errors, missing sources, CORS failures, and unavailable mobile variants must leave the section as usable static content. Never add a blocking click-to-play overlay to the default cinematic path.
