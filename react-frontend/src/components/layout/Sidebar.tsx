import { useState, useEffect } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LayoutDashboard, FileText, Briefcase, Search,
  BarChart3, User, LogOut, Brain, Sun, Moon, BrainCircuit
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/resumes", label: "My Resumes", icon: FileText },
  { to: "/app/resume-match", label: "Find Matches", icon: Search },
  { to: "/app/jobs", label: "Browse Jobs", icon: Briefcase },
  { to: "/app/ats-score", label: "ATS Score", icon: BarChart3 },
  { to: "/app/interview-agent", label: "Interview Agent", icon: BrainCircuit },
  { to: "/app/profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    const loadPhoto = () => {
      try {
        const raw = localStorage.getItem("aicareer_profile");
        if (raw) setProfilePhoto(JSON.parse(raw).photo || null);
      } catch {}
    };
    loadPhoto();
    window.addEventListener("profile_updated", loadPhoto);
    return () => window.removeEventListener("profile_updated", loadPhoto);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/login");
  };

  const initials = user?.full_name
    ?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <aside className="group w-[80px] hover:w-[260px] h-screen shrink-0 border-r border-border bg-card/30 backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out z-20 overflow-hidden absolute sm:relative">
      <div className="p-5 flex items-center gap-3 whitespace-nowrap h-[88px] shrink-0">
        <Link to="/app/home" className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
            <span className="text-lg font-bold tracking-tight leading-none">AI Career Assistant</span>
            <span className="text-xs text-muted-foreground mt-1 font-medium">Powered by RAG</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-x-hidden overflow-y-auto py-2">
        <div className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          Navigation
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => 
            `flex items-center gap-4 px-3 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              isActive 
                ? "bg-secondary text-foreground" 
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`
          }>
            <Icon className="w-5 h-5 shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border mt-auto space-y-3 shrink-0 whitespace-nowrap">
        <Button variant="outline" className="w-full justify-start gap-4 h-11 px-3" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </Button>

        <div className="flex items-center group-hover:justify-start justify-center gap-3 p-2 group-hover:px-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary transition-colors cursor-pointer" onClick={() => navigate("/app/profile")}>
          <div 
            className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground shrink-0 overflow-hidden"
            style={profilePhoto ? { backgroundImage: `url(${profilePhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {!profilePhoto && initials}
          </div>
          <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
            <p className="text-sm font-semibold truncate text-foreground leading-tight">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); handleLogout(); }} 
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 focus:outline-none p-1 hover:bg-destructive/10 rounded-md"
            title="Log Out"
          >
            <LogOut className="w-4 h-4 text-muted-foreground hover:text-destructive shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  );
}
