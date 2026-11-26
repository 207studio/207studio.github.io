# Project homes

The approved 2026-11-17 map keeps one EN/KO home per project. The studio index lists projects and links to those homes. Privacy, support and terms retain their public URLs.

Run `python3 _products/project-pages-gen.py` after editing `_products/apps.json`, `_products/ttoryeot-desktop.json`, or `_products/compare.json`. It writes the new project pages, the Ttoryeot sections and the concise studio index. Historical comparison versions and sample asset paths are retained. `project-redirects.js` handles old studio fragment URLs; ordinary fallback links remain available without JavaScript.

Deployment sources:

- `207studio/207studio.github.io`: studio EN/KO, Ttoryeot, CheckyBoard, Cool Kiwi, Decky Duck, KO Pairy and KO StoneWars, shared assets and discovery files.
- `207studio/pairy`: live EN `/pairy/`, support and privacy. Its generated EN index must match `pairy/index.html` here when those details change. Legal and Japanese support content stay at their existing URLs.
- `207studio/stonewars`: live EN `/stonewars/`, support, privacy and game assets.
- `chalkieboard/chalkieboard.github.io`: existing EN/KO project homes and legal/support pages. Beta routes forward to their home sections.

The old `/pairy/mac/` and `/paddleway-support/` routes already forward to the Pairy home and stay reachable. Removed product/SDK URLs and payment routes keep their previous homepage redirects. A separate Byeolchae domain remains an open decision; this work does not publish a new Byeolchae page or resume paused application work.

Cool Kiwi's preparation copy uses the already documented teacher-tool facts from homepage PR #54 rather than copying the stale messenger description onto a new home. No other held PR is merged by this change.
