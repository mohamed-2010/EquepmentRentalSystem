-- إضافة خيار الإيجار بمدة محددة
ALTER TABLE rentals 
ADD COLUMN IF NOT EXISTS is_fixed_duration BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expected_end_date DATE;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN rentals.is_fixed_duration IS 'هل الإيجار بمدة محددة (نعم) أم مفتوح (لا)';
COMMENT ON COLUMN rentals.expected_end_date IS 'تاريخ الإرجاع المتوقع للإيجار بمدة محددة';
