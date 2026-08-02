# FollowCheck

A privacy-first Instagram follow audit. Visitors upload their official Instagram data export, which is processed entirely in their browser to identify accounts that do not follow them back.

## Run locally

```bash
npm install
npm run dev
```

Requires Node.js 22 or newer. Run `npm test` for the parser and CSV safety tests.

For a deployment at a different path, set `VITE_BASE_PATH` before building. It defaults to `/instagram-follow-audit/` for this GitHub Pages repository.

## Privacy

Uploaded ZIP files never leave the visitor's device. No Instagram password or account connection is required.

## Scope

FollowCheck compares the follower and following usernames contained in an official JSON export. It does not query live follower counts or filter accounts by audience size. Always request an **All time** export; Instagram does not include a reliable field that lets the site verify the selected date range afterward.

Users can exclude celebrities, brands, or any other account from their results. Those preferences are stored only in that browser's local storage and are applied to future uploads and CSV downloads.
