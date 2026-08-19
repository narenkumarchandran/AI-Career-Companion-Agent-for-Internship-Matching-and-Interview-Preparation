import { useEffect, useState } from "react";
import { useResumes } from "../hooks/useResumes";
import { internshipApi } from "../api/internships";
import type { ResumeOut, InternshipMatch } from "../types";
import { scoreColor } from "../lib/utils";
import { useTheme } from "../hooks/useTheme";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Sparkles, AlertCircle, FileText, CheckCircle2, XCircle, ChevronRight, TrendingUp, Trophy, Check, X, AlertTriangle, Target } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ATSScore() {
  const { resumes, parsedResumes, defaultResume, loading: loadingResumes } = useResumes();
  const [selectedId, setSelectedId] = useState<string>("");
  const [resumeData, setResumeData] = useState<ResumeOut | null>(null);
  const [topMatch, setTopMatch] = useState<InternshipMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  
  const isDark = theme === "dark";
  const chartTextColor = isDark ? "#a1a1aa" : "#71717a";
  const chartPrimaryColor = "#6366f1"; // indigo-500

  useEffect(() => {
    if (!selectedId && defaultResume) {
      setSelectedId(defaultResume.id);
    }
  }, [defaultResume, selectedId]);

  const analyze = async (overrideId?: string) => {
    const id = overrideId ?? selectedId;
    if (!id) return;
    const resume = resumes.find(r => r.id === id);
    if (!resume || resume.parsed_status !== "parsed") {
      toast.error("Please select a successfully parsed resume");
      return;
    }
    setLoading(true);
    try {
      setResumeData(resume);
      const { data } = await internshipApi.match(id, 5);
      if (data.results.length) setTopMatch(data.results[0]);
      else setTopMatch(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Analysis failed";
      toast.error(String(msg));
    } finally { setLoading(false); }
  };

  const atsScore = resumeData ? (() => {
    let score = 0;
    if (resumeData.full_name) score += 5;
    if (resumeData.email) score += 5;
    if (resumeData.phone) score += 5;
    if (resumeData.professional_summary) {
      if (resumeData.professional_summary.length > 150) score += 10;
      else score += 5;
    }
    const skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
    if (skills.length >= 8) score += 15;
    else if (skills.length > 0) score += Math.floor((skills.length / 8) * 15);
    const techSkills = Array.isArray(resumeData.technical_skills) ? resumeData.technical_skills : [];
    if (techSkills.length >= 5) score += 10;
    else if (techSkills.length > 0) score += Math.floor((techSkills.length / 5) * 10);
    const edu = Array.isArray(resumeData.education) ? resumeData.education : [];
    if (edu.length > 0) score += 10;
    const exp = Array.isArray(resumeData.work_experience) ? resumeData.work_experience : [];
    if (exp.length >= 2) score += 20;
    else if (exp.length === 1) score += 12;
    const proj = Array.isArray(resumeData.projects) ? resumeData.projects : [];
    if (proj.length >= 2) score += 15;
    else if (proj.length === 1) score += 8;
    if (resumeData.linkedin_url || resumeData.github_url) score += 5;
    if (!resumeData.linkedin_url && !resumeData.github_url) score -= 5;
    return Math.max(0, Math.min(score, 94));
  })() : 0;

  const radarData = topMatch ? [
    { subject: "Skills", A: Math.round(topMatch.skill_score * 100) },
    { subject: "Semantic", A: Math.round(topMatch.semantic_score * 100) },
    { subject: "Education", A: Math.round(topMatch.education_score * 100) },
    { subject: "Location", A: Math.round(topMatch.location_score * 100) },
  ] : [];

  const completenessItems = resumeData ? [
    { name: "Name", done: !!resumeData.full_name },
    { name: "Email", done: !!resumeData.email },
    { name: "Phone", done: !!resumeData.phone },
    { name: "Summary", done: !!resumeData.professional_summary },
    { name: "Skills", done: Array.isArray(resumeData.skills) ? resumeData.skills.length > 0 : !!resumeData.skills },
    { name: "Tech Skills", done: !!resumeData.technical_skills },
    { name: "Education", done: Array.isArray(resumeData.education) ? resumeData.education.length > 0 : !!resumeData.education },
    { name: "Experience", done: Array.isArray(resumeData.work_experience) ? (resumeData.work_experience as unknown[]).length > 0 : !!resumeData.work_experience },
    { name: "Projects", done: Array.isArray(resumeData.projects) ? (resumeData.projects as unknown[]).length > 0 : !!resumeData.projects },
    { name: "Certifications", done: Array.isArray(resumeData.certifications) ? (resumeData.certifications as unknown[]).length > 0 : !!resumeData.certifications },
    { name: "LinkedIn", done: !!resumeData.linkedin_url },
    { name: "GitHub", done: !!resumeData.github_url },
  ] : [];

  const isParsed = (id: string) => resumes.find(r => r.id === id)?.parsed_status === "parsed";

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ATS Score Analysis</h1>
        <p className="text-muted-foreground mt-1">See how well your resume is optimized for applicant tracking systems</p>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium mb-1.5 block">Select Resume to Analyze</label>
              {loadingResumes ? (
                <div className="h-10 px-3 py-2 text-sm text-muted-foreground bg-secondary/30 rounded-md border border-border flex items-center">Loading your resumes…</div>
              ) : resumes.length === 0 ? (
                <div className="flex items-center gap-2 p-2.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" /> No resumes found. <Link to="/app/resumes" className="underline hover:text-amber-500">Upload one →</Link>
                </div>
              ) : (
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setResumeData(null); setTopMatch(null); }}
                >
                  <option value="">-- Choose a resume --</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id} disabled={r.parsed_status !== "parsed"}>
                      {r.original_filename}{r.parsed_status !== "parsed" ? ` (${r.parsed_status})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button onClick={() => analyze()} disabled={loading || !selectedId || !isParsed(selectedId)} className="h-10">
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {loading ? "Analyzing…" : "Analyze Resume"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!loadingResumes && parsedResumes.length === 0 && resumes.length > 0 && (
        <div className="flex gap-3 items-start p-4 rounded-xl border border-amber-500/20 bg-amber-500/10">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-amber-600 dark:text-amber-400 mb-1">No parsed resumes yet</div>
            <div className="text-sm text-amber-600/80 dark:text-amber-400/80">
              Your resumes haven't been parsed yet. Go to <Link to="/app/resumes" className="underline hover:text-amber-600 dark:hover:text-amber-300">My Resumes</Link> to check status.
            </div>
          </div>
        </div>
      )}

      {resumeData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ATS Score */}
            <Card className="bg-card/50 backdrop-blur-sm flex flex-col items-center text-center">
              <CardContent className="p-6 w-full flex flex-col items-center justify-center flex-1">
                <div className="text-sm font-semibold text-muted-foreground mb-4">ATS Readiness Score</div>
                <div className="text-7xl font-extrabold tracking-tighter" style={{ color: scoreColor(atsScore / 100) }}>
                  {atsScore}
                </div>
                <div className="text-sm text-muted-foreground mt-2">out of 100</div>
                <div className="w-full mt-6 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${atsScore}%`, background: scoreColor(atsScore / 100) }} />
                </div>
                <div className="text-xs font-medium text-muted-foreground mt-4 flex items-center gap-1">
                  {atsScore >= 80 ? <><Trophy className="w-4 h-4 text-emerald-500" /> Excellent — ATS ready!</> 
                   : atsScore >= 60 ? <><Check className="w-4 h-4 text-blue-500" /> Good — minor improvements needed</> 
                   : atsScore >= 40 ? <><AlertTriangle className="w-4 h-4 text-amber-500" /> Fair — several sections missing</> 
                   : <><X className="w-4 h-4 text-destructive" /> Needs significant work</>}
                </div>
              </CardContent>
            </Card>

            {/* Completeness */}
            <Card className="bg-card/50 backdrop-blur-sm md:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Resume Completeness
                  <span className="text-sm font-normal text-muted-foreground ml-auto">
                    {completenessItems.filter(i => i.done).length}/{completenessItems.length} sections
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {completenessItems.map(item => (
                    <div key={item.name} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${item.done ? 'bg-secondary/50 border-border/50' : 'bg-background border-border/30 opacity-60'}`}>
                      {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className={`text-xs font-medium ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {topMatch && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar chart */}
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Match Score Breakdown</CardTitle>
                  <p className="text-xs text-muted-foreground">Best match: {topMatch.role_title} @ {topMatch.company}</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={isDark ? "#3f3f46" : "#e4e4e7"} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: chartTextColor, fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: chartTextColor, fontSize: 10 }} />
                        <Radar dataKey="A" stroke={chartPrimaryColor} fill={chartPrimaryColor} fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Bar chart */}
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Score Dimensions</CardTitle>
                  <p className="text-xs text-muted-foreground">Percentage across key areas</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={radarData} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                        <XAxis dataKey="subject" tick={{ fill: chartTextColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: isDark ? "#18181b" : "#ffffff", border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#18181b", fontSize: 13 }}
                          itemStyle={{ color: chartPrimaryColor }}
                          cursor={{ fill: isDark ? "#27272a" : "#f4f4f5" }}
                        />
                        <Bar dataKey="A" fill={chartPrimaryColor} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Suggestions */}
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Improvement Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {completenessItems.filter(i => !i.done).map(item => (
                <div key={item.name} className="flex gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl items-start">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">Add {item.name}</div>
                    <div className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Adding your {item.name.toLowerCase()} can improve your ATS score and visibility to recruiters.</div>
                  </div>
                </div>
              ))}
              {topMatch && topMatch.missing_skills.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <div className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Skills to Develop for Best Match
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topMatch.missing_skills.map(s => <Badge key={s} variant="outline" className="bg-destructive/5 text-destructive border-destructive/20">{s}</Badge>)}
                  </div>
                </div>
              )}
              {completenessItems.every(i => i.done) && (!topMatch || topMatch.missing_skills.length === 0) && (
                <div className="text-center py-8 text-emerald-500 font-semibold flex flex-col items-center gap-2">
                  <Trophy className="w-8 h-8 mb-1" />
                  Your resume is fully optimized!
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!resumeData && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-6 border border-border">
            <BarChart className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">Select a resume to analyze</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            Get your ATS score, completeness breakdown, and personalized suggestions
          </p>
          {parsedResumes.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {parsedResumes.map(r => (
                <Button key={r.id} variant="secondary" size="sm" onClick={() => { setSelectedId(r.id); analyze(r.id); }}>
                  <FileText className="w-3.5 h-3.5 mr-2" /> {r.original_filename}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
