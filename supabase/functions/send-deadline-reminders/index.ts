import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? "no-reply@example.com";
const SENDER_NAME = Deno.env.get("SENDER_NAME") ?? "ScholarMatch";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get scholarships nearing deadline (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: scholarships, error: scholarshipsError } = await supabaseClient
      .from('scholarships')
      .select('id, title, deadline, amount, description')
      .gte('deadline', new Date().toISOString())
      .lte('deadline', sevenDaysFromNow.toISOString());

    if (scholarshipsError) {
      console.error('Error fetching scholarships:', scholarshipsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scholarships' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!scholarships || scholarships.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No scholarships nearing deadline' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For each scholarship, find eligible students and send reminders
    for (const scholarship of scholarships) {
      // Get all student profiles
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        continue;
      }

      if (!profiles) continue;

      // Check eligibility for each student
      for (const profile of profiles) {
        try {
          // Simple eligibility check (you can make this more sophisticated)
          const isEligible = checkBasicEligibility(profile, scholarship);

          if (isEligible) {
            // Check if notification already sent (avoid spam)
            const { data: existingNotification } = await supabaseClient
              .from('notifications')
              .select('id')
              .eq('user_id', profile.id)
              .eq('type', 'deadline_reminder')
              .eq('reference_id', scholarship.id)
              .single();

            if (!existingNotification) {
              // Send email notification
              if (BREVO_API_KEY && profile.email) {
                await sendDeadlineReminderEmail(profile, scholarship);
              }

              // Create in-app notification
              await supabaseClient
                .from('notifications')
                .insert({
                  user_id: profile.id,
                  type: 'deadline_reminder',
                  title: 'Scholarship Deadline Approaching',
                  message: `Don't miss out! The deadline for ${scholarship.title} is approaching.`,
                  reference_id: scholarship.id,
                  read: false,
                });
            }
          }
        } catch (error) {
          console.error(`Error processing reminder for ${profile.email}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: scholarships.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in deadline reminder function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function checkBasicEligibility(profile: any, scholarship: any): boolean {
  // Basic eligibility check - you can expand this based on your scholarship rules
  // For now, just check if the student has completed their profile
  return profile && profile.email && profile.first_name;
}

async function sendDeadlineReminderEmail(profile: any, scholarship: any) {
  if (!BREVO_API_KEY) return;

  try {
    const deadlineDate = new Date(scholarship.deadline).toLocaleDateString();

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: profile.email,
            name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
          },
        ],
        subject: `⏰ Deadline Reminder: ${scholarship.title}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">⏰ Scholarship Deadline Approaching!</h2>
            <p>Dear ${profile.first_name},</p>
            <p>The application deadline for <strong>${scholarship.title}</strong> is coming up soon!</p>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Deadline:</strong> ${deadlineDate}<br>
              <strong>Amount:</strong> $${scholarship.amount}<br>
              <strong>Scholarship ID:</strong> ${scholarship.id}
            </div>

            <p>Don't miss this opportunity! Apply now before it's too late.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Apply Now
              </a>
            </div>

            <p>Best regards,<br>The Scholarship Team</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      console.error("Failed to send deadline reminder email:", await res.text());
    } else {
      console.log(`Deadline reminder sent to ${profile.email} for ${scholarship.title}`);
    }
  } catch (error) {
    console.error("Error sending deadline reminder:", error);
  }
}
