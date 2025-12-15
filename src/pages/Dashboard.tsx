import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { GraduationCap, Calendar, Archive, Search, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { Navbar } from '@/components/Navbar';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [profile, setProfile] = useState<any>(null);
  const [matchedScholarships, setMatchedScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [applicationCount, setApplicationCount] = useState(0);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [totalScholarships, setTotalScholarships] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (!data) {
      navigate('/profile-wizard');
      return;
    }
    setProfile(data);
    loadMatchedScholarships(data);
  };

  const loadStats = async () => {
    if (!user) return;

    // Applications Count
    const { count: appCount } = await supabase
        .from('scholarship_applications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'applied');
    
    if (appCount !== null) {
        setApplicationCount(appCount);
    }

    // Total Scholarships (Count all, including expired, to show system scale)
    const { count: totalCount } = await supabase
        .from('scholarships')
        .select('*', { count: 'exact', head: true });
        
    if (totalCount !== null) {
        setTotalScholarships(totalCount);
    }

    // Upcoming Deadlines
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data: deadlineData } = await supabase
      .from('scholarships')
      .select('id, title, deadline')
      .gte('deadline', todayIso)
      .lte('deadline', thirtyDaysFromNow.toISOString())
      .order('deadline', { ascending: true })
      .limit(5);

    if (deadlineData) {
        setUpcomingDeadlines(deadlineData);
    }
  };

  // Helper to safely parse rules
  const getRules = (data: any) => {
    if (!data || !data.eligibility_rules) return {};
    let rules = data.eligibility_rules;
    if (typeof rules === 'string') {
      try { rules = JSON.parse(rules); } catch (e) { return {}; }
    }
    return rules;
  };

  // Robust helper to find values
  const findValue = (obj: any, keys: string[]) => {
    if (!obj) return undefined;
    const objKeys = Object.keys(obj);
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
      const foundKey = objKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null && obj[foundKey] !== '') {
        return obj[foundKey];
      }
    }
    return undefined;
  };

  // Helper to handle both string and array inputs for rules
  const checkInclusion = (ruleValue: any, userValue: string) => {
      if (!ruleValue) return true; // No rule defined means eligible
      if (Array.isArray(ruleValue)) {
          return ruleValue.length === 0 || ruleValue.includes(userValue);
      }
      // Handle string value (e.g. "Masters" vs "Masters")
      return String(ruleValue) === String(userValue);
  };

  const isEligible = (scholarship: any, userProfile: any) => {
    const rules = getRules(scholarship);
    if (!rules || Object.keys(rules).length === 0) return true;

    const minMarks = findValue(rules, ['minMarks', 'min_marks', 'marks']);
    const maxIncome = findValue(rules, ['maxIncome', 'max_income', 'familyIncome']);
    
    if (minMarks) {
        const marksVal = typeof minMarks === 'string' ? parseFloat(minMarks.replace(/[^0-9.]/g, '')) : Number(minMarks);
        if (!isNaN(marksVal) && Number(userProfile.marks) < marksVal) return false;
    }
    
    if (maxIncome) {
        const incomeVal = typeof maxIncome === 'string' ? parseFloat(maxIncome.replace(/[^0-9.]/g, '')) : Number(maxIncome);
        if (!isNaN(incomeVal) && Number(userProfile.family_income) > incomeVal) return false;
    }
    
    const states = findValue(rules, ['states', 'state']);
    if (!checkInclusion(states, userProfile.state)) return false;

    const categories = findValue(rules, ['categories', 'category']);
    if (!checkInclusion(categories, userProfile.category)) return false;

    const gender = findValue(rules, ['gender', 'sex']);
    if (gender && gender !== 'Any' && gender.toLowerCase() !== userProfile.gender?.toLowerCase()) return false;

    const educationLevels = findValue(rules, ['educationLevels', 'education_level', 'educationLevel']);
    if (!checkInclusion(educationLevels, userProfile.education_level)) return false;
    
    return true;
  };

  const loadMatchedScholarships = async (userProfile: any) => {
    try {
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // Fetch ALL scholarships first, then filter in JS to correctly handle null deadlines
      const { data, error } = await supabase
        .from('scholarships')
        .select('*');

      if (error) throw error;

      // Filter for active scholarships (future deadline OR no deadline) for matches
      // We generally don't want to recommend expired scholarships
      const activeScholarships = (data || []).filter(s => 
        !s.deadline || s.deadline >= todayIso
      );

      const matches = activeScholarships.filter(s => isEligible(s, userProfile));
      setMatchedScholarships(matches);
    } catch (error) {
      console.error('Error loading scholarships:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }
  
  const filteredMatches = matchedScholarships.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Student'}!
          </h1>
          <p className="text-muted-foreground">
            Here are your personalized scholarship recommendations
          </p>
          <div className="mt-4 max-w-lg relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Search your matched scholarships..."
                  className="pl-10 h-12 bg-card"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Matched Scholarships</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{matchedScholarships.length}</div>
              <p className="text-xs text-muted-foreground">Eligible for you</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Applications</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{applicationCount}</div>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Scholarships</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalScholarships}</div>
              <p className="text-xs text-muted-foreground">Available on platform</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t('upcomingDeadlines')}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {upcomingDeadlines.length}
              </div>
              <p className="text-xs text-muted-foreground">In next 30 days</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{t('topMatches')}</CardTitle>
                      <CardDescription>
                        Scholarships you are eligible for based on your profile
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => navigate('/scholarships')}>
                      View All Scholarships
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {filteredMatches.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{searchQuery ? 'No matched scholarships found with that name.' : 'No eligible scholarships found yet. Try updating your profile or check "All Scholarships".'}</p>
                        <Button variant="link" onClick={() => navigate('/scholarships')} className="mt-2">
                          Browse All Scholarships
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredMatches.map((scholarship) => (
                          <div
                            key={scholarship.id}
                            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-card"
                            onClick={() => navigate(`/scholarship/${scholarship.id}`)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">{scholarship.title}</h3>
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                                    Eligible
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {scholarship.description}
                                </p>
                              </div>
                              <Badge variant="secondary">{scholarship.source}</Badge>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex gap-4 text-sm">
                                {scholarship.amount && (
                                  <span className="text-success font-medium">
                                    ₹{scholarship.amount.toLocaleString()}
                                  </span>
                                )}
                                {scholarship.deadline ? (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(scholarship.deadline), 'MMM dd, yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Open all year
                                  </span>
                                )}
                              </div>
                              <Button size="sm" onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/scholarship/${scholarship.id}`);
                              }}>
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
            </div>
            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Deadlines</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {upcomingDeadlines.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-10">No deadlines in the next 30 days.</p>
                        ) : (
                            <div className="space-y-4">
                                {upcomingDeadlines.map(scholarship => (
                                    <div key={scholarship.id} className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => navigate(`/scholarship/${scholarship.id}`)}>
                                        <div className="bg-muted p-3 rounded-lg">
                                            <Calendar className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm line-clamp-1">{scholarship.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(scholarship.deadline), 'MMM dd, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {upcomingDeadlines.length > 0 && (
                            <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => navigate('/scholarships')}>
                                View All
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
}
