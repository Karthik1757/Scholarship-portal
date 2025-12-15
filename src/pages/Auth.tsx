import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { GraduationCap, ShieldCheck } from 'lucide-react';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(searchParams.get('type') === 'admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        toast({ title: isAdminLogin ? 'Welcome Admin!' : 'Welcome back!' });
        
        if (isAdminLogin) {
          // Check role before redirecting
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .eq('role', 'admin')
              .maybeSingle();
            
            if (roleData) {
              navigate('/admin');
            } else {
              toast({ 
                title: 'Access Denied', 
                description: 'You do not have admin privileges.', 
                variant: 'destructive' 
              });
              navigate('/dashboard');
            }
          }
        } else {
          navigate('/dashboard');
        }
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const redirectUrl = `${window.location.origin}/profile-wizard`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) throw error;
        toast({ title: 'Account created! Redirecting to complete your profile...' });
        navigate('/profile-wizard');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let errorMessage = error.message;
      
      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        errorMessage = "Unable to connect to the server. Please check your internet connection or project configuration.";
      } else if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      }

      toast({
        title: 'Authentication Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button 
            variant={isAdminLogin ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setIsAdminLogin(!isAdminLogin)}
            className="gap-2"
        >
            <ShieldCheck className="h-4 w-4" />
            {isAdminLogin ? 'Student Login' : 'Admin Login'}
        </Button>
        <LanguageToggle />
      </div>
      
      <Card className={`w-full max-w-md shadow-medium transition-all duration-300 ${isAdminLogin ? 'border-primary/50' : ''}`}>
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${isAdminLogin ? 'from-slate-700 to-slate-900' : 'from-primary to-secondary'}`}>
              {isAdminLogin ? <ShieldCheck className="h-8 w-8 text-white" /> : <GraduationCap className="h-8 w-8 text-white" />}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isAdminLogin ? 'Admin Portal' : (isLogin ? t('signIn') : t('signUp'))}
          </CardTitle>
          <CardDescription>
            {isAdminLogin 
                ? 'Secure access for scholarship administrators' 
                : (isLogin ? t('heroSubtitle') : 'Create an account to get started')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={isAdminLogin ? "admin@scholarmatch.com" : "student@example.com"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {!isLogin && !isAdminLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : (isAdminLogin ? 'Login to Admin Dashboard' : (isLogin ? t('signIn') : t('signUp')))}
            </Button>
          </form>
          {!isAdminLogin && (
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}{' '}
                {isLogin ? t('signUp') : t('signIn')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
