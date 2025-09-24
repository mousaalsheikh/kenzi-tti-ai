// Text-to-image Worker — "prompt-only" good defaults (CORS always on)
export default {
  async fetch(request: Request, env: any) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      const url = new URL(request.url);
      const raw = (url.searchParams.get("prompt") || "").trim();

      // 1) Rewrite vague/brand-ish prompts to descriptive subjects
      const base = rewriteBrandish(raw);

      // 2) Build rich prompt: subject + action + setting + style hints
      const enriched = enrich(base);

      // 3) Tuned negative prompt for SDXL
      const negative =
        "low quality, blurry, deformed, extra limbs, extra fingers, fused fingers, poorly drawn, bad anatomy, watermark, text, logo, caption, grainy, noisy, oversaturated, jpeg artifacts, cropped, out of frame";

      // 4) Sane SDXL params (good results without extra inputs)
      const width = 768;          // strong detail without being too slow
      const height = 512;         // cinematic landscape
      const num_steps = 30;       // quality/speed balance
      const guidance = 8.5;       // prompt adherence
      const seed = Math.floor(Math.random() * 1e9); // variety per request

      const png = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", {
        prompt: enriched,
        negative_prompt: negative,
        width,
        height,
        num_steps,
        guidance,
        seed,
      });

      return new Response(png, {
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store",
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

    // ---------- helpers ----------
    function corsHeaders() {
      return {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*",
        "access-control-max-age": "86400",
        "vary": "origin",
      };
    }

    // Expand short / vague prompts into a clear subject
    function enrich(user: string) {
      // If the user typed very little, add action + setting for better composition
      const tokens = user.split(/\s+/).filter(Boolean);
      const isShort = tokens.length <= 6;

      // Style pack (neutral but cinematic)
      const stylePrefix =
        "Highly coherent composition, cinematic lighting, volumetric light, soft shadows,";
      const styleSuffix =
        "sharp focus, high dynamic range, award-winning render, professional quality";

      // Defaults if very short
      let subject = user || "friendly puppy rescue team in colorful uniforms";
      if (isShort) {
        // Pick an action/setting that works for most subjects
        subject += ", dynamic action scene, in a lively city square at golden hour";
      }

      // Final enriched prompt
      return `${stylePrefix} ${subject}, ${styleSuffix}`;
    }

    // Replace brand/IP-like phrases with generic, descriptive wording
    function rewriteBrandish(raw: string) {
      let t = raw || "";
      const map: Array<[RegExp, string]> = [
        [/\bpaw\s*patrol\b/i, "friendly puppy rescue team in colorful uniforms"],
        [/\bpixar\b/i, "soft 3D toy aesthetic"],
        [/\bmarvel\b/i, "dynamic comic-book style"],
        [/\bstar\s*wars\b/i, "futuristic sci-fi setting"],
      ];
      for (const [re, repl] of map) t = t.replace(re, repl);
      return t;
    }
  },
};
