// Blog generator for 207studio.dev
// Usage (from the repo root): node _products/blog-gen.mjs
// Reads: _products/site-data.json, _blog/posts.json, _blog/<slug>.md
// Writes: blog/index.html and blog/<slug>/index.html
// Markdown subset: #, ##, ###, paragraphs, - lists, | tables |, ``` code, > quote, --- hr,
// **bold**, `code`, [text](url). No raw HTML passthrough.

import { execFileSync } from 'node:child_process';
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

// opts.jsonLd: optional structured data for the page.
// opts.ko: the Korean twin's URL (adds hreflang). opts.cardImage: og/twitter image for pages without a hero image.
function head(title, description, canonical, ogImage, opts = {}) {
  const image = ogImage
    ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta name="twitter:image" content="${esc(ogImage)}">\n`
    : opts.cardImage ? `<meta property="og:image" content="${esc(opts.cardImage)}">\n` : '';
  const twImage = ogImage || opts.cardImage;
  const alternates = opts.ko
    ? `<link rel="alternate" hreflang="en" href="${esc(canonical)}">\n<link rel="alternate" hreflang="ko" href="${esc(opts.ko)}">\n<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">\n`
    : '';
  const jsonLd = opts.jsonLd ? scriptTag(opts.jsonLd) + '\n' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${alternates}<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(canonical)}">
${image}<meta property="og:site_name" content="207 Studio">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${twImage ? `<meta name="twitter:image" content="${esc(twImage)}">\n` : ''}${jsonLd}<!-- chrome:head:start -->
<!-- chrome:head:end -->
</head>`;
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
      '@type': 'BlogPosting',
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
    ? `<figure class="post-figure"><img src="${esc(post.image)}"${post.image_width ? ` width="${post.image_width}" height="${post.image_height}"` : ''} alt="${esc(post.image_alt || '')}" loading="eager">${post.image_caption ? `<figcaption>${inline(post.image_caption)}</figcaption>` : ''}</figure>`
    : '';

  const jsonLd = { '@context': 'https://schema.org', '@graph': graph };
  const page = `${head(post.meta_title || post.title, post.description, canonical, ogImage, { jsonLd })}
<body>
<!-- chrome:top:start -->
<!-- chrome:top:end -->
<main id="main" class="wrap read">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/blog/">Writing</a> / <span>${esc(post.title)}</span></nav>
<article class="prose">
<h1>${inline(h1)}</h1>
<p class="post-meta">${esc(post.date)} \u00b7 207 Studio</p>
${figure}
${article}
</article>
</main>
<!-- chrome:foot:start -->
<!-- chrome:foot:end -->
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

const listPage = `${head('Writing \u2013 notes on browser rendering and classroom tools | 207 Studio', 'Practical notes from 207 Studio on rendering documents in the browser, offline classroom tools, and the code behind them.', `${BASE}/blog/`, '', { ko: `${BASE}/ko/blog/`, cardImage: posts.find((p) => p.image) ? `${BASE}${posts.find((p) => p.image).image}` : '' })}
<body>
<!-- chrome:top:start -->
<!-- chrome:top:end -->
<main id="main" class="wrap read">
<nav class="crumbs" aria-label="Breadcrumb"><span>Writing</span></nav>
<h1>Writing</h1>
<p class="lede">Notes on rendering documents in the browser, building offline classroom tools, and the parts that are easy to get wrong.</p>
<ul class="post-list">
${listItems}
</ul>
</main>
<!-- chrome:foot:start -->
<!-- chrome:foot:end -->
</body>
</html>
`;
written.push(write('blog/index.html', listPage));

// sitemap.xml, llms.txt and llms-full.txt come from the Rust generator (_products/gen), which reads _blog/posts.json too.

console.log(`posts: ${posts.length}`);
for (const r of rendered) console.log(`  ${r.post.slug}: h1="${r.h1}" faq=${r.faq.length}`);
console.log(`wrote ${written.length} files`);

execFileSync('python3', [path.join(root, '_products/chrome-gen.py')], { stdio: 'inherit' });
