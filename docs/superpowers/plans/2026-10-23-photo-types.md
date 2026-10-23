# Photo types implementation plan

Goal: Add รูปขนาดเต็ม and รูปรหัสครุภัณฑ์ to Appscriptdata and separate upload galleries.
Architecture: Retain legacy links and append new uploads to the selected category. Preserve private Drive permissions, revision checks, and ten photos per category.
Stack: Existing Express, Google Sheets API and browser JavaScript.

- Test category isolation, invalid types, stale revisions and private reads.
- Extend photo service, route and Sheets adapter with category-specific writes.
- Split browser upload controls and retain the legacy gallery.
- Append two live columns and verify existing cells are preserved.
- Run tests, lint and syntax checks.

## Revision: unified three-photo slots

User replaced categories with รูป1, รูป2, รูป3 and a compact combined gallery. Browser selects multiple files and uploads sequentially using the revision returned by each successful write. Server counts unique images across slots and legacy archives, rejects a fourth before uploading, and writes the complete three-slot list atomically. Live migration backed up formulas and retained hidden legacy link/preview columns; all existing images and non-photo data were verified.

## Asset folders

Uploads now resolve an exact asset-number subfolder under GOOGLE_PHOTO_FOLDER_ID, reusing existing folders and sharing concurrent creation requests. Duplicate folder names fail safely. Existing three linked photos migrated into two asset folders with original IDs and sheet links retained; original parents/names saved in credentials/asset-photo-folder-backup.json.
