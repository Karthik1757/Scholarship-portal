import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { GraduationCap, Search, TrendingUp, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [scholarshipCount, setScholarshipCount] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('scholarships')
        .select('*', { count: 'exact', head: true });
      
      if (count !== null) {
        setScholarshipCount(count);
      }
    };
    fetchCount();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold">ScholarMatch</span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <Button variant="ghost" onClick={() => navigate('/auth')}>
            {t('signIn')}
          </Button>
          <Button onClick={() => navigate('/auth')}>
            {t('getStarted')}
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              {t('heroTitle')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('heroSubtitle')}
            </p>
            {scholarshipCount !== null && (
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm mt-4">
                Over {scholarshipCount}+ scholarships available now
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate('/auth')}
              className="text-lg"
            >
              {t('getStarted')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/auth')}
              className="text-lg"
            >
              {t('signIn')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            <div className="p-6 bg-card rounded-xl shadow-soft border">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered Matching</h3>
              <p className="text-muted-foreground">
                Advanced algorithms match you with scholarships based on your unique profile
              </p>
            </div>

            <div className="p-6 bg-card rounded-xl shadow-soft border">
              <div className="p-3 bg-secondary/10 rounded-lg w-fit mb-4">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Updates</h3>
              <p className="text-muted-foreground">
                Stay informed about new opportunities and upcoming deadlines
              </p>
            </div>

            <div className="p-6 bg-card rounded-xl shadow-soft border">
              <div className="p-3 bg-accent/10 rounded-lg w-fit mb-4">
                <Bell className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Notifications</h3>
              <p className="text-muted-foreground">
                Never miss a deadline with intelligent reminders tailored to you
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
