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
    lastS1SyncedAt?: Date | null;
    lastFirewallSyncedAt?: Date | null;
}

const DashboardContext = createContext<DashboardData>({});

export function DashboardProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [data, setData] = useState<DashboardData>({});

    const fetchCredentials = async () => {
        console.log("[Dashboard] Fetching credentials...", new Date().toLocaleTimeString());
        try {
            const [sentinel, harmony, firewall] = await Promise.all([
                fetch("/api/sentinelone/credentials").then((r) => r.json()),
                fetch("/api/harmony/credentials").then((r) => r.json()),
                fetch("/api/firewall/credentials").then((r) => r.json()),
            ]);
            console.log("[Dashboard] Credentials fetched — S1 tokenKey present:", !!sentinel?.tokenKey, "| Harmony token present:", !!harmony?.token, "| Firewall baseUrl present:", !!firewall?.baseUrl);
            setData((prev) => ({ ...prev, sentinel, harmony, firewall }));
            return { sentinel, harmony, firewall };
        } catch (error) {
            console.error("[Dashboard] Credential fetch failed:", error);
            return null;
        }
    };

    const syncAndRefresh = async () => {
        console.log("[Dashboard] Starting sync cycle...", new Date().toLocaleTimeString());
        const creds = await fetchCredentials();
        if (!creds) return;

        const [s1Result, harmonyResult, firewallResult] = await Promise.allSettled([
            creds.sentinel?.tokenKey
                ? fetch("/api/sentinelone/sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tokenKey: creds.sentinel.tokenKey }),
                  }).then((r) => r.json())
                : Promise.resolve("skipped — no S1 tokenKey"),
            creds.harmony?.token
                ? fetch("/api/harmony/sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token: creds.harmony.token }),
                  }).then((r) => r.json())
                : Promise.resolve("skipped — no Harmony token"),
            creds.firewall?.baseUrl
                ? fetch("/api/firewall/collect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                  }).then((r) => r.json())
                : Promise.resolve("skipped — no firewall credentials"),
        ]);

        console.log("[Dashboard] SentinelOne sync:", s1Result.status === "fulfilled" ? s1Result.value : s1Result.reason);
        console.log("[Dashboard] Harmony sync:", harmonyResult.status === "fulfilled" ? harmonyResult.value : harmonyResult.reason);
        console.log("[Dashboard] Firewall collect:", firewallResult.status === "fulfilled" ? firewallResult.value : firewallResult.reason);

        const now = new Date();
        if (s1Result.status === "fulfilled" && typeof s1Result.value !== "string") {
            setData((prev) => ({ ...prev, lastS1SyncedAt: now }));
        }
        if (firewallResult.status === "fulfilled" && typeof firewallResult.value !== "string") {
            setData((prev) => ({ ...prev, lastFirewallSyncedAt: now }));
        }

        console.log("[Dashboard] Sync cycle complete.", new Date().toLocaleTimeString());
    };

    useEffect(() => {
        syncAndRefresh();
        const syncInterval = setInterval(() => {
            console.log("[Dashboard] 15-min interval fired.", new Date().toLocaleTimeString());
            syncAndRefresh();
        }, 5 * 60 * 1000);
        const credInterval = setInterval(fetchCredentials, 5*60_000);

        return () => {
            clearInterval(syncInterval);
            clearInterval(credInterval);
        };
    }, []);

    return (
        <DashboardContext.Provider value={data}>
            {children}
        </DashboardContext.Provider>
    );
}

export const useDashboardData = () => useContext(DashboardContext);