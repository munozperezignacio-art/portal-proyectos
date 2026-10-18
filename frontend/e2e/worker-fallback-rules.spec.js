import {test} from '@playwright/test';
import {checkWorkerFallbackRules,checkWorkerFallbackReadOnly} from './helpers/workerFallbackRules.js';
test('per-worker rules save independently, can be edited and disabled, and display errors',async({page})=>checkWorkerFallbackRules(page));
test('read-only users cannot authorize rules',async({page})=>checkWorkerFallbackReadOnly(page));
