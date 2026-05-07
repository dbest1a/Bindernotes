import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  Calculator,
  ChevronDown,
  GraduationCap,
  Gauge,
  LayoutDashboard,
  LogOut,
  NotebookTabs,
  Palette,
  PenTool,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAdminMotionSettings } from "@/hooks/use-admin-motion";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardExperience } from "@/hooks/use-dashboard-experience";
import { usePerformanceMode } from "@/hooks/use-performance-mode";
import { useTheme } from "@/hooks/use-theme";
import { useTutorialPrompts } from "@/hooks/use-tutorial-prompts";
import {
  loadPersonalNotesPreferences,
  personalNotesPreferencesUpdatedEvent,
  savePersonalNotesPreferences,
} from "@/lib/personal-notes";
import { dashboardViewModeOptions } from "@/lib/admin-dashboard-preferences";
import { cn, initials } from "@/lib/utils";
import { workspaceThemes } from "@/lib/workspace-preferences";
import { LogoMark } from "@/components/ui/logo-mark";
import type { PersonalNotesPreferences } from "@/types";

export function AppShell() {
  const { profile, signOut } = useAuth();
  const { globalTheme, setThemeId } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const dashboardExperience = useDashboardExperience(profile ? isAdmin : undefined);
  const tutorialPrompts = useTutorialPrompts(profile);
  const performanceMode = usePerformanceMode();
  const [personalNotesPreferences, setPersonalNotesPreferences] = useState(() =>
    loadPersonalNotesPreferences(profile?.id),
  );
  const { prefersReducedMotion, resetSettings, settings, updateSettings } = useAdminMotionSettings(
    isAdmin,
    performanceMode.effectivePerformanceMode,
  );
  const effectivePerformanceMode = performanceMode.effectivePerformanceMode || prefersReducedMotion;
  const enhancedModeRequested = performanceMode.enhancedModeEnabled;
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsWindowOpen, setSettingsWindowOpen] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [routeLanding, setRouteLanding] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    setPersonalNotesPreferences(loadPersonalNotesPreferences(profile?.id));
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const onPersonalNotesPreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        preferences?: PersonalNotesPreferences;
        userId?: string;
      }>).detail;
      if (detail?.userId === profile.id && detail.preferences) {
        setPersonalNotesPreferences(detail.preferences);
      }
    };

    window.addEventListener(personalNotesPreferencesUpdatedEvent, onPersonalNotesPreferencesUpdated);
    return () => window.removeEventListener(personalNotesPreferencesUpdatedEvent, onPersonalNotesPreferencesUpdated);
  }, [profile?.id]);

  const setQuickAccessVisible = (showQuickAccess: boolean) => {
    const next = {
      ...personalNotesPreferences,
      showQuickAccess,
    };
    setPersonalNotesPreferences(next);
    savePersonalNotesPreferences(profile?.id, next);
  };

  const openSettingsWindow = () => {
    setSettingsWindowOpen(true);
    setProfileMenuOpen(false);
  };

  const closeSettingsWindow = () => {
    setSettingsWindowOpen(false);
    setSettingsSearch("");
  };

  const normalizedSettingsSearch = settingsSearch.trim().toLowerCase();
  const shouldShowSettingSection = (label: string, terms: string) =>
    !normalizedSettingsSearch || `${label} ${terms}`.toLowerCase().includes(normalizedSettingsSearch);

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

  useEffect(() => {
    if (!settingsWindowOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSettingsWindow();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [settingsWindowOpen]);

  const showAccountSettings = shouldShowSettingSection(
    "Account",
    "profile name email role sign out user learner admin account",
  );
  const showAppearanceSettings = shouldShowSettingSection(
    "Appearance",
    "theme dashboard view normal minimal admin makeover workspace color display",
  );
  const showLearningSettings = shouldShowSettingSection(
    "Learning",
    "tutorial prompts first time walkthrough guide lessons help video library",
  );
  const showPersonalNotesSettings = shouldShowSettingSection(
    "Personal Notes",
    "quick access notes notebook binders folders documents shortcuts home organize",
  );
  const showPerformanceSettings = shouldShowSettingSection(
    "Performance",
    "performance enhanced mode faster scrolling lag motion reduce glow blur responsiveness speed smooth drawing whiteboard canvas lower cpu",
  );
  const showAdminMotionSettings = isAdmin
    ? shouldShowSettingSection(
        "Admin Motion Lab",
        "motion animations intensity speed premium color effects page transition sparkle admin",
      )
    : false;
  const hasSettingsResults =
    showAccountSettings ||
    showAppearanceSettings ||
    showLearningSettings ||
    showPersonalNotesSettings ||
    showPerformanceSettings ||
    showAdminMotionSettings;

  return (
    <div
      className="min-h-screen bg-background"
      data-admin-dashboard={dashboardExperience.dashboardAttribute}
      data-admin-motion={isAdmin && settings.enabled && !effectivePerformanceMode ? "on" : "off"}
      data-enhanced-mode={enhancedModeRequested ? "true" : "false"}
      data-motion-intensity={settings.intensity}
      data-motion-speed={settings.speed}
      data-page-transition={isAdmin && settings.enabled && !effectivePerformanceMode ? settings.pageTransition : "off"}
      data-performance-mode={effectivePerformanceMode ? "true" : "false"}
      data-premium-color-mode={isAdmin && settings.enabled && !effectivePerformanceMode ? settings.colorMode : "off"}
      data-reduced-motion={prefersReducedMotion ? "system" : "none"}
    >
      <header className="app-header sticky top-0 z-20 border-b border-border/70 bg-background/82 backdrop-blur-xl">
        <div className="app-header__inner mx-auto flex h-16 max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            aria-label="BinderNotes dashboard"
            className="flex items-center rounded-xl transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            to="/dashboard"
          >
            <LogoMark className="size-10" />
          </Link>

          <nav className="app-primary-nav hidden items-center gap-1 rounded-lg border border-border/70 bg-card/72 p-1 md:flex">
            <NavItem to="/dashboard" icon={<LayoutDashboard data-icon="inline-start" />}>
              Workspace
            </NavItem>
            <NavItem to="/notes" icon={<NotebookTabs data-icon="inline-start" />}>
              Personal Notes
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

          <div className="app-header__actions flex items-center gap-2">
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
                  <Button
                    className="mt-3 w-full justify-center"
                    data-testid="profile-open-settings"
                    onClick={openSettingsWindow}
                    type="button"
                    variant="outline"
                  >
                    <Settings data-icon="inline-start" />
                    Open settings
                  </Button>
                  {isAdmin ? (
                    <section
                      className="mt-3 rounded-lg border border-border/80 p-3"
                      data-testid="admin-dashboard-appearance"
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <LayoutDashboard className="size-4 text-cyan-300" />
                        Dashboard appearance
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Admin-only preview controls. Learners keep the normal dashboard.
                      </p>
                      <label className="mt-3 grid gap-1 text-xs font-medium text-muted-foreground">
                        Dashboard view
                        <select
                          className="appearance-select h-9 rounded-md border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none"
                          data-testid="admin-dashboard-view-mode"
                          onChange={(event) =>
                            dashboardExperience.setViewMode(
                              event.target.value as typeof dashboardExperience.preference.viewMode,
                            )
                          }
                          value={dashboardExperience.effectiveViewMode}
                        >
                          {dashboardViewModeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {
                          dashboardViewModeOptions.find(
                            (option) => option.value === dashboardExperience.effectiveViewMode,
                          )?.description
                        }
                      </p>
                    </section>
                  ) : null}
                  <section className="mt-3 rounded-lg border border-border/80 p-3" data-testid="personal-notes-quick-access-section">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <NotebookTabs className="size-4 text-cyan-300" />
                          Quick Access
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Show the Personal Notes shortcut card in Home and Organize.
                        </p>
                      </div>
                      <button
                        aria-label="Show Quick Access"
                        aria-pressed={personalNotesPreferences.showQuickAccess}
                        className="admin-motion-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                        data-testid="personal-notes-quick-access-toggle"
                        onClick={() => setQuickAccessVisible(!personalNotesPreferences.showQuickAccess)}
                        type="button"
                      >
                        <span
                          className={
                            personalNotesPreferences.showQuickAccess
                              ? "admin-motion-toggle__knob admin-motion-toggle__knob--on"
                              : "admin-motion-toggle__knob"
                          }
                        />
                        <span className="sr-only">Toggle Personal Notes Quick Access</span>
                      </button>
                    </div>
                    <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                      {personalNotesPreferences.showQuickAccess
                        ? "Quick Access is visible for fast notes, binders, documents, and folders."
                        : "Quick Access is hidden. Navigation and command palette access stay available."}
                    </p>
                  </section>
                  <section className="mt-3 rounded-lg border border-border/80 p-3" data-testid="performance-mode-section">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="size-4 text-cyan-300" />
                          Enhanced Mode
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Enable richer visuals and extra effects. May use more resources.
                        </p>
                      </div>
                      <button
                        aria-label="Enhanced Mode"
                        aria-pressed={enhancedModeRequested}
                        className="admin-motion-toggle performance-mode-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                        data-testid="performance-mode-toggle"
                        onClick={() => performanceMode.setEnhancedModeEnabled(!performanceMode.enhancedModeEnabled)}
                        type="button"
                      >
                        <span
                          className={
                            enhancedModeRequested
                              ? "admin-motion-toggle__knob admin-motion-toggle__knob--on"
                              : "admin-motion-toggle__knob"
                          }
                        />
                        <span className="sr-only">Toggle Enhanced Mode</span>
                      </button>
                    </div>
                    <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                      {effectivePerformanceMode
                        ? "Performance Mode active. Prioritizes speed, smoother drawing, and lower CPU usage."
                        : "Enhanced view is active. Admin Studio, Admin Makeover, and Motion Lab visuals stay as designed."}
                    </p>
                  </section>
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
      {settingsWindowOpen ? (
        <div className="app-settings-overlay" role="presentation">
          <section
            aria-label="BinderNotes settings"
            aria-modal="true"
            className="app-settings-window"
            data-testid="app-settings-window"
            role="dialog"
          >
            <header className="app-settings-window__header">
              <div className="min-w-0">
                <span className="page-kicker">Settings</span>
                <h2>BinderNotes settings</h2>
                <p>Account, dashboard, learning, notes, and performance controls in one place.</p>
              </div>
              <Button
                aria-label="Close settings"
                className="shrink-0"
                onClick={closeSettingsWindow}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X data-icon="inline-start" />
                Close
              </Button>
            </header>

            <div className="app-settings-window__search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search settings"
                className="appearance-select h-11 w-full rounded-lg border border-border bg-background px-9 text-sm font-semibold outline-none"
                data-testid="app-settings-search"
                onChange={(event) => setSettingsSearch(event.target.value)}
                placeholder="Search settings, tutorials, motion, quick access..."
                value={settingsSearch}
              />
            </div>

            <div className="app-settings-window__body">
              <aside className="app-settings-window__nav" aria-label="Settings sections">
                {[
                  ["Account", "Profile and session"],
                  ["Appearance", "Theme and dashboard"],
                  ["Learning", "Tutorial prompts"],
                  ["Personal Notes", "Quick Access"],
                  ["Performance", "Fast mode"],
                  ...(isAdmin ? [["Admin Motion", "Private polish"]] : []),
                ].map(([label, description]) => (
                  <span key={label}>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                ))}
              </aside>

              <div className="app-settings-window__scroll">
                {showAccountSettings ? (
                  <SettingsPanel
                    description="Manage the signed-in account and session controls."
                    icon={<UserCircle className="size-4" />}
                    testId="app-settings-section-account"
                    title="Account"
                  >
                    <div className="app-settings-account-card">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
                        {initials(profile?.full_name ?? "BN")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{profile?.full_name ?? "Binder user"}</p>
                        <p className="truncate text-xs text-muted-foreground">{profile?.email ?? "Signed in account"}</p>
                      </div>
                      <span className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs capitalize text-muted-foreground">
                        {profile?.role ?? "learner"}
                      </span>
                    </div>
                    <Button className="justify-self-start" onClick={logout} size="sm" type="button" variant="outline">
                      <LogOut data-icon="inline-start" />
                      Log out
                    </Button>
                  </SettingsPanel>
                ) : null}

                {showAppearanceSettings ? (
                  <SettingsPanel
                    description="Choose the app theme and dashboard appearance."
                    icon={<Palette className="size-4" />}
                    testId="app-settings-section-appearance"
                    title="Appearance"
                  >
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      App theme
                      <select
                        aria-label="App theme"
                        className="appearance-select h-9 rounded-md border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none"
                        data-testid="app-settings-theme"
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
                    {isAdmin ? (
                      <section className="rounded-lg border border-border/80 p-3" data-testid="admin-dashboard-appearance">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <LayoutDashboard className="size-4 text-cyan-300" />
                          Dashboard appearance
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Admin-only preview controls. Learners keep the normal dashboard.
                        </p>
                        <label className="mt-3 grid gap-1 text-xs font-medium text-muted-foreground">
                          Dashboard view
                          <select
                            className="appearance-select h-9 rounded-md border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none"
                            data-testid="admin-dashboard-view-mode"
                            onChange={(event) =>
                              dashboardExperience.setViewMode(
                                event.target.value as typeof dashboardExperience.preference.viewMode,
                              )
                            }
                            value={dashboardExperience.effectiveViewMode}
                          >
                            {dashboardViewModeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                          {
                            dashboardViewModeOptions.find(
                              (option) => option.value === dashboardExperience.effectiveViewMode,
                            )?.description
                          }
                        </p>
                      </section>
                    ) : null}
                  </SettingsPanel>
                ) : null}

                {showLearningSettings ? (
                  <SettingsPanel
                    description="Control tutorial prompts and open the full tutorial library."
                    icon={<BookOpenCheck className="size-4" />}
                    testId="app-settings-section-learning"
                    title="Learning"
                  >
                    <section className="rounded-lg border border-border/80 p-3" data-testid="tutorial-prompts-section">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <BookOpenCheck className="size-4 text-cyan-300" />
                            Tutorials
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            First-time page prompts are on by default only for accounts created recently.
                          </p>
                        </div>
                        <button
                          aria-label="Toggle tutorial prompts"
                          aria-pressed={tutorialPrompts.promptsEnabled}
                          className="admin-motion-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                          data-testid="tutorial-prompts-toggle"
                          onClick={() => tutorialPrompts.setPromptsEnabled(!tutorialPrompts.promptsEnabled)}
                          type="button"
                        >
                          <span
                            className={
                              tutorialPrompts.promptsEnabled
                                ? "admin-motion-toggle__knob admin-motion-toggle__knob--on"
                                : "admin-motion-toggle__knob"
                            }
                          />
                          <span className="sr-only">Enable first-time tutorial prompts</span>
                        </button>
                      </div>
                      <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {tutorialPrompts.promptsEnabled
                          ? "Tutorial prompts can appear once per page until skipped or watched."
                          : "Tutorial prompts are off. The full Tutorial library stays available from the nav."}
                      </p>
                    </section>
                    <Button asChild className="justify-self-start" size="sm" type="button" variant="outline">
                      <Link onClick={closeSettingsWindow} to="/tutorial">
                        <BookOpenCheck data-icon="inline-start" />
                        Open tutorial library
                      </Link>
                    </Button>
                  </SettingsPanel>
                ) : null}

                {showPersonalNotesSettings ? (
                  <SettingsPanel
                    description="Control fast note and workspace shortcuts."
                    icon={<NotebookTabs className="size-4" />}
                    testId="app-settings-section-personal-notes"
                    title="Personal Notes"
                  >
                    <section className="rounded-lg border border-border/80 p-3" data-testid="personal-notes-quick-access-section">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <NotebookTabs className="size-4 text-cyan-300" />
                            Quick Access
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Show the Personal Notes shortcut card in Home and Organize.
                          </p>
                        </div>
                        <button
                          aria-label="Show Quick Access"
                          aria-pressed={personalNotesPreferences.showQuickAccess}
                          className="admin-motion-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                          data-testid="personal-notes-quick-access-toggle"
                          onClick={() => setQuickAccessVisible(!personalNotesPreferences.showQuickAccess)}
                          type="button"
                        >
                          <span
                            className={
                              personalNotesPreferences.showQuickAccess
                                ? "admin-motion-toggle__knob admin-motion-toggle__knob--on"
                                : "admin-motion-toggle__knob"
                            }
                          />
                          <span className="sr-only">Toggle Personal Notes Quick Access</span>
                        </button>
                      </div>
                      <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {personalNotesPreferences.showQuickAccess
                          ? "Quick Access is visible for fast notes, binders, documents, and folders."
                          : "Quick Access is hidden. Navigation and command palette access stay available."}
                      </p>
                    </section>
                  </SettingsPanel>
                ) : null}

                {showPerformanceSettings ? (
                  <SettingsPanel
                    description="Keep the app responsive and control enhanced visuals."
                    icon={<Gauge className="size-4" />}
                    testId="app-settings-section-performance"
                    title="Performance"
                  >
                    <section className="rounded-lg border border-border/80 p-3" data-testid="performance-mode-section">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="size-4 text-cyan-300" />
                            Enhanced Mode
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Enable richer visuals and extra effects. May use more resources.
                          </p>
                        </div>
                        <button
                          aria-label="Enhanced Mode"
                          aria-pressed={enhancedModeRequested}
                          className="admin-motion-toggle performance-mode-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                          data-testid="performance-mode-toggle"
                          onClick={() => performanceMode.setEnhancedModeEnabled(!performanceMode.enhancedModeEnabled)}
                          type="button"
                        >
                          <span
                            className={
                              enhancedModeRequested
                                ? "admin-motion-toggle__knob admin-motion-toggle__knob--on"
                                : "admin-motion-toggle__knob"
                            }
                          />
                          <span className="sr-only">Toggle Enhanced Mode</span>
                        </button>
                      </div>
                      <p className="mt-2 rounded-md border border-border/70 bg-secondary/45 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {effectivePerformanceMode
                          ? "Performance Mode active. Prioritizes speed, smoother drawing, and lower CPU usage."
                          : "Enhanced view is active. Admin Studio, Admin Makeover, and Motion Lab visuals stay as designed."}
                      </p>
                    </section>
                  </SettingsPanel>
                ) : null}

                {showAdminMotionSettings ? (
                  <SettingsPanel
                    description="Admin-only motion, color, and page transition controls."
                    icon={<Sparkles className="size-4" />}
                    testId="app-settings-section-admin-motion"
                    title="Admin Motion Lab"
                  >
                    <section className="rounded-lg border border-border/80 p-3" data-testid="admin-motion-lab">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="size-4 text-cyan-300" />
                            Admin Motion Lab
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Premium motion and color polish for admin eyes only.
                          </p>
                        </div>
                      </div>
                      <div className="admin-motion-toggle-row mt-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">Admin animations</p>
                          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                            Off disables card sweeps, page motion, and drag sparkle.
                          </p>
                        </div>
                        <button
                          aria-pressed={settings.enabled}
                          aria-label="Toggle admin animations"
                          className="admin-motion-toggle rounded-full border border-border bg-background p-1 text-xs font-semibold"
                          data-testid="admin-motion-toggle"
                          onClick={() => updateSettings({ enabled: !settings.enabled })}
                          type="button"
                        >
                          <span
                            className={
                              settings.enabled
                                ? "admin-motion-toggle__knob admin-motion-toggle__knob--on"
                                : "admin-motion-toggle__knob"
                            }
                          />
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
                  </SettingsPanel>
                ) : null}

                {!hasSettingsResults ? (
                  <div className="app-settings-empty" data-testid="app-settings-empty">
                    <Search className="size-5" />
                    <strong>No settings found</strong>
                    <p>Try theme, dashboard, tutorial, quick access, performance, or motion.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  children,
  description,
  icon,
  testId,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  testId: string;
  title: string;
}) {
  return (
    <section className="app-settings-panel" data-testid={testId}>
      <div className="app-settings-panel__heading">
        <span>{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="app-settings-panel__content">{children}</div>
    </section>
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
