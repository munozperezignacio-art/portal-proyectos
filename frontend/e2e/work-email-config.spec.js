import {test} from '@playwright/test';
import {checkWorkEmailConfig,checkWorkEmailErrors} from './helpers/workEmailConfig.js';
test('work email types keep independent recipients, preserve global and other work config and honor disable',async({page})=>checkWorkEmailConfig(page));
test('load or save failures never look like a successful configuration change',async({page})=>checkWorkEmailErrors(page));
