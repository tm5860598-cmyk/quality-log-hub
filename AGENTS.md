# Project architecture rules

- Use `PrintReport` and `buildStandalonePrintDocument` as the shared reporting layer so company branding and A4 behavior stay consistent.
- Store report branding in the single-row `report_settings` table and private `report-branding` bucket so updates propagate without code changes.
- Share recipes through persistent random QR capability tokens and a safe-column read-only database function, never public product-list policies; this exposes only the selected recipe without login or write access.- Keep the files-to-audio/video converter (`/convert`, `src/lib/media-convert.ts`, pure parsers in `src/lib/convert-text.ts`) fully browser-local (pdf.js, fflate, tesseract.js, Piper wasm, MediaRecorder) and never route it through the AI gateway, so it uses no AI credits.
