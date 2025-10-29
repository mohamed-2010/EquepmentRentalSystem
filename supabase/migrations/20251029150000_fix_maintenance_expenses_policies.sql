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
