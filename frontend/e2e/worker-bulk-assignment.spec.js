import {test} from '@playwright/test';
import {checkWorkerBulkAssignment,checkWorkerAssignmentReadOnly} from './helpers/workerBulkAssignment.js';
test('accumulate selections across search and filters and assign together',async({page})=>checkWorkerBulkAssignment(page));
test('read-only users cannot bulk assign',async({page})=>checkWorkerAssignmentReadOnly(page));
