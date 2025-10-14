import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, BarChart3, Users, TrendingUp, Grid3x3 } from 'lucide-react';
import ModelPerformanceChart from '@/components/admin/ModelPerformanceChart';
import QualityMetricsDashboard from '@/components/admin/QualityMetricsDashboard';

export default function Analytics() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/admin');
    }
  }, [isAdmin, roleLoading, navigate]);

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Panel
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">Deep insights into voting behavior and model performance</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="performance" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Model Performance
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-2">
              <Users className="h-4 w-4" />
              Quality Metrics
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-2" onClick={() => navigate('/admin/pairwise-matrix')}>
              <Grid3x3 className="h-4 w-4" />
              Pairwise Matrix
            </TabsTrigger>
          </TabsList>

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
}
