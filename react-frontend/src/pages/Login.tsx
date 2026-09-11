import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Brain, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Welcome back!");
      } else {
        await register(form.name, form.email, form.password);
        toast.success("Account created!");
      }
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Something went wrong";
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-6">
      {/* background blobs */}
      <div className="absolute rounded-full blur-[100px] opacity-20 bg-indigo-600 w-[400px] h-[400px] -top-20 -left-20 pointer-events-none" />
      <div className="absolute rounded-full blur-[100px] opacity-20 bg-pink-600 w-[300px] h-[300px] -bottom-20 -right-20 pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-border bg-card/60 backdrop-blur-xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-400 flex items-center justify-center">
              <Brain className="w-5 h-5 text-zinc-900" />
            </div>
            <div>
              <CardTitle className="text-xl">AI Career Assistant</CardTitle>
              <p className="text-xs text-muted-foreground">RAG-powered career matching</p>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Sign in to your account" : "Create your account"}
            </h2>
            <CardDescription className="mt-2">
              {mode === "login" ? "Welcome back! Enter your credentials." : "Get started with AI-powered career matching."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Naren Kumar" value={form.name} onChange={set("name")} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  className="pr-10"
                  type={showPwd ? "text" : "password"}
                  placeholder={mode === "register" ? "Min 8 characters" : "••••••••"}
                  value={form.password} onChange={set("password")} required minLength={8}
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading && <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Don't have an account? <button onClick={() => setMode("register")} className="font-semibold text-foreground hover:underline">Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode("login")} className="font-semibold text-foreground hover:underline">Sign in</button></>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
