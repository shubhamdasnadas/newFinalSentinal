"use client";

// Background data syncing is now handled server-side by the cron job at
// /api/cron/sync — called by an external scheduler every 15–30 minutes.
// This component is kept as a no-op so existing imports don't break.
export default function BackgroundSync() {
  return null;
}
