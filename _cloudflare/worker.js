// 207studio.dev edge worker: Markdown for agents in front of GitHub Pages.
// Accept: text/markdown -> Markdown body (Vary: Accept on every response).
// Subrequests to the same hostname go to the origin (GitHub Pages) without re-entering the worker.
const NOT_FOUND_MD = `# 404: page not found

This page does not exist on 207studio.dev.

- All products: https://207studio.dev/products/
- Product list for AI agents: https://207studio.dev/llms.txt
- Full reference with prices and buy links: https://207studio.dev/llms-full.txt
- Contact: support@207studio.dev
`;

function wantsMarkdown(req) {
  const a = (req.headers.get("Accept") || "").toLowerCase();
  return a.includes("text/markdown") || a.includes("text/x-markdown");
}

function md(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Vary": "Accept",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function htmlToMarkdown(html) {
  let s = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, "");
  const t = (s.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  s = s.replace(/<head[\s\S]*?<\/head>/i, "");
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, x) => `\n\n${"#".repeat(+n)} ${x}\n\n`);
  s = s.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, x) => `[${x}](${h})`);
  s = s.replace(/<li[^>]*>/gi, "\n- ").replace(/<(p|div|section|article|tr|br)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  s = s.split("\n").map((l) => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return (t && !s.startsWith("# ") ? `# ${t.trim()}\n\n` : "") + s + "\n";
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const ORIGIN = url.origin;
    const originUrl = req.url;
    if (!wantsMarkdown(req) || req.method !== "GET") {
      const r = await fetch(originUrl, { method: req.method, headers: req.headers, redirect: "manual" });
      const out = new Response(r.body, r);
      out.headers.append("Vary", "Accept");
      return out;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const r = await fetch(ORIGIN + "/llms.txt");
      if (r.ok) return md(await r.text());
    }
    const r = await fetch(originUrl, { redirect: "follow" });
    if (r.status === 404) return md(NOT_FOUND_MD, 404);
    const type = r.headers.get("Content-Type") || "";
    if (!type.includes("text/html")) {
      const out = new Response(r.body, r);
      out.headers.append("Vary", "Accept");
      return out;
    }
    return md(htmlToMarkdown(await r.text()), r.status);
  },
};
