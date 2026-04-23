import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
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
import { workspaceThemes } from "@/lib/workspace-preferences";
import { LogoMark } from "@/components/ui/logo-mark";

export function AppShell() {
  const { profile, signOut, isConfigured } = useAuth();
  const { theme, setThemeId, toggleMonochrome } = useTheme();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate("/");
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
            <select
              aria-label="Theme"
              className="hidden h-10 rounded-lg border border-border/70 bg-card/72 px-3 text-sm text-foreground shadow-sm transition hover:bg-secondary md:block"
              onChange={(event) => setThemeId(event.target.value as typeof theme.id)}
              value={theme.id}
            >
              {workspaceThemes.map((workspaceTheme) => (
                <option key={workspaceTheme.id} value={workspaceTheme.id}>
                  {workspaceTheme.name}
                </option>
              ))}
            </select>
            <Button
              aria-label="Toggle monochrome workspace"
              onClick={toggleMonochrome}
              size="icon"
              type="button"
              variant="ghost"
            >
              <MonitorCog data-icon="inline-start" />
            </Button>
            <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 sm:flex">
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
