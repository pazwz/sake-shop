import assert from 'node:assert/strict';
import test from 'node:test';
import { SmaregiContractService } from '@/services/smaregi/smaregi-contract.service';
import type { SmaregiContractNotification } from '@/types/smaregi';
import { smaregiContractRequestValidator } from '@/validators/smaregi.validator';

const notification: SmaregiContractNotification = {
  event: 'AppSubscription',
  action: 'start',
  date: '2026-08-26',
  contractId: 'contract-test',
  clientId: 'client-test',
  plan: {
    trial_days: 15,
    price: 3000,
    unit_price: 1000,
    quantity: 3,
    name: 'Standard',
  },
  options: [],
};

test('accepts a valid Smaregi contract notification', () => {
  const result = smaregiContractRequestValidator.parse({
    headers: {
      contentType: 'application/json; charset=utf-8',
      contractId: notification.contractId,
      event: notification.event,
    },
    body: notification,
  });

  assert.deepEqual(result.body, notification);
});

test('rejects a contract ID that differs from the request header', () => {
  const result = smaregiContractRequestValidator.safeParse({
    headers: {
      contentType: 'application/json',
      contractId: 'different-contract',
      event: notification.event,
    },
    body: notification,
  });

  assert.equal(result.success, false);
});

test('records only the validated notification through the service', async () => {
  const received: SmaregiContractNotification[] = [];
  const repository = {
    async recordContractNotification(
      value: Pick<
        SmaregiContractNotification,
        'contractId' | 'event' | 'action' | 'date'
      >,
    ) {
      received.push({ ...notification, ...value });
      return null;
    },
  };
  const service = new SmaregiContractService(repository);

  await service.receive(notification);

  assert.deepEqual(received, [notification]);
});
