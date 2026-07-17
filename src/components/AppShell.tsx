import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { BookOpen, Calendar, FileText, Home, LineChart, LogOut, MessageSquare, MoreHorizontal, Target, User, Users } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/planner", label: "Planner", icon: Calendar },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/performance", label: "Performance", icon: LineChart },
  { to: "/people", label: "People", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = nav.slice(0, 4);
  const overflow = nav.slice(4);
  const overflowActive = overflow.some((i) => loc.pathname === i.to || loc.pathname.startsWith(i.to + "/"));

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", u.user.id).maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { user: u.user, profile: p, roles: (roles ?? []).map((r) => r.role) };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex items-center gap-2 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold font-display">Sage</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Link to="/profile" className="mb-2 block rounded-md px-2 py-1 hover:bg-sidebar-accent">
            <p className="truncate text-sm font-medium">{profile?.profile?.full_name ?? profile?.user?.email}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.roles?.join(", ") || "student"}</p>
          </Link>
          <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border p-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-semibold">Sage</span>
        </div>
        <button onClick={signOut} className="text-sm text-muted-foreground">Sign out</button>
      </div>

      <main className="min-w-0 bg-background">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur md:hidden">
        {primary.map((item) => {
          const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
          return (
            <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className={`flex flex-col items-center gap-0.5 py-2 text-xs ${overflowActive ? "text-primary" : "text-muted-foreground"}`}>
              <MoreHorizontal className="h-5 w-5" />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-2 pb-4">
              {overflow.map((item) => {
                const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-md border border-border px-3 py-3 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                }}
                className="col-span-2 mt-2 flex items-center justify-center gap-2 rounded-md border border-border px-3 py-3 text-sm hover:bg-accent"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold font-display">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
