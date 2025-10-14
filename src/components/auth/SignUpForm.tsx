import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
});

interface SignUpFormProps {
  onSuccess: () => void;
}

export const SignUpForm = ({ onSuccess }: SignUpFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      signUpSchema.parse({ email, password, fullName });

      const emailLower = email.toLowerCase().trim();

      // Sign up with Supabase - validation handled by database trigger
      const { error } = await supabase.auth.signUp({
        email: emailLower,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else if (error.message.includes('not authorized')) {
          toast.error('Access restricted to HV Capital participants.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Account created successfully!');
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="signup-name" className="text-sm font-medium">
          Full Name
        </label>
        <Input
          id="signup-name"
          type="text"
          placeholder="Felix Holtkamp"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="glass-hover"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Email Address
        </label>
        <Input
          id="signup-email"
          type="email"
          placeholder="your.email@hvcapital.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="glass-hover"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="signup-password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="signup-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="glass-hover"
          minLength={6}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Only verified HV Capital email addresses can register.
      </p>
    </form>
  );
};
