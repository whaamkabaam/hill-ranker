import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import ModelPerformanceChart from "@/components/admin/ModelPerformanceChart";
import QualityMetricsDashboard from "@/components/admin/QualityMetricsDashboard";
import { GlobalLeaderboard } from "@/components/GlobalLeaderboard";

const Analytics = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Advanced Analytics</h1>
            <p className="text-muted-foreground">
              {isAdmin ? 'Complete analytics dashboard with all user data' : 'Explore model performance and quality metrics'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="leaderboard">Global Leaderboard</TabsTrigger>
            <TabsTrigger value="performance">Model Performance</TabsTrigger>
            <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="space-y-6">
            <GlobalLeaderboard />
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <ModelPerformanceChart />
          </TabsContent>

          <TabsContent value="quality" className="space-y-6">
            <QualityMetricsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
