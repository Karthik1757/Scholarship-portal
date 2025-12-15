import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Inbox, Calendar, DollarSign, FileText, ExternalLink, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { getStoragePath } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Application = {
  id: string;
  status: string;
  applied_at: string;
  documents: Record<string, string> | null;
  scholarships: {
    id: string;
    title: string;
    amount: number;
    deadline: string;
    source: string;
  } | null;
};

export default function MyApplications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      fetchApplications();
    }
  }, [user, authLoading, navigate]);

  const fetchApplications = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select(`
        id,
        status,
        applied_at,
        documents,
        scholarships (
          id,
          title,
          amount,
          deadline,
          source
        )
      `)
      .eq('user_id', user.id)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your applications.',
        variant: 'destructive',
      });
    } else {
      setApplications(data as Application[]);
    }
    setLoading(false);
  };

  const handleWithdraw = async (applicationId: string, scholarshipTitle: string, documents: Record<string, string> | null) => {
    if (!user) return;
    if (!confirm("Are you sure? This will withdraw your application and delete all submitted documents.")) return;

    try {
        // Delete documents from storage
        if (documents) {
            const pathsToDelete = Object.values(documents)
                .map(url => getStoragePath(url))
                .filter((path): path is string => path !== null);

            if (pathsToDelete.length > 0) {
                const { error: deleteError } = await supabase.storage
                    .from('documents')
                    .remove(pathsToDelete);
                
                if (deleteError) {
                    console.error("Error deleting files:", deleteError);
                }
            }
        }

        const { error: updateError } = await supabase
          .from('scholarship_applications')
          .update({ 
              status: 'withdrawn', 
              withdrawn_at: new Date().toISOString(),
              documents: {} // Clear documents
          })
          .eq('id', applicationId);

        if (updateError) throw updateError;

        toast({ title: 'Success', description: 'Application withdrawn and documents deleted.' });
        
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Application Withdrawn',
          message: `You have successfully withdrawn your application for ${scholarshipTitle}.`,
          type: 'application_update',
          is_read: false
        });

        fetchApplications();

        // Trigger Email Notification
        try {
            const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            const { error: emailError } = await supabase.functions.invoke('send-application-email', {
                body: {
                    scholarshipTitle,
                    userEmail: user.email,
                    userName: profileData?.full_name || 'Student',
                    status: 'withdrawn',
                },
            });
            
            if (emailError) {
                console.error("Email function error:", emailError);
                toast({ title: "Email Notification Failed", description: "Application withdrawn, but failed to send confirmation email.", variant: "destructive" });
            }
        } catch (e) { 
            console.error("Failed to invoke email function:", e); 
            toast({ title: "Email Notification Failed", description: "Application withdrawn, but failed to send confirmation email.", variant: "destructive" });
        }

    } catch (error) {
        console.error('Error withdrawing:', error);
        toast({ title: 'Error', description: 'Failed to withdraw application.', variant: 'destructive' });
    }
  };

  const handleDelete = async (applicationId: string, documents: Record<string, string> | null) => {
    setLoading(true);
    try {
        // Cleanup documents if they exist
        if (documents) {
            const pathsToDelete = Object.values(documents)
                .map(url => getStoragePath(url))
                .filter((path): path is string => path !== null);

            if (pathsToDelete.length > 0) {
                await supabase.storage.from('documents').remove(pathsToDelete);
            }
        }

        const { error } = await supabase
            .from('scholarship_applications')
            .delete()
            .eq('id', applicationId);

        if (error) throw error;

        toast({ title: 'Success', description: 'Application record deleted.' });
        fetchApplications();
    } catch (error) {
        console.error('Error deleting application:', error);
        toast({ title: 'Error', description: 'Failed to delete application.', variant: 'destructive' });
    } finally {
        setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading applications...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6 pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-foreground mb-6">My Applications</h1>

        <Card>
          <CardHeader>
            <CardTitle>Your Submitted Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>You haven't applied to any scholarships yet.</p>
                <Button variant="link" onClick={() => navigate('/scholarships')}>Browse scholarships</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => app.scholarships && (
                  <Card key={app.id} className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg">{app.scholarships.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                {app.scholarships.amount > 0 && (
                                    <div className="flex items-center gap-1">
                                        <DollarSign className="h-4 w-4" />
                                        <span>₹{app.scholarships.amount.toLocaleString()}</span>
                                    </div>
                                )}
                                {app.scholarships.deadline && (
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        <span>Deadline: {format(new Date(app.scholarships.deadline), 'MMM dd, yyyy')}</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-sm mt-2">
                                Applied on: {format(new Date(app.applied_at), 'MMM dd, yyyy')}
                            </p>

                            {app.documents && Object.keys(app.documents).length > 0 && (
                              <div className="mt-4">
                                <p className="text-sm font-medium mb-2">Submitted Documents:</p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(app.documents).map(([name, url]) => (
                                    <Button key={name} variant="outline" size="sm" asChild className="h-8">
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                        <FileText className="h-3 w-3" />
                                        {name}
                                        <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                                      </a>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                    app.status === 'applied' ? 'bg-green-100 text-green-800' :
                                    app.status === 'withdrawn' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                                </span>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Application?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this application record? This action cannot be undone and will remove all associated data.
                                        {app.status === 'applied' && " Note: This will effectively withdraw your active application."}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(app.id, app.documents)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </div>

                            {app.status === 'applied' && (
                                <Button variant="destructive" size="sm" onClick={() => handleWithdraw(app.id, app.scholarships!.title, app.documents)}>
                                    Withdraw
                                </Button>
                            )}
                        </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
