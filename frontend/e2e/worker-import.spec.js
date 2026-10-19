import {test} from '@playwright/test';
import {checkWorkerImport} from './helpers/workerImport.js';
test('imports only new workers, preserves contracts and handles races and retries',async({page})=>checkWorkerImport(page));
