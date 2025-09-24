// text-to-image Worker (smarter prompting) — CORS always on
// Style presets you can tweak
const STYLES: Record<string, { prefix: string; suffix?: string }> = {
  "kids-3d": {
    prefix:
      "Cute 3D render, soft studio lighting, toy-like materials, Pixar/Paw-Patrol-inspired aesthetic, kid-friendly, bright colors,",
    suffix:
      "octane render, subsurface scattering, global illumination, high quality",
  },
  cartoon: {
    prefix:
      "Colorful cartoon illustration, clean outlines, flat shading, vector aesthetic,",
    suffix: "bold shapes, simple background, high contrast",
  },
  realistic: {
    prefix:
      "Ultra-detailed, photorealistic, 85mm lens, shallow depth of field, cinematic lighting, volumetric light,",
    suffix: "film grain, natural color grading, high dynamic range",
  },
  anime: {
    prefix:
      "Anime key visual, vibrant cel shading, detailed character design, dynamic pose,",
    suffix: "studio-quality background, crisp lineart",
  },
};

// Good default “negative prompt” to avoid common SDXL artifacts
const DEFAULT_NEGATIVE =
  "low quality, blurry, deformed, extra limbs, extra fingers, fused fingers, poorly drawn, bad anatomy, watermark, text, logo, grainy, noisy, oversaturated, jpeg artifacts, cropped, out of frame";

export default {
  async fetch(request: Request, env: any) {
    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "*",
          "access-control-max-age": "86400",
          "vary": "origin",
        },
      });
    }

    try {
      const url = new URL(request.url);

      // ---- Inputs from QS
      const rawPrompt = (url.searchParams.get("prompt") || "").trim();
      const styleKey = (url.searchParams.get("style") || "kids-3d").toLowerCase();
      const negative = (url.searchParams.get("negative") || DEFAULT_NEGATIVE).trim();

      const width = clamp64(parseInt(url.searchParams.get("width") || "768", 10));   // larger default
      const height = clamp64(parseInt(url.searchParams.get("height") || "512", 10)); // landscape

      const steps = clamp(parseInt(url.searchParams.get("steps") || "28", 10), 10, 60);
      const guidance = clamp(parseFloat(url.searchParams.get("cfg") || "7.5"), 1, 15);
      const seed = url.searchParams.has("seed")
        ? parseInt(url.searchParams.get("seed")!, 10)
        : undefined;

      // ---- Build “smart” prompt
      const style = STYLES[styleKey] || STYLES["kids-3d"];
      const userPart =
        rawPrompt || "friendly rescue puppies in uniforms helping the city"; // smarter default than a single brand word
      const enrichedPrompt = buildPrompt(userPart, style);

      // ---- Generate
      const inputs: any = {
        prompt: enrichedPrompt,
        negative_prompt: negative,
        width,
        height,
        num_steps: steps,
        guidance,
      };
      if (Number.isFinite(seed)) inputs.seed = seed;

      const png = await env.AI.run(
        "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        inputs
      );

      return new Response(png, {
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store",
          // CORS: always allow (no credentials used)
          "access-control-allow-origin": "*",
          "vary": "origin",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "vary": "origin",
        },
      });
    }

    // ---- helpers
    function buildPrompt(
      user: string,
      s: { prefix: string; suffix?: string }
    ) {
      // If user only typed 1–3 words, expand with more context to avoid generic output
      const tokenCount = user.split(/\s+/).filter(Boolean).length;
      const addDetail =
        tokenCount < 6
          ? ", highly detailed, coherent composition, professional lighting, award-winning render"
          : "";

      // Encourage subject clarity: main subject first, then style & render hints
      return `${s.prefix} ${user}${addDetail}${
        s.suffix ? ", " + s.suffix : ""
      }`;
    }

    function clamp(v: number, min: number, max: number) {
      if (!Number.isFinite(v)) return min;
      return Math.max(min, Math.min(max, v));
    }

    function clamp64(v: number) {
      v = Number.isFinite(v) ? v : 512;
      v = Math.max(64, Math.min(1024, v));
      return Math.round(v / 64) * 64;
    }
  },
};
