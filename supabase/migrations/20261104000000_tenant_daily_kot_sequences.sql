-- Migration: Tenant-Aware Atomic Daily Sequence Counter Table & Routine
-- Eliminates race hazard of SELECT count(*) on high-concurrency order punches

CREATE TABLE IF NOT EXISTS public.kitchen_daily_sequences (
    kitchen_id UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
    sequence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_value INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kitchen_id, sequence_date)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_daily_sequences_date 
ON public.kitchen_daily_sequences(sequence_date);

-- Atomic sequence routine with row-level locks
CREATE OR REPLACE FUNCTION public.get_next_daily_kot_number(
    p_kitchen_id UUID,
    p_prefix TEXT DEFAULT 'ORD'
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_val INT;
BEGIN
    INSERT INTO public.kitchen_daily_sequences (kitchen_id, sequence_date, current_value, updated_at)
    VALUES (p_kitchen_id, CURRENT_DATE, 1, NOW())
    ON CONFLICT (kitchen_id, sequence_date)
    DO UPDATE SET 
        current_value = kitchen_daily_sequences.current_value + 1,
        updated_at = NOW()
    RETURNING current_value INTO v_next_val;

    RETURN p_prefix || '-' || LPAD(v_next_val::TEXT, 3, '0');
END;
$$;

