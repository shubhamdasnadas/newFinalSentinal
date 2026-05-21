"use client";

import { useState } from "react";

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  onAdd: (selected: string[]) => void;
  onCancel: () => void;
}

type S1ApiKey =
  | ""
  | "agentInfo"
  | "applicationAgent"
  | "applicationCVE"
  | "deviceControl"
  | "rss"
  | "threatCount"
  | "threats";

const S1_API_OPTIONS: { id: S1ApiKey; label: string; url: string }[] = [
  { id: "", label: "Select SentinelOne API", url: "" },
  {
    id: "agentInfo",
    label: "Agent Info",
    url: "/api/sentinelone/sentinalone_agentinfo",
  },
  {
    id: "applicationAgent",
    label: "Application Agent",
    url: "/api/sentinelone/sentinalone_applicationagent",
  },
  {
    id: "applicationCVE",
    label: "Application CVE",
    url: "/api/sentinelone/sentinalone_applicationCVE",
  },
  {
    id: "deviceControl",
    label: "Device Control",
    url: "/api/sentinelone/sentinalone_devicecontrol",
  },
  {
    id: "rss",
    label: "RSS",
    url: "/api/sentinelone/sentinalone_rss",
  },
  {
    id: "threatCount",
    label: "Threat Count",
    url: "/api/sentinelone/sentinalone_threatcount",
  },
  {
    id: "threats",
    label: "Threats",
    url: "/api/sentinelone/threats",
  },
];

export default function SentinelOneWidgetPicker({
  selected,
  onToggle,
  onAdd,
  onCancel,
}: Props) {
  const [selectedApi, setSelectedApi] = useState<S1ApiKey>("");
  const [loading, setLoading] = useState(false);

  const callSelectedApi = async (apiId: S1ApiKey) => {
    if (!apiId) return;

    const api = S1_API_OPTIONS.find((item) => item.id === apiId);
    if (!api || !api.url) return;

    try {
      setLoading(true);

      const response = await fetch(api.url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || `${api.label} API failed`);
      }

      console.log(`${api.label} Response:`, result);

      onToggle(api.id);
      onAdd([api.id]);
    } catch (error) {
      console.error(`${api.label} API Error:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const apiId = e.target.value as S1ApiKey;
    setSelectedApi(apiId);
    await callSelectedApi(apiId);
  };

  return (
    <div className="w-full">
      <select
        value={selectedApi}
        disabled={loading}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] text-sm outline-none"
      >
        {S1_API_OPTIONS.map((api) => (
          <option key={api.id || "default"} value={api.id}>
            {api.label}
          </option>
        ))}
      </select>
    </div>
  );
}