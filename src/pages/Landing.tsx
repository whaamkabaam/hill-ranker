import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { ArrowRight, Sparkles, BarChart3, Users } from "lucide-react";
import hvLogo from "@/assets/hv-capital-logo.png";

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={hvLogo} alt="HV Capital" className="h-10 object-contain" />
            <h1 className="text-xl font-bold">HVC.tools</h1>
          </div>
          <Button onClick={() => navigate('/auth')} variant="outline" className="glass-hover">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border text-sm mb-4 animate-scale-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Internal Tools Platform</span>
          </div>

          <h2 className="text-5xl md:text-6xl font-bold tracking-tight animate-fade-in-down">
            HV Capital
            <br />
            <span className="text-primary">Internal Tools</span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Powerful internal tools built for the HV Capital team. 
            Streamline workflows, make data-driven decisions, and collaborate efficiently.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4 animate-fade-in">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="gap-2 hover-lift shadow-lg hover:shadow-xl transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-16">
            <div className="glass-card rounded-xl p-6 text-left hover-lift animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered Tools</h3>
              <p className="text-muted-foreground text-sm">
                Leverage AI to evaluate and rank visual content with precision and speed.
              </p>
            </div>

            <div className="glass-card rounded-xl p-6 text-left hover-lift animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Data-Driven Insights</h3>
              <p className="text-muted-foreground text-sm">
                Make informed decisions based on comprehensive data analysis and rankings.
              </p>
            </div>

            <div className="glass-card rounded-xl p-6 text-left hover-lift animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
              <p className="text-muted-foreground text-sm">
                Secure platform exclusively for HV Capital team members.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <p>© 2025 HV Capital. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button className="hover:text-foreground transition-colors">Help</button>
            <button className="hover:text-foreground transition-colors">Privacy</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
