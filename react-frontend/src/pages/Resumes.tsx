import { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { resumeApi } from "../api/resume";
import type { ResumeOut } from "../types";
import { formatDate, formatBytes } from "../lib/utils";
import { Upload, FileText, Download, Trash2, RefreshCw, FileUp, AlertCircle, FileArchive } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Resumes() {
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await resumeApi.list(); setResumes(data); }
    catch { toast.error("Failed to load resumes"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDrop = async (files: File[]) => {
    if (!files[0]) return;
    setUploading(true);
    const t = toast.loading("Uploading & parsing...");
    try {
      await resumeApi.upload(files[0]);
      toast.success("Resume uploaded!", { id: t });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload failed";
      toast.error(String(msg), { id: t });
    } finally { setUploading(false); }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxSize: 5 * 1024 * 1024, multiple: false,
  });

  const handleDownload = async (r: ResumeOut) => {
    try {
      const res = await resumeApi.download(r.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = r.original_filename; a.click();
    } catch { toast.error("Download failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resume?")) return;
    try { await resumeApi.delete(id); setResumes(rs => rs.filter(r => r.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Resumes</h1>
          <p className="text-muted-foreground mt-1">Upload and manage your resumes for AI matching</p>
        </div>
        <Button variant="secondary" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="space-y-6">
        {/* Dropzone */}
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30"
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <div className="text-sm font-medium text-muted-foreground">Processing your resume...</div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
                <FileUp className={`w-8 h-8 transition-transform ${isDragActive ? "scale-110 text-primary" : ""}`} />
              </div>
              <h3 className="text-lg font-bold mb-1">{isDragActive ? "Drop it here!" : "Drop your resume here"}</h3>
              <p className="text-sm text-muted-foreground mb-6">PDF or DOCX · Max 5MB · Click to browse</p>
              <Button type="button">
                <Upload className="w-4 h-4 mr-2" /> Choose File
              </Button>
            </div>
          )}
        </div>

        {/* Resume list */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-6 border border-border">
              <FileArchive className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No resumes uploaded</h3>
            <p className="text-muted-foreground text-sm">Upload your first resume to start matching with internships</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {resumes.map(r => (
              <Card key={r.id} className="bg-card/50 backdrop-blur-sm hover:border-border/80 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base text-foreground truncate">{r.original_filename}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                      <span className="font-medium">{formatBytes(r.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(r.uploaded_at)}</span>
                      {r.full_name && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium">{r.full_name}</span>
                        </>
                      )}
                    </div>
                    {r.parsed_status === "parsed" && Array.isArray(r.skills) && (r.skills as string[]).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(r.skills as string[]).slice(0, 6).map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
                    <Badge variant={r.parsed_status === "parsed" ? "default" : r.parsed_status === "pending" ? "secondary" : "destructive"}>
                      {r.parsed_status}
                    </Badge>
                    <Button variant="outline" size="icon" onClick={() => handleDownload(r)} title="Download">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20" onClick={() => handleDelete(r.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
