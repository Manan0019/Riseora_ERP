import db from "../database.js";
import { installRecordHistory } from "../../utils/recordHistorySchema.js";
export function runRecordHistoryMigration() { installRecordHistory(db); }
