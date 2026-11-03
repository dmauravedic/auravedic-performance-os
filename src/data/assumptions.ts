/**
 * Cost assumptions that stand in for real landed costs until finance supplies them.
 *
 * Shopify (D2C) is costed per unit (the flat `defaultCOGS`). Marketplaces (Amazon, Flipkart, Nykaa,
 * Myntra) are costed as a share of their sales: the owner's range is 25-30%, and the middle of it is
 * used unless the P&L assumption slider is moved.
 */
export const MARKETPLACE_COGS_PCT = {
  low: 25,
  high: 30,
  default: 27.5,
} as const;
