import {test} from '@playwright/test';
import {checkWorkerFallbackRules,checkWorkerFallbackReadOnly,checkWorkerFallbackLoadError} from './helpers/workerFallbackRules.js';
test('search, no-rule filters, bulk selection and overtime authorization preserve existing rules',async({page})=>checkWorkerFallbackRules(page));
test('read-only users cannot authorize rules',async({page})=>checkWorkerFallbackReadOnly(page));
test('loading failure cannot be mistaken for missing rules',async({page})=>checkWorkerFallbackLoadError(page));
