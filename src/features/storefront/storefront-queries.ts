import 'server-only'
import { prisma } from '@/lib/prisma'
import { StorefrontBrand, StorefrontDish } from './types'

export async function getStorefrontBrandAndMenu(brandIdentifier: string) {
  try {
    // 1. Fetch brand (matching either ID or normalized name)
    const brand = await prisma.brand.findFirst({
      where: {
        OR: [
          { id: brandIdentifier },
          { name: { equals: brandIdentifier, mode: 'insensitive' } },
        ],
        active: true,
      },
      include: {
        kitchen: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    })

    if (!brand) {
      // Graceful seed / mock fallback for development & offline environments
      const mockBrands = [
        { id: 'b1', name: 'Biryani Central', tagline: 'Dum Pukht Specialists', color: '#f97316' },
        { id: 'b2', name: 'Burger Box', tagline: 'Smash & Crispy Gourmet', color: '#eab308' },
        { id: 'b3', name: 'Wrap Nation', tagline: 'Rolled Fresh Daily', color: '#10b981' },
      ]

      const matchedMock = mockBrands.find(
        (b) =>
          b.id === brandIdentifier ||
          b.name.toLowerCase().replace(/\s+/g, '-') === brandIdentifier.toLowerCase() ||
          b.name.toLowerCase() === brandIdentifier.toLowerCase()
      )

      if (matchedMock) {
        return {
          brand: {
            id: matchedMock.id,
            name: matchedMock.name,
            tagline: matchedMock.tagline,
            color: matchedMock.color,
            logoUrl: null,
            address: 'Indiranagar 100ft Road, Bengaluru',
            phone: '+91 98765 43210',
            fssaiLic: '11223344000123',
            kitchenId: 'k1',
            kitchenName: 'Indiranagar Cloud Hub',
          },
          dishes: [
            {
              id: 'd1',
              name: 'Hyderabadi Chicken Dum Biryani',
              description: 'Slow-cooked marinated chicken layered with aged fragrant basmati rice and saffron.',
              station: 'DUM_BIRYANI',
              sellingPrice: 349,
              isAvailable: true,
              category: 'Biryanis & Rice',
              dietary: 'NON_VEG' as const,
            },
            {
              id: 'd2',
              name: 'Nizami Paneer Subz Dum Biryani',
              description: 'Fresh malai paneer cubes, seasonal garden vegetables, and caramelized onions.',
              station: 'DUM_BIRYANI',
              sellingPrice: 299,
              isAvailable: true,
              category: 'Biryanis & Rice',
              dietary: 'VEG' as const,
            },
            {
              id: 'd3',
              name: 'Iced Artisan Cold Brew Latte',
              description: '18-hour steeped single-origin espresso with chilled textured milk.',
              station: 'BEVERAGE',
              sellingPrice: 220,
              isAvailable: true,
              category: 'Beverages & Coffee',
              dietary: 'VEG' as const,
            },
            {
              id: 'd4',
              name: 'Signature Shahi Gulab Jamun (2 Pcs)',
              description: 'Golden fried mawa dumplings steeped in cardamom rose syrup.',
              station: 'DESSERT',
              sellingPrice: 120,
              isAvailable: true,
              category: 'Desserts & Bakes',
              dietary: 'VEG' as const,
            },
          ],
        }
      }

      return null
    }

    // 2. Fetch available menu items
    const menuItems = await prisma.menuItem.findMany({
      where: {
        brandId: brand.id,
        isAvailable: true,
      },
      orderBy: [
        { station: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        station: true,
        sellingPrice: true,
        isAvailable: true,
      },
    })

    const transformedBrand: StorefrontBrand = {
      id: brand.id,
      name: brand.name,
      tagline: brand.tagline,
      color: brand.color || '#f97316',
      logoUrl: brand.logoUrl,
      address: brand.address,
      phone: brand.phone,
      fssaiLic: brand.fssaiLic,
      kitchenId: brand.kitchenId,
      kitchenName: brand.kitchen.name,
    }

    const transformedDishes: StorefrontDish[] = menuItems.map((item) => {
      // Derive category and dietary tags
      const lower = item.name.toLowerCase()
      const isVeg = !lower.includes('chicken') && !lower.includes('mutton') && !lower.includes('egg') && !lower.includes('fish') && !lower.includes('meat')
      
      let category = item.station.replace(/_/g, ' ')
      // Clean up common station names for customer presentation
      if (item.station === 'BEVERAGE') category = 'Beverages & Coffee'
      else if (item.station === 'PIZZA') category = 'Artisan Pizzas'
      else if (item.station === 'DUM_BIRYANI') category = 'Biryanis & Rice'
      else if (item.station === 'GRILL') category = 'Grill & Burgers'
      else if (item.station === 'DESSERT') category = 'Desserts & Bakes'

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        station: item.station,
        sellingPrice: item.sellingPrice,
        isAvailable: item.isAvailable,
        category,
        dietary: isVeg ? 'VEG' : 'NON_VEG',
      }
    })

    return {
      brand: transformedBrand,
      dishes: transformedDishes,
    }
  } catch (err) {
    console.error('[StorefrontQueries] Error fetching brand menu:', err)
    return null
  }
}

