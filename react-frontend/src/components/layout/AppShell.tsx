import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Chatbot } from "../Chatbot";
import { motion, AnimatePresence } from "framer-motion";

export default function AppShell() {
  const location = useLocation();
  const isAgentPage = location.pathname === "/app/interview-agent";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className={`flex-1 h-screen relative ${isAgentPage ? "overflow-hidden" : "overflow-y-auto"}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={`w-full ${isAgentPage ? "h-full" : "min-h-full flex flex-col"}`}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Hide the floating chatbot widget on the dedicated interview agent page */}
      {!isAgentPage && <Chatbot />}
    </div>
  );
}
