import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Bell, Calendar, GraduationCap, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
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

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'new_match':
      return <GraduationCap className="h-5 w-5 text-primary" />;
    case 'deadline':
      return <Calendar className="h-5 w-5 text-destructive" />;
    case 'application_update':
      return <Bell className="h-5 w-5 text-secondary" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      // Don't show error toast on 404 (table missing) to avoid spamming, just show UI state
      if (error.code === '42P01') { // undefined_table
         setError("Notifications system is currently being updated. Please try again later.");
      } else {
         setError("Failed to load notifications.");
      }
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error('Error updating notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast({ title: 'All notifications marked as read' });
    } catch (error) {
      console.error('Error updating notifications:', error);
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(notifications.filter(n => n.id !== id));
      toast({ title: 'Notification deleted' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const clearAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user!.id);

      if (error) throw error;

      setNotifications([]);
      toast({ title: 'All notifications cleared' });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast({ title: 'Failed to clear notifications', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="pl-0 hover:pl-2 transition-all">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Notifications</h1>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="icon" onClick={fetchNotifications} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
             </Button>
             
             {notifications.length > 0 && (
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={loading} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Clear All</span>
                    </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                     <AlertDialogDescription>
                       This action cannot be undone. This will permanently delete all your notifications.
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                     <AlertDialogAction onClick={clearAllNotifications} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
             )}

             {notifications.some(n => !n.is_read) && (
                <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={loading}>
                  Mark all read
                </Button>
             )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0 min-h-[300px]">
            {loading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                   <div key={i} className="flex items-start gap-4 p-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                   </div>
                ))}
              </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4 text-destructive/50" />
                    <p className="text-lg font-medium text-foreground">Something went wrong</p>
                    <p className="text-sm mb-4">{error}</p>
                    <Button onClick={fetchNotifications}>Try Again</Button>
                </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer group ${!notification.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <Avatar className="h-10 w-10 border">
                      <AvatarFallback className={`transition-colors ${!notification.is_read ? 'bg-primary/10' : 'bg-muted'}`}>
                        <NotificationIcon type={notification.type} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                         <p className={`font-semibold text-sm sm:text-base ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.title}
                         </p>
                         <div className="flex items-center gap-2">
                           {!notification.is_read && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                           )}
                           <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={(e) => deleteNotification(notification.id, e)}
                           >
                              <Trash2 className="h-3 w-3" />
                           </Button>
                         </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Bell className="h-12 w-12 mb-4 opacity-20" />
                    <h3 className="text-lg font-medium text-foreground">No notifications</h3>
                    <p className="text-sm">We'll notify you when something important happens.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
