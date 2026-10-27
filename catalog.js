/**
 * Product catalog for all Be Management Tools.
 * Prices in ARS (Mercado Pago Argentina charges in ARS). Edit freely; the apps read this through /api/catalog.
 * `app` keys must match APP_CONFIG.PAYMENTS.app in each app's config.js.
 */
const APPS = {
  quickinvoice:   { title: 'QuickInvoice Pro',       ars: 14900, url: 'https://quickinvoice-tool.vercel.app' },
  ratecalc:       { title: 'RateCalc Pro',           ars: 9900,  url: 'https://ratecalc-tool.vercel.app' },
  qrforge:        { title: 'QRForge Pro',            ars: 9900,  url: 'https://qrforge-tool.vercel.app' },
  squish:         { title: 'Squish Pro',             ars: 9900,  url: 'https://squish-tool.vercel.app' },
  growthcalc:     { title: 'GrowthCalc Pro',         ars: 9900,  url: 'https://growthcalc-tool.vercel.app' },
  subnetkit:      { title: 'SubnetKit Pro',          ars: 14900, url: 'https://subnetkit-tool.vercel.app' },
  shotstudio:     { title: 'Screenshot Studio Pro',  ars: 9900,  url: 'https://shotstudio-tool.vercel.app' },
  mockuplab:      { title: 'Social Mockup Lab Pro',  ars: 9900,  url: 'https://mockuplab-tool.vercel.app' },
  carouselmaker:  { title: 'Carousel Maker Pro',     ars: 14900, url: 'https://carouselmaker-tool.vercel.app' },
  creativeresize: { title: 'Creative Resize Pro',    ars: 9900,  url: 'https://creativeresize-tool.vercel.app' },
  framelab:       { title: 'Frame Lab Pro',          ars: 9900,  url: 'https://framelab-tool.vercel.app' },
  sizeconverter:  { title: 'Size Converter Pro',     ars: 9900,  url: 'https://sizeconverter-tool.vercel.app' },
  giveaway:       { title: 'Giveaway Picker Pro',    ars: 9900,  url: 'https://giveaway-tool.vercel.app' },
  iplookup:       { title: 'IP Lookup Pro',          ars: 9900,  url: 'https://iplookup-tool.vercel.app' },
};

// One-time bundle: unlocks every app (license app = "all")
const BUNDLE = { title: 'Be Management Tools – All apps (lifetime)', ars: 49900 };

// Monthly subscription (Mercado Pago preapproval): unlocks every app while active
const SUBSCRIPTION = { title: 'Be Management Tools – Creative Pro (monthly)', ars: 7900, frequency: 1, frequency_type: 'months' };

const CURRENCY = 'ARS';

module.exports = { APPS, BUNDLE, SUBSCRIPTION, CURRENCY };
