-- Sequential ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 201;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- Function to assign next ticket number (called from server action)
CREATE OR REPLACE FUNCTION next_ticket_number()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT nextval('ticket_number_seq')::INTEGER;
$$;
