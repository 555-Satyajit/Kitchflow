'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentKitchenContext } from '@/lib/session';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Server Action: Apply client mutation through stored procedure apply_mutation.
 */
export async function applyMutationAction(params: {
  mutationId: string;
  kitchenId: string;
  orderId: string;
  actionType: string;
  payload: Record<string, any>;
  deviceId?: string;
}): Promise<ActionResult<any>> {
  try {
    const session = await getCurrentKitchenContext();
    // Allow operations if user has permission
    const canMutate = session.role === 'owner' ||
      session.permissions?.includes('orders') ||
      session.permissions?.includes('kds') ||
      session.permissions?.includes('packing') ||
      session.permissions?.includes('pos');

    if (!canMutate) {
      return { ok: false, error: 'Unauthorized: Operational permission required' };
    }

    let { mutationId, kitchenId, orderId, actionType, payload, deviceId } = params;

    // Guard against literal 'ALL' or 'all' pseudo-kitchen ID passed from multi-outlet overview
    if (!kitchenId || kitchenId.toUpperCase() === 'ALL') {
      if (session.kitchenId && session.kitchenId.toUpperCase() !== 'ALL') {
        kitchenId = session.kitchenId;
      } else if (session.kitchenIds && session.kitchenIds.length > 0) {
        kitchenId = session.kitchenIds[0];
      } else {
        const firstKitchen = await prisma.kitchen.findFirst({ select: { id: true } });
        if (firstKitchen) {
          kitchenId = firstKitchen.id;
        }
      }
    }

    // Call stored procedure apply_mutation
    const query = `
      SELECT apply_mutation(
        $1::text,
        $2::text,
        $3::text,
        $4::text,
        $5::jsonb,
        $6::text
      ) as result;
    `;

    const rawResult = await prisma.$queryRawUnsafe<any[]>(
      query,
      mutationId,
      kitchenId,
      orderId,
      actionType,
      JSON.stringify(payload),
      deviceId || null
    );

    const res = rawResult[0]?.result;
    if (res && res.ok) {
      return { ok: true, data: res };
    }

    return { ok: false, error: res?.error || 'Mutation failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply mutation';
    console.error('Error in applyMutationAction:', error);
    return { ok: false, error: message };
  }
}

/**
 * Server Action: Pull event log slice for cursor-based replication.
 */
export async function pullKitchenEventsAction(
  kitchenId: string,
  afterSeq: number,
  limit = 500
): Promise<ActionResult<any[]>> {
  try {
    const session = await getCurrentKitchenContext();
    const allowed = session.role === 'owner' ||
      session.kitchenId === 'ALL' ||
      !session.kitchenId ||
      session.kitchenId === kitchenId ||
      session.kitchenIds?.includes(kitchenId);

    if (!allowed) {
      return { ok: false, error: 'Unauthorized kitchen access' };
    }

    const events = await prisma.$queryRawUnsafe<any[]>(
      `SELECT kitchen_id, seq, order_id, type, payload, mutation_id, created_at
         FROM order_events
        WHERE kitchen_id = $1 AND seq > $2
        ORDER BY seq ASC
        LIMIT $3;`,
      kitchenId,
      afterSeq,
      limit
    );

    const mapped = events.map((e) => ({
      kitchen_id: e.kitchen_id,
      seq: Number(e.seq),
      order_id: e.order_id,
      type: e.type,
      payload: e.payload,
      mutation_id: e.mutation_id,
      created_at: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
    }));

    return { ok: true, data: mapped };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed pulling kitchen events';
    console.error('Error in pullKitchenEventsAction:', error);
    return { ok: false, error: message };
  }
}

