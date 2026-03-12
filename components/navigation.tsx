"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import type { Role } from "@/types/db";

type NavLink = {
  href: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
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
    roles: ["admin", "coach"],
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
    roles: ["admin", "coach"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M6 4h12v16H6V4zm3 4h6M9 12h6" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/programs/generator",
    label: "Generator",
    roles: ["admin", "coach"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M4 12h16M12 4l8 8-8 8" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/challenges",
    label: "Challenges",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path d="M12 2l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 15.6 6.7 18l1-5.8L3.5 8.2l5.9-.9L12 2z" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  },
  {
    href: "/habits",
    label: "Habits",
    roles: ["client"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 3l6 3v5c0 4-2.5 7-6 10-3.5-3-6-6-6-10V6l6-3zm-3 9l2 2 4-4" stroke="currentColor" strokeWidth="1.7"/></svg>
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
    href: "/settings/mfa",
    label: "2FA",
    roles: ["admin", "coach"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zm-2.5 9.5l2 2 3.5-4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  },
  {
    href: "/admin/users",
    label: "Admin Users",
    roles: ["admin"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/admin/security",
    label: "Security Log",
    roles: ["admin"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zm-3 8h6m-6 3h4" stroke="currentColor" strokeWidth="1.7"/></svg>
    )
  },
  {
    href: "/admin/security/settings",
    label: "Security Settings",
    roles: ["admin"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4l-2.1.8a7.8 7.8 0 01-.5 1.2l1 2-2 2-2-1c-.4.2-.8.3-1.2.5L12 21l-2.2-2.1c-.4-.1-.8-.3-1.2-.5l-2 1-2-2 1-2c-.2-.4-.3-.8-.5-1.2L3 12l2.1-2.2c.1-.4.3-.8.5-1.2l-1-2 2-2 2 1c.4-.2.8-.3 1.2-.5L12 3l2.2 2.1c.4.1.8.3 1.2.5l2-1 2 2-1 2c.2.4.3.8.5 1.2L21 12z" stroke="currentColor" strokeWidth="1.4"/></svg>
    )
  },
  {
    href: "/admin/security/operations",
    label: "Security Ops",
    roles: ["admin"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  },
  {
    href: "/community/moderation",
    label: "Moderation",
    roles: ["admin", "coach"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zm-3 9l2 2 4-4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  }
];

export function Navigation({ role, unreadMessages = 0 }: { role: Role; unreadMessages?: number }) {
  const pathname = usePathname();
  const title = role === "client" ? "Client Portal" : role === "admin" ? "Admin Console" : "Coach Console";
  const subtitle =
    role === "client"
      ? "Training, nutrition, and check-ins in one place."
      : "Programs, progress, and accountability in one place.";

  const visibleLinks = links.filter((link) => !link.roles || link.roles.includes(role));

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200/80 bg-white/85 p-5 backdrop-blur lg:block">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-white shadow-lg shadow-blue-200">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} className="border border-white/30" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-50">Able Fitness</p>
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
        </div>
        <p className="mt-1 text-sm text-blue-50">{subtitle}</p>
      </div>

      <nav className="space-y-1.5">
        {visibleLinks.map((link) => {
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
              {link.href === "/messages" && unreadMessages > 0 && (
                <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
