import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { customerNewsletterPreferenceValidator } from '@/validators/customer-account.validator';

test('re-subscribing requires fresh explicit consent, stopping does not', () => {
  assert.equal(
    customerNewsletterPreferenceValidator.safeParse({ subscribed: true })
      .success,
    false,
  );
  assert.equal(
    customerNewsletterPreferenceValidator.safeParse({
      subscribed: true,
      consent: false,
    }).success,
    false,
  );
  assert.equal(
    customerNewsletterPreferenceValidator.safeParse({
      subscribed: true,
      consent: true,
    }).success,
    true,
  );
  assert.equal(
    customerNewsletterPreferenceValidator.safeParse({ subscribed: false })
      .success,
    true,
  );
  assert.equal(
    customerNewsletterPreferenceValidator.safeParse({
      subscribed: true,
      consent: true,
      email: 'other@example.test',
    }).success,
    false,
  );
});

test('anonymous subscription starts without consent and with its submit disabled', async () => {
  const { NewsletterSubscriptionForm } = await import(
    '../../components/newsletter-subscription-form'
  );
  const html = renderToStaticMarkup(createElement(NewsletterSubscriptionForm));
  assert.match(html, /type="email"/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /<button[^>]*disabled=""/);
});

test('unsubscribe renders a confirmation only for a valid active token', async () => {
  const { NewsletterUnsubscribeConfirmation } = await import(
    '../../components/newsletter-unsubscribe-confirmation'
  );
  const render = (
    initialState: 'confirm' | 'already' | 'invalid' | 'unavailable',
  ) =>
    renderToStaticMarkup(
      createElement(NewsletterUnsubscribeConfirmation, {
        initialState,
        token: initialState === 'confirm' ? 'signed-opaque-token' : '',
      }),
    );
  assert.match(render('confirm'), /配信停止する/);
  assert.doesNotMatch(render('confirm'), /signed-opaque-token/);
  assert.match(render('already'), /すでに配信停止手続きが完了しています/);
  assert.match(
    render('invalid'),
    /このリンクは無効、または有効期限が切れています/,
  );
  assert.match(render('unavailable'), /現在、配信設定を確認できません/);
  for (const state of ['already', 'invalid', 'unavailable'] as const)
    assert.doesNotMatch(render(state), /<button/);
});
