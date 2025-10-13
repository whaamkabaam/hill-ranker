import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { useAuth } from '@/hooks/useAuth';
import { BackgroundRippleEffect } from '@/components/ui/background-ripple-effect';
import hvLogo from '@/assets/hv-capital-logo.png';
const Auth = () => {
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  const [activeTab, setActiveTab] = useState('signin');

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);
  const handleSuccess = () => {
    navigate('/');
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background Ripple Effect */}
      <BackgroundRippleEffect rows={15} cols={40} cellSize={52} />
      
      <motion.div initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.5
    }} className="relative z-10 w-full max-w-md">
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <img src={hvLogo} alt="HV Capital" className="h-20 object-contain mb-2" />
            
            
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              <SignInForm onSuccess={handleSuccess} />
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <SignUpForm onSuccess={handleSuccess} />
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>;
};
export default Auth;