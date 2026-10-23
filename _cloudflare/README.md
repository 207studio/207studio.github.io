# Cloudflare in front of 207studio.dev (plan)

Goal: fix the two is-agentic essentials GitHub Pages cannot do: `Accept: text/markdown` answers in Markdown with `Vary: Accept`, and a Markdown 404 body.

State on 2026-10-23 12:40 KST: registrar Spaceship, nameservers `launch1/launch2.spaceship.net`, DNSSEC ON (DS keyTag 27026), A = GitHub Pages 185.199.108-111.153, MX iCloud, TXT: SPF iCloud, apple-domain, anthropic-domain-verification. No Cloudflare account in Kiwi.

## Steps (유일 님 = needs login/signup; agent can do the rest once logged in)
1. 유일 님: create/log in to a Cloudflare account (Free plan, no card needed) and add site `207studio.dev`. Cloudflare imports DNS; check A×4, MX×2, TXT×3 are all there (MX/TXT "DNS only").
2. 유일 님: in Spaceship, turn DNSSEC off (remove DS record) FIRST. Wait for the DS to disappear (up to 24 h). Changing nameservers with the old DS still published breaks the domain and mail.
3. 유일 님: in Spaceship, change nameservers to the two Cloudflare gives.
4. When the zone is Active: SSL/TLS mode Full; GitHub Pages "Enforce HTTPS" stays on.
5. Deploy this worker: `npx wrangler login` (유일 님 browser) then `cd _cloudflare && npx wrangler deploy`. Route `207studio.dev/*`.
6. Optional: re-enable DNSSEC in Cloudflare and add its DS record at Spaceship.
7. Check: `curl -sI -H 'Accept: text/markdown' https://207studio.dev/` → `content-type: text/markdown`, `vary: Accept`; `curl -s -H 'Accept: text/markdown' https://207studio.dev/nope` → 404 Markdown. Then is-agentic Rescan.

Rollback: delete the worker route, or switch nameservers back to `launch1/launch2.spaceship.net` (DNS records stay at Spaceship).
