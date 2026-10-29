'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentKitchenContext } from '@/lib/session';

export interface CustomerStats {
  phone: string;
  name: string;
  address?: string;
  totalOrders: number;
  totalSpend: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  preferredBrand: string;
  preferredChannel: string;
  tier: 'VIP' | 'REGULAR' | 'NEW';
  recentOrders: {
    id: string;
    orderNumber: string;
    brandName: string;
    channel: string;
    createdAt: string;
    grossAmount: number;
    status: string;
    itemSummary: string;
  }[];
}

export interface CustomerDirectoryResponse {
  customers: CustomerStats[];
  totalCustomers: number;
  totalRevenue: number;
  vipCount: number;
  repeatRate: number;
}

export async function getCustomerDirectoryAction(params: {
  kitchenId?: string;
  search?: string;
  tier?: 'ALL' | 'VIP' | 'REGULAR' | 'NEW';
  page?: number;
  limit?: number;
}): Promise<CustomerDirectoryResponse> {
  try {
    const session = await getCurrentKitchenContext();
    if (!session.userId) {
      return { customers: [], totalCustomers: 0, totalRevenue: 0, vipCount: 0, repeatRate: 0 };
    }

    const canAccess = session.role === 'owner' || 
      session.role === 'admin' ||
      session.permissions?.includes('customers') ||
      session.permissions?.includes('orders') ||
      session.permissions?.includes('pos');
    if (!canAccess) {
      return { customers: [], totalCustomers: 0, totalRevenue: 0, vipCount: 0, repeatRate: 0 };
    }

    const allowedKitchenIds: string[] = session.kitchenIds || [session.kitchenId];

    let kitchenWhere: any;
    if (!params.kitchenId || params.kitchenId === 'ALL') {
      kitchenWhere = { in: allowedKitchenIds };
    } else {
      if (!allowedKitchenIds.includes(params.kitchenId)) {
        return { customers: [], totalCustomers: 0, totalRevenue: 0, vipCount: 0, repeatRate: 0 };
      }
      kitchenWhere = params.kitchenId;
    }

    const whereClause: any = {
      kitchenId: kitchenWhere,
      customerPhone: { not: null },
    };

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const cleanDigits = q.replace(/\D/g, '');
      whereClause.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        ...(cleanDigits.length >= 3 ? [{ customerPhone: { contains: cleanDigits } }] : []),
      ];
    }

    // Query orders that have a customerPhone associated
    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        grossAmount: true,
        status: true,
        channel: true,
        createdAt: true,
        brand: {
          select: { name: true },
        },
        items: {
          select: { name: true, quantity: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    // Group orders by customer phone
    const customerMap = new Map<string, {
      phone: string;
      name: string;
      address?: string;
      orders: typeof orders;
      brandCounts: Record<string, number>;
      channelCounts: Record<string, number>;
    }>();

    for (const order of orders) {
      const phone = order.customerPhone?.trim();
      if (!phone) continue;

      let entry = customerMap.get(phone);
      if (!entry) {
        entry = {
          phone,
          name: order.customerName?.trim() || 'Guest Customer',
          address: order.customerAddress || undefined,
          orders: [],
          brandCounts: {},
          channelCounts: {},
        };
        customerMap.set(phone, entry);
      }

      if (
        (entry.name === 'Guest Customer' || !entry.name) &&
        order.customerName &&
        order.customerName.trim() !== 'Guest Customer'
      ) {
        entry.name = order.customerName.trim();
      }

      if (!entry.address && order.customerAddress) {
        entry.address = order.customerAddress;
      }

      entry.orders.push(order);

      const brandName = order.brand?.name || 'Direct';
      entry.brandCounts[brandName] = (entry.brandCounts[brandName] || 0) + 1;

      const channel = order.channel;
      entry.channelCounts[channel] = (entry.channelCounts[channel] || 0) + 1;
    }

    const allCustomerList: CustomerStats[] = [];
    let overallTotalRevenue = 0;
    let vipCount = 0;
    let repeatCustomerCount = 0;

    for (const item of customerMap.values()) {
      const totalOrders = item.orders.length;
      const totalSpend = item.orders.reduce((sum: number, o: { grossAmount: number }) => sum + Number(o.grossAmount || 0), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;
      overallTotalRevenue += totalSpend;

      if (totalOrders > 1) {
        repeatCustomerCount++;
      }

      let tier: CustomerStats['tier'] = 'NEW';
      if (totalOrders >= 5 || totalSpend >= 2500) {
        tier = 'VIP';
        vipCount++;
      } else if (totalOrders >= 2) {
        tier = 'REGULAR';
      }

      let preferredBrand = 'General';
      let maxBrandCount = 0;
      for (const [brand, count] of Object.entries(item.brandCounts)) {
        if (count > maxBrandCount) {
          maxBrandCount = count;
          preferredBrand = brand;
        }
      }

      let preferredChannel = 'DIRECT';
      let maxChannelCount = 0;
      for (const [ch, count] of Object.entries(item.channelCounts)) {
        if (count > maxChannelCount) {
          maxChannelCount = count;
          preferredChannel = ch;
        }
      }

      const sortedOrders = item.orders.sort(
        (a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      const lastOrder = sortedOrders[0];
      const firstOrder = sortedOrders[sortedOrders.length - 1];

      const recentOrders = sortedOrders.slice(0, 5).map((o: {
        id: string;
        orderNumber: string;
        brand?: { name: string } | null;
        channel: string;
        createdAt: Date;
        grossAmount: number;
        status: string;
        items: { name: string; quantity: number }[];
      }) => {
        const itemSummary = o.items
          .map((it: { name: string; quantity: number }) => `${it.quantity}x ${it.name}`)
          .join(', ');
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          brandName: o.brand?.name || 'Kitchen Brand',
          channel: o.channel,
          createdAt: o.createdAt.toISOString(),
          grossAmount: Number(o.grossAmount || 0),
          status: o.status,
          itemSummary: itemSummary || 'General items',
        };
      });

      allCustomerList.push({
        phone: item.phone,
        name: item.name,
        address: item.address,
        totalOrders,
        totalSpend,
        avgOrderValue,
        firstOrderDate: firstOrder ? firstOrder.createdAt.toISOString() : new Date().toISOString(),
        lastOrderDate: lastOrder ? lastOrder.createdAt.toISOString() : new Date().toISOString(),
        preferredBrand,
        preferredChannel,
        tier,
        recentOrders,
      });
    }

    allCustomerList.sort(
      (a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
    );

    let filteredList = allCustomerList;
    if (params.tier && params.tier !== 'ALL') {
      filteredList = allCustomerList.filter((c) => c.tier === params.tier);
    }

    const totalCustomers = filteredList.length;
    const repeatRate =
      customerMap.size > 0 ? Math.round((repeatCustomerCount / customerMap.size) * 100) : 0;

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(10, params.limit || 20));

    // Return all matched customers so client-side TanStack Table can sort & paginate instantly,
    // or if a page limit is explicitly set, use it.
    const isExportOrAll = !params.page && (params.limit === 0 || params.limit === undefined);
    const paginatedCustomers = isExportOrAll
      ? filteredList
      : filteredList.slice((page - 1) * limit, page * limit);

    return {
      customers: paginatedCustomers,
      totalCustomers,
      totalRevenue: overallTotalRevenue,
      vipCount,
      repeatRate,
    };
  } catch (error) {
    console.error('Failed to get customer directory:', error);
    return { customers: [], totalCustomers: 0, totalRevenue: 0, vipCount: 0, repeatRate: 0 };
  }
}
