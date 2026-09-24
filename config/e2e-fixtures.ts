/**
 * Deliberately non-secret identities for the isolated E2E database only.
 * They are injected by Playwright only after the E2E database guard succeeds.
 */
export const E2E_FIXTURES = {
  customer: {
    email: 'e2e-customer@example.test',
    password: 'E2E-Customer-123!',
  },
  secondaryCustomer: {
    email: 'e2e-customer-secondary@example.test',
    password: 'E2E-Customer-Secondary-123!',
  },
  staff: {
    username: 'e2e-staff',
    password: 'E2E-Staff-123!',
  },
  orderNumber: 'E2E-ORDER-SUPPORT-001',
} as const;

export const e2eFixtureEnvironment = () => ({
  E2E_ENV: 'local',
  E2E_ALLOW_MUTATIONS: 'true',
  E2E_QA_EMAIL: E2E_FIXTURES.customer.email,
  E2E_QA_PASSWORD: E2E_FIXTURES.customer.password,
  E2E_QA_SECONDARY_EMAIL: E2E_FIXTURES.secondaryCustomer.email,
  E2E_QA_SECONDARY_PASSWORD: E2E_FIXTURES.secondaryCustomer.password,
  E2E_QA_ORDER_NUMBER: E2E_FIXTURES.orderNumber,
  E2E_STAFF_USERNAME: E2E_FIXTURES.staff.username,
  E2E_STAFF_PASSWORD: E2E_FIXTURES.staff.password,
});
