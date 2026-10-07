# Project architecture rules

- Use `PrintReport` and `buildStandalonePrintDocument` as the shared reporting layer so company branding and A4 behavior stay consistent.
- Store report branding in the single-row `report_settings` table and private `report-branding` bucket so updates propagate without code changes.