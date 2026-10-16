import {test} from '@playwright/test';
import {checkAutomaticUserPassword} from './helpers/automaticUserPassword.js';

test('new users receive the generated password without typing one',async({page})=>checkAutomaticUserPassword(page));
test('failed welcome email can be retried without creating or changing the account',async({page})=>checkAutomaticUserPassword(page,true));
