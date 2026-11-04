import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { buildActionPlan, type ActionPlan } from './actions';
import { useNow } from './freshness';
import { dailyRecords } from '../data/dailyData';
import { lastReportedDays } from './coverage';

/** The action plan for the dashboard's current data, assumptions and clock. */
export function useActionPlan(): ActionPlan {
  const { data, defaultCOGS, flatShipping, marketplaceCOGSPct } = useDashboard();
  const now = useNow();
  return useMemo(
    () =>
      buildActionPlan({
        data,
        // The newest 7 days the store's sales and ads are all reported for: the rules weigh spend
        // against Shopify sales, so a day without one of them would read as a collapse. When those days
        // are old, the cards already carry the "Old data" note from the freshness checks.
        slice: lastReportedDays(dailyRecords, ['shopify', 'meta', 'google'], 7),
        recent: dailyRecords.slice(-14),
        now,
        cogsPerUnit: defaultCOGS,
        shippingPerOrder: flatShipping,
        marketplaceCogsPct: marketplaceCOGSPct
      }),
    [data, defaultCOGS, flatShipping, marketplaceCOGSPct, now]
  );
}
