import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useResumes } from "../hooks/useResumes";
import { authApi } from "../api/auth";
import { toArray } from "../lib/utils";
import {
  User, Lock, Save, Plus, X, GraduationCap, Briefcase,
  FolderGit2, Award, Code, Globe, Link2, CheckCircle, Camera, Sparkles, FileText
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  linkedin_url: string;
  github_url: string;
  professional_summary: string;
  skills: string[];
  technical_skills: string[];
  soft_skills: string[];
  languages: string[];
  certifications: string[];
  achievements: string[];
  education: { degree: string; institution: string; year: string; cgpa: string }[];
  work_experience: { company: string; role: string; duration: string; description: string }[];
  projects: { name: string; description: string; technologies: string; link: string }[];
  photo?: string;
}

const EMPTY_PROFILE: ProfileData = {
  full_name: "", email: "", phone: "", address: "", linkedin_url: "", github_url: "",
  professional_summary: "",
  skills: [], technical_skills: [], soft_skills: [], languages: [], certifications: [], achievements: [],
  education: [], work_experience: [], projects: [],
};

const STORAGE_KEY = "internai_profile";

function loadSaved(): ProfileData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(data: ProfileData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Storage error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TagEditor({
  tags, onChange, placeholder = "Add…", color = "hsl(var(--primary))",
}: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string; color?: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); }
    setInput("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 bg-secondary/50 border border-border text-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground">None added yet</span>}
      </div>
      <div className="flex gap-2">
        <input 
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={placeholder} 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} 
        />
        <Button variant="secondary" size="sm" onClick={add} type="button" className="h-9">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode; color?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="mb-4 bg-card/50 backdrop-blur-sm transition-all">
      <div 
        className={`flex items-center justify-between cursor-pointer select-none p-5 ${open ? 'pb-2' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <span className="font-semibold text-base">{title}</span>
        </div>
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </div>
      {open && <CardContent className="pt-2 px-5 pb-5">{children}</CardContent>}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { defaultResume } = useResumes();

  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [savedOnce, setSavedOnce] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setProfile(saved);
      setSavedOnce(true);
      return;
    }
    setProfile(p => ({ ...p, full_name: user?.full_name ?? "", email: user?.email ?? "" }));
  }, [user]);

  const importedRef = { current: false };
  useEffect(() => {
    if (!defaultResume || loadSaved()) return;
    if (importedRef.current) return;
    importedRef.current = true;

    setProfile(p => ({
      ...p,
      full_name: defaultResume.full_name || p.full_name,
      email: defaultResume.email || p.email,
      phone: defaultResume.phone || "",
      address: defaultResume.address || "",
      linkedin_url: defaultResume.linkedin_url || "",
      github_url: defaultResume.github_url || "",
      professional_summary: defaultResume.professional_summary || "",
      skills: toArray(defaultResume.skills),
      technical_skills: toArray(defaultResume.technical_skills),
      soft_skills: toArray(defaultResume.soft_skills),
      languages: toArray(defaultResume.languages),
      certifications: toArray(defaultResume.certifications),
      achievements: toArray(defaultResume.achievements),
      education: Array.isArray(defaultResume.education)
        ? (defaultResume.education as Record<string, unknown>[]).map(e => ({
            degree: String(e.degree || e.course || ""),
            institution: String(e.institution || e.university || e.college || ""),
            year: String(e.year || e.graduation_year || ""),
            cgpa: String(e.cgpa || e.gpa || ""),
          }))
        : [],
      work_experience: Array.isArray(defaultResume.work_experience)
        ? (defaultResume.work_experience as Record<string, unknown>[]).map(w => ({
            company: String(w.company || w.employer || ""),
            role: String(w.role || w.title || w.position || ""),
            duration: String(w.duration || w.period || ""),
            description: String(w.description || w.responsibilities || ""),
          }))
        : [],
      projects: Array.isArray(defaultResume.projects)
        ? (defaultResume.projects as Record<string, unknown>[]).map(p => ({
            name: String(p.name || p.title || ""),
            description: String(p.description || ""),
            technologies: Array.isArray(p.technologies)
              ? (p.technologies as string[]).join(", ")
              : String(p.technologies || p.tech_stack || ""),
            link: String(p.link || p.url || p.github || ""),
          }))
        : [],
    }));
    setDirty(true);
    toast("Profile auto-filled from your resume", { icon: <FileText className="w-4 h-4 text-primary" /> });
  }, [defaultResume]);

  const set = useCallback(<K extends keyof ProfileData>(key: K, val: ProfileData[K]) => {
    setProfile(p => ({ ...p, [key]: val }));
    setDirty(true);
  }, []);

  const setField = (key: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    set(key, e.target.value as ProfileData[typeof key]);
  };

  const handleSave = () => {
    const success = saveProfile(profile);
    if (!success) {
      toast.error("Failed to save profile. The data (or photo) might be too large.");
      return;
    }
    setSavedOnce(true);
    setDirty(false);
    toast.success("Profile saved!");
    window.dispatchEvent(new Event("profile_updated"));
  };

  const handleImportResume = () => {
    if (!defaultResume) { toast.error("No parsed resume found"); return; }
    if (!confirm("This will overwrite your current profile with data from your latest resume. Continue?")) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const addEdu = () => set("education", [...profile.education, { degree: "", institution: "", year: "", cgpa: "" }]);
  const setEdu = (i: number, k: string, v: string) =>
    set("education", profile.education.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeEdu = (i: number) => set("education", profile.education.filter((_, idx) => idx !== i));

  const addWork = () => set("work_experience", [...profile.work_experience, { company: "", role: "", duration: "", description: "" }]);
  const setWork = (i: number, k: string, v: string) =>
    set("work_experience", profile.work_experience.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeWork = (i: number) => set("work_experience", profile.work_experience.filter((_, idx) => idx !== i));

  const addProj = () => set("projects", [...profile.projects, { name: "", description: "", technologies: "", link: "" }]);
  const setProj = (i: number, k: string, v: string) =>
    set("projects", profile.projects.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeProj = (i: number) => set("projects", profile.projects.filter((_, idx) => idx !== i));

  const initials = user?.full_name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let { width, height } = img;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        // Compress heavily for profile photo to fit in localStorage comfortably
        set("photo", canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const InputClass = "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const TextareaClass = "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1">Edit your profile — auto-filled from your resume on first visit</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleImportResume} title="Re-import from latest resume">
            <FileText className="w-4 h-4 mr-2" /> Re-import from Resume
          </Button>
          <Button onClick={handleSave} disabled={!dirty}>
            {dirty ? <Save className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            {dirty ? "Save Profile" : "Saved"}
          </Button>
        </div>
      </div>

      {!savedOnce && dirty && (
        <div className="flex gap-3 items-center p-4 rounded-xl border border-primary/20 bg-primary/10 text-sm text-primary">
          <Sparkles className="w-5 h-5 shrink-0" /> Profile pre-filled from your resume. Review the details below and click <strong>Save Profile</strong> when ready.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

        {/* LEFT: Account info + password */}
        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm text-center">
            <CardContent className="pt-6">
              <label 
                className="group relative w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-background shadow-md"
                style={
                  profile.photo 
                    ? { backgroundImage: `url(${profile.photo})`, backgroundSize: 'cover', backgroundPosition: 'center', color: "#fff" }
                    : { backgroundColor: "hsl(var(--primary))", color: "#fff" }
                }
              >
                {!profile.photo && <span className="text-2xl font-bold">{initials}</span>}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handlePhotoUpload} />
              </label>
              <div className="font-bold text-lg">{user?.full_name}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="mt-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${user?.is_active ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}>
                  {user?.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long" }) : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={async e => {
                e.preventDefault();
                if (pwdForm.next !== pwdForm.confirm) { toast.error("Passwords do not match"); return; }
                setSavingPwd(true);
                try {
                  await authApi.changePassword(pwdForm.current, pwdForm.next);
                  toast.success("Password changed!");
                  setPwdForm({ current: "", next: "", confirm: "" });
                } catch (err: unknown) {
                  toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed");
                } finally { setSavingPwd(false); }
              }} className="space-y-4">
                {[
                  { label: "Current Password", key: "current" as const },
                  { label: "New Password", key: "next" as const },
                  { label: "Confirm New", key: "confirm" as const },
                ].map(f => (
                  <div className="space-y-1.5" key={f.key}>
                    <label className="text-sm font-medium">{f.label}</label>
                    <input type="password" className={InputClass} placeholder="••••••••" value={pwdForm[f.key]}
                      onChange={e => setPwdForm(p => ({ ...p, [f.key]: e.target.value }))} required minLength={8} />
                  </div>
                ))}
                <Button type="submit" className="w-full" disabled={savingPwd}>
                  {savingPwd ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {savingPwd ? "Saving…" : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Editable profile sections */}
        <div className="space-y-6">

          <Section icon={<User className="w-4 h-4" />} title="Personal Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={InputClass} value={profile.full_name} onChange={setField("full_name")} placeholder="Your full name" />
              </Field>
              <Field label="Email">
                <input className={InputClass} type="email" value={profile.email} onChange={setField("email")} placeholder="you@email.com" />
              </Field>
              <Field label="Phone">
                <input className={InputClass} value={profile.phone} onChange={setField("phone")} placeholder="+91 98765 43210" />
              </Field>
              <Field label="Address">
                <input className={InputClass} value={profile.address} onChange={setField("address")} placeholder="City, State" />
              </Field>
              <Field label="LinkedIn URL">
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input className={`${InputClass} pl-9`} value={profile.linkedin_url} onChange={setField("linkedin_url")} placeholder="https://linkedin.com/in/..." />
                </div>
              </Field>
              <Field label="GitHub URL">
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input className={`${InputClass} pl-9`} value={profile.github_url} onChange={setField("github_url")} placeholder="https://github.com/..." />
                </div>
              </Field>
            </div>
          </Section>

          <Section icon={<Globe className="w-4 h-4" />} title="Professional Summary">
            <textarea className={TextareaClass} rows={4} value={profile.professional_summary} onChange={setField("professional_summary")}
              placeholder="Write a brief summary of your skills, experience, and career goals…" />
          </Section>

          <Section icon={<Code className="w-4 h-4" />} title="Skills">
            <div className="space-y-4">
              <Field label="General Skills">
                <TagEditor tags={profile.skills} onChange={v => set("skills", v)} placeholder="e.g. Python, React…" />
              </Field>
              <Field label="Technical Skills">
                <TagEditor tags={profile.technical_skills} onChange={v => set("technical_skills", v)} placeholder="e.g. FastAPI, PostgreSQL…" />
              </Field>
              <Field label="Soft Skills">
                <TagEditor tags={profile.soft_skills} onChange={v => set("soft_skills", v)} placeholder="e.g. Communication…" />
              </Field>
              <Field label="Languages">
                <TagEditor tags={profile.languages} onChange={v => set("languages", v)} placeholder="e.g. English, Hindi…" />
              </Field>
            </div>
          </Section>

          <Section icon={<GraduationCap className="w-4 h-4" />} title="Education">
            <div className="space-y-4">
              {profile.education.map((e, i) => (
                <div key={i} className="relative bg-secondary/30 p-4 rounded-xl border border-border">
                  <button onClick={() => removeEdu(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Degree / Course">
                      <input className={InputClass} value={e.degree} onChange={ev => setEdu(i, "degree", ev.target.value)} placeholder="B.Tech Computer Science" />
                    </Field>
                    <Field label="Institution">
                      <input className={InputClass} value={e.institution} onChange={ev => setEdu(i, "institution", ev.target.value)} placeholder="IIT Madras" />
                    </Field>
                    <Field label="Year / Graduation">
                      <input className={InputClass} value={e.year} onChange={ev => setEdu(i, "year", ev.target.value)} placeholder="2025" />
                    </Field>
                    <Field label="CGPA / Percentage">
                      <input className={InputClass} value={e.cgpa} onChange={ev => setEdu(i, "cgpa", ev.target.value)} placeholder="8.5 / 10" />
                    </Field>
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addEdu} type="button">
                <Plus className="w-4 h-4 mr-2" /> Add Education
              </Button>
            </div>
          </Section>

          <Section icon={<Briefcase className="w-4 h-4" />} title="Work Experience">
            <div className="space-y-4">
              {profile.work_experience.map((w, i) => (
                <div key={i} className="relative bg-secondary/30 p-4 rounded-xl border border-border space-y-4">
                  <button onClick={() => removeWork(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Company">
                      <input className={InputClass} value={w.company} onChange={ev => setWork(i, "company", ev.target.value)} placeholder="Google" />
                    </Field>
                    <Field label="Role / Title">
                      <input className={InputClass} value={w.role} onChange={ev => setWork(i, "role", ev.target.value)} placeholder="Software Engineering Intern" />
                    </Field>
                    <Field label="Duration">
                      <input className={InputClass} value={w.duration} onChange={ev => setWork(i, "duration", ev.target.value)} placeholder="Jun 2024 – Aug 2024" />
                    </Field>
                  </div>
                  <Field label="Description / Responsibilities">
                    <textarea className={TextareaClass} rows={3} value={w.description}
                      onChange={ev => setWork(i, "description", ev.target.value)} placeholder="What did you build or achieve?" />
                  </Field>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addWork} type="button">
                <Plus className="w-4 h-4 mr-2" /> Add Experience
              </Button>
            </div>
          </Section>

          <Section icon={<FolderGit2 className="w-4 h-4" />} title="Projects">
            <div className="space-y-4">
              {profile.projects.map((p, i) => (
                <div key={i} className="relative bg-secondary/30 p-4 rounded-xl border border-border space-y-4">
                  <button onClick={() => removeProj(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Project Name">
                      <input className={InputClass} value={p.name} onChange={ev => setProj(i, "name", ev.target.value)} placeholder="Internship Assistant" />
                    </Field>
                    <Field label="Technologies / Stack">
                      <input className={InputClass} value={p.technologies} onChange={ev => setProj(i, "technologies", ev.target.value)} placeholder="React, FastAPI, PostgreSQL" />
                    </Field>
                    <Field label="Link / GitHub URL">
                      <input className={InputClass} value={p.link} onChange={ev => setProj(i, "link", ev.target.value)} placeholder="https://github.com/..." />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea className={TextareaClass} rows={3} value={p.description}
                      onChange={ev => setProj(i, "description", ev.target.value)} placeholder="What does this project do?" />
                  </Field>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addProj} type="button">
                <Plus className="w-4 h-4 mr-2" /> Add Project
              </Button>
            </div>
          </Section>

          <Section icon={<Award className="w-4 h-4" />} title="Certifications & Achievements">
            <div className="space-y-4">
              <Field label="Certifications">
                <TagEditor tags={profile.certifications} onChange={v => set("certifications", v)} placeholder="e.g. AWS Cloud Practitioner…" />
              </Field>
              <Field label="Achievements">
                <TagEditor tags={profile.achievements} onChange={v => set("achievements", v)} placeholder="e.g. Hackathon Winner…" />
              </Field>
            </div>
          </Section>

          <div className="flex justify-end pt-4">
            <Button size="lg" onClick={handleSave} disabled={!dirty} className="w-full sm:w-auto">
              {dirty ? <Save className="w-5 h-5 mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
              {dirty ? "Save Profile Changes" : "Profile Up to Date"}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
