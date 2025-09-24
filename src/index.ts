export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const inputs = {
      prompt:  (url.searchParams.get("prompt") || "robot").trim()
    };

    const response = await env.AI.run(
      "@cf/black-forest-labs/flux-1-schnell",
      inputs,
    );

    // Assuming the response has a property 'image' containing the image data as ArrayBuffer or Uint8Array
    return new Response(response.image, {
      headers: {
        "content-type": "image/png",
      },
    });
  },
} satisfies ExportedHandler<Env>;
