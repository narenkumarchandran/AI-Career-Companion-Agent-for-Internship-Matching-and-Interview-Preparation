import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { resumeApi } from "../api/resume";
import { internshipApi } from "../api/internships";
import type { ResumeOut, InternshipPosting } from "../types";
import { FileText, Briefcase, TrendingUp, Upload, CheckCircle2, Target } from "lucide-react";
import { formatDate } from "../lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [jobs, setJobs] = useState<InternshipPosting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([resumeApi.list(), internshipApi.list()])
      .then(([r, j]) => { setResumes(r.data); setJobs(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const stats = [
    { label: "Resumes Uploaded", value: resumes.length, icon: <FileText className="w-5 h-5 text-zinc-400" /> },
    { label: "Internships Available", value: jobs.length, icon: <Briefcase className="w-5 h-5 text-zinc-400" /> },
    { label: "Parsed Successfully", value: resumes.filter(r => r.parsed_status === "parsed").length, icon: <CheckCircle2 className="w-5 h-5 text-zinc-400" /> },
    { label: "Domains Covered", value: [...new Set(jobs.map(j => j.domain))].length, icon: <Target className="w-5 h-5 text-zinc-400" /> },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting()}, {user?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">Here's your internship journey overview</p>
        </div>
        <Button onClick={() => navigate("/app/resumes")}>
          <Upload className="w-4 h-4 mr-2" /> Upload Resume
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map(s => (
              <Card key={s.label} className="bg-card/50 backdrop-blur-sm border-border">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center border border-border shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-sm text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Resumes */}
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Recent Resumes
                </CardTitle>
                <Button variant="secondary" size="sm" onClick={() => navigate("/app/resumes")}>
                  View all
                </Button>
              </CardHeader>
              <CardContent>
                {resumes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                    <h3 className="font-semibold text-lg">No resumes yet</h3>
                    <p className="text-muted-foreground text-sm mb-4">Upload your first resume to get started</p>
                    <Button onClick={() => navigate("/app/resumes")} size="sm">Upload Now</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resumes.slice(0, 4).map(r => (
                      <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50 border border-border/50 transition-colors hover:bg-secondary">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.original_filename}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(r.uploaded_at)}</p>
                        </div>
                        <Badge variant={r.parsed_status === "parsed" ? "default" : r.parsed_status === "pending" ? "secondary" : "destructive"}>
                          {r.parsed_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { icon: <Upload className="w-5 h-5" />, label: "Upload a Resume", sub: "PDF or DOCX, up to 5MB", path: "/app/resumes" },
                    { icon: <TrendingUp className="w-5 h-5" />, label: "Find Matching Internships", sub: "AI-powered semantic matching", path: "/resume-match" },
                    { icon: <Briefcase className="w-5 h-5" />, label: "Browse All Internships", sub: `${jobs.length} positions available`, path: "/jobs" },
                    { icon: <FileText className="w-5 h-5" />, label: "Check ATS Score", sub: "See how your resume scores", path: "/ats-score" },
                  ].map(a => (
                    <div key={a.path} onClick={() => navigate(a.path)}
                      className="group flex items-center gap-4 p-4 rounded-xl bg-secondary/40 border border-transparent hover:border-border hover:bg-secondary/80 transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {a.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{a.label}</div>
                        <div className="text-xs text-muted-foreground">{a.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
