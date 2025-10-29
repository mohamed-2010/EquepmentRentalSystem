-- إضافة حقل الكمية إلى جدول rental_items
ALTER TABLE rental_items 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- تحديث السجلات الموجودة لتحتوي على قيمة افتراضية
UPDATE rental_items SET quantity = 1 WHERE quantity IS NULL;
