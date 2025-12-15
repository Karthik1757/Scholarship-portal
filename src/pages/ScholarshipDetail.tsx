import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar, ExternalLink, CheckCircle2, FileText, ArrowLeft, Loader2, AlertTriangle, ListChecks, ArrowRight, Sparkles, XCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getStoragePath } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';

type ApplicationStatus = 'not_applied' | 'applied' | 'withdrawn' | 'loading';

export default function ScholarshipDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scholarship, setScholarship] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [matchReasons, setMatchReasons] = useState<string[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>('loading');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [similarScholarships, setSimilarScholarships] = useState<any[]>([]);
  const [isEligible, setIsEligible] = useState(true); 
  
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({});
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      loadScholarshipAndProfile();
    }
  }, [user, id]);
  
  useEffect(() => {
    if (scholarship && profile) {
      const eligibility = checkEligibility(scholarship, profile);
      setIsEligible(eligibility);
      calculateMatchReasons();
      checkApplicationStatus();
      fetchSimilarScholarships(scholarship);
      
      if (scholarship.required_documents) {
        const initialFiles: Record<string, File | null> = {};
        scholarship.required_documents.forEach((doc: string) => {
          initialFiles[doc] = null;
        });
        setUploadedFiles(initialFiles);
      }
    }
  }, [scholarship, profile]);

  const getRules = (data: any) => {
    if (!data || !data.eligibility_rules) return {};
    let rules = data.eligibility_rules;
    if (typeof rules === 'string') {
      try { rules = JSON.parse(rules); } catch (e) { return {}; }
    }
    if (Array.isArray(rules) && rules.length > 0) rules = rules[0];
    return rules;
  };

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
  
  const checkInclusion = (ruleValue: any, userValue: string) => {
      if (!ruleValue) return true; 
      if (Array.isArray(ruleValue)) {
          return ruleValue.length === 0 || ruleValue.includes(userValue);
      }
      return String(ruleValue) === String(userValue);
  };

  const checkEligibility = (scholarshipData: any, profileData: any) => {
    const rules = getRules(scholarshipData);
    if (!rules || Object.keys(rules).length === 0) return true;

    const minMarks = findValue(rules, ['minMarks', 'min_marks', 'marks', 'percentage']);
    const maxIncome = findValue(rules, ['maxIncome', 'max_income', 'familyIncome', 'income']);
    
    if (minMarks) {
        const marksVal = typeof minMarks === 'string' ? parseFloat(minMarks.replace(/[^0-9.]/g, '')) : Number(minMarks);
        if (!isNaN(marksVal) && Number(profileData.marks) < marksVal) return false;
    }
    
    if (maxIncome) {
        const incomeVal = typeof maxIncome === 'string' ? parseFloat(maxIncome.replace(/[^0-9.]/g, '')) : Number(maxIncome);
        if (!isNaN(incomeVal) && Number(profileData.family_income) > incomeVal) return false;
    }
    
    const states = findValue(rules, ['states', 'state', 'domicile']);
    if (!checkInclusion(states, profileData.state)) return false;

    const categories = findValue(rules, ['categories', 'category', 'caste']);
    if (!checkInclusion(categories, profileData.category)) return false;

    const gender = findValue(rules, ['gender', 'sex']);
    if (gender && gender !== 'Any' && gender.toLowerCase() !== profileData.gender?.toLowerCase()) return false;

    const educationLevels = findValue(rules, ['educationLevels', 'education_level', 'educationLevel']);
    if (!checkInclusion(educationLevels, profileData.education_level)) return false;
    
    return true;
  };

  const formatLabel = (key: string) => {
    const labels: Record<string, string> = {
      min_marks: "Minimum Marks", minMarks: "Minimum Marks", marks: "Minimum Marks", percentage: "Percentage Required",
      max_income: "Family Income Limit", maxIncome: "Family Income Limit", family_income_limit: "Family Income Limit", familyIncome: "Family Income Limit",
      education_level: "Education Level", educationLevel: "Education Level", educationLevels: "Education Level",
      states: "Eligible States", state: "Eligible States", location: "Location", domicile: "Domicile",
      categories: "Categories", category: "Category", caste: "Caste",
      gender: "Gender", sex: "Gender",
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim().replace(/\b\w/g, l => l.toUpperCase());
  };

  const loadScholarshipAndProfile = async () => {
    const { data: scholarshipData, error: scholarshipError } = await supabase
      .from('scholarships')
      .select('*')
      .eq('id', id)
      .single();

    if (scholarshipError || !scholarshipData) {
      toast({ title: 'Error', description: 'Scholarship not found.', variant: 'destructive' });
      navigate('/dashboard');
      return;
    }
    setScholarship(scholarshipData);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();
    
    if (profileError || !profileData) {
        toast({ title: 'Error', description: 'Could not load your profile.', variant: 'destructive' });
        navigate('/dashboard');
        return;
    }
    setProfile(profileData);
  };

  const fetchSimilarScholarships = async (currentScholarship: any) => {
    try {
      const { data: allScholarships } = await supabase
        .from('scholarships')
        .select('*')
        .neq('id', currentScholarship.id)
        .limit(20);

      if (!allScholarships) return;

      const currentRules = getRules(currentScholarship);
      const cCats = findValue(currentRules, ['categories', 'category', 'caste']) || [];
      const cStates = findValue(currentRules, ['states', 'state', 'domicile']) || [];
      const cEdu = findValue(currentRules, ['educationLevels', 'education_level', 'educationLevel']) || [];

      const scored = allScholarships.map(s => {
        let score = 0;
        const sRules = getRules(s);
        const sCats = findValue(sRules, ['categories', 'category', 'caste']) || [];
        const sStates = findValue(sRules, ['states', 'state', 'domicile']) || [];
        const sEdu = findValue(sRules, ['educationLevels', 'education_level', 'educationLevel']) || [];

        if (Array.isArray(cCats) && cCats.some((c: string) => Array.isArray(sCats) && sCats.includes(c))) score += 2;
        if (Array.isArray(cStates) && cStates.some((s: string) => Array.isArray(sStates) && sStates.includes(s))) score += 2;
        if (Array.isArray(cEdu) && cEdu.some((e: string) => Array.isArray(sEdu) && sEdu.includes(e))) score += 1;
        return { ...s, score };
      });

      const similar = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      if (similar.length === 0 && allScholarships.length > 0) {
         setSimilarScholarships(allScholarships.slice(0, 3));
      } else {
         setSimilarScholarships(similar);
      }
    } catch (e) { console.error("Error fetching similar scholarships", e); }
  };

  const checkApplicationStatus = async () => {
    if (!user || !scholarship) return;
    setApplicationStatus('loading');
    
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('scholarship_id', scholarship.id)
      .order('applied_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setApplicationStatus('not_applied');
      return;
    }

    if (data) {
      setApplicationStatus(data.status as 'applied' | 'withdrawn');
      setApplicationId(data.id);
    } else {
      setApplicationStatus('not_applied');
    }
  };
  
  const calculateMatchReasons = () => {
    if (profile && scholarship) {
        const reasons: string[] = [];
        const rules = getRules(scholarship);
        
        const states = findValue(rules, ['states', 'state', 'domicile']);
        const categories = findValue(rules, ['categories', 'category', 'caste']);
        const maxIncome = findValue(rules, ['maxIncome', 'max_income', 'familyIncome', 'income']);
        const minMarks = findValue(rules, ['minMarks', 'min_marks', 'marks', 'percentage']);
        const educationLevels = findValue(rules, ['educationLevels', 'education_level', 'educationLevel']);

        if (checkInclusion(states, profile.state)) reasons.push(`State: ${profile.state}`);
        if (checkInclusion(categories, profile.category)) reasons.push(`Category: ${profile.category}`);
        
        let incomeLimit = maxIncome;
        if (typeof maxIncome === 'string') {
           const parsed = parseFloat(maxIncome.replace(/[^0-9.]/g, ''));
           if (!isNaN(parsed)) incomeLimit = parsed;
        }
        if (typeof incomeLimit === 'number' && profile.family_income != null && profile.family_income <= incomeLimit) {
          reasons.push(`Income: ₹${profile.family_income.toLocaleString()} (Within limit)`);
        }
        
        let marksReq = minMarks;
        if (typeof minMarks === 'string') {
             const parsed = parseFloat(minMarks.replace(/[^0-9.]/g, ''));
             if (!isNaN(parsed)) marksReq = parsed;
        }
        if (typeof marksReq === 'number' && profile.marks != null && profile.marks >= marksReq) {
          reasons.push(`Marks: ${profile.marks}% (Meets requirement)`);
        }
        if (checkInclusion(educationLevels, profile.education_level)) reasons.push(`Education: ${profile.education_level}`);
        
        setMatchReasons(reasons);
      }
  };
  
  const handleFileChange = (docName: string, file: File | null) => {
    setUploadedFiles(prev => ({ ...prev, [docName]: file }));
  };

  const handleApply = async () => {
    if (!user || !scholarship) return;
    
    if (!isEligible) {
        toast({ title: "Not Eligible", description: "You do not meet the eligibility criteria.", variant: "destructive" });
        return;
    }
    
    if (applicationStatus === 'applied') {
        toast({ title: "Already Applied", description: "You have already applied.", variant: "destructive" });
        return;
    }

    if (scholarship.required_documents && scholarship.required_documents.length > 0) {
      const missingDocs = scholarship.required_documents.filter((doc: string) => !uploadedFiles[doc]);
      if (missingDocs.length > 0) {
        toast({ title: "Missing Documents", description: `Please upload: ${missingDocs.join(', ')}`, variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);
    const uploadedDocPaths: Record<string, string> = {};

    if (scholarship.required_documents && scholarship.required_documents.length > 0) {
      for (const docName of scholarship.required_documents) {
        const file = uploadedFiles[docName];
        if (file) {
          const fileExt = file.name.split('.').pop();
          const safeDocName = docName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          const fileName = `${user.id}/${scholarship.id}/${safeDocName}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file, { cacheControl: '3600', upsert: false });

          if (uploadError) {
            toast({ title: 'Error', description: `Failed to upload ${docName}.`, variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }

          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
          uploadedDocPaths[docName] = publicUrl;
        }
      }
    }

    const { data, error } = await supabase
      .from('scholarship_applications')
      .insert({
        user_id: user.id,
        scholarship_id: scholarship.id,
        status: 'applied',
        documents: uploadedDocPaths
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to apply.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Application Submitted',
        message: `You have successfully applied for ${scholarship.title}.`,
        type: 'application_update',
        is_read: false
    });

    // TRIGGER EMAIL NOTIFICATION
    if (user.email) {
        try {
          const { error: funcError } = await supabase.functions.invoke('send-application-email', {
              body: {
                  scholarshipTitle: scholarship.title,
                  userEmail: user.email,
                  userName: profile.full_name || 'Student',
                  status: 'applied',
                  deadline: scholarship.deadline ? format(new Date(scholarship.deadline), 'MMMM dd, yyyy') : undefined
              },
          });
          
          if (funcError) {
            console.error("Email Function Error:", funcError);
            toast({ title: "Email Notification Failed", description: "Application submitted, but failed to send confirmation email.", variant: "destructive" });
          }
        } catch (e) { 
          console.error("Failed to invoke email function:", e); 
          toast({ title: "Email Notification Failed", description: "Application submitted, but failed to send confirmation email.", variant: "destructive" });
        }
    }

    toast({ title: 'Success', description: 'Application submitted successfully!' });
    setApplicationStatus('applied');
    setApplicationId(data.id);
    setIsApplyDialogOpen(false);
    setIsSubmitting(false);
    setShowSuccessDialog(true);
  };

  const handleWithdraw = async () => {
    if (!applicationId || !user) return;
    if (!confirm("Are you sure? This will withdraw your application and delete all submitted documents.")) return;
    
    setIsSubmitting(true);

    try {
        const { data: appData } = await supabase
            .from('scholarship_applications')
            .select('documents')
            .eq('id', applicationId)
            .single();

        if (appData?.documents) {
            const documents = appData.documents as Record<string, string>;
            const pathsToDelete = Object.values(documents)
                .map(url => getStoragePath(url))
                .filter((path): path is string => path !== null);

            if (pathsToDelete.length > 0) {
                await supabase.storage.from('documents').remove(pathsToDelete);
            }
        }

        const { error } = await supabase
            .from('scholarship_applications')
            .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString(), documents: {} })
            .eq('id', applicationId);

        if (error) throw error;

        toast({ title: 'Success', description: 'Application withdrawn.' });
        setApplicationStatus('withdrawn');
        
        await supabase.from('notifications').insert({
            user_id: user.id,
            title: 'Application Withdrawn',
            message: `You have withdrawn your application for ${scholarship.title}.`,
            type: 'application_update',
            is_read: false
        });

        // TRIGGER EMAIL NOTIFICATION FOR WITHDRAWAL
        if (user.email) {
            try {
                const { error: funcError } = await supabase.functions.invoke('send-application-email', {
                    body: {
                        scholarshipTitle: scholarship.title,
                        userEmail: user.email,
                        userName: profile.full_name || 'Student',
                        status: 'withdrawn',
                    },
                });
                if (funcError) throw funcError;
            } catch (e) { 
                console.error("Failed to send withdrawal email:", e);
                toast({ title: "Email Notification Failed", description: "Application withdrawn, but failed to send confirmation email.", variant: "destructive" });
            }
        }

    } catch (error: any) {
        toast({ title: 'Error', description: 'Failed to withdraw application.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderApplyButton = () => {
    if (applicationStatus === 'loading' || isSubmitting) {
        return <Button className="w-full" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait...</Button>;
    }
    
    if (applicationStatus === 'applied') {
        return (
            <div className="space-y-2">
                <Button variant="secondary" className="w-full cursor-default bg-green-100 text-green-800 hover:bg-green-100">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Application Submitted
                </Button>
                <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10" onClick={handleWithdraw}>
                    Withdraw Application
                </Button>
            </div>
        );
    }

    if (!isEligible) {
        return (
            <Button className="w-full" disabled variant="secondary">
                <XCircle className="mr-2 h-4 w-4" />
                Not Eligible
            </Button>
        );
    }

    if (scholarship.deadline) {
      const deadlineDate = new Date(scholarship.deadline);
      deadlineDate.setHours(23, 59, 59, 999);
      if (isPast(deadlineDate)) {
        return (
          <Button className="w-full" disabled variant="secondary">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Deadline Passed
          </Button>
        );
      }
    }

    if (scholarship.required_documents && scholarship.required_documents.length > 0) {
      return (
        <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">Apply Now</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Required Documents</DialogTitle>
              <DialogDescription>
                To complete your application for <strong>{scholarship.title}</strong>, please upload the following documents.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {scholarship.required_documents.map((doc: string, index: number) => (
                <div key={index} className="grid gap-2">
                  <Label htmlFor={`doc-${index}`} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {doc} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`doc-${index}`}
                    type="file"
                    onChange={(e) => handleFileChange(doc, e.target.files ? e.target.files[0] : null)}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleApply} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    return <Button className="w-full" onClick={handleApply}>Apply Now</Button>;
  };

  if (authLoading || !scholarship || !profile) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  const rules = getRules(scholarship);
  const activeRules = Object.entries(rules).filter(([_, value]) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background pb-20">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="pl-0 hover:pl-2 transition-all">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <Badge className="w-fit mb-2">{scholarship.source}</Badge>
                <CardTitle className="text-2xl">{scholarship.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {scholarship.amount && (
                  <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                    <span className="text-sm font-medium">Award Amount</span>
                    <span className="text-xl font-bold text-success">
                      ₹{scholarship.amount.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {scholarship.deadline && (
                  <div className={`flex items-center gap-2 ${isPast(new Date(scholarship.deadline)) ? 'text-destructive' : 'text-muted-foreground'}`}>
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Deadline: {format(new Date(scholarship.deadline), 'MMMM dd, yyyy')}
                    </span>
                  </div>
                )}

                {renderApplyButton()}

                {!isEligible && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                        You do not meet one or more eligibility criteria for this scholarship.
                    </div>
                )}

                {scholarship.external_url && (
                  <Button className="w-full" variant="outline" asChild>
                    <a href={scholarship.external_url} target="_blank" rel="noopener noreferrer">
                      Visit Official Site
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-muted-foreground" />
                        Eligibility Criteria
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 text-sm">
                        {activeRules.length > 0 ? (
                            activeRules.map(([key, value]) => (
                                <li key={key} className="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0">
                                    <span className="text-muted-foreground">{formatLabel(key)}</span>
                                    <div className="font-medium">
                                        {Array.isArray(value) ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {value.map((v: any, i: number) => (
                                                    <Badge key={i} variant="secondary" className="font-normal">
                                                        {String(v)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <span>{String(value)}</span>
                                        )}
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="text-muted-foreground italic">
                                No specific eligibility criteria mentioned. Open to all eligible candidates.
                            </li>
                        )}
                    </ul>
                </CardContent>
            </Card>

            {matchReasons.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Why You Match
                  </CardTitle>
                  <CardDescription>
                    You meet the following eligibility criteria
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {matchReasons.map((reason, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About This Scholarship</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">
                  {scholarship.description}
                </p>
              </CardContent>
            </Card>

            {scholarship.application_steps && scholarship.application_steps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Application Guide</CardTitle>
                  <CardDescription>Follow these steps to apply</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {scholarship.application_steps.map((step: string, index: number) => (
                      <li key={index} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {scholarship.required_documents && scholarship.required_documents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Required Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {scholarship.required_documents.map((doc: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {similarScholarships.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Similar Scholarships You Might Like
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarScholarships.map((s) => (
                <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                    window.scrollTo(0,0);
                    navigate(`/scholarship/${s.id}`);
                }}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                       <Badge variant="outline">{s.source}</Badge>
                    </div>
                    <CardTitle className="text-lg mt-2 line-clamp-1">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {s.description}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-success">₹{s.amount?.toLocaleString()}</span>
                      <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent text-primary">
                        View Details <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">Application Submitted Successfully!</DialogTitle>
            <DialogDescription className="text-center">
              Your application for <strong>{scholarship.title}</strong> has been received.
            </DialogDescription>
          </DialogHeader>
          
          {similarScholarships.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Similar Scholarships to Apply</h4>
              <div className="space-y-3">
                {similarScholarships.slice(0, 2).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">₹{s.amount?.toLocaleString()} • {s.source}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                        setShowSuccessDialog(false);
                        window.scrollTo(0,0);
                        navigate(`/scholarship/${s.id}`);
                    }}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center mt-4">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-auto">
              Done
            </Button>
            <Button variant="outline" onClick={() => navigate('/my-applications')} className="w-full sm:w-auto">
              View My Applications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
