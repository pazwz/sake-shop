import { AdminRole, ContactInquiryMessageDirection, OrderStatus, PaymentStatus, PrismaClient, ShipmentStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { CUSTOMER_PASSWORD_HASH_ROUNDS } from '@/config/customer-auth';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { assertQaSeedAllowed } from '@/config/qa-seed';

const prisma = new PrismaClient();
const now = () => performance.now();
const phase = async <T>(name: string, action: () => Promise<T>) => { const started = now(); const result = await action(); process.stdout.write(`E2E fixture ${name} prepared in ${(now() - started).toFixed(0)}ms\n`); return result; };

const run = async () => {
  assertQaSeedAllowed();
  const started = now();
  const category = await phase('phase 1', () => prisma.category.upsert({ where: { slug: 'e2e-whisky' }, update: { name: 'E2E ウイスキー', displayOrder: 999, isActive: true }, create: { slug: 'e2e-whisky', name: 'E2E ウイスキー', displayOrder: 999, isActive: true } }));
  const product = await prisma.product.upsert({ where: { smaregiProductId: 'e2e-smaregi-product-001' }, update: { categoryId: category.id, productCode: 'E2E-PRODUCT-001', name: 'E2E テスト商品', slug: 'e2e-test-product', price: 1000, taxRate: 10, isActive: true, isEcAvailable: true, isManuallyHidden: false }, create: { smaregiProductId: 'e2e-smaregi-product-001', categoryId: category.id, productCode: 'E2E-PRODUCT-001', name: 'E2E テスト商品', slug: 'e2e-test-product', price: 1000, taxRate: 10, isActive: true, isEcAvailable: true } });
  await prisma.$transaction([prisma.productImage.deleteMany({ where: { productId: product.id } }), prisma.productImage.create({ data: { productId: product.id, imageUrl: 'https://example.test/e2e-product.jpg', imageType: 'e2e-fixture', displayOrder: 0, altText: product.name } })]);
  const [customerPasswordHash, secondaryPasswordHash, staffPasswordHash] = await Promise.all([hash(E2E_FIXTURES.customer.password, CUSTOMER_PASSWORD_HASH_ROUNDS), hash(E2E_FIXTURES.secondaryCustomer.password, CUSTOMER_PASSWORD_HASH_ROUNDS), hash(E2E_FIXTURES.staff.password, CUSTOMER_PASSWORD_HASH_ROUNDS)]);
  const accounts = await phase('phase 2', () => prisma.$transaction([
    prisma.customer.upsert({ where: { email: E2E_FIXTURES.customer.email }, update: { name: 'E2E Customer', passwordHash: customerPasswordHash, emailVerifiedAt: new Date() }, create: { email: E2E_FIXTURES.customer.email, name: 'E2E Customer', passwordHash: customerPasswordHash, emailVerifiedAt: new Date() } }),
    prisma.customer.upsert({ where: { email: E2E_FIXTURES.secondaryCustomer.email }, update: { name: 'E2E Secondary Customer', passwordHash: secondaryPasswordHash, emailVerifiedAt: new Date() }, create: { email: E2E_FIXTURES.secondaryCustomer.email, name: 'E2E Secondary Customer', passwordHash: secondaryPasswordHash, emailVerifiedAt: new Date() } }),
    prisma.adminUser.upsert({ where: { username: E2E_FIXTURES.staff.username }, update: { email: 'e2e-staff@example.test', name: 'E2E Staff', role: AdminRole.STAFF, isActive: true, passwordHash: staffPasswordHash }, create: { username: E2E_FIXTURES.staff.username, email: 'e2e-staff@example.test', name: 'E2E Staff', role: AdminRole.STAFF, isActive: true, passwordHash: staffPasswordHash } }),
  ]));
  const [customer, secondaryCustomer] = accounts;
  const subtotal = Number(product.price); const shippingFee = 880;
  const order = await phase('phase 3', () => prisma.order.upsert({ where: { orderNumber: E2E_FIXTURES.orderNumber }, update: { customerId: customer.id, status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING, shipmentStatus: ShipmentStatus.PENDING }, create: { orderNumber: E2E_FIXTURES.orderNumber, customerId: customer.id, status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING, shipmentStatus: ShipmentStatus.PENDING, subtotal, shippingFee, taxAmount: (subtotal * Number(product.taxRate)) / (100 + Number(product.taxRate)), discountAmount: 0, totalAmount: subtotal + shippingFee, paymentMethod: 'E2E_TEST', shippingAddressSnapshot: { prefecture: '福岡県', city: '福岡市', addressLine1: 'E2E test address' }, shippingQuoteSnapshot: { policyVersion: 'e2e', totalShipping: shippingFee, method: 'E2E_TEST' }, ageConfirmedAt: new Date(), items: { create: { productId: product.id, productName: product.name, productCode: product.productCode, unitPrice: product.price, quantity: 1, taxRate: product.taxRate, subtotal, requiresTransfer: false } } } }));
  const inquiry = await prisma.contactInquiry.upsert({ where: { orderId: order.id }, update: { customerId: customer.id, orderNumber: order.orderNumber, customerLastReadAt: null }, create: { submissionId: 'e2e-order-support-submission', publicId: 'E2E-ORDER-SUPPORT', topic: 'ORDER_SUPPORT', name: customer.name, email: customer.email, customerId: customer.id, orderId: order.id, orderNumber: order.orderNumber, message: 'E2E fixture initial message.' } });
  await phase('phase 4', () => prisma.$transaction([
    prisma.contactInquiryMessage.deleteMany({ where: { inquiryId: inquiry.id, subject: 'E2E fixture admin reply' } }),
    prisma.contactInquiryMessage.create({ data: { inquiryId: inquiry.id, direction: ContactInquiryMessageDirection.ADMIN, fromEmail: 'support@example.test', toEmail: customer.email, subject: 'E2E fixture admin reply', body: 'E2E fixture admin reply.' } }),
    prisma.siteAnnouncement.upsert({ where: { id: 'e2e-published-announcement' }, update: { title: 'E2E お知らせ', body: 'E2E announcement body.', isPublished: true, publishedAt: new Date('2026-01-01T00:00:00.000Z'), expiresAt: null }, create: { id: 'e2e-published-announcement', title: 'E2E お知らせ', body: 'E2E announcement body.', isPublished: true, publishedAt: new Date('2026-01-01T00:00:00.000Z') } }),
    prisma.customerAnnouncementRead.deleteMany({ where: { customerId: { in: [customer.id, secondaryCustomer.id] }, announcementId: 'e2e-published-announcement' } }),
  ]));
  process.stdout.write(`E2E fixtures prepared in ${((now() - started) / 1000).toFixed(2)}s\n`);
};
run().finally(() => prisma.$disconnect());
