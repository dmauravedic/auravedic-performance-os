import React, { createContext, useContext, useState, ReactNode } from 'react';
import { initialDashboardData, DashboardDataBundle, AmazonASINItem, UnitEconomicItem } from '../data/initialData';
import { MARKETPLACE_COGS_PCT } from '../data/assumptions';

export type TimePeriod = 'yesterday' | '7d' | '14d' | '30d' | 'mtd' | 'all';
export type ChannelFilter = 'all' | 'shopify' | 'amazon' | 'flipkart' | 'nykaa' | 'myntra';
export type DashboardView =
  | 'actions'
  | 'executive'
  | 'pnl'
  | 'advertising'
  | 'shopify'
  | 'marketplaces'
  | 'products'
  | 'inventory'
  | 'data-health';

interface DashboardContextType {
  data: DashboardDataBundle;
  period: TimePeriod;
  setPeriod: (period: TimePeriod) => void;
  channel: ChannelFilter;
  setChannel: (channel: ChannelFilter) => void;
  currentView: DashboardView;
  setCurrentView: (view: DashboardView) => void;
  
  // Dynamic assumptions
  defaultCOGS: number;
  setDefaultCOGS: (val: number) => void;
  /** COGS for marketplace channels (Amazon, Flipkart, Nykaa, Myntra), as a % of their sales. */
  marketplaceCOGSPct: number;
  setMarketplaceCOGSPct: (val: number) => void;
  flatShipping: number;
  setFlatShipping: (val: number) => void;
  monthlyRevenueTarget: number;
  setMonthlyRevenueTarget: (val: number) => void;

  // Actions
  updateAmazonData: (newData: AmazonASINItem[]) => void;
  updateUnitEconomics: (key: string, item: UnitEconomicItem) => void;
  resetToDefaults: () => void;
  loadCustomBundle: (bundle: DashboardDataBundle) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DashboardDataBundle>(initialDashboardData);
  const [period, setPeriod] = useState<TimePeriod>('mtd');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [currentView, setCurrentView] = useState<DashboardView>('actions');

  // Operational assumptions
  const [defaultCOGS, setDefaultCOGS] = useState<number>(125);
  const [marketplaceCOGSPct, setMarketplaceCOGSPct] = useState<number>(MARKETPLACE_COGS_PCT.default);
  const [flatShipping, setFlatShipping] = useState<number>(65);
  const [monthlyRevenueTarget, setMonthlyRevenueTarget] = useState<number>(6500000); // ₹65L target

  const updateAmazonData = (newData: AmazonASINItem[]) => {
    setData(prev => ({
      ...prev,
      amazonBusinessData: newData
    }));
  };

  const updateUnitEconomics = (key: string, item: UnitEconomicItem) => {
    setData(prev => ({
      ...prev,
      unitEconomics: {
        ...prev.unitEconomics,
        [key]: item
      }
    }));
  };

  const resetToDefaults = () => {
    setData(initialDashboardData);
    setDefaultCOGS(125);
    setMarketplaceCOGSPct(MARKETPLACE_COGS_PCT.default);
    setFlatShipping(65);
    setMonthlyRevenueTarget(6500000);
  };

  const loadCustomBundle = (bundle: DashboardDataBundle) => {
    setData(bundle);
  };

  return (
    <DashboardContext.Provider value={{
      data,
      period,
      setPeriod,
      channel,
      setChannel,
      currentView,
      setCurrentView,
      defaultCOGS,
      setDefaultCOGS,
      marketplaceCOGSPct,
      setMarketplaceCOGSPct,
      flatShipping,
      setFlatShipping,
      monthlyRevenueTarget,
      setMonthlyRevenueTarget,
      updateAmazonData,
      updateUnitEconomics,
      resetToDefaults,
      loadCustomBundle
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export function useDashboard(): DashboardContextType {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return ctx;
}
