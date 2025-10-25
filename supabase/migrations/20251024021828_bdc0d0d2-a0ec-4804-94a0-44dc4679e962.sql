-- إضافة معلومات الشركة لجدول الفروع
ALTER TABLE branches 
ADD COLUMN company_name TEXT,
ADD COLUMN tax_number TEXT,
ADD COLUMN commercial_registration TEXT;

-- إضافة نوع الإيجار (يومي/شهري) لجدول الإيجارات
CREATE TYPE rental_type AS ENUM ('daily', 'monthly');
ALTER TABLE rentals ADD COLUMN rental_type rental_type DEFAULT 'daily';

-- إنشاء جدول لتتبع المعدات في كل إيجار
CREATE TABLE rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  start_date DATE NOT NULL,
  return_date DATE,
  days_count INTEGER,
  amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تفعيل RLS على جدول rental_items
ALTER TABLE rental_items ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لجدول rental_items
CREATE POLICY "Admins can view all rental items"
ON rental_items FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Branch users can view own branch rental items"
ON rental_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentals r
    WHERE r.id = rental_items.rental_id
    AND r.branch_id = get_user_branch(auth.uid())
  )
);

CREATE POLICY "Admins can insert rental items"
ON rental_items FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Branch users can insert own branch rental items"
ON rental_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentals r
    WHERE r.id = rental_items.rental_id
    AND r.branch_id = get_user_branch(auth.uid())
  )
);

CREATE POLICY "Admins can update rental items"
ON rental_items FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Branch users can update own branch rental items"
ON rental_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentals r
    WHERE r.id = rental_items.rental_id
    AND r.branch_id = get_user_branch(auth.uid())
  )
);

-- إضافة trigger للتحديث التلقائي لـ updated_at
CREATE TRIGGER update_rental_items_updated_at
BEFORE UPDATE ON rental_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();