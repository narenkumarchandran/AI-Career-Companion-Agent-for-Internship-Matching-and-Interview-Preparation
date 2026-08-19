import { useState, useEffect } from "react";
import { generateCoverLetter, applyToJob, isApplied } from "../../lib/jobUtils";
import { Copy, Download, CheckCircle, Send, FileText, Lightbulb, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import type { InternshipPosting } from "../../types";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Props {
  job: InternshipPosting & { matched_skills?: string[]; missing_skills?: string[] };
  onClose: () => void;
  open: boolean;
}

export function CoverLetterModal({ job, onClose, open }: Props) {
  const [letter, setLetter] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (open) {
      setLetter(generateCoverLetter({
        role_title: job.role_title,
        company: job.company,
        domain: job.domain,
        required_skills: job.required_skills,
        description: job.description,
      }));
    }
  }, [job, open]);

  const copy = () => {
    navigator.clipboard.writeText(letter);
    toast.success("Copied to clipboard!");
  };

  const download = () => {
    const blob = new Blob([letter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cover_Letter_${job.company}_${job.role_title}.txt`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-3xl border-border">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Cover Letter</DialogTitle>
              <DialogDescription>{job.role_title} @ {job.company}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {editing ? (
            <textarea
              value={letter}
              onChange={e => setLetter(e.target.value)}
              className="w-full min-h-[400px] max-h-[60vh] overflow-y-auto p-4 bg-secondary/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground bg-secondary/30 rounded-lg p-6 border border-border min-h-[400px] max-h-[60vh] overflow-y-auto font-sans">
              {letter}
            </pre>
          )}

          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              This letter is AI-generated based on your default resume and the job description. 
              Always review and personalize it before sending!
            </span>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setEditing(e => !e)}>
            <Edit2 className="w-4 h-4 mr-2" /> {editing ? "Preview" : "Edit"}
          </Button>
          <Button variant="outline" onClick={copy}>
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
          <Button variant="outline" onClick={download}>
            <Download className="w-4 h-4 mr-2" /> Download .txt
          </Button>
          <Button onClick={onClose}>
            <CheckCircle className="w-4 h-4 mr-2" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Apply + Cover Letter action buttons
// ---------------------------------------------------------------------------
interface ActionButtonsProps {
  job: InternshipPosting & { matched_skills?: string[]; missing_skills?: string[] };
  compact?: boolean;
}

export function JobActionButtons({ job, compact = false }: ActionButtonsProps) {
  const [applied, setApplied] = useState(() => isApplied(job.id));
  const [showCover, setShowCover] = useState(false);

  const handleApply = () => {
    applyToJob(job.id);
    setApplied(true);
    toast.success(`Applied to ${job.role_title} at ${job.company}!`);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {applied ? (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 px-3 py-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Applied
          </Badge>
        ) : (
          <Button size={compact ? "sm" : "default"} onClick={handleApply}>
            <Send className="w-4 h-4 mr-2" />
            Apply Now
          </Button>
        )}
        <Button variant="secondary" size={compact ? "sm" : "default"} onClick={() => setShowCover(true)}>
          <FileText className="w-4 h-4 mr-2" />
          {compact ? "Cover Letter" : "Generate Cover Letter"}
        </Button>
      </div>
      <CoverLetterModal open={showCover} job={job} onClose={() => setShowCover(false)} />
    </>
  );
}
