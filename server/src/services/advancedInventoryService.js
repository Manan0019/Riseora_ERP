import db from '../db/database.js';
import {createInventoryOperations} from '../utils/advancedInventory.js';
export const inventoryOperations=createInventoryOperations(db);
