import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Search, Calendar, DollarSign } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { isPast, isFuture, isToday } from 'date-fns';
import { Navbar } from '@/components/Navbar';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const EDUCATION_LEVELS = ['Class 10', 'Class 12', 'Bachelors', 'Masters', 'PhD'];

export default function AllScholarships() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [filteredScholarships, setFilteredScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [showEligibleOnly, setShowEligibleOnly] = useState(false);
  
  const [filters, setFilters] = useState({
    state: '',
    category: '',
    education_level: '',
    source: '',
    minAmount: '',
    maxAmount: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProfile();
    fetchScholarships();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [scholarships, searchQuery, filters, showEligibleOnly, profile]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
    if (data) setProfile(data);
  };

  const fetchScholarships = async () => {
    // Fetch ALL scholarships
    const { data, error } = await supabase
      .from('scholarships')
      .select('*');

    if (error) {
      console.error('Error fetching scholarships:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scholarships.',
        variant: 'destructive',
      });
      return;
    }

    // Custom Sorting Logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedData = (data || []).sort((a, b) => {
      const dateA = a.deadline ? new Date(a.deadline) : null;
      const dateB = b.deadline ? new Date(b.deadline) : null;
      
      // Check if expired (deadline is strictly before today)
      const isExpiredA = dateA && dateA.getTime() < today.getTime();
      const isExpiredB = dateB && dateB.getTime() < today.getTime();

      // 1. Active comes before Expired
      if (isExpiredA && !isExpiredB) return 1;
      if (!isExpiredA && isExpiredB) return -1;

      // 2. Both are Active (Future deadline or No deadline)
      if (!isExpiredA && !isExpiredB) {
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        if (dateA && dateB) return dateA.getTime() - dateB.getTime();
        return 0;
      }

      // 3. Both are Expired
      if (isExpiredA && isExpiredB) {
        return dateB!.getTime() - dateA!.getTime();
      }
      
      return 0;
    });

    setScholarships(sortedData);
    setLoading(false);
  };

  // Helper to safely parse rules regardless of format
  const getRules = (data: any) => {
    if (!data || !data.eligibility_rules) return {};
    let rules = data.eligibility_rules;
    if (typeof rules === 'string') {
      try { rules = JSON.parse(rules); } catch (e) { return {}; }
    }
    return rules;
  };

  // Robust helper to find values with various key casings
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

  const isEligible = (scholarship: any) => {
    if (!profile) return false;
    const rules = getRules(scholarship);
    if (!rules || Object.keys(rules).length === 0) return true;

    const minMarks = findValue(rules, ['minMarks', 'min_marks', 'marks']);
    const maxIncome = findValue(rules, ['maxIncome', 'max_income', 'familyIncome']);
    
    if (minMarks) {
        const marksVal = typeof minMarks === 'string' ? parseFloat(minMarks.replace(/[^0-9.]/g, '')) : Number(minMarks);
        if (!isNaN(marksVal) && Number(profile.marks) < marksVal) return false;
    }
    
    if (maxIncome) {
        const incomeVal = typeof maxIncome === 'string' ? parseFloat(maxIncome.replace(/[^0-9.]/g, '')) : Number(maxIncome);
        if (!isNaN(incomeVal) && Number(profile.family_income) > incomeVal) return false;
    }
    
    const states = findValue(rules, ['states', 'state']);
    if (!checkInclusion(states, profile.state)) return false;

    const categories = findValue(rules, ['categories', 'category']);
    if (!checkInclusion(categories, profile.category)) return false;

    const gender = findValue(rules, ['gender', 'sex']);
    if (gender && gender !== 'Any' && gender.toLowerCase() !== profile.gender?.toLowerCase()) return false;

    const educationLevels = findValue(rules, ['educationLevels', 'education_level', 'educationLevel']);
    if (!checkInclusion(educationLevels, profile.education_level)) return false;
    
    return true;
  };

  const applyFilters = () => {
    let filtered = scholarships;

    // Eligible filter
    if (showEligibleOnly && profile) {
      filtered = filtered.filter(s => isEligible(s));
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // State filter
    if (filters.state && filters.state !== 'all') {
      filtered = filtered.filter((s) => {
        const rules = getRules(s);
        const states = findValue(rules, ['states', 'state']);
        return checkInclusion(states, filters.state);
      });
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter((s) => {
        const rules = getRules(s);
        const categories = findValue(rules, ['categories', 'category']);
        return checkInclusion(categories, filters.category);
      });
    }

    // Education level filter
    if (filters.education_level && filters.education_level !== 'all') {
      filtered = filtered.filter((s) => {
        const rules = getRules(s);
        const levels = findValue(rules, ['educationLevels', 'education_level']);
        return checkInclusion(levels, filters.education_level);
      });
    }

    // Source filter
    if (filters.source && filters.source !== 'all') {
      filtered = filtered.filter((s) => s.source === filters.source);
    }

    // Amount filters
    if (filters.minAmount) {
      filtered = filtered.filter((s) => s.amount >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      filtered = filtered.filter((s) => s.amount <= parseFloat(filters.maxAmount));
    }

    setFilteredScholarships(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setShowEligibleOnly(false);
    setFilters({
      state: '',
      category: '',
      education_level: '',
      source: '',
      minAmount: '',
      maxAmount: '',
    });
  };

  const totalPages = Math.ceil(filteredScholarships.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentScholarships = filteredScholarships.slice(startIndex, endIndex);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6 pl-0 hover:pl-2 transition-all">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">All Scholarships</h1>
          <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border">
            <Switch
              id="eligible-mode"
              checked={showEligibleOnly}
              onCheckedChange={setShowEligibleOnly}
            />
            <Label htmlFor="eligible-mode" className="cursor-pointer">Show Eligible Only</Label>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search scholarships..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={filters.state} onValueChange={(value) => setFilters({ ...filters, state: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.education_level} onValueChange={(value) => setFilters({ ...filters, education_level: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Education" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {EDUCATION_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="Government">Government</SelectItem>
                  <SelectItem value="Private">Private</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Min Amount (₹)"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
              />

              <Input
                type="number"
                placeholder="Max Amount (₹)"
                value={filters.maxAmount}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
              />
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Showing {currentScholarships.length} of {filteredScholarships.length} scholarships
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scholarships Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {currentScholarships.map((scholarship) => {
            const eligible = isEligible(scholarship);
            // Determine expiration status based on deadline
            const deadlineDate = scholarship.deadline ? new Date(scholarship.deadline) : null;
            const isExpired = deadlineDate ? isPast(deadlineDate) && !isToday(deadlineDate) : false;
            
            return (
              <Card
                key={scholarship.id}
                className={`hover:shadow-lg transition-shadow cursor-pointer flex flex-col ${isExpired ? 'opacity-75 bg-muted/30' : ''}`}
                onClick={() => navigate(`/scholarship/${scholarship.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg line-clamp-2">{scholarship.title}</CardTitle>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                        {isExpired && (
                            <Badge variant="destructive">Expired</Badge>
                        )}
                        {eligible && !isExpired && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                            Eligible
                          </Badge>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                      {scholarship.source}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="font-semibold">₹{scholarship.amount?.toLocaleString()}</span>
                    </div>
                    {scholarship.deadline ? (
                      <div className={`flex items-center gap-2 text-sm ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Calendar className="h-4 w-4" />
                        <span>Deadline: {new Date(scholarship.deadline).toLocaleDateString()}</span>
                      </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Open all year</span>
                        </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {scholarship.description}
                    </p>
                  </div>
                  <Button className="w-full mt-auto" variant={isExpired ? "outline" : "secondary"}>
                    {isExpired ? 'View Details' : 'View Details'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => setCurrentPage(i + 1)}
                    isActive={currentPage === i + 1}
                    className="cursor-pointer"
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
