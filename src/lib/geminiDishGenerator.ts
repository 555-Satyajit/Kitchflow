import { Station } from '@/types';
import { AIBOMSuggestion, AIGeneratedRecipeItem, estimateRecipeBOM } from '@/lib/aiBOMEstimator';

/**
 * Extracts and cleans the Google Gemini API key from environment variables.
 * Accommodates variations like trailing spaces or surrounding quotes in .env.
 */
export function getGeminiApiKey(): string | undefined {
  for (const [k, v] of Object.entries(process.env)) {
    const normalizedKey = k.trim().toLowerCase();
    if (normalizedKey === 'gemini_api_key' || normalizedKey === 'gemini_apikey') {
      let val = v?.trim();
      if (val) {
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.slice(1, -1).trim();
        }
        return val;
      }
    }
  }
  let fallback = process.env.GEMINI_API_KEY?.trim() || process.env.Gemini_API_Key?.trim();
  if (fallback) {
    if ((fallback.startsWith("'") && fallback.endsWith("'")) || (fallback.startsWith('"') && fallback.endsWith('"'))) {
      fallback = fallback.slice(1, -1).trim();
    }
    return fallback;
  }
  return undefined;
}

export interface InventoryItemHint {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  category?: string;
}

export interface GenerateDishResult {
  suggestion: AIBOMSuggestion;
  source: 'gemini' | 'local_fallback';
  modelUsed?: string;
}

/**
 * Connects to Google Gemini Flash API to predict commercial BOM, ingredient portions,
 * kitchen station routing, packaging costs, and retail pricing for Indian cloud kitchens & cafes.
 * Actively matches and reuses existing stockroom inventory items to prevent duplicate SKUs
 * and ensure accurate food cost calculations.
 */
export async function generateDishWithGemini(params: {
  dishName: string;
  brandName?: string;
  cuisineHint?: string;
  availableInventory?: InventoryItemHint[];
}): Promise<GenerateDishResult> {
  const apiKey = getGeminiApiKey();
  const trimmedName = params.dishName.trim();

  if (!apiKey) {
    console.warn('[Gemini Dish Generator] No Gemini API key detected, falling back to local culinary rule engine.');
    return {
      suggestion: estimateRecipeBOM(trimmedName),
      source: 'local_fallback',
    };
  }

  // Build condensed representation of existing inventory for prompt grounding
  const inventoryContext = params.availableInventory && params.availableInventory.length > 0
    ? `
EXISTING KITCHEN STOCKROOM INVENTORY ITEMS:
${JSON.stringify(
  params.availableInventory.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    costPerUnit: i.costPerUnit,
  })),
  null,
  2
)}

CRITICAL STOCKROOM REUSE & DEDUPLICATION INSTRUCTIONS:
1. Always PRIORITIZE matching against the existing stockroom items listed above whenever the recipe needs that type of ingredient (e.g. if the dish needs butter and "Amul Table Butter (Salted)" exists in stock, use that exact item).
2. For any ingredient matched from the existing stockroom list:
   - "ingredientName" MUST be the exact name from the stockroom list.
   - "unit" MUST match the exact unit from the stockroom list.
   - "estimatedCostPerUnit" MUST be the exact costPerUnit from the stockroom list.
   - "matchedIngredientId" MUST be set to that item's "id".
   - "isExisting" MUST be set to true.
3. For truly missing ingredients not available in the stockroom (e.g. specialized garnish or uncommon spice):
   - Provide standard commercial naming, realistic portion and cost.
   - "matchedIngredientId" MUST be null.
   - "isExisting" MUST be false.
`
    : '';

  const prompt = `You are a World-Class Executive Chef and Culinary Director for high-throughput commercial multi-brand cloud kitchens and QSRs in India.
Analyze the dish: "${trimmedName}"${params.brandName ? ` for the brand "${params.brandName}"` : ''}${params.cuisineHint ? ` with style/cuisine "${params.cuisineHint}"` : ''}.
Generate an accurate commercial Bill of Materials (BOM) recipe for 1 standard commercial portion, correct station routing, packaging cost, and retail selling price in Indian Rupees (INR).
${inventoryContext}
STATION REQUIREMENTS:
The "station" field MUST be exactly one of:
- "GRILL": for grilled items, sandwiches, burgers, paninis, wraps
- "FRY": for fried snacks, fries, nuggets, pakoras, wings, samosas
- "TANDOOR": for tikkas, naans, rotis, kebabs, tandoori platters
- "DUM_BIRYANI": for biryanis, pulaos, dum preparations
- "WOK": for noodles, fried rice, manchurian, stir-fries, hakka items, Asian bowls
- "PIZZA": for pizzas, calzones, garlic bread, pasta bakes
- "BEVERAGE": for shakes, teas, coffees, mojitos, smoothies, sodas
- "DESSERT": for sweets, cakes, ice creams, gulab jamuns, brownies
- "ASSEMBLY": for cold assembly, salads, chaat, rolls wrapping
- "PACKING": for simple dispatch packing

INGREDIENT CATEGORIES:
Each recipe ingredient category must be one of: "PROTEIN" | "CARB" | "SAUCE" | "VEGGIE" | "PACKAGING" | "OTHER".
The unit must be one of: "g" | "ml" | "pc".
Quantity must be numeric (e.g. 150 for 150g, 20 for 20ml, 1 for 1 bun).

Return strictly JSON matching this structure:
{
  "dishName": "${trimmedName}",
  "description": "Appetizing 1-sentence cloud kitchen menu description",
  "station": "STATION_NAME",
  "secondaryStations": ["ASSEMBLY", "PACKING"],
  "suggestedPrice": 249,
  "packagingCost": 15,
  "recipe": [
    {
      "ingredientName": "Specific ingredient name",
      "quantity": 100,
      "unit": "g",
      "estimatedCostPerUnit": 0.35,
      "category": "PROTEIN",
      "matchedIngredientId": "existing-id-or-null",
      "isExisting": true
    }
  ]
}`;

  const candidateModels = ['gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3.5-flash'];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      });

      if (!response.ok) {
        console.warn(`[Gemini Dish Generator] Model ${model} returned HTTP ${response.status}`);
        continue;
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);

      // Validate and sanitize station
      const VALID_STATIONS: Station[] = [
        'GRILL',
        'FRY',
        'TANDOOR',
        'DUM_BIRYANI',
        'WOK',
        'PIZZA',
        'BEVERAGE',
        'DESSERT',
        'ASSEMBLY',
        'PACKING',
      ];
      const validStation: Station = VALID_STATIONS.includes(parsed.station) ? parsed.station : 'ASSEMBLY';

      const validRecipe: AIGeneratedRecipeItem[] = Array.isArray(parsed.recipe)
        ? parsed.recipe.map((r: any) => ({
            ingredientName: String(r.ingredientName || 'Raw Ingredient').trim(),
            quantity: Math.max(1, Math.round(Number(r.quantity) || 50)),
            unit: (['g', 'ml', 'pc'].includes(r.unit) ? r.unit : 'g') as 'g' | 'ml' | 'pc',
            estimatedCostPerUnit: Math.max(0.01, Number(r.estimatedCostPerUnit) || 0.2),
            category: (['PROTEIN', 'CARB', 'SAUCE', 'VEGGIE', 'PACKAGING', 'OTHER'].includes(r.category)
              ? r.category
              : 'OTHER') as any,
            matchedIngredientId: r.matchedIngredientId || null,
            isExisting: Boolean(r.isExisting || r.matchedIngredientId),
          }))
        : [];

      return {
        suggestion: {
          dishName: parsed.dishName || trimmedName,
          station: validStation,
          secondaryStations: Array.isArray(parsed.secondaryStations)
            ? parsed.secondaryStations.filter((s: any) => VALID_STATIONS.includes(s))
            : ['ASSEMBLY'],
          suggestedPrice: Math.max(10, Math.round(Number(parsed.suggestedPrice) || 199)),
          packagingCost: Math.max(0, Math.round(Number(parsed.packagingCost) || 15)),
          description: parsed.description || `${trimmedName} freshly prepared with premium culinary ingredients.`,
          recipe: validRecipe,
        },
        source: 'gemini',
        modelUsed: model,
      };
    } catch (err) {
      console.warn(`[Gemini Dish Generator] Attempt with model ${model} failed:`, err);
    }
  }

  // Graceful fallback to rule-based estimator
  return {
    suggestion: estimateRecipeBOM(trimmedName),
    source: 'local_fallback',
  };
}

