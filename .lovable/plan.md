## Goal
Opening a note should never make the browser start downloading the file on its own. Viewing stays inline; downloading only happens when the user clicks a button.

## What's happening
On the note detail page the document panel embeds the signed file URL in an `<iframe>` for PDFs and text-like files. When the stored file's content type isn't something the browser can render inline (e.g. `application/octet-stream`, Word/Office types, or a mismatched type set at upload), the iframe navigation turns into a file download instead of a preview — so simply opening the note triggers a download.

## Changes

1. **Note detail viewer** (`src/routes/_authenticated/notes/$noteId.tsx`)
   - Only embed in an iframe when the type is genuinely browser-renderable inline (PDF and plain text/markdown/csv/json).
   - For text-like files, fetch the content and render it as text in a scrollable panel instead of pointing an iframe at the URL.
   - Everything else (Office docs, zips, unknown types) shows a "Preview not available" card — no iframe, so nothing auto-downloads.
   - The top-right "Open" link opens in a new tab for previewable types, and is labelled "Download" only where a download is the actual action.

2. **Signed URL handling** (`src/lib/notes.functions.ts`)
   - Request the signed URL without any download disposition, so the file is served inline for preview.
   - Provide a separate explicit download URL (download disposition) used only by the download button.

## Result
Navigating to a note renders a preview or a neutral placeholder; a file only lands on disk when the user clicks Download.