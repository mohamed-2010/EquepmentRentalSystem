-- Create expenses table
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

-- Enable RLS
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

-- Add indexes
CREATE INDEX idx_expenses_branch ON expenses(branch_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
