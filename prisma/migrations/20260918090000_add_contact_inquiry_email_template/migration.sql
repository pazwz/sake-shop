-- Contact inquiries use the existing durable EmailOutbox and require a
-- distinct template so they cannot be mistaken for transactional mail.
ALTER TYPE "EmailTemplate" ADD VALUE IF NOT EXISTS 'CONTACT_INQUIRY';
