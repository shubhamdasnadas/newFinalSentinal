"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect old admin path to new organizations page
export default function OldAdminOrgsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/organizations"); }, [router]);
  return null;
}
