"use client";

import Image from "next/image";
import Link from "next/link";

export function Header({ dark = false }: { dark?: boolean }) {
  return (
    <header className="fixed top-0 left-0 z-30 px-4 py-3">
      <Link href="/" className="flex items-center gap-2 w-fit">
        <Image src="/secondme-logo.svg" alt="Second Me" width={28} height={28} />
        <span className={`text-xs font-medium ${dark ? "text-[#FFF8F0]/40" : "text-[#3D2C1E]/35"}`}>
          分身篝火会
        </span>
      </Link>
    </header>
  );
}
