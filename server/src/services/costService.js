import db from "../db/database.js";

function ensureCostState(itemId) {
  db.prepare(`
    INSERT OR IGNORE INTO inventory_cost_state (
      item_id,
      quantity,
      inventory_value,
      average_cost
    )
    VALUES (?, 0, 0, 0)
  `).run(itemId);

  return db.prepare(`
    SELECT *
    FROM inventory_cost_state
    WHERE item_id = ?
  `).get(itemId);
}

export function getItemCostState(itemId) {
  return ensureCostState(
    Number(itemId)
  );
}

export function getAverageCost(itemId) {
  const state =
    ensureCostState(
      Number(itemId)
    );

  return Number(
    state.average_cost || 0
  );
}

export function addInventoryValue(
  itemId,
  quantity,
  unitCost
) {
  const id =
    Number(itemId);

  const qty =
    Number(quantity);

  const cost =
    Number(unitCost || 0);

  if (qty <= 0) {
    throw new Error(
      "Incoming stock quantity must be greater than zero."
    );
  }

  if (cost < 0) {
    throw new Error(
      "Unit cost cannot be negative."
    );
  }

  const state =
    ensureCostState(id);

  const oldQuantity =
    Number(
      state.quantity || 0
    );

  const oldValue =
    Number(
      state.inventory_value || 0
    );

  const newQuantity =
    oldQuantity + qty;

  const newValue =
    oldValue +
    qty * cost;

  const newAverage =
    newQuantity > 0
      ? newValue /
        newQuantity
      : 0;

  db.prepare(`
    UPDATE inventory_cost_state
    SET
      quantity = ?,
      inventory_value = ?,
      average_cost = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE item_id = ?
  `).run(
    newQuantity,
    newValue,
    newAverage,
    id
  );

  return {
    quantity:
      newQuantity,

    inventoryValue:
      newValue,

    averageCost:
      newAverage,
  };
}

export function removeInventoryValue(
  itemId,
  quantity
) {
  const id =
    Number(itemId);

  const qty =
    Number(quantity);

  if (qty <= 0) {
    throw new Error(
      "Outgoing stock quantity must be greater than zero."
    );
  }

  const state =
    ensureCostState(id);

  const currentQuantity =
    Number(
      state.quantity || 0
    );

  const currentValue =
    Number(
      state.inventory_value || 0
    );

  const averageCost =
    currentQuantity > 0
      ? currentValue /
        currentQuantity
      : 0;

  if (
    qty >
    currentQuantity
  ) {
    throw new Error(
      "Outgoing stock exceeds costing quantity."
    );
  }

  const valueRemoved =
    qty * averageCost;

  let newQuantity =
    currentQuantity - qty;

  let newValue =
    currentValue -
    valueRemoved;

  if (
    Math.abs(newQuantity) <
    0.0000001
  ) {
    newQuantity = 0;
    newValue = 0;
  }

  const newAverage =
    newQuantity > 0
      ? newValue /
        newQuantity
      : 0;

  db.prepare(`
    UPDATE inventory_cost_state
    SET
      quantity = ?,
      inventory_value = ?,
      average_cost = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE item_id = ?
  `).run(
    newQuantity,
    newValue,
    newAverage,
    id
  );

  return {
    unitCost:
      averageCost,

    valueRemoved,

    quantity:
      newQuantity,

    inventoryValue:
      newValue,

    averageCost:
      newAverage,
  };
}