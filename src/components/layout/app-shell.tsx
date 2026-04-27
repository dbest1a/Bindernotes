import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  Calculator,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PenTool,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAdminMotionSettings } from "@/hooks/use-admin-motion";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn, initials } from "@/lib/utils";
import { workspaceThemes } from "@/lib/workspace-preferences";
import { LogoMark } from "@/components/ui/logo-mark";

export function AppShell() {
  const { profile, signOut } = useAuth();
  const { globalTheme, setThemeId } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const { prefersReducedMotion, resetSettings, settings, updateSettings } = useAdminMotionSettings(isAdmin);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [routeLanding, setRouteLanding] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setRouteLanding(false), 300);
    setRouteLanding(true);
    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const closeOnOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  return (
    <div
      className="min-h-screen bg-background"
      data-admin-motion={isAdmin && settings.enabled ? "on" : "off"}
      data-motion-intensity={settings.intensity}
      data-motion-speed={settings.speed}
      data-page-transition={isAdmin && settings.enabled ? settings.pageTransition : "off"}
      data-premium-color-mode={isAdmin && settings.enabled ? settings.colorMode : "off"}
      data-reduced-motion={prefersReducedMotion ? "system" : "none"}
    >
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
            <NavItem to="/math/lab" icon={<Calculator data-icon="inline-start" />}>
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
            <label className="hidden h-10 items-center gap-2 rounded-lg border border-border/70 bg-card/72 px-3 text-sm text-foreground shadow-sm transition hover:bg-secondary lg:flex">
              <span className="text-xs font-medium text-muted-foreground">Theme</span>
              <select
                aria-label="App theme"
                className="appearance-select h-8 max-w-[150px] border-0 bg-transparent text-sm font-semibold outline-none"
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
            <div className="relative hidden xl:block" ref={profileMenuRef}>
              <button
                className="admin-profile-trigger flex items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 text-left transition hover:bg-secondary"
                data-admin={isAdmin ? "true" : "false"}
                data-testid="profile-menu-button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                type="button"
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
                  {initials(profile?.full_name ?? "BN")}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-medium">{profile?.full_name ?? "Binder user"}</span>
                  <span className="block text-xs text-muted-foreground">{profile?.role ?? "learner"}</span>
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
              {profileMenuOpen ? (
                <div
                  className="admin-motion-popover absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
                  data-testid="profile-settings-popover"
                  role="dialog"
                >
                  <div className="flex items-start gap-3 rounded-md bg-secondary/60 p-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold">
                      {initials(profile?.full_name ?? "BN")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{profile?.full_name ?? "Binder user"}</p>
                      <p className="text-xs capitalize text-muted-foreground">{profile?.role ?? "learner"}</p>
                    </div>
                  </div>
                  {isAdmin ? (
                    <section className="mt-3 rounded-lg border border-border/80 p-3" data-testid="admin-motion-lab">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="size-4 text-cyan-300" />
                            Admin Motion Lab
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Premium motion and color polish for admin eyes only.
                          </p>
                        </div>
                        <button
                          aria-pressed={settings.enabled}
                          className="admin-motion-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                          data-testid="admin-motion-toggle"
                          onClick={() => updateSettings({ enabled: !settings.enabled })}
                          type="button"
                        >
                          <span className={settings.enabled ? "admin-motion-toggle__knob admin-motion-toggle__knob--on" : "admin-motion-toggle__knob"} />
                          <span className="sr-only">Enable premium animations</span>
                        </button>
                      </div>
                      {prefersReducedMotion ? (
                        <p className="mt-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
                          Your system reduced-motion setting is on, so premium motion stays paused.
                        </p>
                      ) : null}
                      <div className="mt-3 grid gap-2">
                        <AdminMotionSelect
                          label="Motion intensity"
                          onChange={(value) => updateSettings({ intensity: value as typeof settings.intensity })}
                          testId="admin-motion-intensity"
                          value={settings.intensity}
                          values={["subtle", "full", "party"]}
                        />
                        <AdminMotionSelect
                          label="Motion speed"
                          onChange={(value) => updateSettings({ speed: value as typeof settings.speed })}
                          testId="admin-motion-speed"
                          value={settings.speed}
                          values={["quick", "normal", "slow"]}
                        />
                        <AdminMotionSelect
                          label="Premium color effects"
                          onChange={(value) => updateSettings({ colorMode: value as typeof settings.colorMode })}
                          testId="admin-premium-color-mode"
                          value={settings.colorMode}
                          values={["off", "soft-glow", "gradient", "neon-lab"]}
                        />
                        <AdminMotionSelect
                          label="Page transition"
                          onChange={(value) => updateSettings({ pageTransition: value as typeof settings.pageTransition })}
                          testId="admin-page-transition"
                          value={settings.pageTransition}
                          values={["off", "soft-land", "slide-pop", "drop-in"]}
                        />
                      </div>
                      <Button
                        className="mt-3 w-full justify-center"
                        data-testid="admin-motion-reset"
                        onClick={resetSettings}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RotateCcw data-icon="inline-start" />
                        Reset motion settings
                      </Button>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>
            <Button onClick={logout} type="button" variant="ghost">
              <LogOut data-icon="inline-start" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="app-route-transition-shell" data-route-transition-active={routeLanding ? "true" : "false"}>
        <Outlet />
      </main>
    </div>
  );
}

function AdminMotionSelect({
  label,
  onChange,
  testId,
  value,
  values,
}: {
  label: string;
  onChange: (value: string) => void;
  testId: string;
  value: string;
  values: string[];
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="appearance-select h-9 rounded-md border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none"
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {option.replace(/-/g, " ")}
          </option>
        ))}
      </select>
    </label>
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
