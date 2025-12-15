import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus, ArrowLeft, Settings, Bell, Trash, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScholarship, setEditingScholarship] = useState<any>(null);
  const [isRunningTask, setIsRunningTask] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    deadline: '',
    source: 'Government',
    minMarks: '',
    maxIncome: '',
    states: '',
    categories: '',
    educationLevels: '',
    gender: 'Any',
    requiredDocuments: '',
  });

  useEffect(() => {
    checkAdminRole();
    fetchScholarships();
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (error || !data) {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges.',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const fetchScholarships = async () => {
    const { data, error } = await supabase
      .from('scholarships')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch scholarships.',
        variant: 'destructive',
      });
      return;
    }

    setScholarships(data || []);
  };

  const runMaintenanceTask = async (functionName: string, taskName: string) => {
    setIsRunningTask(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        method: 'POST',
      });

      if (error) throw error;

      toast({
        title: 'Task Completed',
        description: data.message || `${taskName} executed successfully.`,
      });
      
      // If cleanup was run, refresh list
      if (functionName === 'cleanup-expired-scholarships') {
        fetchScholarships();
      }
    } catch (error: any) {
      console.error(`Error running ${taskName}:`, error);
      toast({
        title: 'Task Failed',
        description: error.message || `Failed to run ${taskName}.`,
        variant: 'destructive',
      });
    } finally {
      setIsRunningTask(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const scholarshipData = {
      title: formData.title,
      description: formData.description,
      amount: parseFloat(formData.amount) || 0,
      deadline: formData.deadline,
      source: formData.source,
      required_documents: formData.requiredDocuments.split(',').map(d => d.trim()).filter(Boolean),
      eligibility_rules: {
        minMarks: parseFloat(formData.minMarks) || 0,
        maxIncome: parseFloat(formData.maxIncome) || 0,
        states: formData.states.split(',').map(s => s.trim()).filter(Boolean),
        categories: formData.categories.split(',').map(c => c.trim()).filter(Boolean),
        educationLevels: formData.educationLevels.split(',').map(e => e.trim()).filter(Boolean),
        gender: formData.gender,
      },
    };

    if (editingScholarship) {
      const { error } = await supabase
        .from('scholarships')
        .update(scholarshipData)
        .eq('id', editingScholarship.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update scholarship.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Success', description: 'Scholarship updated successfully.' });
    } else {
      const { error } = await supabase
        .from('scholarships')
        .insert(scholarshipData);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create scholarship.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Success', description: 'Scholarship created successfully.' });
    }

    setIsDialogOpen(false);
    resetForm();
    fetchScholarships();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scholarship?')) return;

    const { error } = await supabase
      .from('scholarships')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete scholarship.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Success', description: 'Scholarship deleted successfully.' });
    fetchScholarships();
  };

  const handleEdit = (scholarship: any) => {
    setEditingScholarship(scholarship);
    const rules = scholarship.eligibility_rules || {};
    setFormData({
      title: scholarship.title,
      description: scholarship.description || '',
      amount: scholarship.amount?.toString() || '',
      deadline: scholarship.deadline || '',
      source: scholarship.source || 'Government',
      minMarks: rules.minMarks?.toString() || '',
      maxIncome: rules.maxIncome?.toString() || '',
      states: rules.states?.join(', ') || '',
      categories: rules.categories?.join(', ') || '',
      educationLevels: rules.educationLevels?.join(', ') || '',
      gender: rules.gender || 'Any',
      requiredDocuments: scholarship.required_documents?.join(', ') || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: '',
      deadline: '',
      source: 'Government',
      minMarks: '',
      maxIncome: '',
      states: '',
      categories: '',
      educationLevels: '',
      gender: 'Any',
      requiredDocuments: '',
    });
    setEditingScholarship(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="pl-0 hover:pl-2 transition-all">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Scholarship
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingScholarship ? 'Edit Scholarship' : 'Add New Scholarship'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2 border-t pt-4 mt-4">
                  <h3 className="font-medium">Eligibility Rules</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minMarks">Min Marks (%)</Label>
                      <Input
                        id="minMarks"
                        type="number"
                        value={formData.minMarks}
                        onChange={(e) => setFormData({ ...formData, minMarks: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxIncome">Max Income (₹)</Label>
                      <Input
                        id="maxIncome"
                        type="number"
                        value={formData.maxIncome}
                        onChange={(e) => setFormData({ ...formData, maxIncome: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="states">States (comma-separated)</Label>
                    <Input
                      id="states"
                      value={formData.states}
                      onChange={(e) => setFormData({ ...formData, states: e.target.value })}
                      placeholder="e.g., Maharashtra, Delhi, Karnataka"
                    />
                  </div>
                  <div>
                    <Label htmlFor="categories">Categories (comma-separated)</Label>
                    <Input
                      id="categories"
                      value={formData.categories}
                      onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                      placeholder="e.g., SC, ST, OBC, General"
                    />
                  </div>
                  <div>
                    <Label htmlFor="educationLevels">Education Levels (comma-separated)</Label>
                    <Input
                      id="educationLevels"
                      value={formData.educationLevels}
                      onChange={(e) => setFormData({ ...formData, educationLevels: e.target.value })}
                      placeholder="e.g., Class 10, Class 12, Bachelors"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender Eligibility</Label>
                    <Select 
                      value={formData.gender} 
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Any">Any</SelectItem>
                        <SelectItem value="Male">Male Only</SelectItem>
                        <SelectItem value="Female">Female Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4 mt-4">
                  <h3 className="font-medium">Application Requirements</h3>
                  <div>
                    <Label htmlFor="requiredDocuments">Required Documents (comma-separated)</Label>
                    <Input
                      id="requiredDocuments"
                      value={formData.requiredDocuments}
                      onChange={(e) => setFormData({ ...formData, requiredDocuments: e.target.value })}
                      placeholder="e.g., Resume, Transcript, Income Certificate"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingScholarship ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* System Maintenance Section */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              System Maintenance
            </CardTitle>
            <CardDescription>
              Manually trigger system tasks. These usually run automatically via scheduled jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button 
              variant="secondary" 
              onClick={() => runMaintenanceTask('send-deadline-reminders', 'Deadline Reminders')}
              disabled={isRunningTask}
            >
              {isRunningTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              Run Deadline Reminders
            </Button>
            <Button 
              variant="destructive" 
              className="bg-red-100 text-red-900 hover:bg-red-200 border-red-200"
              onClick={() => runMaintenanceTask('cleanup-expired-scholarships', 'Cleanup Expired')}
              disabled={isRunningTask}
            >
              {isRunningTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
              Cleanup Expired (&gt;7 days)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scholarships ({scholarships.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scholarships.map((scholarship) => (
                  <TableRow key={scholarship.id}>
                    <TableCell className="font-medium">{scholarship.title}</TableCell>
                    <TableCell>₹{scholarship.amount?.toLocaleString()}</TableCell>
                    <TableCell>
                      {scholarship.deadline ? new Date(scholarship.deadline).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>{scholarship.source}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(scholarship)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(scholarship.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
