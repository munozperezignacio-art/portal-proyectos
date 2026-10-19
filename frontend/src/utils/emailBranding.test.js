import test from 'node:test';
import assert from 'node:assert/strict';
import { emailBranding } from './emailBranding.js';

test('company logo is inline and preserves the S curve attachment', () => {
  const curve = { filename: 'curve.png', content: 'AAAA', content_id: 'curve' };
  const result = emailBranding({ companyName: 'EMINSG', companyBranding: { logo_base64: 'data:image/png;base64,AAAA' }, attachments: [curve] });
  assert.match(result.header, /cid:company-logo/);
  assert.match(result.header, /alt="EMINSG"/);
  assert.deepEqual(result.attachments, [curve, { filename: 'company-logo.png', content: 'AAAA', content_id: 'company-logo' }]);
});

test('remote logo escapes attributes and missing company logo uses company name', () => {
  assert.match(emailBranding({ companyName: 'A&B', companyBranding: { logo_url: 'https://example.com/logo.png?a=1&b=2' } }).header, /a=1&amp;b=2/);
  const result = emailBranding({ companyName: 'A&B', companyBranding: { logo_url: 'javascript:alert(1)' } });
  assert.match(result.header, /A&amp;B/);
  assert.doesNotMatch(result.header, /<img|Obraxis/);
});

test('other existing email flows keep the default branding', () => {
  assert.match(emailBranding().header, /obraxis-primary.png/);
});
