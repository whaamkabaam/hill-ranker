import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Lock, Shield, User as UserIcon, BarChart3 } from "lucide-react";
import { ToolRequestDialog } from "@/components/ToolRequestDialog";
import hvLogo from "@/assets/hv-capital-logo.png";
import genpeachLogo from "@/assets/genpeach-logo.jpg";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
const Dashboard = () => {
  const {
    user,
    signOut
  } = useAuth();
  const {
    role,
    jobTitle,
    isAdmin,
    loading: roleLoading
  } = useUserRole();
  const navigate = useNavigate();
  const [promptCount, setPromptCount] = useState(0);
  useEffect(() => {
    loadPromptCount();
  }, []);
  const loadPromptCount = async () => {
    try {
      const {
        count,
        error
      } = await supabase.from("prompts").select("*", {
        count: 'exact',
        head: true
      });
      if (error) throw error;
      setPromptCount(count || 0);
    } catch (error) {
      console.error("Error loading prompt count:", error);
    }
  };
  const getFirstName = () => {
    if (!user?.email) return "User";
    const emailPrefix = user.email.split('@')[0];
    // Split by dot and take first part (handles felix.holtkamp -> felix)
    const firstName = emailPrefix.split('.')[0];
    // Capitalize first letter
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
  };
  return <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <header className="glass border-b">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={hvLogo} alt="HV Capital" className="h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">HVC.tools</h1>
              <p className="text-xs text-muted-foreground">Internal Tools Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{getFirstName()}</p>
              {jobTitle && <p className="text-xs text-muted-foreground">{jobTitle}</p>}
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="glass-hover">
              <UserIcon className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="glass-hover">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {getFirstName()} 👋
          </h2>
          {jobTitle && <p className="text-lg text-muted-foreground mb-1">
              {jobTitle}
            </p>}
          <p className="text-muted-foreground">
            Select a tool below to get started
          </p>
        </div>

        {/* Admin Panel (only visible to admins) */}
        {isAdmin && <div className="mb-6 glass-card rounded-xl p-6 border-2 border-primary/50 hover:border-primary cursor-pointer group animate-scale-in" onClick={() => navigate('/admin')}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <Badge variant="destructive">Admin Only</Badge>
            </div>

            <h3 className="text-lg font-semibold mb-2">Admin Panel</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Manage users, roles, and platform settings
            </p>

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Full platform access
              </span>
              <Button size="sm" className="gap-2 group-hover:gap-3 transition-all">
                Manage
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>}

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* GenPeach - Active Tool */}
          <div className="glass-card rounded-xl p-6 cursor-pointer group hover-lift animate-fade-in" onClick={() => navigate('/tools/image-ranker')}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center">
                <img src={genpeachLogo} alt="GenPeach" className="w-full h-full object-cover" />
              </div>
              <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">
                Active
              </span>
            </div>

            <h3 className="text-lg font-semibold mb-2">GenPeach</h3>
            <p className="text-sm text-muted-foreground mb-4">Compare SOTA Image Gen Models vs GenPeach</p>

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {promptCount} prompts available
              </span>
              <Button size="sm" className="gap-2 group-hover:gap-3 transition-all">
                Launch
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ToolRequestDialog />
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t mt-auto">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <p>© 2025 HV Capital. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button className="hover:text-foreground transition-colors">Help</button>
            <button className="hover:text-foreground transition-colors">Support</button>
          </div>
        </div>
      </footer>
    </div>;
};
export default Dashboard;