-- ========================================
-- إضافة حقول جديدة في جدول العملاء وربط الفروع بحسابات
-- ========================================

-- 1. إضافة حقول مصدر الهوية والعنوان في جدول customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS id_source TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. إضافة حقول في جدول branches لربط الفرع بحساب مستخدم
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS user_password TEXT; -- سيتم تخزين الباسورد مؤقتاً للعرض فقط

-- 3. إنشاء دالة لإنشاء حساب مستخدم جديد لفرع
-- هذه الدالة ستُستخدم عند إنشاء فرع جديد من واجهة التطبيق
CREATE OR REPLACE FUNCTION create_branch_user(
  branch_name TEXT,
  branch_id UUID
) RETURNS JSON AS $$
DECLARE
  new_email TEXT;
  new_password TEXT;
  new_user_id UUID;
BEGIN
  -- توليد بريد إلكتروني فريد بناءً على اسم الفرع
  new_email := LOWER(REPLACE(branch_name, ' ', '_')) || '@branch.local';
  
  -- توليد كلمة مرور عشوائية (8 أحرف)
  new_password := SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8);
  
  -- إنشاء المستخدم في auth.users
  -- ملاحظة: هذا يتطلب صلاحيات service_role
  -- سيتم التنفيذ من الكود بدلاً من هنا
  
  RETURN json_build_object(
    'email', new_email,
    'password', new_password
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. إضافة index على حقول البحث الجديدة
CREATE INDEX IF NOT EXISTS idx_customers_address ON public.customers(address);
CREATE INDEX IF NOT EXISTS idx_customers_id_source ON public.customers(id_source);
CREATE INDEX IF NOT EXISTS idx_branches_user_id ON public.branches(user_id);

COMMENT ON COLUMN public.customers.id_source IS 'مصدر الهوية (بطاقة شخصية، جواز سفر، إلخ)';
COMMENT ON COLUMN public.customers.address IS 'عنوان العميل';
COMMENT ON COLUMN public.branches.user_id IS 'معرف المستخدم المرتبط بهذا الفرع';
COMMENT ON COLUMN public.branches.user_email IS 'البريد الإلكتروني للحساب المرتبط بالفرع';
COMMENT ON COLUMN public.branches.user_password IS 'كلمة المرور (مؤقتة للعرض فقط)';
