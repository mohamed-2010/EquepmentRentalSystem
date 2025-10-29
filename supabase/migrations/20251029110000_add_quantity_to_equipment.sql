-- Add quantity field to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add index on quantity for faster queries
CREATE INDEX IF NOT EXISTS idx_equipment_quantity ON equipment(quantity);
