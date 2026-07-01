"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/properties",
    label: "Properties",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="9" y1="16" x2="9" y2="16" />
        <line x1="12" y1="16" x2="12" y2="16" />
        <line x1="15" y1="16" x2="15" y2="16" />
      </svg>
    ),
  },
  {
    href: "/dashboard/guests",
    label: "Guests",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/dashboard/financials",
    label: "Financials",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ical",
    label: "iCal Sync",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },

  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("integrio_user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  async function handleLogout() {
    localStorage.removeItem("integrio_user");
    document.cookie = "auth-token=; path=/; max-age=0";
    window.location.href = "/login";
  }

  return (
    <div className="dash-root">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <img src="/darktrans.png" alt="Integrio" className="logo-img" />
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {isActive && <span className="nav-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="user-details">
              <p className="user-name">{user?.name || "Admin"}</p>
              <p className="user-role">{user?.role || "ADMIN"}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn" title="Logout">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-wrap">
        {/* Top header */}
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="topbar-title">
            {navItems.find((i) => i.href === pathname)?.label || "Dashboard"}
          </div>

          <div className="topbar-right">
            <div className="topbar-date">
              {new Date().toLocaleDateString("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content">{children}</main>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .dash-root {
          display: flex;
          min-height: 100vh;
          background: var(--background);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 260px;
          min-height: 100vh;
          background: var(--sidebar);
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0; top: 0; bottom: 0;
          z-index: 100;
          box-shadow: 4px 0 24px rgba(0,0,0,0.15);
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        .sidebar-logo {
        padding: 20px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          justify-content: center;
          display: flex;
        }

        .logo-img {
          width: 180px;
          object-fit: contain;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: 10px;
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          position: relative;
          cursor: pointer;
        }

        .nav-item:hover {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.9);
        }

        .nav-item.active {
          background: linear-gradient(135deg, rgba(32,178,170,0.2), rgba(32,178,170,0.1));
          color: #4ecdc4;
          font-weight: 600;
        }

        .nav-icon {
          width: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-indicator {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: linear-gradient(to bottom, #4ecdc4, #2cb5b0);
          border-radius: 2px 0 0 2px;
        }

        .sidebar-footer {
          padding: 16px 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4ecdc4, #2196f3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }

        .user-details { min-width: 0; }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: #f0ece4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .logout-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .logout-btn:hover {
          background: rgba(231,76,60,0.15);
          border-color: rgba(231,76,60,0.3);
          color: #e74c3c;
        }

        /* ── MAIN ── */
        .main-wrap {
          flex: 1;
          margin-left: 260px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .topbar {
          height: 64px;
          background: var(--background);
          border-bottom: 1px solid #e8edf3;
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 1px 8px rgba(0,0,0,0.06);
        }

        .menu-btn {
          display: none;
          width: 36px;
          height: 36px;
          border: none;
          background: none;
          color: var(--brand-text);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .menu-btn:hover { background: var(--popover); }

        .topbar-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--brand-text);
          flex: 1;
        }

        .topbar-date {
          font-size: 13px;
          color: var(--brand-text);
          font-weight: 500;
        }

        .main-content {
          flex: 1;
          padding: 28px;
          overflow-y: auto;
        }

        .overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 99;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .main-wrap {
            margin-left: 0;
          }
          .menu-btn {
            display: flex;
          }
          .overlay {
            display: block;
          }
          .main-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
