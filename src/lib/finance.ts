import { Order, OrderFinancials } from "@/types";

export interface CommissionSettings {
  applyCommissionOn: 'GROSS' | 'NET_AFTER_DISCOUNT';
  includeGstInDeduction: boolean; // Section 9(5) CGST Act: e-commerce operator collects & remits GST
  includeGstOnCommission?: boolean; // 18% GST charged by Swiggy/Zomato on their commission invoice
}

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  applyCommissionOn: 'NET_AFTER_DISCOUNT', // Standard aggregator contract terms
  includeGstInDeduction: false, // Section 9(5) CGST: platform remits 5% food tax directly
  includeGstOnCommission: true, // Swiggy/Zomato invoice includes 18% GST on commission fees
};

export interface FinancialLineItem {
  key: string;
  label: string;
  amount: number;
  type: 'INCOME' | 'DEDUCTION' | 'NET';
  description?: string;
}

/**
 * Single source of truth calculation for cloud kitchen unit economics.
 * Stores money in integer paise internally, eliminating floating point drift.
 */
export function calculateOrderFinancials(params: {
  itemSubtotal: number;
  packagingFeeCollected: number;
  customerDiscount: number;
  commissionRate: number; // e.g. 0.22
  ingredientCost: number; // BOM
  packagingMaterialCost: number;
  taxRate?: number; // e.g. 0.05
  settings?: CommissionSettings;
}): {
  financials: OrderFinancials;
  lineItems: FinancialLineItem[];
} {
  const settings = params.settings || DEFAULT_COMMISSION_SETTINGS;

  // Convert all inflows and costs to integer paise
  const grossPaise = Math.round(params.itemSubtotal * 100);
  const pkgFeePaise = Math.round(params.packagingFeeCollected * 100);
  const discountPaise = Math.round(params.customerDiscount * 100);
  const ingredientCostPaise = Math.round(params.ingredientCost * 100);
  const packagingCostPaise = Math.round(params.packagingMaterialCost * 100);

  // Total Customer Inflow (Item + Packaging Fee)
  const totalInflowPaise = grossPaise + pkgFeePaise;

  // Commission Base (Gross vs Net of Discount)
  const commissionBasePaise = settings.applyCommissionOn === 'GROSS'
    ? grossPaise
    : Math.max(0, grossPaise - discountPaise);

  const baseCommissionPaise = Math.round(commissionBasePaise * params.commissionRate);
  
  // 18% GST on aggregator commission invoice
  const gstOnCommPaise = settings.includeGstOnCommission
    ? Math.round(baseCommissionPaise * 0.18)
    : 0;

  const totalCommissionPaise = baseCommissionPaise + gstOnCommPaise;

  // 5% Restaurant GST
  const taxRate = params.taxRate ?? 0.05;
  const taxesPaise = Math.round(grossPaise * taxRate);
  const taxDeductionPaise = settings.includeGstInDeduction ? taxesPaise : 0;

  // Total Outflows strictly in integer paise
  const totalDeductionsPaise = discountPaise + 
                               totalCommissionPaise + 
                               ingredientCostPaise + 
                               packagingCostPaise + 
                               taxDeductionPaise;

  const netContributionPaise = totalInflowPaise - totalDeductionsPaise;

  // Convert back to Rupees for display
  const grossAmount = grossPaise / 100;
  const packagingFeeCollected = pkgFeePaise / 100;
  const discount = discountPaise / 100;
  const commissionAmount = totalCommissionPaise / 100;
  const baseCommission = baseCommissionPaise / 100;
  const gstOnCommission = gstOnCommPaise / 100;
  const ingredientCost = ingredientCostPaise / 100;
  const packagingCost = packagingCostPaise / 100;
  const taxes = taxesPaise / 100;
  const netContribution = netContributionPaise / 100;

  // Contribution Margin % (Denominator is Total Inflow: Food + Packaging Fee Collected)
  const netMarginPercentage = totalInflowPaise > 0
    ? Math.round((netContributionPaise / totalInflowPaise) * 1000) / 10
    : 0;

  const lineItems: FinancialLineItem[] = [
    { key: 'gross', label: 'Food Gross Revenue', amount: grossAmount, type: 'INCOME' },
    { key: 'pkg_inflow', label: 'Packaging Fee Collected', amount: packagingFeeCollected, type: 'INCOME' },
    { key: 'discount', label: 'Restaurant Discount Burn', amount: discount, type: 'DEDUCTION' },
    {
      key: 'commission',
      label: `Platform Commission (${(params.commissionRate * 100).toFixed(0)}% base${settings.includeGstOnCommission ? ' + 18% GST' : ''})`,
      amount: commissionAmount,
      type: 'DEDUCTION',
      description: settings.includeGstOnCommission 
        ? `₹${baseCommission.toFixed(2)} base fee + ₹${gstOnCommission.toFixed(2)} GST (18%)` 
        : undefined
    },
    { key: 'bom', label: 'Raw Ingredient Cost (BOM)', amount: ingredientCost, type: 'DEDUCTION' },
    { key: 'pkg_cost', label: 'Packaging Material & Box Cost', amount: packagingCost, type: 'DEDUCTION' },
  ];

  if (settings.includeGstInDeduction) {
    lineItems.push({ key: 'gst', label: '5% Food GST (Remitted by Kitchen)', amount: taxes, type: 'DEDUCTION' });
  } else {
    lineItems.push({ key: 'gst_info', label: '5% Food GST (Section 9(5) Remitted by Platform)', amount: taxes, type: 'INCOME', description: 'Remitted directly by Swiggy/Zomato' });
  }

  lineItems.push({
    key: 'net_contribution',
    label: 'Net Contribution Margin',
    amount: netContribution,
    type: 'NET',
  });

  return {
    financials: {
      grossAmount,
      packagingFeeCollected,
      discount,
      commissionRate: params.commissionRate,
      commissionAmount,
      taxes,
      ingredientCost,
      packagingCost,
      netMargin: netContribution,
      netMarginPercentage,
    },
    lineItems,
  };
}
