-- Migration: Local-First Event-Sourced Kitchen Pipeline Kernel
-- Adds per-kitchen contiguous sequence counter, idempotency replay table, 
-- append-only order_events log, and the atomic apply_mutation stored procedure.

-- 1. Add sequence counter to kitchens
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS next_seq bigint NOT NULL DEFAULT 1;

-- 2. Idempotent mutation replay table
CREATE TABLE IF NOT EXISTS mutations (
  id uuid PRIMARY KEY,
  kitchen_id text NOT NULL,
  order_id uuid NOT NULL,
  action_type text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mutations_kitchen_order ON mutations (kitchen_id, order_id);

-- 3. Append-only kitchen event log
CREATE TABLE IF NOT EXISTS order_events (
  kitchen_id text NOT NULL,
  seq bigint NOT NULL,
  order_id uuid NOT NULL,
  type text NOT NULL, -- 'CREATED' | 'STATUS_CHANGED' | 'ITEM_UPDATED' | 'CANCELLED'
  payload jsonb NOT NULL,
  mutation_id uuid NOT NULL UNIQUE,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kitchen_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_order_events_cursor ON order_events (kitchen_id, seq ASC);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events (order_id);

-- 4. Enable Supabase Realtime replication on order_events
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE order_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 5. Clean Prototype Test Orders & Reset Sequences
-- Keeps master data (kitchens, brands, menu_items, inventory) intact.
TRUNCATE TABLE order_events, mutations;
DELETE FROM order_items;
DELETE FROM orders;
UPDATE kitchens SET next_seq = 1;

-- 6. Atomic apply_mutation stored procedure
CREATE OR REPLACE FUNCTION apply_mutation(
  p_mutation_id uuid,
  p_kitchen_id text,
  p_order_id uuid,
  p_action_type text,
  p_payload jsonb,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_mutation mutations%ROWTYPE;
  v_seq bigint;
  v_current_order orders%ROWTYPE;
  v_new_status text;
  v_order_number text;
  v_new_version int;
  v_result jsonb;
  v_item_id text;
  v_item_done boolean;
  v_brand_id text;
  v_channel text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_payment_method text;
  v_payment_status text;
  v_items jsonb;
  v_gross_amount float8;
  v_net_margin float8;
BEGIN
  -- 1. Idempotency Check: if mutation_id already processed, return stored result immediately
  SELECT * INTO v_existing_mutation FROM mutations WHERE id = p_mutation_id;
  IF FOUND THEN
    RETURN v_existing_mutation.result;
  END IF;

  -- 2. Lock kitchen row & allocate strictly contiguous, commit-ordered sequence
  UPDATE kitchens 
     SET next_seq = next_seq + 1 
   WHERE id = p_kitchen_id 
  RETURNING next_seq - 1 INTO v_seq;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'Kitchen % not found', p_kitchen_id;
  END IF;

  -- Fetch existing order if any
  SELECT * INTO v_current_order FROM orders WHERE id = p_order_id;

  -- 3. Execute State Machine & Order Mutation
  IF p_action_type = 'CREATED' THEN
    IF v_current_order.id IS NOT NULL THEN
      -- Order already exists, treat as no-op return
      v_result := jsonb_build_object(
        'ok', true,
        'seq', v_seq,
        'orderId', p_order_id,
        'orderNumber', v_current_order.order_number,
        'version', v_current_order.version,
        'action', 'ALREADY_EXISTS'
      );
    ELSE
      -- Resolve daily sequence token
      v_channel := COALESCE(p_payload->>'channel', 'WALK_IN');
      v_brand_id := p_payload->>'brandId';
      v_customer_name := COALESCE(p_payload->>'customerName', 'Counter Guest');
      v_customer_phone := p_payload->>'customerPhone';
      v_customer_address := p_payload->>'customerAddress';
      v_payment_method := COALESCE(p_payload->>'paymentMethod', 'COD');
      v_payment_status := COALESCE(p_payload->>'paymentStatus', 'PAID');
      v_items := COALESCE(p_payload->'items', '[]'::jsonb);
      v_gross_amount := COALESCE((p_payload->>'grossAmount')::float8, 0.0);
      v_net_margin := COALESCE((p_payload->>'netMargin')::float8, v_gross_amount);

      -- Allocate human-readable order number using kitchen sequence
      v_order_number := COALESCE(p_payload->>'orderNumber', 'ORD-' || LPAD(v_seq::text, 3, '0'));

      INSERT INTO orders (
        id,
        kitchen_id,
        brand_id,
        channel,
        order_number,
        customer_name,
        customer_phone,
        customer_address,
        status,
        payment_method,
        payment_status,
        gross_amount,
        net_margin,
        net_margin_percentage,
        checklist,
        version,
        created_at,
        updated_at
      ) VALUES (
        p_order_id,
        p_kitchen_id,
        v_brand_id,
        v_channel::"Channel",
        v_order_number,
        v_customer_name,
        v_customer_phone,
        v_customer_address,
        'PREPARING'::"OrderStatus",
        v_payment_method::"PaymentMethod",
        v_payment_status::"PaymentStatus",
        v_gross_amount,
        v_net_margin,
        100,
        '{"cutlery":false,"saucesDips":false,"napkins":false,"tamperSeal":false,"beverageSeparated":false}'::jsonb,
        1,
        now(),
        now()
      );

      -- Also insert order items into order_items table for normalized relations
      INSERT INTO order_items (
        id,
        order_id,
        menu_item_id,
        name,
        quantity,
        price,
        station,
        station_done,
        version
      )
      SELECT 
        COALESCE(it->>'id', gen_random_uuid()::text),
        p_order_id,
        it->>'menuItemId',
        COALESCE(it->>'name', 'Item'),
        COALESCE((it->>'quantity')::int, 1),
        COALESCE((it->>'price')::float8, 0.0),
        COALESCE(it->>'station', 'GRILL')::"KitchenStation",
        COALESCE((it->>'stationDone')::boolean, false),
        1
      FROM jsonb_array_elements(v_items) AS it;

      v_result := jsonb_build_object(
        'ok', true,
        'seq', v_seq,
        'orderId', p_order_id,
        'orderNumber', v_order_number,
        'status', 'PREPARING',
        'version', 1
      );
    END IF;

  ELSIF p_action_type = 'STATUS_CHANGED' THEN
    IF v_current_order.id IS NULL THEN
      v_result := jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
    ELSE
      v_new_status := p_payload->>'status';
      
      -- Forward-only validation: terminal statuses DISPATCHED and CANCELLED cannot regress
      IF v_current_order.status = 'DISPATCHED' OR v_current_order.status = 'CANCELLED' THEN
        v_result := jsonb_build_object(
          'ok', true,
          'seq', v_seq,
          'orderId', p_order_id,
          'status', v_current_order.status,
          'version', v_current_order.version,
          'action', 'TERMINAL_NOOP'
        );
      ELSE
        v_new_version := v_current_order.version + 1;
        UPDATE orders 
           SET status = v_new_status::"OrderStatus",
               version = v_new_version,
               updated_at = now(),
               ready_at = CASE WHEN v_new_status = 'READY' THEN now() ELSE ready_at END,
               dispatched_at = CASE WHEN v_new_status = 'DISPATCHED' THEN now() ELSE dispatched_at END
         WHERE id = p_order_id;

        v_result := jsonb_build_object(
          'ok', true,
          'seq', v_seq,
          'orderId', p_order_id,
          'status', v_new_status,
          'version', v_new_version
        );
      END IF;
    END IF;

  ELSIF p_action_type = 'ITEM_UPDATED' THEN
    IF v_current_order.id IS NULL THEN
      v_result := jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
    ELSE
      v_item_id := p_payload->>'itemId';
      v_item_done := COALESCE((p_payload->>'stationDone')::boolean, true);

      UPDATE order_items 
         SET station_done = v_item_done,
             version = version + 1,
             updated_at = now()
       WHERE order_id = p_order_id AND id = v_item_id;

      v_new_version := v_current_order.version + 1;
      UPDATE orders SET version = v_new_version, updated_at = now() WHERE id = p_order_id;

      v_result := jsonb_build_object(
        'ok', true,
        'seq', v_seq,
        'orderId', p_order_id,
        'itemId', v_item_id,
        'stationDone', v_item_done,
        'version', v_new_version
      );
    END IF;

  ELSE
    v_result := jsonb_build_object('ok', false, 'error', 'UNKNOWN_ACTION_TYPE');
  END IF;

  -- 4. Record event in append-only log if operation succeeded
  IF (v_result->>'ok')::boolean = true THEN
    INSERT INTO order_events (
      kitchen_id,
      seq,
      order_id,
      type,
      payload,
      mutation_id,
      device_id,
      created_at
    ) VALUES (
      p_kitchen_id,
      v_seq,
      p_order_id,
      p_action_type,
      v_result,
      p_mutation_id,
      p_device_id,
      now()
    );
  END IF;

  -- 5. Record idempotent mutation result
  INSERT INTO mutations (id, kitchen_id, order_id, action_type, result, created_at)
  VALUES (p_mutation_id, p_kitchen_id, p_order_id, p_action_type, v_result, now());

  RETURN v_result;
END;
$$;

