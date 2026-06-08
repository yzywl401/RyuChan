/**
 * Cloudflare Workers — 静态资源托管入口
 * 配合 wrangler.toml 中的 ASSETS binding 使用
 */
export default {
	async fetch(request, env) {
		try {
			return await env.ASSETS.fetch(request);
		} catch {
			// SPA fallback: 对于 HTML 请求，回退到 index.html
			// 这样客户端路由（如 /write、/config 等）可以正常工作
			const accept = request.headers.get("Accept") || "";
			if (accept.includes("text/html")) {
				try {
					return await env.ASSETS.fetch(
						new Request(new URL("/index.html", request.url), request)
					);
				} catch {
					// 即使 index.html 也不存在，返回 404
				}
			}
			return new Response("Not Found", { status: 404 });
		}
	},
};