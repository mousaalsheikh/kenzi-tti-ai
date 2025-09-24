export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const prompt = url.searchParams.get("prompt") ||
      "A futuristic humanoid robot, sleek design, glowing blue eyes, ultra-detailed, 4k illustration";

    // Parse width/height (defaults to 512x512 if not set)
    const width = Math.min(1024, Math.max(64, parseInt(url.searchParams.get("width") || "512", 10)));
    const height = Math.min(1024, Math.max(64, parseInt(url.searchParams.get("height") || "512", 10)));

    const inputs = {
      prompt,
      width,
      height,
    };

    const response = await env.AI.run(
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      inputs,
    );

    return new Response(response, {
      headers: {
        "content-type": "image/png",
      },
    });
  },
} satisfies ExportedHandler<Env>;
