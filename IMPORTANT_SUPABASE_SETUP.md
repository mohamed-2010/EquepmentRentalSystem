# 🔴 خطوات مهمة جداً - يجب تطبيقها على Supabase

## المشكلة

بعض الجداول والسياسات غير موجودة أو تحتاج تحديث في قاعدة البيانات على Supabase:

- ❌ `expenses` - جدول المصروفات
- ❌ `maintenance_requests` - جدول الصيانة
- ❌ سياسات RLS تحتاج تحديث لدعم الـ Admin

## الحل ✅

### الخطوة 1: إنشاء الجداول (إذا لم تكن موجودة)

افتح [Supabase Dashboard](https://app.supabase.com)

1. اختر مشروعك
2. اذهب إلى **SQL Editor** من القائمة الجانبية
3. انسخ والصق الكود التالي بالكامل
4. اضغط **Run** أو **Ctrl+Enter**

```sql
-- ========================================
-- تطبيق كل الجداول المفقودة على Supabase
-- ========================================

-- 1. إنشاء جدول maintenance_requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    completed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for maintenance_requests
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Policies for maintenance_requests
CREATE POLICY "Users can view maintenance requests in their branch"
    ON maintenance_requests FOR SELECT
    USING (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert maintenance requests in their branch"
    ON maintenance_requests FOR INSERT
    WITH CHECK (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update maintenance requests in their branch"
    ON maintenance_requests FOR UPDATE
    USING (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete maintenance requests in their branch"
    ON maintenance_requests FOR DELETE
    USING (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Add indexes for maintenance_requests
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_branch ON maintenance_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_customer ON maintenance_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_equipment ON maintenance_requests(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);

-- ========================================
-- 2. إنشاء جدول expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL, -- تشغيلية، رواتب، صيانة، أخرى
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policies for expenses
CREATE POLICY "Users can view expenses in their branch"
    ON expenses FOR SELECT
    USING (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert expenses in their branch"
    ON expenses FOR INSERT
    WITH CHECK (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update expenses in their branch"
    ON expenses FOR UPDATE
    USING (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete expenses in their branch"
    ON expenses FOR DELETE
    USING (
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Add indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
```

---

### الخطوة 2: تحديث سياسات RLS لدعم الـ Admin ⚠️ **مهم جداً**

**إذا واجهت خطأ 403 Forbidden عند إضافة مصروفات أو صيانة:**

```sql
-- ========================================
-- إصلاح سياسات RLS للمصاريف والصيانة لدعم الـ Admin
-- ========================================

-- 1️⃣ حذف السياسات القديمة لـ maintenance_requests
DROP POLICY IF EXISTS "Users can view maintenance requests in their branch" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can insert maintenance requests in their branch" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can update maintenance requests in their branch" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can delete maintenance requests in their branch" ON maintenance_requests;

-- 2️⃣ إنشاء سياسات جديدة تدعم Admin
CREATE POLICY "Users can view maintenance requests"
    ON maintenance_requests FOR SELECT
    USING (
        -- Admin يرى كل شيء
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يرى فرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert maintenance requests"
    ON maintenance_requests FOR INSERT
    WITH CHECK (
        -- Admin يضيف لأي فرع
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يضيف لفرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update maintenance requests"
    ON maintenance_requests FOR UPDATE
    USING (
        -- Admin يعدل كل شيء
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يعدل في فرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete maintenance requests"
    ON maintenance_requests FOR DELETE
    USING (
        -- Admin يحذف كل شيء
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يحذف من فرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- 3️⃣ نفس الشيء لجدول expenses
-- ========================================

-- حذف السياسات القديمة لـ expenses
DROP POLICY IF EXISTS "Users can view expenses in their branch" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses in their branch" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their branch" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses in their branch" ON expenses;

-- إنشاء سياسات جديدة تدعم Admin
CREATE POLICY "Users can view expenses"
    ON expenses FOR SELECT
    USING (
        -- Admin يرى كل شيء
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يرى فرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert expenses"
    ON expenses FOR INSERT
    WITH CHECK (
        -- Admin يضيف لأي فرع
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يضيف لفرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update expenses"
    ON expenses FOR UPDATE
    USING (
        -- Admin يعدل كل شيء
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يعدل في فرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete expenses"
    ON expenses FOR DELETE
    USING (
        -- Admin يحذف كل شيء
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        -- المستخدم العادي يحذف من فرعه فقط
        branch_id IN (
            SELECT branch_id FROM user_roles WHERE user_id = auth.uid()
        )
    );
```

---

## بعد تطبيق الكود أعلاه ✅

قم بتحديث الصفحة في التطبيق، والآن يجب أن تعمل:

- ✅ صفحة المصروفات (Expenses) - الـ Admin والمستخدمين العاديين
- ✅ صفحة الصيانة (Maintenance) - الـ Admin والمستخدمين العاديين
- ✅ لوحة الأرباح (Dashboard)
- ✅ لا أخطاء 403 Forbidden

---

## ملاحظة مهمة 📝

حقل `quantity` تم إضافته بالفعل إلى جدول `rental_items` وسيعمل بشكل صحيح الآن في:

- ✅ العقود (تعرض الكمية الصحيحة)
- ✅ الفواتير (تعرض الكمية وتحسبها في الإجمالي)
- ✅ نموذج الإيجار (يمكن إدخال الكمية عند إضافة معدة)
