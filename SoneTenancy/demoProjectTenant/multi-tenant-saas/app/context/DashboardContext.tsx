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
    crowdstrike?: any;
    tenable?: any;
    harmony?: any;
    defender?: any;
}

const DashboardContext = createContext<DashboardData>({});

export function DashboardProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [data, setData] = useState<DashboardData>({});

    const refreshAll = async () => {
        try {
            const [
                sentinel,
                crowdstrike,
                tenable,
                harmony,
                defender,
            ] = await Promise.all([
                fetch("/api/sentinelone").then((r) => r.json()),
                fetch("/api/crowdstrike").then((r) => r.json()),
                fetch("/api/tenable").then((r) => r.json()),
                fetch("/api/harmony").then((r) => r.json()),
                fetch("/api/defender").then((r) => r.json()),
            ]);

            setData({
                sentinel,
                crowdstrike,
                tenable,
                harmony,
                defender,
            });
        } catch (error) {
            console.error("Dashboard refresh failed:", error);
        }
    };

    useEffect(() => {
        refreshAll();
        console.log("Refreshing dashboard data...", new Date());
        const interval = setInterval(refreshAll, 60000);

        return () => clearInterval(interval);
    }, []);

    return (
        <DashboardContext.Provider value={data}>
            {children}
        </DashboardContext.Provider>
    );
}

export const useDashboardData = () => useContext(DashboardContext);