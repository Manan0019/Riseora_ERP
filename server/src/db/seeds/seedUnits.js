import db from "../database.js";

export function seedUnits() {
  const units = [
    { code: "ML", name: "Millilitre", unitType: "VOLUME" },
    { code: "L", name: "Litre", unitType: "VOLUME" },
    { code: "G", name: "Gram", unitType: "WEIGHT" },
    { code: "KG", name: "Kilogram", unitType: "WEIGHT" },
    { code: "PCS", name: "Pieces", unitType: "COUNT" },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO units (
      code,
      name,
      unit_type
    )
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const unit of units) {
      insert.run(
        unit.code,
        unit.name,
        unit.unitType
      );
    }
  });

  transaction();

  console.log("Default units seeded");
}