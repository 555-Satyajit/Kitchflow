'use server';

import { prisma } from '@/lib/prisma';
import { ActionResult } from './settings';

export interface InvoicePublicData {
  order: any;
  kitchen: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    fssaiLic: string | null;
    gstRate: number | null;
    invoiceTerms: string | null;
  } | null;
  brand: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    fssaiLic: string | null;
    invoiceTerms: string | null;
  } | null;
}

export async function getPublicInvoiceAction(orderId: string): Promise<ActionResult<InvoicePublicData>> {
  try {
    const cleanId = orderId.trim();
    // 1. Fetch order by UUID or orderNumber (including case-insensitive and alphanum matching)
    let order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { orderNumber: cleanId },
          { orderNumber: { equals: cleanId, mode: 'insensitive' } },
        ],
      },
      include: {
        items: true,
        kitchen: {
          select: {
            name: true,
            address: true,
            phone: true,
            email: true,
            gstin: true,
            fssaiLic: true,
            gstRate: true,
            invoiceTerms: true,
          },
        },
        brand: {
          select: {
            name: true,
            address: true,
            phone: true,
            email: true,
            fssaiLic: true,
            invoiceTerms: true,
          },
        },
      },
    });

    // Fallback search by stripped alphanumeric order number (e.g., BEH104 -> BEH-104)
    if (!order) {
      const targetClean = cleanId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const recentOrders = await prisma.order.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          kitchen: {
            select: {
              name: true,
              address: true,
              phone: true,
              email: true,
              gstin: true,
              fssaiLic: true,
              gstRate: true,
              invoiceTerms: true,
            },
          },
          brand: {
            select: {
              name: true,
              address: true,
              phone: true,
              email: true,
              fssaiLic: true,
              invoiceTerms: true,
            },
          },
        },
      });

      order = recentOrders.find(
        (o) => o.id === cleanId || o.orderNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === targetClean
      ) || null;
    }

    if (!order) {
      return { ok: false, error: 'Invoice not found' };
    }

    return {
      ok: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress,
          channel: order.channel,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          couponCode: order.couponCode,
          financials: {
            grossAmount: order.grossAmount,
            discount: order.discount,
            taxes: order.taxes,
          },
          createdAt: order.createdAt.toISOString(),
          items: order.items.map((it) => ({
            id: it.id,
            name: it.name,
            quantity: it.quantity,
            price: it.price,
          })),
        },
        kitchen: order.kitchen,
        brand: order.brand,
      },
    };
  } catch (error: any) {
    console.error('Error fetching public invoice:', error);
    return { ok: false, error: 'Failed to load invoice' };
  }
}

