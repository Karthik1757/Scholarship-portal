# 🚀 Step-by-Step Deployment Guide for karthikkumar6757@gmail.com

## Phase 1: Supabase Setup

### Step 1.1: Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Sign up with: `karthikkumar6757@gmail.com`
3. Verify your email
4. Create a new project:
   - **Name**: `Scholarship-Portal-Karthik`
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Select closest to your location

### Step 1.2: Database Setup
1. In Supabase Dashboard → SQL Editor
2. Run each migration file in order:
   ```sql
   -- Copy and paste each migration from supabase/migrations/
   -- Start with 20251118182248_13d15ee3-0558-49ac-8824-86a86bb27a8d.sql
   -- Then 20251118182257_1a98d46a-49d6-4aea-b4c0-b4e3a7eb6d02.sql
   -- Continue with all migration files
   ```

### Step 1.3: Storage Setup
1. Go to Storage → Create bucket
2. **Bucket Name**: `documents`
3. **Public**: Uncheck (keep private)
4. Set bucket policies for authenticated users

### Step 1.4: Authentication Setup
1. Go to Authentication → Settings
2. Configure:
   - **Site URL**: `https://your-netlify-site.netlify.app` (update after deployment)
   - **Redirect URLs**: Add your Netlify URL
3. Enable email confirmations

## Phase 2: Environment Variables Setup

### Step 2.1: Create .env file
Create `.env` file in your project root:

```bash
# Get these from Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Get from OpenRouter (https://openrouter.ai/)
VITE_OPENROUTER_API_KEY=your-openrouter-key
```

### Step 2.2: Supabase Secrets (for Edge Functions)
In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
BREVO_API_KEY=your-brevo-api-key
SENDER_EMAIL=karthikkumar6757@gmail.com
SENDER_NAME=Scholarship Portal
```

## Phase 3: Netlify Deployment

### Step 3.1: Create Netlify Account
1. Go to [netlify.com](https://netlify.com)
2. Sign up with: `karthikkumar6757@gmail.com`
3. Verify email

### Step 3.2: Connect Repository
1. Push your code to GitHub/GitLab
2. In Netlify: "New site from Git"
3. Connect your repository
4. Configure build settings:
   - **Branch**: `main`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `dist`

### Step 3.3: Set Netlify Environment Variables
In Netlify Site Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_OPENROUTER_API_KEY=your-openrouter-key
NODE_VERSION=18
```

### Step 3.4: Deploy
1. Click "Deploy site"
2. Wait for build completion
3. Your site will be live at: `https://random-name.netlify.app`

## Phase 4: Post-Deployment Configuration

### Step 4.1: Update Supabase URLs
1. In Supabase → Authentication → URL Configuration
2. Add your Netlify domain to "Redirect URLs"
3. Update "Site URL" to your Netlify domain

### Step 4.2: Deploy Edge Functions
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-id

# Deploy functions
supabase functions deploy match-scholarships
supabase functions deploy send-application-email
supabase functions deploy send-deadline-reminders
supabase functions deploy cleanup-expired-scholarships
```

### Step 4.3: Set up Email Service (Brevo)
1. Go to [brevo.com](https://brevo.com)
2. Sign up with: `karthikkumar6757@gmail.com`
3. Verify domain/email
4. Get API key from SMTP & API settings
5. Add API key to Supabase secrets

## Phase 5: Testing & Verification

### Step 5.1: Test Authentication
1. Visit your Netlify site
2. Try signing up as a student
3. Verify email works

### Step 5.2: Test Core Features
1. Browse scholarships
2. Apply to a scholarship
3. Upload documents
4. Check notifications
5. Test chatbot

### Step 5.3: Admin Access
1. Create admin user in Supabase Auth
2. Assign admin role in database
3. Test admin dashboard

## 🔧 Troubleshooting

### If build fails:
- Check Netlify build logs
- Ensure NODE_VERSION=18
- Verify all environment variables are set

### If white screen appears:
- Check browser console for errors
- Verify Supabase URL and keys
- Check CORS settings in Supabase

### If functions don't work:
- Check Supabase function logs
- Verify secrets are set correctly
- Test functions locally first

## 📞 Support

If you get stuck:
1. Check the DEPLOYMENT.md file I created
2. Review Supabase/Netlify documentation
3. Check browser console and build logs
4. Verify all environment variables

---

**Your deployed site URL will be something like:** `https://scholarship-portal-karthik.netlify.app`

**Need help with any specific step?** Let me know which part you're working on!