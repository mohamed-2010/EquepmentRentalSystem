-- Create maintenance_requests table
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

-- Enable RLS
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

-- Add indexes
CREATE INDEX idx_maintenance_requests_branch ON maintenance_requests(branch_id);
CREATE INDEX idx_maintenance_requests_customer ON maintenance_requests(customer_id);
CREATE INDEX idx_maintenance_requests_equipment ON maintenance_requests(equipment_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
