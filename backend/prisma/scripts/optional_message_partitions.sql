-- Optional: messages table monthly partitioning by sent_at.
-- Run manually when scaling. Requires PK (id, sent_at); Prisma uses id-only PK, so this is for advanced deployments.
-- Retention worker can drop partitions older than 6 months by dropping child tables.

-- Example: create next month partition (run monthly via cron or retention job):
-- CREATE TABLE messages_2026_04 PARTITION OF messages FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- Drop old partition (e.g. older than 6 months):
-- DROP TABLE IF EXISTS messages_2024_09;
