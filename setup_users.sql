-- إضافة المستخدمين الحاليين إلى user_roles
-- قم بتشغيل هذا SQL في Supabase Dashboard > SQL Editor

-- أولاً: تأكد من وجود فرع واحد على الأقل
-- إذا لم يكن هناك فروع، قم بإنشاء فرع افتراضي
INSERT INTO branches (name, address, phone)
VALUES ('الفرع الرئيسي', 'العنوان', '0500000000')
ON CONFLICT DO NOTHING;

-- ثانياً: احصل على ID الفرع الأول (أو الوحيد)
-- سنستخدمه لتعيين المستخدمين
DO $$
DECLARE
  default_branch_id UUID;
  user_record RECORD;
BEGIN
  -- الحصول على أول فرع
  SELECT id INTO default_branch_id FROM branches LIMIT 1;
  
  IF default_branch_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد فروع في قاعدة البيانات. يرجى إنشاء فرع أولاً.';
  END IF;
  
  -- إضافة جميع المستخدمين الموجودين في profiles إلى user_roles
  FOR user_record IN (SELECT id FROM profiles) LOOP
    -- التحقق من عدم وجود المستخدم في user_roles
    IF NOT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = user_record.id
    ) THEN
      -- إضافة المستخدم كـ admin في الفرع الافتراضي
      INSERT INTO user_roles (user_id, role, branch_id)
      VALUES (user_record.id, 'admin'::app_role, default_branch_id);
      
      RAISE NOTICE 'تم إضافة المستخدم % إلى user_roles', user_record.id;
    END IF;
  END LOOP;
END $$;

-- التحقق من النتائج
SELECT 
  p.full_name,
  ur.role,
  b.name as branch_name
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN branches b ON b.id = ur.branch_id;
