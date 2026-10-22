Route new heart selections: team IQI with owner IT or blank goes to IQI + IT; other selections go to รอตรวจสอบ. Search, heart removal, IQI updates and inspection locate copies across both tabs and reject cross-tab duplicates. Do not set dates on heart clicks. User additionally requested a one-time migration of matching historical entries including completed records, and a separate IT + IQI search group that identifies the destination.

1. Parameterize ReviewQueue by fixed sheet name, preserving single-tab APIs used by maintenance scripts.
2. Add ReviewQueues coordinator: batch-read both tabs, choose existing location first or route a new selection, and expose links/status for search and UI.
3. Cover routing, moved entries, stale source checks, duplicate prevention, per-tab inspection and removal with tests. Verify real reversible selections and untouched historical/source rows.
4. Show actual destination in heart feedback and add IQI + IT link. Restart, verify mobile/browser and existing 20 moved records without changing their data.
