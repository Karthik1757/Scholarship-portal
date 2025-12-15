import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Starting cleanup of expired scholarships...");

    // Use Service Role Key to bypass RLS for deletion
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateString = sevenDaysAgo.toISOString();

    console.log(`Deleting scholarships with deadline before ${dateString}`);

    // Delete scholarships expired more than 7 days ago
    // We also need to handle related data if cascading isn't set up in DB, 
    // but typically Supabase handles cascade if configured. 
    // Assuming standard foreign keys, we might need to delete applications first if not cascading.
    // For safety, we'll rely on DB constraints or simple delete if cascade is on.
    
    const { data, error, count } = await supabase
      .from('scholarships')
      .delete({ count: 'exact' })
      .lt('deadline', dateString)
      .not('deadline', 'is', null);

    if (error) {
      console.error("Error deleting scholarships:", error);
      throw error;
    }

    console.log(`Deleted ${count} expired scholarships.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully deleted ${count} scholarships expired before ${sevenDaysAgo.toLocaleDateString()}`,
        deletedCount: count 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: any) {
    console.error("Error in cleanup-expired-scholarships:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
};

serve(handler);
