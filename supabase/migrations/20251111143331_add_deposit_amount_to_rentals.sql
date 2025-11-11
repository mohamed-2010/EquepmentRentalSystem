-- إضافة عمود deposit_amount إلى جدول rentals
ALTER TABLE rentals
ADD COLUMN deposit_amount numeric DEFAULT 0;

-- إضافة تعليق على العمود
COMMENT ON COLUMN rentals.deposit_amount IS 'مبلغ التأمين المدفوع عند إنشاء الإيجار';
