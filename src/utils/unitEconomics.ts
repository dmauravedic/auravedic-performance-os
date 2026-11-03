import type { Recipe, UnitEconomicItem } from '../data/initialData';

export interface BundleEconomics {
  key: string;
  item: UnitEconomicItem;
  /** Units in the bundle, or null when its recipe is not loaded. */
  units: number | null;
  /** True when the row is costed at the flat per-unit assumption. */
  flat: boolean;
}

/**
 * Unit economics per bundle, with landed cost set to units x the flat per-unit cost the P&L uses, so
 * the Products table and the P&L cannot disagree. The sheet's own landed costs are not used until
 * finance supplies real ones.
 */
export function bundleEconomics(
  unitEconomics: Record<string, UnitEconomicItem>,
  recipes: Recipe[],
  cogsPerUnit: number
): BundleEconomics[] {
  const unitsInBundle = (key: string): number | null => {
    if (key === 'DEFAULT') return 1;
    const parts = recipes.find(r => r.code === `AV-${key.replace('+', '-')}`)?.parts;
    return parts ? Object.values(parts).reduce((sum, n) => sum + n, 0) : null;
  };

  return Object.entries(unitEconomics).map(([key, item]) => {
    const units = unitsInBundle(key);
    if (units === null) return { key, item, units, flat: false };
    // The baseline row is already the flat assumption, with its own profit figures: leave it as it is.
    if (key === 'DEFAULT') return { key, item, units, flat: true };
    const cogs = units * cogsPerUnit;
    const oldCost = item.cogs + item.shipping + item.metaCAC;
    const newCost = cogs + item.shipping + item.metaCAC;
    // RTO penalty grows with the order's cost, in the same proportion as in the sheet.
    const rtoCost = oldCost > 0 ? Math.round(item.rtoCost * (newCost / oldCost)) : item.rtoCost;
    const netProfitWithoutRTO = item.sellingPrice - newCost;
    const netProfitWithRTO = netProfitWithoutRTO - rtoCost;
    return {
      key,
      units,
      flat: true,
      item: { ...item, cogs, rtoCost, netProfitWithoutRTO, netProfitWithRTO }
    };
  });
}
