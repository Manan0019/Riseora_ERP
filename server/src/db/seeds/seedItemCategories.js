import db from "../database.js";

export function seedItemCategories() {
  const categories = [
    { code: "RAW", name: "Raw Material", inventoryRole: "RAW" },
    { code: "PACK", name: "Packaging Material", inventoryRole: "PACK" },
    { code: "FG", name: "Finished Good", inventoryRole: "FG" },
    { code: "CONS", name: "Consumable", inventoryRole: "CONS" },
  ];

  const insert = db.prepare(`
    INSERT INTO item_categories (
      code,
      name,
      inventory_role
    )
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      inventory_role = excluded.inventory_role,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const category of categories) {
      insert.run(
        category.code,
        category.name,
        category.inventoryRole,
      );
    }
  });

  transaction();

  console.log("Default item categories seeded");
}
