// Blog generator for 207studio.dev
// Usage (from the repo root): node _products/blog-gen.mjs
// Reads: _products/site-data.json, _blog/posts.json, _blog/<slug>.md
// Writes: blog/index.html, blog/<slug>/index.html, blog/blog.css, sitemap.xml, llms.txt
// Markdown subset: #, ##, ###, paragraphs, - lists, | tables |, ``` code, > quote, --- hr,
// **bold**, `code`, [text](url). No raw HTML passthrough.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, '_products/site-data.json'), 'utf8'));
const posts = JSON.parse(fs.readFileSync(path.join(root, '_blog/posts.json'), 'utf8'));
const BASE = data.base_url.replace(/\/$/, '');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function inline(text) {
  const codes = [];
  let t = String(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//.test(href);
    const rel = external ? ' rel="noopener"' : '';
    return `<a href="${href}"${rel}>${label}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return t;
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let para = [];

  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flush();
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const cls = lang ? ` class="language-${esc(lang)}"` : '';
      out.push(`<pre><code${cls}>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flush();
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^\|\s*/.test(line) && lines[i + 1] && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (row) =>
        row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      const thead = head.map((c) => `<th>${inline(c)}</th>`).join('');
      const tbody = rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('\n');
      out.push(`<div class="table-wrap"><table>\n<thead><tr>${thead}</tr></thead>\n<tbody>\n${tbody}\n</tbody>\n</table></div>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ''));
      out.push(`<ol>\n${items.map((it) => `<li>${inline(it)}</li>`).join('\n')}\n</ol>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      out.push(`<ul>\n${items.map((it) => `<li>${inline(it)}</li>`).join('\n')}\n</ul>`);
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

function splitFaq(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((l) => /^##\s+FAQ\s*$/i.test(l));
  if (idx === -1) return { body: md, faq: [] };
  const before = lines.slice(0, idx);
  let rest = lines.slice(idx + 1);
  const end = rest.findIndex((l) => /^---+\s*$/.test(l) || /^##\s+/.test(l));
  if (end !== -1) rest = rest.slice(0, end);

  const faq = [];
  let current = null;
  for (const raw of rest) {
    const line = raw.trim();
    if (!line) continue;
    const q = line.match(/^\*\*(.+\?)\*\*$/);
    if (q) {
      if (current && current.a) faq.push(current);
      current = { q: q[1], a: '' };
    } else if (current) {
      current.a = current.a ? `${current.a} ${line}` : line;
    }
  }
  if (current && current.a) faq.push(current);
  return { body: before.join('\n'), faq };
}

const CSS = `:root{--bg:#fafbf8;--ink:#102b32;--muted:#52646a;--line:#d6dedb;--lime:#d5f66b}
.prose{max-width:760px}
.prose h1{font-size:clamp(1.9rem,4vw,2.7rem);line-height:1.2;margin:.2em 0 .4em}
.prose h2{font-size:clamp(1.3rem,2.4vw,1.6rem);line-height:1.3;margin:2.2em 0 .5em}
.prose h3{font-size:1.1rem;margin:1.6em 0 .4em}
.prose p,.prose li{font-size:1.02rem}
.prose p{margin:.9em 0}
.prose ul,.prose ol{margin:.9em 0 .9em 1.2em;padding:0}
.prose li{margin:.4em 0}
.prose a{text-underline-offset:2px}
.prose code{background:#eef2ec;padding:.12em .3em;border-radius:4px;font-size:.92em}
.prose pre{background:#102b32;color:#f4f7f2;padding:16px 18px;border-radius:10px;overflow:auto;font-size:.9rem;line-height:1.5}
.prose pre code{background:none;color:inherit;padding:0;font-size:inherit}
.prose blockquote{margin:1.2em 0;padding:.2em 0 .2em 1em;border-left:3px solid var(--lime);color:var(--muted)}
.prose hr{border:0;border-top:1px solid var(--line);margin:2.4em 0}
.prose .table-wrap{overflow-x:auto;margin:1.4em 0}
.prose table{border-collapse:collapse;width:100%;font-size:.95rem}
.prose th,.prose td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
.prose th{background:#eef2ec;font-weight:600}
.prose details{border-bottom:1px solid var(--line);padding:10px 0}
.prose details summary{cursor:pointer;font-weight:600}
.prose details p{margin:.5em 0 0;color:var(--muted)}
.post-figure{margin:0 0 2em;padding:0;max-width:760px}
.post-figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:12px}
.post-figure figcaption{margin-top:.6em;color:var(--muted);font-size:.9rem}
.post-meta{margin:0 0 2em;color:var(--muted);font-size:.92rem}
.post-list{list-style:none;padding:0;margin:0;max-width:820px}
.post-list li{border-bottom:1px solid var(--line);padding:18px 0}
.post-list h2{margin:0 0 .3em;font-size:1.25rem}
.post-list h2 a{text-decoration:none}
.post-list p{margin:0 0 .4em;color:var(--muted)}
.post-list time{font-size:.88rem;color:var(--muted)}
`;

function head(title, description, canonical, ogImage, extraCss = '/blog/blog.css') {
  const image = ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta name="twitter:image" content="${esc(ogImage)}">\n` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#102b32">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%23102b32'/%3E%3Cpath d='M10 12h20v4L20 29h-6l10-13H10z' fill='%23d5f66b'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/products/products.css">
<link rel="stylesheet" href="${extraCss}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(canonical)}">
${image}<meta property="og:site_name" content="207 Studio">
<meta name="twitter:card" content="summary_large_image">
</head>`;
}

function header(current) {
  const blog = current === 'blog' ? ' aria-current="page"' : '';
  return `<header class="site-header wrap"><a class="brand" href="/"><span class="brand-mark">207</span><span>STUDIO</span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/products/">Products</a><a href="/blog/"${blog}>Writing</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer wrap"><p>207 Studio (207studio.dev), South Korea. Support: <a href="mailto:${esc(data.support_email)}">${esc(data.support_email)}</a></p><p>Last updated ${esc(data.last_updated)}. \u00a9 2026 207 Studio</p></footer>`;
}

const scriptTag = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return rel;
}

const written = [];
const rendered = [];

for (const post of posts) {
  const mdPath = path.join(root, '_blog', `${post.slug}.md`);
  const md = fs.readFileSync(mdPath, 'utf8');
  const { body, faq } = splitFaq(md);
  const h1Line = body.split('\n').find((l) => /^#\s+/.test(l));
  const h1 = h1Line ? h1Line.replace(/^#\s+/, '').trim() : post.title;
  const bodyNoH1 = body.replace(/^#\s+.*\n/, '');

  const faqHtml = faq.length
    ? `<h2>FAQ</h2>\n${faq.map((f) => `<details><summary>${inline(f.q)}</summary><p>${inline(f.a)}</p></details>`).join('\n')}`
    : '';

  const canonical = `${BASE}/blog/${post.slug}/`;
  const article = mdToHtml(bodyNoH1) + (faqHtml ? `\n${faqHtml}` : '');

  const graph = [
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: h1,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { '@type': 'Organization', name: '207 Studio', url: `${BASE}/` },
      publisher: { '@type': 'Organization', name: '207 Studio', url: `${BASE}/` },
      mainEntityOfPage: canonical,
      keywords: (post.tags || []).join(', '),
      image: post.image ? `${BASE}${post.image}` : undefined,
      inLanguage: 'en',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Writing', item: `${BASE}/blog/` },
        { '@type': 'ListItem', position: 2, name: h1, item: canonical },
      ],
    },
  ];
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  const ogImage = post.image ? `${BASE}${post.image}` : '';
  const figure = post.image
    ? `<figure class="post-figure"><img src="${esc(post.image)}" alt="${esc(post.image_alt || '')}" loading="eager">${post.image_caption ? `<figcaption>${inline(post.image_caption)}</figcaption>` : ''}</figure>`
    : '';

  const page = `${head(post.meta_title || post.title, post.description, canonical, ogImage)}
<body>
${header('blog')}
<main class="wrap product-page blog-post">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/blog/">Writing</a> / <span>${esc(post.title)}</span></nav>
<article class="prose">
<h1>${inline(h1)}</h1>
<p class="post-meta">${esc(post.date)} \u00b7 207 Studio</p>
${figure}
${article}
</article>
</main>
${footer()}
${scriptTag({ '@context': 'https://schema.org', '@graph': graph })}
</body>
</html>
`;
  written.push(write(`blog/${post.slug}/index.html`, page));
  rendered.push({ post, h1, faq });
}

const listItems = posts
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .map(
    (p) => `<li><h2><a href="/blog/${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.description)}</p><time datetime="${esc(p.date)}">${esc(p.date)}</time></li>`
  )
  .join('\n');

const listPage = `${head('Writing \u2013 notes on browser rendering and classroom tools | 207 Studio', 'Practical notes from 207 Studio on rendering documents in the browser, offline classroom tools, and the code behind them.', `${BASE}/blog/`)}
<body>
${header('blog')}
<main class="wrap product-page blog-index">
<nav class="crumbs" aria-label="Breadcrumb"><span>Writing</span></nav>
<h1>Writing</h1>
<p class="lede">Notes on rendering documents in the browser, building offline classroom tools, and the parts that are easy to get wrong.</p>
<ul class="post-list">
${listItems}
</ul>
</main>
${footer()}
</body>
</html>
`;
written.push(write('blog/index.html', listPage));
written.push(write('blog/blog.css', CSS));

// sitemap: home + products + blog, same shape as the Rust generator
const locations = [`${BASE}/`, `${BASE}/products/`];
for (const product of data.products) locations.push(`${BASE}/products/${product.slug}/`);
const sitemap = [`<?xml version="1.0" encoding="UTF-8"?>`, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
for (const location of locations) {
  sitemap.push(`<url><loc>${esc(location)}</loc><lastmod>${esc(data.last_updated)}</lastmod></url>`);
}
sitemap.push(`<url><loc>${esc(`${BASE}/blog/`)}</loc><lastmod>${esc(data.last_updated)}</lastmod></url>`);
for (const post of posts) {
  sitemap.push(`<url><loc>${esc(`${BASE}/blog/${post.slug}/`)}</loc><lastmod>${esc(post.date)}</lastmod></url>`);
}
sitemap.push('</urlset>', '');
written.push(write('sitemap.xml', sitemap.join('\n')));

// llms.txt: products plus a Writing section
const llms = [
  '# 207 Studio',
  '',
  '> Developer kits and classroom tools from 207 Studio (207studio.dev), South Korea. One-time purchase, full source.',
  '',
  '## Products',
  '',
];
for (const product of data.products) {
  llms.push(`- [${product.name}](${BASE}/products/${product.slug}/): ${product.summary}`);
}
llms.push('', '## Writing', '');
for (const post of posts) {
  llms.push(`- [${post.title}](${BASE}/blog/${post.slug}/): ${post.description}`);
}
llms.push('');
written.push(write('llms.txt', llms.join('\n')));

console.log(`posts: ${posts.length}`);
for (const r of rendered) console.log(`  ${r.post.slug}: h1="${r.h1}" faq=${r.faq.length}`);
console.log(`wrote ${written.length} files`);
