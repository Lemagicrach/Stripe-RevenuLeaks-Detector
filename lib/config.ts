// lib/config.ts
// Centralized app configuration toggles.

// Template mode: when enabled, the app behaves like a starter kit:
// - dashboard shows demo metrics by default
// - buyers can connect Stripe later to switch to real data
export const TEMPLATE_MODE = process.env.NEXT_PUBLIC_TEMPLATE_MODE === 'true';

// Default data mode for the current build.
// In template mode we default to demo for a frictionless first-run experience.
export const DEFAULT_DATA_MODE: 'demo' | 'real' = TEMPLATE_MODE ? 'demo' : 'real';
