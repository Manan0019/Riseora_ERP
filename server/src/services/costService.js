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

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Incoming stock quantity must be greater than zero.");
  }

 if (!Number.isFinite(cost) || cost < 0) {
   throw new Error("Unit cost cannot be negative.");
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

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Outgoing stock quantity must be greater than zero.");
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

export function previewItemCostRebuild(
  itemId
) {
  const id =
    Number(itemId);

  const item =
    db.prepare(`
      SELECT
        id,
        code,
        name
      FROM items
      WHERE id = ?
    `).get(id);

  if (!item) {
    throw new Error(
      "Item not found."
    );
  }

  const currentState =
    ensureCostState(id);

  const transactions =
    db.prepare(`
      SELECT
        id,
        transaction_date,
        transaction_type,
        reference_no,
        quantity_in,
        quantity_out,
        unit_cost

      FROM stock_transactions

      WHERE item_id = ?

      ORDER BY
        transaction_date,
        id
    `).all(id);

  let quantity = 0;
  let inventoryValue = 0;

  const warnings = [];

  for (
    const transaction of
      transactions
  ) {
    const quantityIn =
      Number(
        transaction.quantity_in ||
          0
      );

    const quantityOut =
      Number(
        transaction.quantity_out ||
          0
      );

    const unitCost =
      Number(
        transaction.unit_cost ||
          0
      );

    if (
      !Number.isFinite(
        quantityIn
      ) ||
      !Number.isFinite(
        quantityOut
      ) ||
      !Number.isFinite(
        unitCost
      )
    ) {
      throw new Error(
        `Invalid stock transaction ${transaction.id}.`
      );
    }

    if (
      quantityIn < 0 ||
      quantityOut < 0
    ) {
      throw new Error(
        `Negative stock movement found in transaction ${transaction.id}.`
      );
    }

    if (
      quantityIn > 0
    ) {
      if (
        unitCost <= 0
      ) {
        warnings.push(
          `${
            transaction.transaction_type
          } ${
            transaction.reference_no ||
            `#${transaction.id}`
          } on ${
            transaction.transaction_date
          } has zero unit cost.`
        );
      }

      quantity +=
        quantityIn;

      inventoryValue +=
        quantityIn *
        unitCost;
    }

    if (
      quantityOut > 0
    ) {
      if (
        quantityOut >
        quantity +
          0.0000001
      ) {
        throw new Error(
          `Stock ledger goes negative at transaction ${transaction.id}. Costing cannot be rebuilt automatically.`
        );
      }

      const averageCost =
        quantity > 0
          ? inventoryValue /
            quantity
          : 0;

      inventoryValue -=
        quantityOut *
        averageCost;

      quantity -=
        quantityOut;

      if (
        Math.abs(quantity) <
        0.0000001
      ) {
        quantity = 0;
        inventoryValue = 0;
      }
    }
  }

  const rebuiltAverageCost =
    quantity > 0
      ? inventoryValue /
        quantity
      : 0;

  const ledgerQuantity =
    db.prepare(`
      SELECT
        COALESCE(
          SUM(
            quantity_in -
            quantity_out
          ),
          0
        ) AS quantity

      FROM stock_transactions
      WHERE item_id = ?
    `).get(id);

  const physicalQuantity =
    Number(
      ledgerQuantity?.quantity ||
        0
    );

  return {
    item,

    current: {
      quantity:
        Number(
          currentState.quantity ||
            0
        ),

      inventoryValue:
        Number(
          currentState.inventory_value ||
            0
        ),

      averageCost:
        Number(
          currentState.average_cost ||
            0
        ),
    },

    rebuilt: {
      quantity,
      inventoryValue,
      averageCost:
        rebuiltAverageCost,
    },

    physicalQuantity,

    transactionCount:
      transactions.length,

    warnings,

    canApply:
      warnings.length === 0 &&
      Math.abs(
        physicalQuantity -
          quantity
      ) <
        0.000001,
  };
}

export function rebuildItemCostState(
  itemId
) {
  const transaction =
    db.transaction(() => {
      const preview =
        previewItemCostRebuild(
          itemId
        );

      if (
        !preview.canApply
      ) {
        throw new Error(
          "Costing cannot be rebuilt automatically. Review the costing preview and transaction warnings first."
        );
      }

      db.prepare(`
        INSERT INTO inventory_cost_state (
          item_id,
          quantity,
          inventory_value,
          average_cost
        )
        VALUES (?, ?, ?, ?)

        ON CONFLICT(item_id)
        DO UPDATE SET
          quantity =
            excluded.quantity,

          inventory_value =
            excluded.inventory_value,

          average_cost =
            excluded.average_cost,

          updated_at =
            CURRENT_TIMESTAMP
      `).run(
        Number(itemId),

        preview.rebuilt
          .quantity,

        preview.rebuilt
          .inventoryValue,

        preview.rebuilt
          .averageCost
      );

      return preview;
    });

  return transaction();
}