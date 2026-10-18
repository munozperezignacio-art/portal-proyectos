import {test} from '@playwright/test';
import {checkEquipmentInventory,checkInventoryReadOnly,checkInventoryPages} from './helpers/equipmentInventory.js';
test('real machinery inventory filters, edits category, and safely manages categories',async({page})=>checkEquipmentInventory(page));
test('inventory permissions hide writes for read-only users',async({page})=>checkInventoryReadOnly(page));
test('pagination resets when changing filters',async({page})=>checkInventoryPages(page));
