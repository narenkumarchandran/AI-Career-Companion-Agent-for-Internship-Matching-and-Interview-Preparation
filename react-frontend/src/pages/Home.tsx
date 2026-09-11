import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, FileText, Search, BarChart3, ChevronRight, Bot, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../hooks/useAuth";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleStart = () => {
    navigate(isAuthenticated ? "/app/dashboard" : "/login");
  };

  const features = [
    {
      title: "AI Resume Parsing",
      description: "Instantly parse and analyze your resume data with high accuracy to build a comprehensive professional profile.",
      icon: <FileText className="w-6 h-6 text-primary" />,
    },
    {
      title: "Smart Career Matching",
      description: "Our RAG-powered engine matches your skills and experience to the best career opportunities dynamically.",
      icon: <Search className="w-6 h-6 text-primary" />,
    },
    {
      title: "ATS Optimization Score",
      description: "Get actionable feedback on how to improve your resume to bypass Applicant Tracking Systems.",
      icon: <BarChart3 className="w-6 h-6 text-primary" />,
    },
    {
      title: "AI Career Assistant",
      description: "Chat with your personalized AI assistant for career advice, interview prep, and cover letter generation.",
      icon: <Bot className="w-6 h-6 text-primary" />,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">AI Career Assistant</span>
        </div>
        <div className="flex items-center gap-4">
          {!isAuthenticated && <Button variant="ghost" onClick={() => navigate("/login")}>Sign In</Button>}
          <Button onClick={handleStart}>{isAuthenticated ? "Go to Dashboard" : "Get Started"}</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative px-6 pt-24 pb-32 flex flex-col items-center justify-center text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-4xl mx-auto space-y-8 flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border border-border">
              <Brain className="w-4 h-4 text-primary" /> Introducing the ultimate RAG-powered career tool
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
              Land your dream career with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">AI precision.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              AI Career Assistant analyzes your resume, scores it against ATS standards, and finds the perfect career matches using advanced AI and semantic search.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Button size="lg" className="h-14 px-8 text-base group" onClick={handleStart}>
                {isAuthenticated ? "Go to Dashboard" : "Start Your Journey"}
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              {!isAuthenticated && (
                <Button size="lg" variant="outline" className="h-14 px-8 text-base" onClick={() => navigate("/login")}>
                  View Demo
                </Button>
              )}
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="px-6 py-24 bg-secondary/30 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Supercharge your career hunt</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to stand out to recruiters and find the role that fits your unique skillset.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((feature, idx) => (
                <motion.div 
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="p-8 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-32 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl space-y-8"
          >
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Target className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to get started?</h2>
            <p className="text-xl text-muted-foreground">Join thousands of students who have optimized their resumes and found their perfect career match.</p>
            <Button size="lg" className="h-14 px-10 text-base" onClick={handleStart}>
              {isAuthenticated ? "Go to Dashboard" : "Create your free account"}
            </Button>
          </motion.div>
        </section>
      </main>

      <footer className="py-8 border-t border-border text-center text-sm text-muted-foreground bg-background">
        © {new Date().getFullYear()} AI Career Assistant. Built for students, powered by AI.
      </footer>
    </div>
  );
}
