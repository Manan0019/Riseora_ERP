import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function addColumn(tableName, definition) {
  const columnName = definition.trim().split(/\s+/)[0];

  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

export function runProfessionalInvoicingMigration() {
  addColumn("items", "hsn_code TEXT");
  addColumn("items", "default_gst_rate REAL NOT NULL DEFAULT 0");

  addColumn("companies", "bank_name TEXT");
  addColumn("companies", "bank_account_name TEXT");
  addColumn("companies", "bank_account_no TEXT");
  addColumn("companies", "bank_ifsc TEXT");
  addColumn("companies", "upi_id TEXT");
  addColumn("companies", "invoice_terms TEXT");

  addColumn("sales_invoices", "place_of_supply TEXT");
  addColumn("sales_invoices", "tax_type TEXT NOT NULL DEFAULT 'INTRA_STATE'");

  addColumn("sales_invoices", "seller_name TEXT");
  addColumn("sales_invoices", "seller_legal_name TEXT");
  addColumn("sales_invoices", "seller_gstin TEXT");
  addColumn("sales_invoices", "seller_address TEXT");
  addColumn("sales_invoices", "seller_city TEXT");
  addColumn("sales_invoices", "seller_state TEXT");
  addColumn("sales_invoices", "seller_pincode TEXT");
  addColumn("sales_invoices", "seller_phone TEXT");
  addColumn("sales_invoices", "seller_email TEXT");
  addColumn("sales_invoices", "seller_bank_name TEXT");
  addColumn("sales_invoices", "seller_bank_account_name TEXT");
  addColumn("sales_invoices", "seller_bank_account_no TEXT");
  addColumn("sales_invoices", "seller_bank_ifsc TEXT");
  addColumn("sales_invoices", "seller_upi_id TEXT");
  addColumn("sales_invoices", "invoice_terms_snapshot TEXT");

  addColumn("sales_invoices", "buyer_code TEXT");
  addColumn("sales_invoices", "buyer_name TEXT");
  addColumn("sales_invoices", "buyer_phone TEXT");
  addColumn("sales_invoices", "buyer_email TEXT");
  addColumn("sales_invoices", "buyer_gstin TEXT");
  addColumn("sales_invoices", "buyer_address TEXT");
  addColumn("sales_invoices", "buyer_city TEXT");
  addColumn("sales_invoices", "buyer_state TEXT");
  addColumn("sales_invoices", "buyer_pincode TEXT");

  addColumn("sales_items", "item_code_snapshot TEXT");
  addColumn("sales_items", "item_name_snapshot TEXT");
  addColumn("sales_items", "unit_code_snapshot TEXT");
  addColumn("sales_items", "hsn_code_snapshot TEXT");

  /*
   * Backfill snapshots for invoices that existed before this migration.
   * New invoices always write these values at posting time.
   */
  db.exec(`
    UPDATE sales_invoices
    SET
      place_of_supply = COALESCE(
        place_of_supply,
        (SELECT state FROM customers WHERE customers.id = sales_invoices.customer_id)
      ),
      seller_name = COALESCE(seller_name, (SELECT name FROM companies ORDER BY id LIMIT 1)),
      seller_legal_name = COALESCE(seller_legal_name, (SELECT legal_name FROM companies ORDER BY id LIMIT 1)),
      seller_gstin = COALESCE(seller_gstin, (SELECT gstin FROM companies ORDER BY id LIMIT 1)),
      seller_address = COALESCE(seller_address, (SELECT address FROM companies ORDER BY id LIMIT 1)),
      seller_city = COALESCE(seller_city, (SELECT city FROM companies ORDER BY id LIMIT 1)),
      seller_state = COALESCE(seller_state, (SELECT state FROM companies ORDER BY id LIMIT 1)),
      seller_pincode = COALESCE(seller_pincode, (SELECT pincode FROM companies ORDER BY id LIMIT 1)),
      seller_phone = COALESCE(seller_phone, (SELECT phone FROM companies ORDER BY id LIMIT 1)),
      seller_email = COALESCE(seller_email, (SELECT email FROM companies ORDER BY id LIMIT 1)),
      seller_bank_name = COALESCE(seller_bank_name, (SELECT bank_name FROM companies ORDER BY id LIMIT 1)),
      seller_bank_account_name = COALESCE(seller_bank_account_name, (SELECT bank_account_name FROM companies ORDER BY id LIMIT 1)),
      seller_bank_account_no = COALESCE(seller_bank_account_no, (SELECT bank_account_no FROM companies ORDER BY id LIMIT 1)),
      seller_bank_ifsc = COALESCE(seller_bank_ifsc, (SELECT bank_ifsc FROM companies ORDER BY id LIMIT 1)),
      seller_upi_id = COALESCE(seller_upi_id, (SELECT upi_id FROM companies ORDER BY id LIMIT 1)),
      invoice_terms_snapshot = COALESCE(invoice_terms_snapshot, (SELECT invoice_terms FROM companies ORDER BY id LIMIT 1)),
      buyer_code = COALESCE(buyer_code, (SELECT code FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_name = COALESCE(buyer_name, (SELECT name FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_phone = COALESCE(buyer_phone, (SELECT phone FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_email = COALESCE(buyer_email, (SELECT email FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_gstin = COALESCE(buyer_gstin, (SELECT gstin FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_address = COALESCE(buyer_address, (SELECT address FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_city = COALESCE(buyer_city, (SELECT city FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_state = COALESCE(buyer_state, (SELECT state FROM customers WHERE customers.id = sales_invoices.customer_id)),
      buyer_pincode = COALESCE(buyer_pincode, (SELECT pincode FROM customers WHERE customers.id = sales_invoices.customer_id));

    UPDATE sales_invoices
    SET tax_type = CASE
      WHEN TRIM(COALESCE(seller_state, '')) <> ''
        AND TRIM(COALESCE(buyer_state, '')) <> ''
        AND LOWER(TRIM(seller_state)) <> LOWER(TRIM(buyer_state))
      THEN 'INTER_STATE'
      ELSE 'INTRA_STATE'
    END;

    UPDATE sales_items
    SET
      item_code_snapshot = COALESCE(item_code_snapshot, (SELECT code FROM items WHERE items.id = sales_items.item_id)),
      item_name_snapshot = COALESCE(item_name_snapshot, (SELECT name FROM items WHERE items.id = sales_items.item_id)),
      hsn_code_snapshot = COALESCE(hsn_code_snapshot, (SELECT hsn_code FROM items WHERE items.id = sales_items.item_id)),
      unit_code_snapshot = COALESCE(
        unit_code_snapshot,
        (
          SELECT units.code
          FROM items
          INNER JOIN units ON units.id = items.base_unit_id
          WHERE items.id = sales_items.item_id
        )
      );
  `);

  console.log("Professional invoicing migration completed");
}
