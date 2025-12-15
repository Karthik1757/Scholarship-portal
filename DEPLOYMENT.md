# 🚀 Deployment Guide

## Prerequisites

1. **Supabase Project**: Set up a Supabase project
2. **Netlify Account**: Create a Netlify account
3. **OpenRouter API Key**: Get an API key from OpenRouter
4. **Brevo Email API**: Set up Brevo for email notifications

## Step 1: Environment Setup

### 1.1 Create `.env` file
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 1.2 Supabase Setup
1. Create a new Supabase project
2. Run the migrations in `supabase/migrations/`
3. Deploy the edge functions:
   ```bash
   supabase functions deploy
   ```

### 1.3 Set Supabase Secrets
In your Supabase dashboard → Project Settings → Edge Functions:
```
SUPABASE_URL = your_project_url
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
SUPABASE_ANON_KEY = your_anon_key
BREVO_API_KEY = your_brevo_api_key
SENDER_EMAIL = your_verified_sender_email
SENDER_NAME = Scholarship Portal
```

## Step 2: Netlify Deployment

### Option A: Git-based Deployment (Recommended)

1. **Push to Git**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Connect your repository
   - Configure build settings:
     - **Build command**: `npm install && npm run build`
     - **Publish directory**: `dist`
     - **Node version**: `18`

3. **Set Environment Variables** in Netlify:
   ```
   VITE_SUPABASE_URL = your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY = your_supabase_anon_key
   VITE_OPENROUTER_API_KEY = your_openrouter_api_key
   NODE_VERSION = 18
   ```

### Option B: Manual Deployment

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   - Drag and drop the `dist` folder to Netlify
   - Set environment variables as above

## Step 3: Post-Deployment Configuration

### 3.1 Update Supabase CORS
In Supabase Dashboard → Authentication → URL Configuration:
- Add your Netlify domain to allowed origins

### 3.2 Storage Bucket Setup
Ensure the `documents` bucket exists in Supabase Storage with proper policies.

### 3.3 Email Templates
Configure Brevo email templates for application notifications.

## Step 4: Testing

1. **Test Authentication**: Sign up/login should work
2. **Test Scholarships**: Browse and apply to scholarships
3. **Test File Uploads**: Document uploads should work
4. **Test Notifications**: Check email notifications
5. **Test Chatbot**: AI assistant should respond

## Troubleshooting

### Common Issues:

1. **White Screen**: Check browser console for JavaScript errors
2. **Auth Issues**: Verify Supabase URL and keys
3. **Build Failures**: Ensure Node 18+ and all dependencies installed
4. **CORS Errors**: Add Netlify domain to Supabase allowed origins

### Debug Commands:
```bash
# Test build locally
npm run build

# Preview production build
npm run preview

# Check environment variables
echo $VITE_SUPABASE_URL
```

## Production Checklist

- [ ] Environment variables set in Netlify
- [ ] Supabase secrets configured
- [ ] Edge functions deployed
- [ ] Database migrations applied
- [ ] Storage bucket configured
- [ ] Email service configured
- [ ] Domain configured (optional)
- [ ] HTTPS enabled (automatic on Netlify)

## Performance Optimization

The build currently has a large bundle (~874KB). Consider:
- Code splitting for routes
- Lazy loading components
- Optimizing images
- CDN for static assets

---

🎉 **Your Scholarship Portal is now deployed!**