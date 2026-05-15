"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in via cookie (server will redirect if not)
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
    </div>
  );
}
