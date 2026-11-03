import React from 'react';
import { useDashboard, DashboardView } from '../../context/DashboardContext';
import {
  LayoutDashboard,
  BadgePercent,
  Megaphone,
  ShoppingBag,
  Store,
  Layers,
  Boxes,
  Database,
  Sparkles,
  ShieldCheck,
  PackageCheck,
  ListChecks
} from 'lucide-react';
import { useActionPlan } from '../../utils/useActionPlan';

interface NavItem {
  id: DashboardView;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'slate';
}

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useDashboard();

  const plan = useActionPlan();

  const navItems: NavItem[] = [
    {
      id: 'actions',
      label: "Today's Actions",
      sublabel: 'What to do, in plain words',
      icon: <ListChecks className="w-4 h-4" />,
      badge: plan.counts.urgent > 0 ? `${plan.counts.urgent} urgent` : undefined,
      badgeColor: 'rose'
    },
    {
      id: 'executive',
      label: 'Executive Summary',
      sublabel: 'KPIs, mix & actions',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'pnl',
      label: 'Profit & Loss',
      sublabel: 'Dual P&L & waterfall',
      icon: <BadgePercent className="w-4 h-4" />,
      badge: 'Realistic',
      badgeColor: 'emerald'
    },
    {
      id: 'advertising',
      label: 'Advertising & ROAS',
      sublabel: 'Meta, Google, Amz, FKT',
      icon: <Megaphone className="w-4 h-4" />,
      badge: '5 Accounts',
      badgeColor: 'slate'
    },
    {
      id: 'shopify',
      label: 'Shopify D2C Store',
      sublabel: 'Funnel, COD & RTO',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      id: 'marketplaces',
      label: 'Marketplaces',
      sublabel: 'Amazon, Flipkart, Nykaa',
      icon: <Store className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Products & Recipes',
      sublabel: '43 Base & 190 Combos',
      icon: <Layers className="w-4 h-4" />,
      badge: 'Recipes',
      badgeColor: 'amber'
    },
    {
      id: 'inventory',
      label: 'Warehouse & Stock',
      sublabel: 'CBE, Mumbai & Cover',
      icon: <Boxes className="w-4 h-4" />,
      badge: '2 Alerts',
      badgeColor: 'rose'
    },
    {
      id: 'data-health',
      label: 'Data Health & Ingest',
      sublabel: 'Audit, upload & logs',
      icon: <Database className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 select-none min-h-[calc(100vh-65px)]">
      {/* Top: Navigation list */}
      <div className="p-3">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>Command Center</span>
        </div>

        <nav className="space-y-1 mt-1">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                  active
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`${active ? 'text-white' : 'text-slate-400'}`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs leading-none truncate">{item.label}</div>
                    <div className={`text-[10px] mt-1 truncate ${active ? 'text-amber-100' : 'text-slate-500'}`}>
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ml-2 ${
                    active ? 'bg-amber-700/80 text-white' :
                    item.badgeColor === 'emerald' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' :
                    item.badgeColor === 'amber' ? 'bg-amber-950 text-amber-400 border border-amber-800/60' :
                    item.badgeColor === 'rose' ? 'bg-rose-950 text-rose-400 border border-rose-800/60' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Operational Card & Golden Rules */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
            <span className="flex items-center gap-1.5 text-amber-400">
              <PackageCheck className="w-3.5 h-3.5" />
              Hero Product
            </span>
            <span className="text-[10px] text-slate-400 font-mono">K100</span>
          </div>
          <div className="text-[11px] text-slate-400">Kumkumadi Tailam 100ml</div>
          <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-700/60">
            <span className="text-slate-400">Total Stock (WH):</span>
            <span className="font-bold text-slate-200">7,190 units</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Days of Cover:</span>
            <span className="font-bold text-emerald-400">43.5 Days</span>
          </div>
        </div>

        <div className="px-2 py-1 flex items-center justify-between text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            IST Timezone • INR
          </span>
          <span>auravedic.com</span>
        </div>
      </div>
    </aside>
  );
};
