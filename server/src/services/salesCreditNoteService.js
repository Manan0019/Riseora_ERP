import db from "../db/database.js";

import {
  addStockTransaction,
} from "./stockService.js";

import {
  addInventoryValue,
} from "./costService.js";

import {
  refreshInvoicePaymentStatus,
} from "./salesService.js";

function generateCreditNoteNumber() {
  const year =
    new Date().getFullYear();

  const lastEntry =
    db.prepare(`
      SELECT id
      FROM sales_credit_notes
      ORDER BY id DESC
      LIMIT 1
    `).get();

  const nextNumber =
    Number(
      lastEntry?.id || 0
    ) + 1;

  return `CN-${year}-${String(
    nextNumber
  ).padStart(5, "0")}`;
}

export function getReturnableSale(
  invoiceId
) {
  const id =
    Number(invoiceId);

  const invoice =
    db.prepare(`
      SELECT
        si.*,

        c.code AS customer_code,
        c.name AS customer_name

      FROM sales_invoices si

      INNER JOIN customers c
        ON c.id = si.customer_id

      WHERE si.id = ?
    `).get(id);

  if (!invoice) {
    throw new Error(
      "Sales invoice not found."
    );
  }

  if (
    invoice.status ===
    "CANCELLED"
  ) {
    throw new Error(
      "Cancelled sales invoices cannot be returned."
    );
  }

  const items =
    db.prepare(`
      SELECT
        si.id AS sales_item_id,
        si.item_id,
        si.quantity,
        si.rate,
        si.discount_amount,
        si.taxable_amount,
        si.gst_rate,
        si.gst_amount,
        si.line_total,
        si.lot_no,

        COALESCE(si.item_code_snapshot, i.code) AS item_code,
        COALESCE(si.item_name_snapshot, i.name) AS item_name,

        COALESCE(si.unit_code_snapshot, u.code) AS unit_code,

        COALESCE(
          (
            SELECT
              SUM(
                scni.quantity
              )

            FROM sales_credit_note_items scni

            INNER JOIN sales_credit_notes scn
              ON scn.id =
                 scni.sales_credit_note_id

            WHERE
              scni.sales_item_id =
                si.id

              AND
              scn.status =
                'POSTED'
          ),
          0
        ) AS returned_quantity

      FROM sales_items si

      INNER JOIN items i
        ON i.id =
           si.item_id

      INNER JOIN units u
        ON u.id =
           i.base_unit_id

      WHERE
        si.sales_invoice_id = ?

      ORDER BY
        si.id
    `).all(id);

  return {
    ...invoice,

    items:
      items.map(
        (item) => ({
          ...item,

          returnable_quantity:
            Math.max(
              0,

              Number(
                item.quantity ||
                  0
              ) -
              Number(
                item.returned_quantity ||
                  0
              )
            ),
        })
      ),
  };
}

export function createSalesCreditNote(
  data
) {
  const transaction =
    db.transaction(() => {
      const invoice =
        getReturnableSale(
          Number(
            data.salesInvoiceId
          )
        );

      if (
        !data.creditNoteDate
      ) {
        throw new Error(
          "Credit note date is required."
        );
      }

      if (
        String(data.creditNoteDate) <
        String(invoice.invoice_date)
      ) {
        throw new Error(
          "Credit note date cannot be earlier than the sales invoice date."
        );
      }

      if (
        !data.reason?.trim()
      ) {
        throw new Error(
          "Return reason is required."
        );
      }

      if (
        !Array.isArray(
          data.items
        ) ||
        data.items.length ===
          0
      ) {
        throw new Error(
          "At least one returned item is required."
        );
      }

      const originalSubtotal =
        Number(
          invoice.subtotal ||
            0
        );

      const originalInvoiceDiscount =
        Number(
          invoice.discount_amount ||
            0
        );

      const requestedIds =
        new Set();

      const calculatedItems =
        [];

      let subtotal = 0;
      let gstAmount = 0;

      for (
        const returnItem of
          data.items
      ) {
        const salesItemId =
          Number(
            returnItem.salesItemId
          );

        const returnQuantity =
          Number(
            returnItem.quantity
          );

        if (
          requestedIds.has(
            salesItemId
          )
        ) {
          throw new Error(
            "The same sales item cannot be returned twice in one credit note."
          );
        }

        requestedIds.add(
          salesItemId
        );

        const originalItem =
          invoice.items.find(
            (item) =>
              Number(
                item.sales_item_id
              ) ===
              salesItemId
          );

        if (
          !originalItem
        ) {
          throw new Error(
            "Returned item does not belong to this sales invoice."
          );
        }

        if (
          !Number.isFinite(
            returnQuantity
          ) ||
          returnQuantity <= 0
        ) {
          throw new Error(
            `${originalItem.item_name}: return quantity must be greater than zero.`
          );
        }

        const returnableQuantity =
          Number(
            originalItem
              .returnable_quantity ||
              0
          );

        if (
          returnQuantity >
          returnableQuantity +
            0.0000001
        ) {
          throw new Error(
            `${originalItem.item_name}: return quantity exceeds remaining returnable quantity (${returnableQuantity.toFixed(
              3
            )}).`
          );
        }

        const originalQuantity =
          Number(
            originalItem.quantity
          );

        const ratio =
          returnQuantity /
          originalQuantity;

        const lineDiscount =
          Number(
            originalItem
              .discount_amount ||
              0
          ) *
          ratio;

        const taxableAmount =
          Number(
            originalItem
              .taxable_amount ||
              0
          ) *
          ratio;

        const lineGst =
          Number(
            originalItem
              .gst_amount ||
              0
          ) *
          ratio;

        const invoiceDiscountShare =
          originalSubtotal > 0
            ? originalInvoiceDiscount *
              (Number(originalItem.taxable_amount || 0) / originalSubtotal) *
              ratio
            : 0;

        const lineTotal =
          Math.max(0, taxableAmount - invoiceDiscountShare) +
          lineGst;

        const saleCost =
          db.prepare(`
            SELECT
              unit_cost

            FROM stock_transactions

            WHERE
              reference_type =
                'SALE'

              AND
              reference_id = ?

              AND
              item_id = ?

              AND
              transaction_type =
                'SALE'

            ORDER BY id

            LIMIT 1
          `).get(
            invoice.id,
            originalItem.item_id
          );

        if (!saleCost) {
          throw new Error(
            `${originalItem.item_name}: original sale costing transaction was not found.`
          );
        }

        const originalUnitCost =
          Number(
            saleCost.unit_cost ||
              0
          );

        subtotal +=
          taxableAmount;

        gstAmount +=
          lineGst;

        calculatedItems.push({
          salesItemId,

          itemId:
            Number(
              originalItem.item_id
            ),

          itemCode:
            originalItem.item_code,

          itemName:
            originalItem.item_name,

          quantity:
            returnQuantity,

          rate:
            Number(
              originalItem.rate ||
                0
            ),

          discountAmount:
            lineDiscount,

          taxableAmount,

          gstRate:
            Number(
              originalItem.gst_rate ||
                0
            ),

          gstAmount:
            lineGst,

          invoiceDiscountShare,

          lineTotal,

          unitCost:
            originalUnitCost,

          lotNo:
            originalItem.lot_no ||
            null,
        });
      }

      /*
       * Existing Sales Invoice currently
       * treats invoice-level discount
       * separately from GST.
       *
       * Allocate the original invoice-level
       * discount proportionally to the
       * returned taxable value.
       */
      const creditDiscount =
        calculatedItems.reduce(
          (total, item) => total + Number(item.invoiceDiscountShare || 0),
          0,
        );

      /*
       * Other charges are intentionally
       * NOT automatically refunded.
       */
      const grandTotal =
        subtotal -
        creditDiscount +
        gstAmount;

      const creditNoteNo =
        generateCreditNoteNumber();

      const headerResult =
        db.prepare(`
          INSERT INTO sales_credit_notes (
            credit_note_no,
            credit_note_date,
            sales_invoice_id,
            customer_id,
            subtotal,
            discount_amount,
            gst_amount,
            grand_total,
            reason,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          creditNoteNo,

          data.creditNoteDate,

          invoice.id,

          invoice.customer_id,

          subtotal,

          creditDiscount,

          gstAmount,

          grandTotal,

          data.reason.trim(),

          data.notes
            ?.trim() ||
            null
        );

      const creditNoteId =
        Number(
          headerResult
            .lastInsertRowid
        );

      const insertItem =
        db.prepare(`
          INSERT INTO sales_credit_note_items (
            sales_credit_note_id,
            sales_item_id,
            item_id,
            quantity,
            rate,
            discount_amount,
            taxable_amount,
            gst_rate,
            gst_amount,
            line_total,
            unit_cost,
            lot_no
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

      for (
        const item of
          calculatedItems
      ) {
        insertItem.run(
          creditNoteId,

          item.salesItemId,

          item.itemId,

          item.quantity,

          item.rate,

          item.discountAmount,

          item.taxableAmount,

          item.gstRate,

          item.gstAmount,

          item.lineTotal,

          item.unitCost,

          item.lotNo
        );

        /*
         * Returned goods go back into
         * inventory at the ORIGINAL
         * sale COGS.
         */
        addInventoryValue(
          item.itemId,
          item.quantity,
          item.unitCost
        );

        addStockTransaction({
          transactionDate:
            data.creditNoteDate,

          itemId:
            item.itemId,

          transactionType:
            "SALE_RETURN",

          referenceType:
            "SALES_CREDIT_NOTE",

          referenceId:
            creditNoteId,

          referenceNo:
            creditNoteNo,

          quantityIn:
            item.quantity,

          quantityOut: 0,

          unitCost:
            item.unitCost,

          lotNo:
            item.lotNo,

          expiryDate:
            null,

          notes:
            `Returned against ${invoice.invoice_no}`,
        });
      }

      const settlement =
        refreshInvoicePaymentStatus(
          invoice.id
        );

      return {
        creditNoteId,
        creditNoteNo,

        salesInvoiceId:
          invoice.id,

        invoiceNo:
          invoice.invoice_no,

        subtotal,

        discountAmount:
          creditDiscount,

        gstAmount,

        grandTotal,

        effectiveInvoiceTotal:
          settlement.effectiveInvoiceTotal,

        amountPaid:
          Number(
            invoice.amount_paid ||
              0
          ),

        refundedAmount:
          settlement.refundedAmount,

        balanceAmount:
          settlement.balanceAmount,

        refundDue:
          settlement.refundDue,

        paymentStatus:
          settlement.paymentStatus,
      };
    });

  return transaction();
}

export function getSalesCreditNotes() {
  return db.prepare(`
    SELECT
      scn.*,

      si.invoice_no,

      c.code AS customer_code,
      c.name AS customer_name

    FROM sales_credit_notes scn

    INNER JOIN sales_invoices si
      ON si.id =
         scn.sales_invoice_id

    INNER JOIN customers c
      ON c.id =
         scn.customer_id

    ORDER BY
      scn.credit_note_date DESC,
      scn.id DESC
  `).all();
}

export function getSalesCreditNoteById(
  id
) {
  const creditNote =
    db.prepare(`
      SELECT
        scn.*,

        si.invoice_no,

        c.code AS customer_code,
        c.name AS customer_name

      FROM sales_credit_notes scn

      INNER JOIN sales_invoices si
        ON si.id =
           scn.sales_invoice_id

      INNER JOIN customers c
        ON c.id =
           scn.customer_id

      WHERE scn.id = ?
    `).get(
      Number(id)
    );

  if (!creditNote) {
    return null;
  }

  const items =
    db.prepare(`
      SELECT
        scni.*,

        i.code AS item_code,
        i.name AS item_name,

        u.code AS unit_code

      FROM sales_credit_note_items scni

      INNER JOIN items i
        ON i.id =
           scni.item_id

      INNER JOIN units u
        ON u.id =
           i.base_unit_id

      WHERE
        scni.sales_credit_note_id = ?

      ORDER BY
        scni.id
    `).all(
      Number(id)
    );

  return {
    ...creditNote,
    items,
  };
}