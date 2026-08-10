# BlackPyre 1.0 Data-Flow Map

Verified against native v102 Phase 2 source. BlackPyre has no account, analytics SDK,
advertising SDK, BlackPyre server, or direct AI-provider connection.

| Source | Destination | Data | Trigger | Storage / retention |
|---|---|---|---|---|
| User entry | WebView local storage | Settings, food/training logs, saved foods, weights, programs | User saves or logs | Device only under BlackPyre storage keys |
| Validated primary storage | Native Vault in iOS Library | Exact validated primary and recovery strings | Healthy boot or verified save | Device only; excluded from automatic iOS/iCloud backup |
| User | Files → On My iPhone → BlackPyre | JSON backup or export | User taps Save backup/export | App-owned file; excluded from automatic iOS/iCloud backup; deleted on uninstall/reset |
| User | Share sheet / chosen destination | Backup, report, plan, or recovery file | User explicitly chooses Save elsewhere/share | Controlled by the chosen destination; BlackPyre does not retain another copy |
| Food search field | Search-a-licious at search.openfoodfacts.org | Search words and normal HTTPS network metadata | User searches for a packaged food while online | Third-party handling under Open Food Facts policy |
| Barcode field/scanner | Open Food Facts product API | Barcode and normal HTTPS network metadata | User looks up an unknown barcode while online | Third-party handling under Open Food Facts policy |
| Camera | In-app html5-qrcode scanner | Camera frames sufficient to recognize a barcode | User opens barcode scanner and grants camera permission | Processed locally; not uploaded or saved by BlackPyre |
| Exercise name | YouTube external website/app | Exercise name in a search URL | User taps Video | External browser/app; YouTube/Google terms apply |
| Static link label | Research, legal, privacy, support, or licensing website | Requested URL and ordinary network metadata | User taps an external link | External website policy applies |
| Rest timer | iOS Local Notifications | Timer completion time and BlackPyre reminder text | User starts a rest timer and grants notification permission | Managed locally by iOS; canceled when timer ends or all data is erased |
| Selected photo/text | iOS share sheet, clipboard, or user-selected AI app | Only content the user explicitly selects | User starts an AI copy/paste handoff | BlackPyre does not contact an AI service; selected photo/raw reply is cleared after the handoff/review |
| Backup file | BlackPyre restore pipeline | User-selected BlackPyre JSON | User chooses Restore and confirms validated summary | Validated before commit; original state preserved until successful replacement |
| Damaged local storage | Local quarantine / Native Vault | Exact original strings and diagnostics | Protected mode recovery | Device only; excluded from automatic backup; never sent automatically |

## Open Food Facts boundaries

- Text search uses only https://search.openfoodfacts.org/search.
- Barcode lookup remains on the stable v2 product endpoint for 1.0.
- The retired cgi/search.pl endpoint is not used.
- Native WebKit appends BlackPyre/1.0 and the support URL to its standard User-Agent.
- Browser JavaScript cannot set a User-Agent header, so the public web build retains the
  browser's standard User-Agent.
- Open Food Facts attribution and ODbL licensing are shown in Settings, the privacy
  policy, and third-party notices.

## Backup boundaries

App-owned native backup and Native Vault files receive the iOS
URLResourceKey.isExcludedFromBackup value. Explicit user sharing remains possible.
Erase All removes BlackPyre local storage, managed native files, pending rest
notifications, and BlackPyre cache storage after two confirmations. Protected mode
blocks the operation.
