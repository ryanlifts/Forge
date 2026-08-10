# Open Food Facts Integration Record

- Product: BlackPyre 1.0
- Developer: Ryan Allen Wilsey
- Support URL: https://ryanlifts.github.io/Forge/support.html
- Text search: Search-a-licious only
- Barcode lookup: /api/v2/product/{barcode}.json
- Authentication: none
- Writes/contributions: none
- Native identification appended to standard WebKit User-Agent:
  BlackPyre/1.0 (+https://ryanlifts.github.io/Forge/support.html)
- Web identification: browser-controlled User-Agent; JavaScript is not permitted to set it
- Local caching: only user-confirmed saved foods and barcode corrections
- Database attribution: Open Food Facts, ODbL 1.0

## Rate-limit behavior

Search is initiated by an explicit user action, limited to 15 results, and guarded by an
8-second timeout. Barcode lookup is initiated by an explicit scan/lookup. No background
polling, bulk download, or retry loop exists. On timeout, rate limiting, or service
failure, BlackPyre stops the request path and offers saved/built-in foods or manual label
entry. The retired cgi/search.pl fallback has been removed.

## Registration/contact follow-up

The native User-Agent gives Open Food Facts a stable product and support contact on every
request. Before App Store submission, send this integration record to Open Food Facts if
their current registration process requires a separate notice; no BlackPyre account or
API credential is required by the shipped app.
