"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

type NavLink = {
  href: string;
  label: string;
  icon: ReactNode;
};

const iconClass = "h-4 w-4";

const links: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M4 13h7V4H4v9zm9 7h7V4h-7v16zM4 20h7v-5H4v5z" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M6 8a3 3 0 116 0 3 3 0 01-6 0zm10 1a2.5 2.5 0 110-5 2.5 2.5 0 010 5zM3 19a6 6 0 0112 0m1 0c.4-2.3 2.4-4 4.8-4" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/workouts",
    label: "Workouts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M3 10h3v4H3v-4zm15 0h3v4h-3v-4zM8 9h8v6H8V9z" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/exercises",
    label: "Exercises",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 3l8 5v8l-8 5-8-5V8l8-5z" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/programs/templates",
    label: "Templates",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M6 4h12v16H6V4zm3 4h6M9 12h6" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/programs/generator",
    label: "Generator",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M4 12h16M12 4l8 8-8 8" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/nutrition",
    label: "Nutrition",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M7 3c3 2 3 6 0 9-2 2-2 6 0 9m10-18c-3 2-3 6 0 9 2 2 2 6 0 9" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/messages",
    label: "Messages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M4 5h16v10H7l-3 3V5z" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/checkins",
    label: "Check-ins",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M6 3h12v18H6V3zm3 5l2 2 4-4" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/settings/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/settings/password",
    label: "Security",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/admin/users",
    label: "Admin Users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200/80 bg-white/85 p-5 backdrop-blur lg:block">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-white shadow-lg shadow-blue-200">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} className="border border-white/30" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-50">Able Fitness</p>
            <h2 className="text-2xl font-bold">Coach Console</h2>
          </div>
        </div>
        <p className="mt-1 text-sm text-blue-50">Programs, progress, and accountability in one place.</p>
      </div>

      <nav className="space-y-1.5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
