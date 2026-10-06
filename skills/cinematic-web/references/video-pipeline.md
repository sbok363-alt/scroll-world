# Provider-agnostic video pipeline

The runtime is provider-blind. Choose generation tools at build time, then ship ordinary optimized web assets. The selection policy is **free-first**, but never assume a provider is still free or still supports the required mode.

## 1. Verify the provider before generating

Re-check current provider capability immediately before spending quota. For every candidate, verify:

- image-to-video capability for the intended input;
- supported duration;
- supported aspect ratio and whether custom ratios are available;
- supported resolution and export format;
- current free quota, credits, price, rate limits, and regional availability;
- watermark/output restrictions;
- output ownership and commercial-use rights for the intended project.

Possible candidates can include Wan, MiniMax, Seedance, or another currently suitable model/service. These names are candidates, not guarantees of current availability, price, quality, or rights.

## 2. Decide whether a separate mobile render is justified

Do not generate two videos by default. Prefer a deliberate crop of the desktop asset when the composition survives it.

Generate a native mobile or portrait mobile version only when subject placement, camera motion, UI legibility, or product framing would crop badly. If a separate mobile encode is used, keep the same communication purpose and art direction.

## 3. Generate sections independently

Each section is a standalone clip driven by its own communication purpose. Reuse shared brand/art-direction context, but use **no connector stage** and no N-1 chain of transition clips between sections. The page is normal document flow, not one long rendered movie.

For each result, record the provider/model used, generation settings, duration, aspect ratio, resolution, and any relevant rights/check notes so the asset can be reproduced or replaced later.

## 4. Prepare assets for the web

Keep a high-quality source master, then create web delivery assets. A typical ffmpeg pass for H.264 delivery should:

- remove audio when it has no product purpose;
- use a broadly compatible H.264 profile and `yuv420p` pixel format;
- enable MP4 `faststart` so metadata is moved to the front;
- tune bitrate/CRF to the visual content instead of shipping the generator output untouched;
- preserve the intended aspect ratio and resolution;
- create a lighter mobile encode when measured savings justify it.

Example shape only; tune quality to the actual asset:

```bash
ffmpeg -i input.mp4 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart output.mp4
```

Report final **file size** for every shipped clip. Check playback quality at the real rendered size rather than optimizing for source resolution alone.

## 5. Posters and layout stability

Export a poster/static visual for every motion section. Poster dimensions and aspect ratio must match the media wrapper so first-frame takeover does not shift layout. The useful copy, navigation, and CTA remain HTML and must work even if the video never loads.

## 6. Scrub delivery requirements

Micro-scrub assets are Blob-fetched for reliable seeking. Ship scrub clips same-origin whenever practical. If they are hosted elsewhere, the host must be CORS-readable by the site. A same-origin or valid CORS response is a runtime requirement, not an optional optimization.

Ordinary viewport autoplay video does not require the scrub Blob pipeline and must not be turned into scroll-controlled playback.

## 7. Final pre-ship check

Before accepting an asset, verify current provider terms again if generation happened under temporary/free access, then check: visual purpose, duration, aspect ratio, resolution, poster match, file size, mobile crop/render, muted inline playback, and—only for scrubs—same-origin/CORS readability.
