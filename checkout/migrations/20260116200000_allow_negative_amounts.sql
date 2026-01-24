-- Allow negative amounts for deductions (game participation, etc.)
-- Positive amounts = top-ups, negative amounts = deductions

ALTER TABLE checkout_transactions DROP CONSTRAINT checkout_transactions_amount_cents_check;
ALTER TABLE checkout_transactions ADD CONSTRAINT checkout_transactions_amount_cents_check CHECK (amount_cents != 0);
