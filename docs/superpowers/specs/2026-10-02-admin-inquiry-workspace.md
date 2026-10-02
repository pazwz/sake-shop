# LINXAS Admin workspace and inquiry identity

User approved this design and inline execution on 2026-10-02, including additive migration before deployment. No further design approval gate is required.

## Scope and safety

Separate Admin navigation, inquiry inbox, per-admin unread, and server-derived message authors. Preserve Customer storefront, ownership, Smaregi logic, disabled Checkout, and existing email behavior. Browser notifications and new notification-email configuration are follow-ups, not this release.

## Layout

Root layout supplies HTML and metadata only. A shared StorefrontLayout owns existing customer providers, navigation, footer and effects. Existing public route directories get thin layouts; homepage uses the same wrapper. Admin has independent LINXAS ADMIN navigation, role-aware links, identity/logout, breadcrumbs and dashboard return. Public URLs and page file locations remain unchanged. Admin rendering never loads Customer auth or category navigation.

## Read and identity model

Add nullable ContactInquiryMessage.authorCustomerId, populated only for new Customer messages using authenticated customerId. Existing rows stay NULL. Keep direction and authorAdminId; route-specific authentication remains authoritative. No AdminSession schema rewrite.

Add AdminInquiryMessageRead with compound primary key (adminId, messageId), readAt and foreign keys. Reads acknowledge an explicit bounded set of CUSTOMER message IDs from the rendered thread after client mount; server checks inquiry membership and direction. A read cannot acknowledge a later message or clear another admin's reads. Duplicate acknowledgments are idempotent. Admin replies and notes never contribute to Admin unread. Legacy inquiries lacking message rows remain viewable but have no synthetic unread messages.

Add a direction/inquiryId/createdAt index to messages. No data deletion, historical sender backfill or status-enum changes. Keep NEW, IN_PROGRESS, ANSWERED, CLOSED, with natural Japanese labels. Customer replies reopen ANSWERED/CLOSED through the existing transaction.

## Inbox and summary

Repository SQL computes unread EXISTS, latest message via indexed lateral lookup, priority CASE and LIMIT/OFFSET before hydration. Priority: unread and customer-last; IN_PROGRESS/NEW and customer-last; other active; CLOSED. Tie-break lastMessageAt descending, then id. Filter before pagination. List shows unread, topic, customer, order, preview, last sender/time, status and assignee.

Admin-only GET /api/v1/admin/inquiries/unread-summary returns distinct unread inquiry count and at most five metadata records, no full history or email addresses. Admin-only POST /api/v1/admin/inquiries/{id}/read accepts strict messageIds only. Both use Route -> Service -> Repository. Foreground polling every 30 seconds, paused while hidden; read success dispatches a local refresh event. No WebSocket or provider calls.

## Validation and rollout

Tests cover read isolation, concurrent messages including equal timestamps, wrong-thread/admin-message read rejection, authorship, spoofed sender rejection, dual-session routing, DB sorting/paging, and admin/storefront separation. Isolated E2E exercises real read state and both actors, with console email only.

After QA and review: Production read-only migration status/history/schema/count baseline must show only this migration pending; otherwise stop. Apply additive migration, verify status/schema and unchanged business counts, commit scoped files (excluding pre-existing legal work), push main, wait for exact-SHA Production success, smoke using existing test actors/thread only.
