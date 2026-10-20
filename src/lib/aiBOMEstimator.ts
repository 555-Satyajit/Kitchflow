import { Station } from '@/types'

export interface AIGeneratedRecipeItem {
  ingredientName: string
  quantity: number
  unit: 'g' | 'ml' | 'pc'
  estimatedCostPerUnit: number
  category: 'PROTEIN' | 'CARB' | 'SAUCE' | 'VEGGIE' | 'PACKAGING' | 'OTHER'
}

export interface AIBOMSuggestion {
  dishName: string
  station: Station
  secondaryStations?: Station[]
  suggestedPrice: number
  packagingCost: number
  description: string
  recipe: AIGeneratedRecipeItem[]
}

/**
 * Intelligent culinary knowledge engine for Indian cloud kitchens & cafes.
 * Infers commercial cloud kitchen portions, hero ingredients, station routing,
 * and packaging for sandwiches, appetizers, curries, biryanis, rolls, and street snacks.
 */
export function estimateRecipeBOM(dishName: string): AIBOMSuggestion {
  const normalized = dishName.trim().toLowerCase()

  // 1. Sandwiches & Toasts
  if (normalized.includes('sandwich') || normalized.includes('toast') || normalized.includes('panini') || normalized.includes('sub')) {
    const isCorn = normalized.includes('corn')
    const isPaneer = normalized.includes('paneer')
    const isCheese = normalized.includes('cheese') || normalized.includes('grilled')
    const isChicken = normalized.includes('chicken')
    const isClub = normalized.includes('club')

    const breadSlices = isClub ? 3 : 2
    const items: AIGeneratedRecipeItem[] = [
      { ingredientName: 'Bread Slices', quantity: breadSlices, unit: 'pc', estimatedCostPerUnit: 2.5, category: 'CARB' },
      { ingredientName: 'Butter / Spread', quantity: 15, unit: 'g', estimatedCostPerUnit: 0.6, category: 'SAUCE' },
    ]

    if (isCheese) {
      items.push({ ingredientName: 'Processed Cheese Slice / Mozzarella', quantity: 1, unit: 'pc', estimatedCostPerUnit: 14, category: 'PROTEIN' })
    }
    if (isCorn) {
      items.push({ ingredientName: 'Sweet Corn (Frozen Kernels)', quantity: 60, unit: 'g', estimatedCostPerUnit: 0.15, category: 'VEGGIE' })
    }
    if (isPaneer) {
      items.push({ ingredientName: 'Paneer Cubes (Diced)', quantity: 80, unit: 'g', estimatedCostPerUnit: 0.45, category: 'PROTEIN' })
    }
    if (isChicken) {
      items.push({ ingredientName: 'Shredded Cooked Chicken', quantity: 90, unit: 'g', estimatedCostPerUnit: 0.35, category: 'PROTEIN' })
    }
    if (!isCorn && !isPaneer && !isChicken) {
      items.push({ ingredientName: 'Mixed Veggies (Capsicum, Onion, Tomato)', quantity: 70, unit: 'g', estimatedCostPerUnit: 0.1, category: 'VEGGIE' })
    }
    items.push({ ingredientName: 'Green Mint Chutney / Mayo', quantity: 20, unit: 'ml', estimatedCostPerUnit: 0.2, category: 'SAUCE' })

    return {
      dishName: dishName.trim(),
      station: 'GRILL',
      secondaryStations: ['ASSEMBLY'],
      suggestedPrice: isChicken ? 199 : isPaneer ? 179 : isCheese ? 149 : 129,
      packagingCost: 12,
      description: 'Golden grilled sandwich with seasoned filling, melted cheese, and green mint relish.',
      recipe: items,
    }
  }

  // 2. Corn Salt & Pepper / Crispy Appetizers
  if (normalized.includes('corn salt') || normalized.includes('salt and pepper') || normalized.includes('crispy corn')) {
    return {
      dishName: dishName.trim(),
      station: 'FRY',
      secondaryStations: ['WOK', 'ASSEMBLY'],
      suggestedPrice: 189,
      packagingCost: 14,
      description: 'Wok-tossed crunchy golden sweet corn with cracked pepper, spring onions, and garlic.',
      recipe: [
        { ingredientName: 'Sweet Corn (Frozen Kernels)', quantity: 180, unit: 'g', estimatedCostPerUnit: 0.15, category: 'VEGGIE' },
        { ingredientName: 'Corn Flour / Starch Batter', quantity: 30, unit: 'g', estimatedCostPerUnit: 0.08, category: 'CARB' },
        { ingredientName: 'Spring Onion & Bell Peppers', quantity: 40, unit: 'g', estimatedCostPerUnit: 0.15, category: 'VEGGIE' },
        { ingredientName: 'Butter / Toss Oil', quantity: 15, unit: 'g', estimatedCostPerUnit: 0.5, category: 'SAUCE' },
      ],
    }
  }

  // 3. Fries / Potato Starters
  if (normalized.includes('fries') || normalized.includes('potato wedge') || normalized.includes('french fries')) {
    const isPeriPeri = normalized.includes('peri')
    return {
      dishName: dishName.trim(),
      station: 'FRY',
      secondaryStations: ['PACKING'],
      suggestedPrice: isPeriPeri ? 139 : 119,
      packagingCost: 10,
      description: 'Deep-fried golden potato frites seasoned with chef spice blend.',
      recipe: [
        { ingredientName: 'Frozen Potato Fries Cut', quantity: 180, unit: 'g', estimatedCostPerUnit: 0.18, category: 'CARB' },
        { ingredientName: 'Frying Oil Absorption', quantity: 25, unit: 'ml', estimatedCostPerUnit: 0.15, category: 'SAUCE' },
        { ingredientName: 'Seasoning Blend (Peri-Peri / Salt)', quantity: 8, unit: 'g', estimatedCostPerUnit: 0.4, category: 'OTHER' },
      ],
    }
  }

  // 4. Maggi / Pasta / Noodles
  if (normalized.includes('maggi') || normalized.includes('noodles') || normalized.includes('pasta')) {
    return {
      dishName: dishName.trim(),
      station: 'WOK',
      secondaryStations: ['ASSEMBLY'],
      suggestedPrice: 119,
      packagingCost: 12,
      description: 'Classic quick comfort noodles tossed with butter and seasonal diced vegetables.',
      recipe: [
        { ingredientName: 'Noodle / Maggi Cake', quantity: 1, unit: 'pc', estimatedCostPerUnit: 14, category: 'CARB' },
        { ingredientName: 'Diced Veggies (Carrot, Peas, Onion)', quantity: 60, unit: 'g', estimatedCostPerUnit: 0.12, category: 'VEGGIE' },
        { ingredientName: 'Butter', quantity: 15, unit: 'g', estimatedCostPerUnit: 0.6, category: 'SAUCE' },
      ],
    }
  }

  // 5. Rolls & Wraps
  if (normalized.includes('roll') || normalized.includes('wrap') || normalized.includes('frankie')) {
    const isPaneer = normalized.includes('paneer')
    const isChicken = normalized.includes('chicken')
    const isEgg = normalized.includes('egg')

    const items: AIGeneratedRecipeItem[] = [
      { ingredientName: 'Tortilla / Paratha Flatbread', quantity: 1, unit: 'pc', estimatedCostPerUnit: 9.5, category: 'CARB' },
      { ingredientName: 'Mint Mayo / Sauce', quantity: 25, unit: 'ml', estimatedCostPerUnit: 0.2, category: 'SAUCE' },
      { ingredientName: 'Sliced Pickled Onion & Bell Pepper', quantity: 40, unit: 'g', estimatedCostPerUnit: 0.1, category: 'VEGGIE' },
    ]

    if (isPaneer) {
      items.push({ ingredientName: 'Tandoori Paneer Chunks', quantity: 110, unit: 'g', estimatedCostPerUnit: 0.45, category: 'PROTEIN' })
    } else if (isChicken) {
      items.push({ ingredientName: 'Grilled Chicken Tikka', quantity: 130, unit: 'g', estimatedCostPerUnit: 0.32, category: 'PROTEIN' })
    } else if (isEgg) {
      items.push({ ingredientName: 'Farm Fresh Egg', quantity: 2, unit: 'pc', estimatedCostPerUnit: 7.0, category: 'PROTEIN' })
    } else {
      items.push({ ingredientName: 'Mixed Veggie Kebab Patty', quantity: 1, unit: 'pc', estimatedCostPerUnit: 25, category: 'PROTEIN' })
    }

    return {
      dishName: dishName.trim(),
      station: 'GRILL',
      secondaryStations: ['ASSEMBLY'],
      suggestedPrice: isChicken ? 229 : isPaneer ? 199 : 159,
      packagingCost: 14,
      description: 'Flaky toasted wrap stuffed with marinated fillings, sliced laccha onions, and tangy sauce.',
      recipe: items,
    }
  }

  // 6. Biryanis & Rice Bowls
  if (normalized.includes('biryani') || normalized.includes('pulao') || normalized.includes('rice bowl')) {
    const isChicken = normalized.includes('chicken')
    const isMutton = normalized.includes('mutton')
    const isPaneer = normalized.includes('paneer') || normalized.includes('veg')

    const items: AIGeneratedRecipeItem[] = [
      { ingredientName: 'Basmati Rice (Aged Long-Grain)', quantity: 300, unit: 'g', estimatedCostPerUnit: 0.12, category: 'CARB' },
      { ingredientName: 'Biryani Gravy Base', quantity: 120, unit: 'ml', estimatedCostPerUnit: 0.18, category: 'SAUCE' },
    ]

    if (isMutton) {
      items.push({ ingredientName: 'Mutton Cuts (Bone-in)', quantity: 240, unit: 'g', estimatedCostPerUnit: 0.75, category: 'PROTEIN' })
    } else if (isChicken) {
      items.push({ ingredientName: 'Chicken Curry Cut / Boneless', quantity: 220, unit: 'g', estimatedCostPerUnit: 0.28, category: 'PROTEIN' })
    } else if (isPaneer) {
      items.push({ ingredientName: 'Paneer Cubes', quantity: 150, unit: 'g', estimatedCostPerUnit: 0.45, category: 'PROTEIN' })
    }

    return {
      dishName: dishName.trim(),
      station: 'DUM_BIRYANI',
      secondaryStations: ['ASSEMBLY', 'PACKING'],
      suggestedPrice: isMutton ? 489 : isChicken ? 389 : 299,
      packagingCost: 22,
      description: 'Slow-cooked aromatic dum rice layered with marinated protein and rich masala gravy.',
      recipe: items,
    }
  }

  // 7. Burgers
  if (normalized.includes('burger')) {
    const isChicken = normalized.includes('chicken')
    return {
      dishName: dishName.trim(),
      station: 'FRY',
      secondaryStations: ['GRILL', 'ASSEMBLY'],
      suggestedPrice: isChicken ? 249 : 179,
      packagingCost: 16,
      description: 'Toasted bun, crunchy seasoned patty, crisp lettuce, and signature house sauce.',
      recipe: [
        { ingredientName: 'Brioche Burger Bun', quantity: 1, unit: 'pc', estimatedCostPerUnit: 18, category: 'CARB' },
        { ingredientName: isChicken ? 'Crispy Chicken Patty' : 'Veg Supreme Patty', quantity: 1, unit: 'pc', estimatedCostPerUnit: isChicken ? 42 : 22, category: 'PROTEIN' },
        { ingredientName: 'House Burger Mayo / Dressing', quantity: 30, unit: 'ml', estimatedCostPerUnit: 0.18, category: 'SAUCE' },
      ],
    }
  }

  // 8. Beverages, Chai, Shakes
  if (normalized.includes('chai') || normalized.includes('tea') || normalized.includes('coffee') || normalized.includes('shake') || normalized.includes('cooler') || normalized.includes('mojito')) {
    const isHot = normalized.includes('chai') || normalized.includes('tea') || (normalized.includes('coffee') && !normalized.includes('cold'))
    return {
      dishName: dishName.trim(),
      station: 'BEVERAGE',
      suggestedPrice: isHot ? 69 : 149,
      packagingCost: 12,
      description: 'Freshly brewed and prepared cafe beverage served in sealed packaging.',
      recipe: [
        { ingredientName: 'Fresh Dairy Milk', quantity: 200, unit: 'ml', estimatedCostPerUnit: 0.07, category: 'SAUCE' },
        { ingredientName: isHot ? 'Specialty Tea/Coffee Decoction' : 'Shake Syrup / Flavored Base', quantity: 40, unit: 'ml', estimatedCostPerUnit: 0.35, category: 'OTHER' },
        { ingredientName: 'Eco-Friendly Beverage Cup & Lid', quantity: 1, unit: 'pc', estimatedCostPerUnit: 8, category: 'PACKAGING' },
      ],
    }
  }

  // 9. Generic Fallback for Any Indian Curry or Main Dish
  return {
    dishName: dishName.trim(),
    station: 'ASSEMBLY',
    secondaryStations: ['TANDOOR'],
    suggestedPrice: 249,
    packagingCost: 16,
    description: 'Freshly prepared specialty dish prepared with premium spices and standard portioning.',
    recipe: [
      { ingredientName: 'Main Dish Protein / Base Veggie', quantity: 160, unit: 'g', estimatedCostPerUnit: 0.35, category: 'PROTEIN' },
      { ingredientName: 'Signature Curry / Gravy Base', quantity: 150, unit: 'ml', estimatedCostPerUnit: 0.18, category: 'SAUCE' },
      { ingredientName: 'Seasoned Garnish (Coriander / Butter)', quantity: 20, unit: 'g', estimatedCostPerUnit: 0.4, category: 'OTHER' },
      { ingredientName: '500ml Leakproof Meal Container', quantity: 1, unit: 'pc', estimatedCostPerUnit: 12, category: 'PACKAGING' },
    ],
  }
}
