use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;

use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
struct SiteData {
    base_url: String,
    last_updated: String,
    support_email: String,
    listing: Listing,
    organization: Organization,
    products: Vec<Product>,
}

#[derive(Deserialize)]
struct Organization {
    name: String,
    url: String,
    email: String,
    country: String,
    #[serde(rename = "sameAs")]
    same_as: Vec<String>,
}

#[derive(Deserialize)]
struct Listing {
    title: String,
    description: String,
    h1: String,
    intro: String,
}

#[derive(Deserialize)]
struct Product {
    slug: String,
    name: String,
    audience: String,
    title: String,
    description: String,
    summary: String,
    what: String,
    quickstart: Vec<String>,
    compare: Vec<[String; 3]>,
    faq: Vec<[String; 2]>,
    tiers: Vec<Tier>,
    image_webp_640: String,
    image_webp_1200: String,
    image_jpg: String,
    category: String,
    related: Vec<String>,
    tier_note: Option<String>,
    upsell: Option<Upsell>,
    includes: Option<Includes>,
    badge: Option<String>,
}

#[derive(Deserialize)]
struct Upsell {
    text: String,
    link: String,
    link_text: String,
}

#[derive(Deserialize)]
struct Includes {
    text: String,
    links: Vec<[String; 2]>,
}

#[derive(Deserialize)]
struct Tier {
    name: String,
    price_usd: i64,
    url: String,
    lemonsqueezy_url: Option<String>,
    booth_url: Option<String>,
    paddle_price_id: Option<String>,
}

const FAVICON: &str = "<link rel=\"icon\" type=\"image/svg+xml\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%23102b32'/%3E%3Cpath d='M10 12h20v4L20 29h-6l10-13H10z' fill='%23d5f66b'/%3E%3C/svg%3E\">";

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        die("usage: products-gen <site-data.json> <site-root>");
    }
    let data_path = &args[1];
    let site_root = PathBuf::from(&args[2]);

    let raw = match fs::read_to_string(data_path) {
        Ok(raw) => raw,
        Err(err) => die(&format!("cannot read data file {data_path}: {err}")),
    };
    let data: SiteData = match serde_json::from_str(&raw) {
        Ok(data) => data,
        Err(err) => die(&format!("invalid site data in {data_path}: {err}")),
    };

    if let Err(err) = generate(&data, &site_root) {
        die(&err);
    }
}

fn die(message: &str) -> ! {
    eprintln!("error: {message}");
    process::exit(1);
}

fn generate(data: &SiteData, root: &Path) -> Result<(), String> {
    write_file(root, "products/index.html", &render_listing(data)?)?;
    for product in &data.products {
        let path = format!("products/{}/index.html", product.slug);
        write_file(root, &path, &render_product(data, product)?)?;
    }
    write_file(root, "products/products.css", CSS)?;
    write_file(root, "sitemap.xml", &render_sitemap(data))?;
    write_file(root, "robots.txt", &render_robots(data))?;
    write_file(root, "llms.txt", &render_llms(data))?;
    Ok(())
}

fn write_file(root: &Path, relative: &str, content: &str) -> Result<(), String> {
    let path = root.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("cannot create {}: {err}", parent.display()))?;
    }
    fs::write(&path, content).map_err(|err| format!("cannot write {}: {err}", path.display()))
}

fn esc(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

fn absolute(base_url: &str, path: &str) -> String {
    format!("{base_url}{path}")
}

fn canonical_products(base_url: &str) -> String {
    format!("{base_url}/products/")
}

fn canonical_product(base_url: &str, slug: &str) -> String {
    format!("{base_url}/products/{slug}/")
}

fn head(
    data: &SiteData,
    title: &str,
    description: &str,
    canonical: &str,
    image_jpg: &str,
) -> String {
    let image = esc(&absolute(&data.base_url, image_jpg));
    let canonical = esc(canonical);
    let title = esc(title);
    let description = esc(description);
    format!(
        "<!doctype html>\n\
<html lang=\"en\">\n\
<head>\n\
<meta charset=\"utf-8\">\n\
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
<meta name=\"theme-color\" content=\"#102b32\">\n\
{FAVICON}\n\
<link rel=\"stylesheet\" href=\"/products/products.css\">\n\
<title>{title}</title>\n\
<meta name=\"description\" content=\"{description}\">\n\
<link rel=\"canonical\" href=\"{canonical}\">\n\
<meta property=\"og:title\" content=\"{title}\">\n\
<meta property=\"og:description\" content=\"{description}\">\n\
<meta property=\"og:type\" content=\"website\">\n\
<meta property=\"og:url\" content=\"{canonical}\">\n\
<meta property=\"og:image\" content=\"{image}\">\n\
<meta property=\"og:site_name\" content=\"207 Studio\">\n\
<meta name=\"twitter:card\" content=\"summary_large_image\">\n\
</head>\n"
    )
}

fn header(products_current: bool) -> String {
    let current = if products_current {
        " aria-current=\"page\""
    } else {
        ""
    };
    format!(
        "<header class=\"site-header wrap\"><a class=\"brand\" href=\"/\"><span class=\"brand-mark\">207</span><span>STUDIO</span></a><nav aria-label=\"Main navigation\"><a href=\"/\">Home</a><a href=\"/products/\"{current}>Products</a><a href=\"/blog/\">Writing</a></nav></header>\n"
    )
}

fn footer(data: &SiteData) -> String {
    let email = esc(&data.support_email);
    let updated = esc(&data.last_updated);
    format!(
        "<footer class=\"site-footer wrap\"><p>207 Studio (207studio.dev), South Korea. Support: <a href=\"mailto:{email}\">{email}</a></p><p>Last updated {updated}. © 2026 207 Studio</p></footer>\n"
    )
}

fn script(value: &Value) -> String {
    let json = serde_json::to_string(value).expect("serialize JSON-LD");
    format!("<script type=\"application/ld+json\">{}</script>\n", json.replace("</", "<\\/"))
}

fn price(price_usd: i64) -> String {
    format!("{price_usd}.00")
}

fn sku(slug: &str, tier: &Tier) -> String {
    format!("{slug}-{}", tier.name.to_lowercase().replace([' ', '/'], "-"))
}

fn offers(data: &SiteData, product: &Product) -> Vec<Value> {
    product
        .tiers
        .iter()
        .map(|tier| {
            json!({
                "@type": "Offer",
                "name": tier.name,
                "sku": sku(&product.slug, tier),
                "price": price(tier.price_usd),
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": tier.url,
                "seller": {
                    "@type": "Organization",
                    "name": data.organization.name,
                    "url": data.organization.url,
                },
            })
        })
        .collect()
}

fn brand() -> Value {
    json!({ "@type": "Brand", "name": "207 Studio" })
}

fn checkout_url(tier: &Tier, slug: &str, place: &str) -> String {
    format!(
        "{}?utm_source=207studio.dev&utm_medium=site&utm_campaign={slug}&utm_content={place}",
        tier.url
    )
}

fn buy_row(product: &Product, place: &str) -> String {
    let mut out = String::from("<div class=\"buy-row\">");
    for (index, tier) in product.tiers.iter().enumerate() {
        let class = if index == 0 { "buy primary" } else { "buy" };
        out.push_str(&format!(
            "<a class=\"{class}\" href=\"{}\">{} · ${}</a>",
            esc(&checkout_url(tier, &product.slug, place)),
            esc(&tier.name),
            tier.price_usd
        ));
    }
    out.push_str("</div>");
    out.push_str(&store_links(&product.tiers));
    out
}

fn store_links(tiers: &[Tier]) -> String {
    let links: Vec<String> = tiers
        .iter()
        .flat_map(|tier| {
            [
                (tier.lemonsqueezy_url.as_ref(), "Lemon Squeezy"),
                (tier.booth_url.as_ref(), "BOOTH"),
            ]
        })
        .filter_map(|(url, label)| url.map(|url| format!("<a href=\"{}\">{label}</a>", esc(url))))
        .collect();
    let paddle: Vec<String> = tiers
        .iter()
        .filter_map(|tier| {
            tier.paddle_price_id.as_ref().map(|id| {
                format!(
                    "<a href=\"/pay/?price={}\">{} ${}</a>",
                    esc(id),
                    esc(&tier.name),
                    tier.price_usd
                )
            })
        })
        .collect();
    let mut out = String::new();
    if !links.is_empty() {
        out.push_str(&format!("<p class=\"also\">Also on {}</p>", links.join(" ")));
    }
    if !paddle.is_empty() {
        out.push_str(&format!(
            "<p class=\"also paddle\">Card or PayPal via Paddle: {}</p>",
            paddle.join(" · ")
        ));
    }
    out
}

fn upsell_box(product: &Product) -> String {
    match &product.upsell {
        Some(upsell) => format!(
            "<aside class=\"upsell\"><p>{}</p><a class=\"buy\" href=\"{}\">{}</a></aside>\n",
            esc(&upsell.text),
            esc(&upsell.link),
            esc(&upsell.link_text)
        ),
        None => String::new(),
    }
}

fn related_section(data: &SiteData, product: &Product) -> Result<String, String> {
    let mut out = String::from(
        "<section class=\"related\"><h2>Related products</h2><div class=\"related-grid\">",
    );
    for slug in &product.related {
        let other = data
            .products
            .iter()
            .find(|p| &p.slug == slug)
            .ok_or_else(|| format!("product {} lists unknown related product {slug}", product.slug))?;
        let lowest = other
            .tiers
            .iter()
            .map(|tier| tier.price_usd)
            .min()
            .ok_or_else(|| format!("product {} has no tiers", other.slug))?;
        out.push_str(&format!(
            "<a class=\"related-card\" href=\"/products/{}/\"><img src=\"{}\" width=\"640\" height=\"360\" alt=\"{name} cover\" loading=\"lazy\" decoding=\"async\"><span class=\"related-name\">{name}</span><span class=\"related-summary\">{}</span><span class=\"related-price\">From ${lowest}</span></a>",
            esc(&other.slug),
            esc(&other.image_webp_640),
            esc(&other.summary),
            name = esc(&other.name),
        ));
    }
    out.push_str("</div></section>\n");
    Ok(out)
}

fn picture(inner_class: Option<&str>, product: &Product, loading: &str) -> String {
    let class = match inner_class {
        Some(class) => format!(" class=\"{class}\""),
        None => String::new(),
    };
    format!(
        "<picture{class}><source type=\"image/webp\" srcset=\"{} 640w, {} 1200w\" sizes=\"(max-width: 760px) 100vw, 50vw\"><img src=\"{}\" width=\"1200\" height=\"675\" alt=\"{} cover\" loading=\"{loading}\" decoding=\"async\"></picture>",
        esc(&product.image_webp_640),
        esc(&product.image_webp_1200),
        esc(&product.image_jpg),
        esc(&product.name),
    )
}

fn render_card(product: &Product, loading: &str) -> String {
    let slug = esc(&product.slug);
    format!(
        "<article class=\"card\" id=\"{slug}\">\n\
<a class=\"card-media\" href=\"/products/{slug}/\">{picture}</a>\n\
{badge}<h3><a href=\"/products/{slug}/\">{name}</a></h3>\n\
<p class=\"summary\">{summary}</p>\n\
{buy}\n\
<p class=\"note\">One-time purchase.</p>\n\
</article>\n",
        picture = picture(None, product, loading),
        name = esc(&product.name),
        summary = esc(&product.summary),
        badge = match &product.badge {
            Some(badge) => format!("<span class=\"badge\">{}</span>", esc(badge)),
            None => String::new(),
        },
        buy = buy_row(product, "card"),
    )
}

fn render_listing(data: &SiteData) -> Result<String, String> {
    let first = data
        .products
        .first()
        .ok_or("site data has no products (og:image for the listing needs one)")?;
    let canonical = canonical_products(&data.base_url);

    let mut out = head(
        data,
        &data.listing.title,
        &data.listing.description,
        &canonical,
        &first.image_jpg,
    );
    out.push_str("<body>\n");
    out.push_str(&header(true));
    out.push_str("<main>\n");
    out.push_str(&format!(
        "<section class=\"hero wrap\"><p class=\"eyebrow\">207 STUDIO / PRODUCTS</p><h1>{}</h1><p class=\"intro\">{}</p></section>\n",
        esc(&data.listing.h1),
        esc(&data.listing.intro)
    ));

    let mut card_index = 0usize;
    for (audience, id, heading) in [
        ("developers", "dev-h", "For developers"),
        ("teachers", "teachers-h", "For teachers"),
    ] {
        out.push_str(&format!(
            "<section aria-labelledby=\"{id}\">\n<div class=\"wrap products-section\">\n<h2 id=\"{id}\">{heading}</h2>\n<div class=\"cards\">\n"
        ));
        for product in data.products.iter().filter(|p| p.audience == audience) {
            let loading = if card_index < 2 { "eager" } else { "lazy" };
            card_index += 1;
            out.push_str(&render_card(product, loading));
        }
        out.push_str("</div>\n</div>\n</section>\n");
    }

    let items: Vec<Value> = data
        .products
        .iter()
        .enumerate()
        .map(|(index, product)| {
            json!({
                "@type": "ListItem",
                "position": index + 1,
                "item": {
                    "@type": "Product",
                    "name": product.name,
                    "description": product.summary,
                    "image": absolute(&data.base_url, &product.image_jpg),
                    "url": canonical_product(&data.base_url, &product.slug),
                    "brand": brand(),
                    "category": product.category,
                    "offers": offers(data, product),
                },
            })
        })
        .collect();
    let org = &data.organization;
    let org_id = format!("{}/#org", org.url);
    out.push_str(&script(&json!({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": org_id,
                "name": org.name,
                "url": org.url,
                "email": org.email,
                "address": { "@type": "PostalAddress", "addressCountry": org.country },
                "sameAs": org.same_as,
            },
            {
                "@type": "WebSite",
                "@id": format!("{}/#website", org.url),
                "name": org.name,
                "url": format!("{}/", org.url),
                "publisher": { "@id": org_id },
            },
            {
                "@type": "ItemList",
                "itemListElement": items,
            },
        ],
    })));

    out.push_str("</main>\n");
    out.push_str(&footer(data));
    out.push_str("</body>\n</html>\n");
    Ok(out)
}

fn render_product(data: &SiteData, product: &Product) -> Result<String, String> {
    let canonical = canonical_product(&data.base_url, &product.slug);

    let mut out = head(
        data,
        &product.title,
        &product.description,
        &canonical,
        &product.image_jpg,
    );
    out.push_str("<body>\n");
    out.push_str(&header(false));
    out.push_str("<main class=\"wrap product-page\">\n");
    out.push_str(&format!(
        "<nav class=\"crumbs\" aria-label=\"Breadcrumb\"><a href=\"/products/\">Products</a> / <span>{}</span></nav>\n",
        esc(&product.name)
    ));
    out.push_str(&format!("<h1>{}</h1>\n", esc(&product.title)));
    out.push_str(&format!(
        "<p class=\"lede\">{}</p>\n",
        esc(&product.summary)
    ));
    if let Some(includes) = &product.includes {
        let links: Vec<String> = includes
            .links
            .iter()
            .map(|[label, href]| format!("<a href=\"{}\">{}</a>", esc(href), esc(label)))
            .collect();
        out.push_str(&format!(
            "<p class=\"includes\">{} {}</p>\n",
            esc(&includes.text),
            links.join(" · ")
        ));
    }
    out.push_str(&format!("{}\n", picture(Some("hero-media"), product, "eager")));
    out.push_str(&format!("{}\n", buy_row(product, "top")));
    out.push_str("<p class=\"note\">One-time purchase.</p>\n");
    if let Some(note) = &product.tier_note {
        if product.tiers.len() == 1 {
            out.push_str(&format!("<p class=\"tier-note-small\">{}</p>\n", esc(note)));
        } else {
            out.push_str(&format!(
                "<aside class=\"tier-note\"><h2>Which one do I need?</h2><p>{}</p></aside>\n",
                esc(note)
            ));
        }
    }
    out.push_str(&upsell_box(product));

    out.push_str(&format!(
        "<section><h2>What it is</h2><p>{}</p></section>\n",
        esc(&product.what)
    ));

    if !product.quickstart.is_empty() {
        out.push_str("<section><h2>Quick start</h2><pre><code>");
        out.push_str(&esc(&product.quickstart.join("\n")));
        out.push_str("</code></pre></section>\n");
    }

    out.push_str("<section><h2>Compared with</h2><div class=\"table-wrap\"><table>\n");
    out.push_str("<thead><tr><th>Tool</th><th>Type</th><th>Notes</th></tr></thead>\n<tbody>\n");
    let last = product.compare.len().saturating_sub(1);
    for (index, row) in product.compare.iter().enumerate() {
        let class = if index == last { " class=\"ours\"" } else { "" };
        out.push_str(&format!(
            "<tr{class}><td>{}</td><td>{}</td><td>{}</td></tr>\n",
            esc(&row[0]),
            esc(&row[1]),
            esc(&row[2])
        ));
    }
    out.push_str("</tbody>\n</table></div></section>\n");

    out.push_str("<section><h2>FAQ</h2>\n");
    for item in &product.faq {
        out.push_str(&format!(
            "<details><summary>{}</summary><p>{}</p></details>\n",
            esc(&item[0]),
            esc(&item[1])
        ));
    }
    out.push_str("</section>\n");

    out.push_str(&related_section(data, product)?);
    out.push_str(&upsell_box(product));
    out.push_str(&format!("{}\n", buy_row(product, "bottom")));
    out.push_str("<p class=\"note\">One-time purchase.</p>\n");
    out.push_str("<p><a href=\"/products/\">← All products</a></p>\n");

    let product_ld = json!({
        "@type": "Product",
        "@id": format!("{canonical}#product"),
        "name": product.name,
        "description": product.description,
        "image": absolute(&data.base_url, &product.image_jpg),
        "url": canonical,
        "brand": brand(),
        "category": product.category,
        "offers": offers(data, product),
    });
    let faq_ld = json!({
        "@type": "FAQPage",
        "mainEntity": product.faq.iter().map(|item| json!({
            "@type": "Question",
            "name": item[0],
            "acceptedAnswer": { "@type": "Answer", "text": item[1] },
        })).collect::<Vec<Value>>(),
    });
    let crumbs_ld = json!({
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Products",
                "item": canonical_products(&data.base_url),
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": product.name,
                "item": canonical,
            },
        ],
    });
    out.push_str(&script(&json!({
        "@context": "https://schema.org",
        "@graph": [product_ld, faq_ld, crumbs_ld],
    })));

    out.push_str("</main>\n");
    out.push_str(&footer(data));
    out.push_str("</body>\n</html>\n");
    Ok(out)
}

fn render_sitemap(data: &SiteData) -> String {
    let mut locations = vec![
        format!("{}/", data.base_url),
        canonical_products(&data.base_url),
        format!("{}/legal/terms/", data.base_url),
        format!("{}/legal/privacy/", data.base_url),
        format!("{}/legal/refunds/", data.base_url),
    ];
    for product in &data.products {
        locations.push(canonical_product(&data.base_url, &product.slug));
    }

    let mut out = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n",
    );
    let lastmod = esc(&data.last_updated);
    for location in locations {
        out.push_str(&format!(
            "<url><loc>{}</loc><lastmod>{lastmod}</lastmod></url>\n",
            esc(&location)
        ));
    }
    out.push_str("</urlset>\n");
    out
}

fn render_llms(data: &SiteData) -> String {
    let mut out = String::from(
        "# 207 Studio\n\n> Developer kits and classroom tools from 207 Studio (207studio.dev), South Korea. One-time purchase, full source.\n\n## Products\n\n",
    );
    for product in &data.products {
        let prices = product
            .tiers
            .iter()
            .map(|tier| format!("{} ${}", tier.name, tier.price_usd))
            .collect::<Vec<_>>()
            .join(" / ");
        out.push_str(&format!(
            "- [{}]({}): {} Prices: {}.\n",
            product.name,
            canonical_product(&data.base_url, &product.slug),
            product.summary,
            prices
        ));
    }
    out
}

fn render_robots(data: &SiteData) -> String {
    format!(
        "User-agent: *\nAllow: /\n\nSitemap: {}/sitemap.xml\n",
        data.base_url
    )
}

const CSS: &str = ":root{--bg:#fafbf8;--ink:#102b32;--muted:#52646a;--line:#d6dedb;--lime:#d5f66b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,Arial,\"Noto Sans KR\",sans-serif;line-height:1.6}
.wrap{width:min(1240px,calc(100% - 48px));margin-inline:auto}
a{color:inherit}
img{max-width:100%}
.site-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0;border-bottom:1px solid var(--line)}
.site-header nav{display:flex;gap:18px}
.site-header nav a{text-decoration:none;font-weight:600}
.brand{display:inline-flex;gap:10px;align-items:center;font-size:14px;letter-spacing:.14em;font-weight:700;text-decoration:none;color:inherit}
.brand-mark{font-size:29px;letter-spacing:-.07em;font-weight:800;line-height:1;border:2px solid;padding:7px 8px 8px 6px;border-radius:5px}
.site-footer{margin-top:64px;padding:24px 0 40px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
.site-footer p{margin:4px 0}
h1{font-size:clamp(36px,5vw,60px);letter-spacing:-.03em;line-height:1.05;margin:0 0 12px}
h2{font-size:26px;margin:0 0 18px}
h3{font-size:22px;font-weight:600;margin:0 0 8px}
.hero{padding:48px 0 0}
.eyebrow{letter-spacing:.16em;font-size:13px;font-weight:600;color:var(--muted);margin:0 0 12px}
.intro{color:var(--muted);font-size:18px;max-width:720px}
.products-section{padding:40px 0 0}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px}
@media (max-width:760px){.cards{grid-template-columns:1fr}}
.card{padding-bottom:8px}
.card-media{display:block}
.card-media img,.hero-media img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}
.hero-media{display:block;margin:20px 0}
.card h3 a{text-decoration:none}
.buy-row{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.buy{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:6px;border:2px solid var(--ink);color:var(--ink);text-decoration:none;font-weight:600}
.buy.primary{background:var(--ink);color:#fff}
:focus-visible{outline:3px solid #426bd3;outline-offset:2px}
.note,.summary,.lede{color:var(--muted)}
.summary{max-width:640px}
.lede{font-size:18px;max-width:720px}
.product-page section{margin:40px 0}
.product-page section p{max-width:720px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
tr.ours{background:#f3fbd9}
tr.ours td:first-child{font-weight:700}
details{border-bottom:1px solid var(--line);padding:14px 0}
summary{font-weight:600;cursor:pointer}
details p{margin:10px 0 0}
pre{background:#102b32;color:#e9f1ee;padding:16px;border-radius:8px;overflow-x:auto}
pre code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px}
.crumbs{font-size:14px;color:var(--muted);margin:24px 0 8px}
.tier-note{border:1px solid var(--line);border-radius:8px;padding:16px 20px;margin:8px 0 24px;background:#fff}.tier-note h2{font-size:18px;margin:0 0 6px}.tier-note p{margin:0;color:var(--muted)}
.tier-note-small{color:var(--muted);font-size:15px;margin:4px 0 20px}
.upsell{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;background:#f3fbd9;border:1px solid #c8e98a;border-radius:8px;padding:16px 20px;margin:16px 0}.upsell p{margin:0;flex:1 1 320px}
.includes{color:var(--muted)}.badge{display:inline-block;background:var(--lime);color:var(--ink);font-weight:700;font-size:13px;padding:3px 10px;border-radius:30px;margin:4px 0 8px}
.related-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}@media (max-width:760px){.related-grid{grid-template-columns:1fr}}.related-card{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit}.related-card img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--line)}.related-name{font-weight:600}.related-summary{color:var(--muted);font-size:15px}.related-price{font-weight:600;font-size:14px}.also{font-size:14px;color:var(--muted)}
";
