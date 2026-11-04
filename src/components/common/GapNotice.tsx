import React from 'react';
import { AlertBanner } from './AlertBanner';
import type { Gap } from '../../utils/coverage';

/**
 * Says which sources have not reported which days of the selected period. Figures on the page count
 * only the reported days (see utils/coverage.ts). When no day is complete there is nothing to show.
 */
export const GapNotice: React.FC<{ gap: Gap | null; className?: string }> = ({ gap, className = '' }) => {
  if (!gap) return null;
  return (
    <AlertBanner
      type="warning"
      className={className}
      title={gap.whole ? 'Not reported yet' : 'Some days are not reported yet'}
      message={
        gap.whole
          ? `${gap.text} There is nothing complete to show for this period yet: pick a longer period to see the days that are reported.`
          : `${gap.text} The figures below count only those days, and changes against the prior period are hidden.`
      }
    />
  );
};
