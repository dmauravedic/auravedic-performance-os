import React from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { FreshnessStrip } from './components/layout/FreshnessStrip';
import { StaleBanner } from './components/layout/StaleBanner';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ActionsView } from './components/views/ActionsView';
import { ExecutiveSummaryView } from './components/views/ExecutiveSummaryView';
import { ProfitLossView } from './components/views/ProfitLossView';
import { AdvertisingView } from './components/views/AdvertisingView';
import { ShopifyStoreView } from './components/views/ShopifyStoreView';
import { MarketplacesView } from './components/views/MarketplacesView';
import { ProductsRecipesView } from './components/views/ProductsRecipesView';
import { InventoryOpsView } from './components/views/InventoryOpsView';
import { DataHealthIngestionView } from './components/views/DataHealthIngestionView';

const DashboardContent: React.FC = () => {
  const { currentView } = useDashboard();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* 1. Real-Time Freshness Strip */}
      <FreshnessStrip />
      <StaleBanner />

      {/* 2. Global Header */}
      <Header />

      {/* 3. Main Dashboard Body (Sidebar + Scrollable View) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          {currentView === 'actions' && <ActionsView />}
          {currentView === 'executive' && <ExecutiveSummaryView />}
          {currentView === 'pnl' && <ProfitLossView />}
          {currentView === 'advertising' && <AdvertisingView />}
          {currentView === 'shopify' && <ShopifyStoreView />}
          {currentView === 'marketplaces' && <MarketplacesView />}
          {currentView === 'products' && <ProductsRecipesView />}
          {currentView === 'inventory' && <InventoryOpsView />}
          {currentView === 'data-health' && <DataHealthIngestionView />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
};

export default App;
