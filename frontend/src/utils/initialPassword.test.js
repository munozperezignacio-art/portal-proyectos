import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateInitialPassword, escapeCredentialText} from './initialPassword.js';

test('automatic passwords have 20 characters, all four classes and are distinct', () => {
  const passwords = Array.from({length: 100}, () => generateInitialPassword());
  assert.equal(new Set(passwords).size, 100);
  for (const password of passwords) {
    assert.equal(password.length, 20);
    for (const pattern of [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%*_-]/]) assert.match(password, pattern);
    assert.match(password, /^[A-Za-z0-9!@#$%*_-]+$/);
  }
});

test('credential email text cannot inject HTML', () => {
  assert.equal(escapeCredentialText('<img src="x"> & \'test\''), '&lt;img src=&quot;x&quot;&gt; &amp; &#39;test&#39;');
});
