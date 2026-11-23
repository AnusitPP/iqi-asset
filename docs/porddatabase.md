# PORDDATABASE

Temporary admin page at `/porddatabase`, linked from the overview menu.

- Starts with the 125 recognized PDF asset IDs and joins current Appscriptdata by normalized asset ID; PDF-only assets remain visible. The default filter shows all unsent Appscriptdata and PDF records, with changed statuses first. Separate Appscriptdata/PDF filters and pending counts remain available. Sent records disappear after a confirmed submission and remain accessible through the sent filter. An optional all-records filter includes assets outside the PDF. No records are preselected and the ready-to-borrow catalog is not imported.
- PDF reference is a snapshot of the recognized IDs in the comparison CSV from stash commit `3160cf7`. It supplies group flags and explicit damaged/missing status, not a complete PDF transcription. Absence does not imply good condition. All Appscriptdata columns remain visible in each record's source details.
- Cost (`ราคาทุน`, column F) comes exclusively from the PDF text in that stash, matched by original asset ID. Missing PDF prices remain empty. Cost is read-only in the temporary page and derived again by the server when sending; old browser drafts cannot replace it.
- Admins manually edit catalog fields, select records. Drafts persist in localStorage per account on the same browser; download a JSON backup before clearing browser data. Drafts are not shared between devices.
- Submission creates `PORDDATABASE` on demand and appends only selected records using RAW values. It never changes Appscriptdata or `พร้อมยืม` and does not connect the new sheet to live lending.
- Source fingerprints detect changed source rows. The admin must inspect and acknowledge current source data before sending a stale draft.
- Asset IDs identify previously submitted rows and must match Appscriptdata. Retries skip existing asset IDs; no source ID column is stored. Sent rows display the saved destination values and are read-only.
- Existing process write locks serialize submissions. Like existing catalog writes, separate server processes do not have a distributed lock: avoid simultaneous submission from different deployments.

Validation: backend behavior and route authorization tests, frontend typecheck/lint, and production build. No production sheet write is needed to verify implementation.

Destination columns A–I: เลขครุภัณฑ์, S/N, ชื่ออุปกรณ์, สภาพ, ที่ตั้ง, ราคาทุน, วันที่อัปเดตล่าสุด, รูป (ลิงก์), ชื่อผู้ถือครอง. Legacy eight-column destinations remain readable; the next submission adds only the I1 owner header.

Comparison controls show PDF status/groups/cost separately from current Appscriptdata fields. Choose a side for status, copy available Appscriptdata fields individually, or edit the outgoing draft. PDF has no extracted names, serials or photos; choosing its status preserves other fields. Empty Appscriptdata values never erase populated draft fields. Explicit review and a name are required in the UI before submission; confirmation previews the outgoing values. Existing destination rows remain read-only and are skipped on retry.

Explicit exclusion: STeP61-107-041 remains in the ready-to-borrow catalog and is omitted from PORD records; server-side submission also rejects old drafts for this asset. Other Appscriptdata records remain available, including those outside the PDF. Photo links use one HTTP(S) URL per line in a single destination cell, as in the ready-to-borrow sheet; each line is validated before writing.

The initial view shortlists unsent electronic equipment by source name (computers, displays, cameras, networking, audio, phones, UPS, storage and digital measuring devices). Furniture, general household appliances, stands and software remain available through other filters. This heuristic neither selects nor submits records; users still review them manually.

When a photo folder is configured, PORD reads images recursively from that Drive folder using the existing app credentials. Exact asset-folder or bounded filename matches supply additional photo links; conflicting or unidentified matches are skipped. Drive errors are reported rather than treated as an empty result. Links are merged with existing source photo slots for review; saved destination values and browser drafts are preserved. No source Sheet writes or Drive file/permission changes occur.

The table, editor, search and submission preview include the current asset holder. Existing source holders are the default, including for older browser drafts and clients that omit the field; admins may edit or clear the holder before submission. Holder changes are saved only to the PORD destination, not Appscriptdata.
