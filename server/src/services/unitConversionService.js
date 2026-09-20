import db from "../db/database.js";

/*
 * Supported standard conversions.
 *
 * factorToBase means:
 *
 * VOLUME base = ML
 * WEIGHT base = G
 * COUNT base = PCS
 *
 * Examples:
 * 1 L  = 1000 ML
 * 1 KG = 1000 G
 */
const UNIT_DEFINITIONS = {
  ML: {
    family: "VOLUME",
    factorToBase: 1,
  },

  L: {
    family: "VOLUME",
    factorToBase: 1000,
  },

  G: {
    family: "WEIGHT",
    factorToBase: 1,
  },

  KG: {
    family: "WEIGHT",
    factorToBase: 1000,
  },

  PCS: {
    family: "COUNT",
    factorToBase: 1,
  },
};

function normalizeUnitCode(code) {
  return String(
    code || ""
  )
    .trim()
    .toUpperCase();
}

export function getUnitById(
  unitId
) {
  const unit =
    db.prepare(`
      SELECT
        id,
        code,
        name
      FROM units
      WHERE id = ?
    `).get(
      Number(unitId)
    );

  if (!unit) {
    throw new Error(
      `Unit not found: ${unitId}`
    );
  }

  return unit;
}

export function getItemBaseUnit(
  itemId
) {
  const result =
    db.prepare(`
      SELECT
        i.id AS item_id,
        i.code AS item_code,
        i.name AS item_name,

        u.id AS unit_id,
        u.code AS unit_code,
        u.name AS unit_name

      FROM items i

      INNER JOIN units u
        ON u.id =
           i.base_unit_id

      WHERE i.id = ?
    `).get(
      Number(itemId)
    );

  if (!result) {
    throw new Error(
      `Item not found: ${itemId}`
    );
  }

  return {
    itemId:
      result.item_id,

    itemCode:
      result.item_code,

    itemName:
      result.item_name,

    unitId:
      result.unit_id,

    unitCode:
      result.unit_code,

    unitName:
      result.unit_name,
  };
}

export function canConvertUnits(
  fromUnitCode,
  toUnitCode
) {
  const fromCode =
    normalizeUnitCode(
      fromUnitCode
    );

  const toCode =
    normalizeUnitCode(
      toUnitCode
    );

  if (
    fromCode === toCode
  ) {
    return true;
  }

  const fromDefinition =
    UNIT_DEFINITIONS[
      fromCode
    ];

  const toDefinition =
    UNIT_DEFINITIONS[
      toCode
    ];

  if (
    !fromDefinition ||
    !toDefinition
  ) {
    return false;
  }

  return (
    fromDefinition.family ===
    toDefinition.family
  );
}

export function convertQuantity(
  quantity,
  fromUnitCode,
  toUnitCode
) {
  const qty =
    Number(quantity);

  if (
    !Number.isFinite(qty)
  ) {
    throw new Error(
      "Invalid quantity for unit conversion."
    );
  }

  const fromCode =
    normalizeUnitCode(
      fromUnitCode
    );

  const toCode =
    normalizeUnitCode(
      toUnitCode
    );

  /*
   * Same unit requires no
   * conversion.
   */
  if (
    fromCode === toCode
  ) {
    return qty;
  }

  const fromDefinition =
    UNIT_DEFINITIONS[
      fromCode
    ];

  const toDefinition =
    UNIT_DEFINITIONS[
      toCode
    ];

  if (!fromDefinition) {
    throw new Error(
      `Unit conversion is not configured for ${fromCode}.`
    );
  }

  if (!toDefinition) {
    throw new Error(
      `Unit conversion is not configured for ${toCode}.`
    );
  }

  if (
    fromDefinition.family !==
    toDefinition.family
  ) {
    throw new Error(
      `Cannot convert ${fromCode} to ${toCode}. Weight and volume conversion requires density.`
    );
  }

  /*
   * First convert to canonical family unit:
   *
   * L  -> ML
   * KG -> G
   */
  const quantityInFamilyBase =
    qty *
    fromDefinition.factorToBase;

  /*
   * Then convert from canonical
   * family unit to destination.
   */
  return (
    quantityInFamilyBase /
    toDefinition.factorToBase
  );
}

export function convertQuantityByUnitIds(
  quantity,
  fromUnitId,
  toUnitId
) {
  const fromUnit =
    getUnitById(
      fromUnitId
    );

  const toUnit =
    getUnitById(
      toUnitId
    );

  return convertQuantity(
    quantity,
    fromUnit.code,
    toUnit.code
  );
}

export function convertToItemBaseUnit(
  itemId,
  quantity,
  fromUnitId
) {
  const itemBaseUnit =
    getItemBaseUnit(
      itemId
    );

  const quantityInBaseUnit =
    convertQuantityByUnitIds(
      quantity,
      fromUnitId,
      itemBaseUnit.unitId
    );

  return {
    quantity:
      quantityInBaseUnit,

    unitId:
      itemBaseUnit.unitId,

    unitCode:
      itemBaseUnit.unitCode,
  };
}

export function convertFromItemBaseUnit(
  itemId,
  quantity,
  toUnitId
) {
  const itemBaseUnit =
    getItemBaseUnit(
      itemId
    );

  return convertQuantityByUnitIds(
    quantity,
    itemBaseUnit.unitId,
    toUnitId
  );
}