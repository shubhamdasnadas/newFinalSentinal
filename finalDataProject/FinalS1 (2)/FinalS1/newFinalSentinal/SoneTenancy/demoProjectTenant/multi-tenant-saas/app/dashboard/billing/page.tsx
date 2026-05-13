"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Invoice {
  id: string;
  invoice_ref?: string;
  amount: number;
  date: string;
  status: string;
}

interface Billing {
  plan: string;
  amount: number;
  currency: string;
  status: string;
  invoices?: Invoice[];
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    features: ["5 members", "3 projects", "Basic reports", "Email support"],
    color: "border-gray-200 dark:border-gray-700",
    badge: "",
  },
  {
    id: "starter",
    name: "Starter",
    price: 29,
    features: ["25 members", "10 projects", "Advanced reports", "Analytics", "Priority support"],
    color: "border-sky-200 dark:border-sky-800",
    badge: "",
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    features: ["100 members", "Unlimited projects", "All reports", "Analytics", "API access", "SLA"],
    color: "border-indigo-500",
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 299,
    features: ["Unlimited members", "Custom reports", "Dedicated support", "Custom SLA", "Custom integrations", "On-premise option"],
    color: "border-violet-500",
    badge: "Best Value",
  },
];

export default function BillingPage() {
  const { user, activeOrgSlug, activeOrgName } = useAuth();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "org_admin";

  useEffect(() => {
    if (!activeOrgSlug) { setLoading(false); return; }
    fetch("/api/billing", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBilling(d.billing))
      .finally(() => setLoading(false));
  }, [activeOrgSlug]);

  const changePlan = async (planId: string) => {
    if (!canManage) return;
    setSaving(true);
    const plan = PLANS.find((p) => p.id === planId);
    const res = await fetch("/api/billing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan: planId, amount: plan?.price || 0 }),
    });
    const data = await res.json();
    if (data.billing) setBilling(data.billing);
    setSaving(false);
  };

  if (!activeOrgSlug) return (
    <div className="p-8">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
      </div>
    </div>
  );

  const currentPlan = PLANS.find((p) => p.id === billing?.plan);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Billing</h1>
        <p className="text-[var(--muted)] text-sm mt-1">{activeOrgName}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Current subscription */}
          {billing && (
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 mb-6">
              <h3 className="font-semibold text-[var(--foreground)] mb-4">Current Subscription</h3>
              <div className="flex items-center gap-8 flex-wrap">
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Plan</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 capitalize">{billing.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Amount</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {billing.currency === "INR" ? "₹" : "$"}{billing.amount}
                    <span className="text-sm font-normal text-[var(--muted)]">/mo</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${
                    billing.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${billing.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                    {billing.status}
                  </span>
                </div>
                {currentPlan && (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Features</p>
                    <p className="text-sm text-[var(--foreground)]">{currentPlan.features.length} features included</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plans */}
          <h3 className="font-semibold text-[var(--foreground)] mb-4">
            {canManage ? "Change Plan" : "Available Plans"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {PLANS.map((plan) => {
              const isCurrent = billing?.plan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`bg-[var(--card-bg)] rounded-2xl border-2 p-6 transition-all relative ${
                    isCurrent ? plan.color + " shadow-md" : "border-[var(--card-border)]"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      {plan.badge}
                    </span>
                  )}
                  <h4 className="font-bold text-[var(--foreground)] text-lg">{plan.name}</h4>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                    ${plan.price}
                    <span className="text-sm font-normal text-[var(--muted)]">/mo</span>
                  </p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {canManage && !isCurrent ? (
                    <button
                      onClick={() => changePlan(plan.id)}
                      disabled={saving}
                      className="w-full mt-5 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Updating..." : `Switch to ${plan.name}`}
                    </button>
                  ) : isCurrent ? (
                    <div className="w-full mt-5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-2.5 rounded-xl text-center text-sm font-semibold">
                      ✓ Current Plan
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Invoice history */}
          {billing?.invoices && billing.invoices.length > 0 && (
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--card-border)]">
                <h3 className="font-semibold text-[var(--foreground)]">Invoice History</h3>
              </div>
              <table className="w-full">
                <thead className="bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Invoice</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden sm:table-cell">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {billing.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[var(--muted-bg)] transition-colors">
                      <td className="px-6 py-3.5 text-sm font-mono text-[var(--foreground)]">
                        {inv.invoice_ref || inv.id}
                      </td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-[var(--foreground)]">
                        {billing.currency === "INR" ? "₹" : "$"}{inv.amount}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-[var(--muted)] hidden sm:table-cell">
                        {inv.date ? new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          inv.status === "paid"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
