/**
 * Cloudflare Workers — 静态资源托管入口
 * 配合 wrangler.jsonc 中的 ASSETS binding 使用
 */
export default {
  async fetch(request, env) {
    try {
      return await env.ASSETS.fetch(request);
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
};