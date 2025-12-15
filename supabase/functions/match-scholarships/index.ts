import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Profile {
  education_level: string;
  field_of_study: string;
  marks: number;
  state: string;
  category: string;
  gender: string;
  family_income: number;
  current_year: number;
}

interface Scholarship {
  id: string;
  title: string;
  description: string;
  source: string;
  amount: number;
  deadline: string;
  eligibility_rules: any;
}

// Simple TF-IDF-like text vectorization
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function calculateTfIdf(tokens: string[], allTokens: string[]): Map<string, number> {
  const termFreq = new Map<string, number>();
  tokens.forEach(token => {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  });
  
  const maxFreq = Math.max(...Array.from(termFreq.values()));
  const normalizedTf = new Map<string, number>();
  
  termFreq.forEach((freq, term) => {
    normalizedTf.set(term, freq / maxFreq);
  });
  
  return normalizedTf;
}

function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  const allKeys = new Set([...vec1.keys(), ...vec2.keys()]);
  
  allKeys.forEach(key => {
    const v1 = vec1.get(key) || 0;
    const v2 = vec2.get(key) || 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  });
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    // Create Supabase client with user's JWT token for RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Step 1: Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Rule-based filtering - fetch all scholarships
    const { data: allScholarships, error: scholarshipsError } = await supabase
      .from('scholarships')
      .select('*');

    if (scholarshipsError) {
      throw scholarshipsError;
    }

    // Filter scholarships based on eligibility rules
    const eligibleScholarships = (allScholarships || []).filter((scholarship: Scholarship) => {
      const rules = scholarship.eligibility_rules;
      if (!rules) return true;

      // Check marks
      if (rules.minMarks && profile.marks < rules.minMarks) return false;
      
      // Check income
      if (rules.maxIncome && profile.family_income > rules.maxIncome) return false;
      
      // Check state
      if (rules.states && rules.states.length > 0) {
        if (!rules.states.includes(profile.state)) return false;
      }
      
      // Check category
      if (rules.categories && rules.categories.length > 0) {
        if (!rules.categories.includes(profile.category)) return false;
      }
      
      // Check gender
      if (rules.gender && rules.gender !== 'Any') {
        if (rules.gender !== profile.gender) return false;
      }
      
      // Check education level
      if (rules.educationLevels && rules.educationLevels.length > 0) {
        if (!rules.educationLevels.includes(profile.education_level)) return false;
      }

      return true;
    });

    console.log(`Found ${eligibleScholarships.length} eligible scholarships out of ${allScholarships?.length}`);

    // Step 3: Content-based ranking using simple TF-IDF and cosine similarity
    const studentInterest = `${profile.field_of_study} ${profile.education_level}`.toLowerCase();
    const studentTokens = tokenize(studentInterest);
    const studentVector = calculateTfIdf(studentTokens, studentTokens);

    const rankedScholarships = eligibleScholarships.map((scholarship: Scholarship) => {
      const scholarshipText = `${scholarship.title} ${scholarship.description || ''}`;
      const scholarshipTokens = tokenize(scholarshipText);
      const scholarshipVector = calculateTfIdf(scholarshipTokens, scholarshipTokens);
      
      const similarity = cosineSimilarity(studentVector, scholarshipVector);
      
      // Calculate match reasons
      const matchReasons: string[] = [];
      const rules = scholarship.eligibility_rules;
      
      if (rules) {
        if (rules.states && rules.states.includes(profile.state)) {
          matchReasons.push('state');
        }
        if (rules.categories && rules.categories.includes(profile.category)) {
          matchReasons.push('category');
        }
        if (rules.maxIncome && profile.family_income <= rules.maxIncome) {
          matchReasons.push('income');
        }
        if (rules.minMarks && profile.marks >= rules.minMarks) {
          matchReasons.push('marks');
        }
        if (rules.gender && (rules.gender === profile.gender || rules.gender === 'Any')) {
          matchReasons.push('gender');
        }
        if (rules.educationLevels && rules.educationLevels.includes(profile.education_level)) {
          matchReasons.push('education');
        }
      }
      
      return {
        ...scholarship,
        match_score: similarity,
        match_reasons: matchReasons,
      };
    }).sort((a, b) => b.match_score - a.match_score);

    // Store matches in database
    const matchRecords = rankedScholarships.slice(0, 20).map(scholarship => ({
      user_id: user.id,
      scholarship_id: scholarship.id,
      match_score: scholarship.match_score,
      is_eligible: true,
    }));

    // Delete old matches for this user
    await supabase
      .from('user_scholarship_matches')
      .delete()
      .eq('user_id', user.id);

    // Insert new matches
    if (matchRecords.length > 0) {
      await supabase
        .from('user_scholarship_matches')
        .insert(matchRecords);
    }

    return new Response(
      JSON.stringify({ 
        matches: rankedScholarships.slice(0, 10),
        total_eligible: eligibleScholarships.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in match-scholarships:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
