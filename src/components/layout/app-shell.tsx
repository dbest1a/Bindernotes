import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  Calculator,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MonitorCog,
  PenTool,
} from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn, initials } from "@/lib/utils";
import { defaultCustomPalette, workspaceThemes } from "@/lib/workspace-preferences";
import { LogoMark } from "@/components/ui/logo-mark";
import type { AppearanceCustomPalette } from "@/types";

export function AppShell() {
  const { profile, signOut, isConfigured } = useAuth();
  const { globalTheme, setCustomPalette, setThemeId, toggleMonochrome } = useTheme();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  const updateCustomColor = (key: keyof AppearanceCustomPalette, value: string) => {
    setCustomPalette({
      ...(globalTheme.customPalette ?? defaultCustomPalette),
      [key]: value,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3 font-semibold tracking-tight" to="/dashboard">
            <LogoMark />
            <div className="leading-none">
              <span className="block text-sm font-semibold tracking-tight">Binder Notes</span>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Study workspace
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-lg border border-border/70 bg-card/72 p-1 md:flex">
            <NavItem to="/dashboard" icon={<LayoutDashboard data-icon="inline-start" />}>
              Workspace
            </NavItem>
            <NavItem to="/math" icon={<Calculator data-icon="inline-start" />}>
              Math lab
            </NavItem>
            <NavItem to="/tutorial" icon={<BookOpenCheck data-icon="inline-start" />}>
              Tutorial
            </NavItem>
            {profile?.role === "admin" ? (
              <NavItem to="/admin" icon={<PenTool data-icon="inline-start" />}>
                Admin studio
              </NavItem>
            ) : null}
            <NavItem to="/pricing" icon={<GraduationCap data-icon="inline-start" />}>
              Pricing
            </NavItem>
          </nav>

          <div className="flex items-center gap-2">
            {!isConfigured ? <Badge variant="outline">Demo mode</Badge> : null}
            <label className="hidden h-10 items-center gap-2 rounded-lg border border-border/70 bg-card/72 px-3 text-sm text-foreground shadow-sm transition hover:bg-secondary xl:flex">
              <span className="text-xs font-medium text-muted-foreground">App theme</span>
              <select
                aria-label="App theme"
                className="appearance-select h-8 border-0 bg-transparent text-sm font-medium outline-none"
                onChange={(event) => setThemeId(event.target.value as typeof globalTheme.id)}
                value={globalTheme.id}
              >
                {workspaceThemes.map((workspaceTheme) => (
                  <option key={workspaceTheme.id} value={workspaceTheme.id}>
                    {workspaceTheme.name}
                  </option>
                ))}
              </select>
            </label>
            {globalTheme.id === "custom" ? (
              <div className="hidden items-center gap-1 rounded-lg border border-border/70 bg-card/72 px-2 py-1 shadow-sm 2xl:flex">
                {(["primary", "secondary", "accent"] as const).map((key) => (
                  <label className="grid gap-0.5 text-[10px] font-medium capitalize text-muted-foreground" key={key}>
                    <span>{key}</span>
                    <input
                      aria-label={`Custom ${key} color`}
                      className="size-6 rounded border border-border/80 bg-transparent p-0.5"
                      onChange={(event) => updateCustomColor(key, event.target.value)}
                      type="color"
                      value={(globalTheme.customPalette ?? defaultCustomPalette)[key]}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <Button
              aria-label="Toggle monochrome workspace"
              onClick={toggleMonochrome}
              size="icon"
              type="button"
              variant="ghost"
            >
              <MonitorCog data-icon="inline-start" />
            </Button>
            <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 xl:flex">
              <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
                {initials(profile?.full_name ?? "BN")}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium">{profile?.full_name ?? "Binder user"}</p>
                <p className="text-xs text-muted-foreground">{profile?.role ?? "learner"}</p>
              </div>
            </div>
            <Button onClick={logout} type="button" variant="ghost">
              <LogOut data-icon="inline-start" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function NavItem({
  children,
  icon,
  to,
}: {
  children: ReactNode;
  icon: ReactNode;
  to: string;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
          isActive && "bg-secondary text-foreground",
        )
      }
      to={to}
    >
      {icon}
      {children}
    </NavLink>
  );
}
