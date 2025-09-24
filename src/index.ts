export default {
  async fetch(request, env) {
    // simple health
    if (new URL(request.url).pathname === "/health") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }

    try {
      const url = new URL(request.url);
      const prompt = (url.searchParams.get("prompt") || "robot").trim();

      // primary + fallback models
      const models = [
        "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        "@cf/bytedance/stable-diffusion-xl-lightning",
      ];

      let lastErr;
      for (const model of models) {
        try {
          const png = await env.AI.run(model, {
            prompt,
            // sane defaults even if you only pass ?prompt
            width: 768, height: 512, num_steps: 28, guidance: 8.0,
            negative_prompt:
              "low quality, blurry, deformed, extra fingers, bad anatomy, watermark, text, logo, caption, artifacts",
            seed: Math.floor(Math.random() * 1e9),
          });
          return new Response(png, {
            headers: {
              "content-type": "image/png",
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          lastErr = e;
        }
      }

      // if both models failed, surface the error
      throw lastErr ?? new Error("Unknown error");
    } catch (err) {
      // return the error so you can see it in the browser
      return new Response(
        JSON.stringify({ error: String(err) }, null, 2),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  },
} satisfies ExportedHandler<Env>;
