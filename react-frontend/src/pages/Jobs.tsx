import { useEffect, useState } from "react";
import { internshipApi } from "../api/internships";
import type { InternshipPosting } from "../types";
import { formatINR } from "../lib/utils";
import { MapPin, Clock, GraduationCap, Banknote, Search, Filter, X } from "lucide-react";
import { JobActionButtons } from "../components/jobs/JobActions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Jobs() {
  const [jobs, setJobs] = useState<InternshipPosting[]>([]);
  const [filtered, setFiltered] = useState<InternshipPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [selected, setSelected] = useState<InternshipPosting | null>(null);

  useEffect(() => {
    internshipApi.list().then(r => { setJobs(r.data); setFiltered(r.data); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let res = jobs;
    if (query) res = res.filter(j => `${j.company} ${j.role_title} ${j.domain}`.toLowerCase().includes(query.toLowerCase()));
    if (domainFilter) res = res.filter(j => j.domain === domainFilter);
    if (modeFilter) res = res.filter(j => j.mode === modeFilter);
    setFiltered(res);
  }, [query, domainFilter, modeFilter, jobs]);

  const domains = [...new Set(jobs.map(j => j.domain))].sort();
  const modes = [...new Set(jobs.map(j => j.mode))].sort();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse Internships</h1>
        <p className="text-muted-foreground mt-1">{filtered.length} opportunities available</p>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 bg-background/50" placeholder="Search by role, company, domain..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[160px] md:w-auto" value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
              <option value="">All Domains</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[140px] md:w-auto" value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
              <option value="">All Modes</option>
              {modes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {(query || domainFilter || modeFilter) && (
              <Button variant="outline" onClick={() => { setQuery(""); setDomainFilter(""); setModeFilter(""); }}>
                <Filter className="w-4 h-4 mr-2" /> Clear
              </Button>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* List */}
            <div className="flex-1 space-y-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl bg-card/30">
                  <Search className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="font-semibold text-lg">No results found</h3>
                  <p className="text-muted-foreground text-sm">Try adjusting your search criteria</p>
                </div>
              ) : filtered.map(j => (
                <Card key={j.id} 
                  className={`bg-card/50 backdrop-blur-sm transition-all cursor-pointer hover:border-primary/50 hover:bg-card/80 ${selected?.id === j.id ? 'border-primary shadow-sm bg-card/80' : 'border-border'}`}
                  onClick={e => { if ((e.target as HTMLElement).closest("button")) return; setSelected(j); }}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{j.company}</p>
                        <h3 className="text-xl font-bold leading-none">{j.role_title}</h3>
                      </div>
                      <Badge variant="secondary">{j.domain}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{j.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{j.duration_weeks}w</span>
                      <span className="flex items-center gap-1"><Banknote className="w-4 h-4" />{formatINR(j.stipend_inr_per_month)}/mo</span>
                      <Badge variant={j.mode === "Remote" ? "default" : j.mode === "Hybrid" ? "secondary" : "outline"} className={j.mode === "Remote" ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : ""}>{j.mode}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{j.description}</p>
                    <div onClick={e => e.stopPropagation()}>
                      <JobActionButtons job={j} compact />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detail panel */}
            {selected && (
              <Card className="w-full lg:w-[380px] shrink-0 self-start sticky top-6 bg-card/80 backdrop-blur-xl border-border shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{selected.company}</p>
                      <CardTitle className="text-2xl leading-none">{selected.role_title}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="h-8 w-8 rounded-full">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{selected.domain}</Badge>
                    <Badge variant={selected.mode === "Remote" ? "default" : selected.mode === "Hybrid" ? "secondary" : "outline"} className={selected.mode === "Remote" ? "bg-emerald-500/10 text-emerald-500" : ""}>{selected.mode}</Badge>
                  </div>

                  <div className="space-y-3">
                    {[
                      { icon: <MapPin className="w-4 h-4" />, label: "Location", val: selected.location },
                      { icon: <Clock className="w-4 h-4" />, label: "Duration", val: `${selected.duration_weeks} weeks` },
                      { icon: <Banknote className="w-4 h-4" />, label: "Stipend", val: `${formatINR(selected.stipend_inr_per_month)}/month` },
                      { icon: <GraduationCap className="w-4 h-4" />, label: "Education", val: selected.min_education },
                    ].map(item => (
                      <div key={item.label} className="flex gap-3 items-center py-2 border-b border-border/50 last:border-0">
                        <div className="text-muted-foreground">{item.icon}</div>
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-semibold">{item.val}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {selected.required_skills.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                    </div>
                  </div>

                  {selected.preferred_skills.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Preferred Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {selected.preferred_skills.map(s => <Badge key={s} variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">{s}</Badge>)}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <JobActionButtons job={selected} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
