**Done**
- Email/password auth, protected routes, session persistence
- Sticky nav with sync status indicator (grey → amber → red) + review badge
- Dashboard: KPIs, daily avg, safe-to-spend, category chart, weekly history, budget bars, insights, top merchants
- Every card has ⓘ tooltip
- Transactions: full list, search, filter by category/direction, running net
- Review queue: categorize + optional merchant promotion (saves UPI handle to DB)
- Budget Control Centre: total corpus, per-account cards (Kotak + HDFC), MTD combined, safe-to-spend + projection, full budget vs actual
- Settings: edit budget limits inline, saves instantly
- Pipeline (CLI): PDF → Gemini → validate → categorize → Supabase, balance reconciliation, dedup, internal transfer detection, ~87% auto-categorization

**Future scope**
- Analytics page (trends logic already written, no page yet)
- HDFC pipeline — untested, needs one dry run
- Splits tracker (tables exist in DB, no UI)
- Upload history page
- Month picker — all analytics currently locked to current month
- Merchant management page — view/edit/delete merchants
- Mobile layout optimisation
- Multi-account net worth over time chart