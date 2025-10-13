import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'moderator' | 'user' | null;

export interface UserProfile {
  role: UserRole;
  jobTitle: string | null;
  fullName: string | null;
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isUser: boolean;
}

export const useUserRole = (): UserProfile => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setRole(null);
        setJobTitle(null);
        setFullName(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch role from user_roles
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
          setRole('user');
        } else {
          setRole(roleData?.role || 'user');
        }

        // Fetch job title and full name from profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('job_title, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        } else {
          setJobTitle(profileData?.job_title || null);
          setFullName(profileData?.full_name || null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  return {
    role,
    jobTitle,
    fullName,
    loading,
    isAdmin: role === 'admin',
    isModerator: role === 'moderator' || role === 'admin',
    isUser: role === 'user',
  };
};
