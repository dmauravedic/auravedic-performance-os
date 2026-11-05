// Exports warehouse stock and daily demand from the nightly stock desk page as data/warehouse_stock.csv.
//
//   node scripts/stock_desk_export.cjs <stock desk index.html> > data/warehouse_stock.csv
//
// The stock desk (a Claude artifact, rebuilt every night at 23:00 IST from the Coimbatore and Mumbai
// sheets posted in Slack) works out each product's demand in its own page script: Shopify units with
// combos split into their products, plus marketplace demand inferred from stock that left a warehouse
// beyond its Shopify orders. Rather than copy that logic, this opens the saved page in headless
// Chromium with all network blocked and reads the figures the page computes, with marketplaces
// switched on and a 30-day basis (the page's defaults for planning).
//
// Columns: key, cbe_d2c, cbe_reserve, mumbai, cbe_asof, mumbai_asof, daily_rate, shopify_rate,
// marketplace_rate. Rates are units per day. Needs Playwright (preinstalled in the Claude workspace;
// elsewhere `npm i playwright`).
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/stock_desk_export.cjs <stock desk index.html>');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route(/^https?:/, r => r.abort()); // the saved page must not reach the network
  await page.goto('file://' + path.resolve(file), { waitUntil: 'load' });
  const out = await page.evaluate(() => {
    /* global state, derive, WH, SNAPS, asofOf */
    state.chan = 1;
    state.basis = 30;
    derive();
    const last = SNAPS[SNAPS.length - 1];
    return {
      cbe: asofOf(last, 'cbe'),
      mum: asofOf(last, 'mum'),
      rows: WH.map(r => [r.k, r.d2c, r.rsrv, r.mum, r.rate, r.shopRate, r.mkt])
    };
  });
  await browser.close();
  if (errors.length) {
    console.error('stock desk page errors: ' + errors.join(' | '));
    process.exit(1);
  }
  const n = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
  const lines = ['key,cbe_d2c,cbe_reserve,mumbai,cbe_asof,mumbai_asof,daily_rate,shopify_rate,marketplace_rate'];
  for (const [k, d2c, rsrv, mum, rate, shop, mkt] of out.rows.sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    lines.push([k, d2c, rsrv, mum, out.cbe, out.mum, n(rate), n(shop), n(mkt)].join(','));
  }
  process.stdout.write(lines.join('\n') + '\n');
})().catch(e => {
  console.error(String(e));
  process.exit(1);
});
