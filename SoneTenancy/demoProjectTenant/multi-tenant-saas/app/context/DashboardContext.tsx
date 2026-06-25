"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface DashboardData {
  sentinel?: any;
  harmony?: any;
  firewall?: any;
}

const DashboardContext = createContext<DashboardData>({});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData>({});

  // Fetch stored credentials once on mount so widgets can read them.
  // Syncing is now handled server-side by the cron job at /api/cron/sync —
  // the browser no longer triggers data pulls from external APIs.
  useEffect(() => {
    Promise.all([
      fetch("/api/sentinelone/credentials").then((r) => r.json()).catch(() => ({})),
      fetch("/api/harmony/credentials").then((r) => r.json()).catch(() => ({})),
      fetch("/api/firewall/credentials").then((r) => r.json()).catch(() => ({})),
    ]).then(([sentinel, harmony, firewall]) => {
      setData({ sentinel, harmony, firewall });
    });
  }, []);

  return (
    <DashboardContext.Provider value={data}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboardData = () => useContext(DashboardContext);
