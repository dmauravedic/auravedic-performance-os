import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { buildActionPlan, type ActionPlan } from './actions';
import { useNow } from './freshness';
import { resolvePeriod } from './periods';

/** The action plan for the dashboard's current data, assumptions and clock. */
export function useActionPlan(): ActionPlan {
  const { data, defaultCOGS, flatShipping, marketplaceCOGSPct } = useDashboard();
  const now = useNow();
  return useMemo(
    () =>
      buildActionPlan({
        data,
        slice: resolvePeriod('7d').current,
        now,
        cogsPerUnit: defaultCOGS,
        shippingPerOrder: flatShipping,
        marketplaceCogsPct: marketplaceCOGSPct
      }),
    [data, defaultCOGS, flatShipping, marketplaceCOGSPct, now]
  );
}
