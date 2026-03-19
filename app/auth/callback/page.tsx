"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // The API route handles the callback and sets cookies, then redirects to /
    // This page is just a fallback if the redirect doesn't work
    const timer = setTimeout(() => router.push("/"), 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-[#9B5DE5]/60 animate-breathe mx-auto mb-4" />
        <p className="text-[#FFF8F0]/40 text-sm">登录中...</p>
      </div>
    </main>
  );
}
