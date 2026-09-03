import db from "../database.js";

export function seedItemCategories() {
  const categories = [
    { code: "RAW", name: "Raw Material" },
    { code: "PACK", name: "Packaging Material" },
    { code: "FG", name: "Finished Good" },
    { code: "CONS", name: "Consumable" },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO item_categories (
      code,
      name
    )
    VALUES (?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const category of categories) {
      insert.run(
        category.code,
        category.name
      );
    }
  });

  transaction();

  console.log("Default item categories seeded");
}