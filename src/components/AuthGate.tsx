import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import hvLogo from "@/assets/hv-capital-logo.png";
interface AuthGateProps {
  onAuthenticated: (email: string) => void;
}
export const AuthGate = ({
  onAuthenticated
}: AuthGateProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from("allowed_users").select("email").eq("email", email.toLowerCase().trim()).maybeSingle();
      if (error) throw error;
      if (data) {
        toast.success("Access granted!");
        onAuthenticated(email.toLowerCase().trim());
      } else {
        toast.error("Access restricted to HV Capital participants.");
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.5
    }} className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <img src={hvLogo} alt="HV Capital" className="h-20 object-contain mb-2" />
            <h1 className="text-5xl font-bold text-primary tracking-tight">tools</h1>
            <p className="text-muted-foreground text-lg">Internal tools for HVC</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input id="email" type="email" placeholder="your.email@hvcapital.com" value={email} onChange={e => setEmail(e.target.value)} required className="glass-hover" />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Enter"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Access is restricted to verified HV Capital email addresses.
          </p>
        </div>
      </motion.div>
    </div>;
};