-- إضافة رقم فاتورة رقمي تلقائي
-- إنشاء sequence لتوليد أرقام تسلسلية
CREATE SEQUENCE IF NOT EXISTS rentals_invoice_number_seq START WITH 1;

-- إضافة عمود invoice_number
ALTER TABLE rentals
ADD COLUMN invoice_number bigint;

-- تعيين القيمة الافتراضية من الـ sequence
ALTER TABLE rentals
ALTER COLUMN invoice_number SET DEFAULT nextval('rentals_invoice_number_seq');

-- تحديث السجلات الموجودة بأرقام تسلسلية
UPDATE rentals
SET invoice_number = nextval('rentals_invoice_number_seq')
WHERE invoice_number IS NULL;

-- جعل الحقل غير قابل للقيمة NULL
ALTER TABLE rentals
ALTER COLUMN invoice_number SET NOT NULL;

-- إضافة index فريد على رقم الفاتورة
CREATE UNIQUE INDEX IF NOT EXISTS rentals_invoice_number_idx ON rentals(invoice_number);

-- إضافة تعليق على العمود
COMMENT ON COLUMN rentals.invoice_number IS 'رقم الفاتورة (رقمي فقط)';
