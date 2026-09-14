-- Configurable cap on summary output length.
-- NULL means "use the provider default"; for Claude, which requires the field,
-- the backend substitutes a per-model default instead of the old hardcoded 2048.
ALTER TABLE settings ADD COLUMN summaryMaxTokens INTEGER;
