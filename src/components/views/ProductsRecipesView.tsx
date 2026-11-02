import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatINR, formatPercent, formatNumber } from '../../utils/formatters';
import {
  Layers,
  Search,
  Package,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  Info
} from 'lucide-react';

export const ProductsRecipesView: React.FC = () => {
  const { data, defaultCOGS } = useDashboard();
  const { baseProducts, recipes, unitEconomics } = data;

  const [selectedBaseKey, setSelectedBaseKey] = useState<string>('K100');
  const [productSearch, setProductSearch] = useState<string>('');

  // Landed cost is the flat per-unit cost the P&L uses, times the units in the bundle, so this table
  // and the P&L cannot disagree. The sheet's own landed costs are not used until finance supplies real ones.
  const unitsInBundle = (key: string): number | null => {
    if (key === 'DEFAULT') return 1;
    const parts = recipes.find(r => r.code === `AV-${key.replace('+', '-')}`)?.parts;
    return parts ? Object.values(parts).reduce((sum, n) => sum + n, 0) : null;
  };
  const economics = Object.entries(unitEconomics).map(([key, item]) => {
    const units = unitsInBundle(key);
    if (units === null) return { key, item, units, flat: false };
    // The baseline row is already the flat assumption, with its own profit figures: leave it as it is.
    if (key === 'DEFAULT') return { key, item, units, flat: true };
    const cogs = units * defaultCOGS;
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

  const selectedBase = baseProducts.find(bp => bp.key === selectedBaseKey) || baseProducts[0];
  const containingListings = recipes.filter(r => r.parts && r.parts[selectedBaseKey]);

  const filteredBaseProducts = baseProducts.filter(bp =>
    bp.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    bp.key.toLowerCase().includes(productSearch.toLowerCase()) ||
    bp.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner: Explaining the Recipe Engine */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-orange-900 text-white rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5" />
              Formula & Recipe Deconstruction Engine
            </span>
            <h2 className="text-lg font-bold text-white">{baseProducts.length} Base Products, {recipes.length} Sample Recipes Loaded</h2>
            <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
              Combos consume their component base products. Click any base product below to see the listings (singles, packs, combos) that draw from its stock. The stock desk holds 190 recipes in full; only a sample of them is loaded here.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/20 text-xs">
            <span className="text-amber-200 block text-[10px] uppercase font-bold">Loaded:</span>
            <span className="text-xl font-bold font-mono">{baseProducts.length} Base • {recipes.length} of 190 Recipes</span>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <SectionSourceBadge 
            source="Stock desk recipe database (190 listing recipes; a sample is loaded here)"
            className="bg-black/20 text-amber-100 border-white/10"
          />
        </div>
      </div>

      {/* Unit Economics & Margin Trap Alert (from Sheet31) */}
      <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rose-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Unit Economic Margin Traps & RTO Impact (Sheet31 Audit)</h3>
              <p className="text-xs text-slate-500">
                Landed cost at the flat ₹{defaultCOGS} per unit used across the dashboard, plus shipping, Meta acquisition CAC and the RTO penalty per order.
              </p>
            </div>
          </div>
          <SectionSourceBadge 
            source="Shan's report sheet, tab Sheet31 (shipping, CAC and RTO). Landed cost is the flat ₹125 per unit."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Product / Combo Bundle</th>
                <th className="py-2.5 px-3 text-right">Selling Price</th>
                <th className="py-2.5 px-3 text-right">Landed COGS</th>
                <th className="py-2.5 px-3 text-right">Shipping</th>
                <th className="py-2.5 px-3 text-right">Meta CAC</th>
                <th className="py-2.5 px-3 text-right">RTO Cost</th>
                <th className="py-2.5 px-3 text-right">Profit (Without RTO)</th>
                <th className="py-2.5 px-3 text-right">Profit (With Real RTO)</th>
                <th className="py-2.5 px-3">Margin Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {economics.map(({ key, item, units, flat }) => (
                <tr key={key} className={`hover:bg-slate-50 transition-colors ${item.netProfitWithRTO < 0 ? 'bg-rose-50/50' : ''}`}>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <span className="font-mono text-amber-800 mr-2 text-[11px] font-bold">{key}</span>
                    {item.name}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">{formatINR(item.sellingPrice)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {formatINR(item.cogs)}
                    {flat && units !== null && (
                      <span className="block text-[10px] font-normal text-slate-400">
                        {units} × ₹{defaultCOGS}
                      </span>
                    )}
                    {!flat && <span className="block text-[10px] font-normal text-amber-700">sheet figure</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(item.shipping)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(item.metaCAC)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600">{formatINR(item.rtoCost)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                    {formatINR(item.netProfitWithoutRTO)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-extrabold">
                    <span className={item.netProfitWithRTO < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {formatINR(item.netProfitWithRTO)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      item.netProfitWithRTO < 0 ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold' :
                      item.netProfitWithRTO < 10 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {item.netProfitWithRTO < 0
                        ? `Losing ${formatINR(-item.netProfitWithRTO)} per order`
                        : item.netProfitWithRTO < 10
                          ? `Thin margin (${formatINR(item.netProfitWithRTO)} per order)`
                          : 'Healthy'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Base Product Explorer & Linked Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 43 Base Products List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">43 Base Products Catalog</h3>
              <span className="text-[11px] text-slate-500 font-mono">Select to explode</span>
            </div>

            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search base products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredBaseProducts.map((bp) => {
                const active = bp.key === selectedBaseKey;
                return (
                  <button
                    key={bp.key}
                    onClick={() => setSelectedBaseKey(bp.key)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                      active
                        ? 'bg-amber-50 border border-amber-300 font-bold text-amber-950 shadow-2xs'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        active ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {bp.key}
                      </span>
                      <span className="truncate">{bp.name}</span>
                    </div>
                    {bp.hero && (
                      <span className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded-full ml-1">
                        HERO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge source="Auravedic Base Products Registry (Context Handbook Appendix B)" />
          </div>
        </div>

        {/* Right: Deconstruction & Linked Combo Listings */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    {selectedBase.key}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">{selectedBase.name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Category: {selectedBase.category} • MRP: ₹{selectedBase.mrp} <span className="text-amber-700">(placeholder)</span> • Landed cost: not provided yet (P&L assumes a flat ₹{defaultCOGS} per unit)
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Listings Consuming This Product:</span>
                <span className="text-base font-bold text-amber-700 font-mono">{containingListings.length} Listings</span>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-700 mb-3">
              Finished SKUs, Combos & Packs Drawing From This Inventory:
            </div>

            <div className="space-y-3">
              {containingListings.map((listing, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 text-[11px]">{listing.code}</span>
                      <span className="font-semibold text-slate-900 text-xs">{listing.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>Channel: <strong className="text-slate-700">{listing.channel}</strong></span>
                      <span>•</span>
                      <span>Type: <strong className="text-slate-700">{listing.type === 'S' ? 'Single' : listing.type === 'C' ? 'Combo Bundle' : 'Pack'}</strong></span>
                      <span>•</span>
                      <span>Selling Price: <strong className="text-slate-700">₹{listing.sellingPrice}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right text-[11px]">
                      <span className="text-slate-500 block">Recipe Parts:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {Object.entries(listing.parts).map(([k, q]) => `${q}x ${k}`).join(' + ')}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Consumes {listing.parts[selectedBaseKey]} unit(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge source="Stock desk combo formulas (how each combo splits into base products)" />
          </div>
        </div>
      </div>
    </div>
  );
};
