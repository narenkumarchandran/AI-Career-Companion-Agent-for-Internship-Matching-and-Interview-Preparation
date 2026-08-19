import { useEffect, useState } from "react";
import { useResumes } from "../hooks/useResumes";
import { internshipApi } from "../api/internships";
import type { InternshipMatch } from "../types";
import { formatINR, scoreColor } from "../lib/utils";
import { MapPin, Clock, Banknote, Sparkles, ChevronDown, ChevronUp, AlertCircle, FileText, Target, Link } from "lucide-react";
import { JobActionButtons } from "../components/jobs/JobActions";
import toast from "react-hot-toast";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold" style={{ color: scoreColor(value) }}>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: scoreColor(value) }} />
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: InternshipMatch }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(match.match_percentage);

  return (
    <Card className="mb-4 bg-card/50 backdrop-blur-sm hover:border-border/80 transition-colors">
      <CardContent className="p-5">
        <div className="flex gap-4 items-start flex-col sm:flex-row">
          {/* Score ring */}
          <div className="shrink-0 text-center flex flex-col items-center">
            <div className="relative w-20 h-20">
              <ResponsiveContainer width={80} height={80}>
                <RadialBarChart cx={40} cy={40} innerRadius={28} outerRadius={38}
                  data={[{ value: pct, fill: scoreColor(match.match_score) }]}
                  startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--secondary))" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-sm font-extrabold leading-none" style={{ color: scoreColor(match.match_score) }}>{pct}%</div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-tight max-w-[80px]">{match.match_label}</div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">{match.company}</div>
                <div className="text-lg font-bold text-foreground">{match.role_title}</div>
              </div>
              <Badge variant="secondary">{match.domain}</Badge>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{match.location}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{match.duration_weeks}w</span>
              <span className="flex items-center gap-1"><Banknote className="w-3.5 h-3.5" />{formatINR(match.stipend_inr_per_month)}/mo</span>
              <Badge variant={match.mode === "Remote" ? "default" : match.mode === "Hybrid" ? "secondary" : "outline"} className="text-[10px] h-5 px-1.5 py-0">
                {match.mode}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-1.5 mt-3">
              {match.matched_skills.slice(0, 5).map(s => (
                <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-primary/5 text-primary border-primary/20">{s}</Badge>
              ))}
              {match.missing_skills.slice(0, 3).map(s => (
                <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-destructive/5 text-destructive border-destructive/20">− {s}</Badge>
              ))}
            </div>

            <div className="flex gap-3 mt-4 flex-wrap items-center">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} className="h-8 text-xs">
                {expanded ? <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Less</> : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> Details</>}
              </Button>
              <JobActionButtons job={match as any} compact />
            </div>

            {expanded && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <ScoreBar label="Skill Match" value={match.skill_score} />
                    <ScoreBar label="Semantic Fit" value={match.semantic_score} />
                    <ScoreBar label="Education Match" value={match.education_score} />
                    <ScoreBar label="Location Match" value={match.location_score} />
                  </div>
                  <div>
                    {match.missing_skills.length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Skills to develop</div>
                        <div className="flex flex-wrap gap-1.5">
                          {match.missing_skills.map(s => (
                            <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-destructive/5 text-destructive border-destructive/20">{s}</Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">{match.description}</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResumeMatch() {
  const { resumes, parsedResumes, defaultResume, loading: loadingResumes } = useResumes();
  const [selectedId, setSelectedId] = useState<string>("");
  const [matches, setMatches] = useState<InternshipMatch[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId && defaultResume) {
      setSelectedId(defaultResume.id);
    }
  }, [defaultResume, selectedId]);

  const selectedResume = resumes.find(r => r.id === selectedId);
  const isParsed = selectedResume?.parsed_status === "parsed";

  const runMatch = async () => {
    if (!selectedId) { toast.error("Select a resume first"); return; }
    if (!isParsed) { toast.error("The selected resume hasn't been parsed yet. Please wait or choose a parsed one."); return; }
    setLoading(true);
    try {
      const { data } = await internshipApi.match(selectedId, topK);
      setMatches(data.results);
      setSummary(data.summary);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Matching failed";
      toast.error(String(msg));
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Resume Matching</h1>
        <p className="text-muted-foreground mt-1">Find internships that best match your skills and experience</p>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium mb-1.5 block">Select Resume</label>
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
                  onChange={e => setSelectedId(e.target.value)}
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
            <div className="min-w-[120px]">
              <label className="text-sm font-medium mb-1.5 block">Top Results</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={topK} 
                onChange={e => setTopK(Number(e.target.value))}
              >
                {[5, 10, 15, 20].map(k => <option key={k} value={k}>{k} matches</option>)}
              </select>
            </div>
            <Button onClick={runMatch} disabled={loading || !selectedId || !isParsed} className="h-10">
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {loading ? "Matching…" : "Find Matches"}
            </Button>
          </div>

          {/* Status feedback */}
          {selectedResume && !isParsed && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              This resume is not yet parsed (status: <strong className="font-semibold">{selectedResume.parsed_status}</strong>). Please select a successfully parsed resume.
            </div>
          )}
          {selectedResume && isParsed && (
            <div className="mt-4 flex gap-3 flex-wrap items-center pt-4 border-t border-border">
              {selectedResume.full_name && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {selectedResume.full_name}</span>}
              {Array.isArray(selectedResume.skills) && selectedResume.skills.slice(0, 5).map(s => (
                <Badge key={String(s)} variant="secondary" className="text-[10px] px-1.5 py-0.5 font-normal">{String(s)}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* No parsed resumes guide */}
      {!loadingResumes && parsedResumes.length === 0 && resumes.length > 0 && (
        <div className="flex gap-3 items-start p-4 rounded-xl border border-amber-500/20 bg-amber-500/10">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-amber-600 dark:text-amber-400 mb-1">No parsed resumes yet</div>
            <div className="text-sm text-amber-600/80 dark:text-amber-400/80">
              Your uploaded resume(s) are still being processed or failed to parse.
              Go to <Link to="/app/resumes" className="underline hover:text-amber-600 dark:hover:text-amber-300">My Resumes</Link> to check the status or upload a new one.
            </div> 
          </div>
        </div>
      )}

      {summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> AI Summary
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">{summary}</div>
          </CardContent>
        </Card>
      )}

      {matches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">{matches.length} Matches Found</h2>
          {matches.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      )}

      {!loading && matches.length === 0 && parsedResumes.length > 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-6 border border-border">
            <Target className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">Ready to match</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            {selectedId ? `Resume selected. Click "Find Matches" to get AI-powered recommendations.` : "Select a resume above then click Find Matches."}
          </p>
          {!selectedId && (
            <div className="flex flex-wrap gap-2 justify-center">
              {parsedResumes.map(r => (
                <Button key={r.id} variant="secondary" size="sm" onClick={() => setSelectedId(r.id)}>
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
