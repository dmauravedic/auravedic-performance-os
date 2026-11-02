import React from 'react';
import { Zap, Hand, Shuffle } from 'lucide-react';
import type { ChannelFilter } from '../../context/DashboardContext';
import { CHANNEL_FEED, FEED_NOTE } from '../../data/channelLatency';

const STYLE = {
  automated: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: Zap },
  mixed: { cls: 'bg-sky-50 text-sky-800 border-sky-200', Icon: Shuffle },
  manual: { cls: 'bg-amber-50 text-amber-900 border-amber-200', Icon: Hand }
} as const;

/**
 * Marks a channel as automated, manual, or both. The icon and the word carry the meaning, and the
 * tooltip spells out the route. Renders nothing for a channel with no recorded route.
 */
export const FeedBadge: React.FC<{ channel: ChannelFilter; showDetail?: boolean }> = ({ channel, showDetail = false }) => {
  const feed = CHANNEL_FEED[channel];
  if (!feed) return null;
  const { cls, Icon } = STYLE[feed.mode];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span
        title={`${feed.detail} ${FEED_NOTE}`}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${cls}`}
      >
        <Icon className="w-3 h-3" />
        {feed.label}
      </span>
      {showDetail && <span className="text-[11px] text-slate-500 font-normal">{feed.detail}</span>}
    </span>
  );
};
