-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create scholarship_applications table
CREATE TABLE public.scholarship_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scholarship_id UUID REFERENCES public.scholarships(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'withdrawn')),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, scholarship_id)
);

-- Enable RLS on applications
ALTER TABLE public.scholarship_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for applications
CREATE POLICY "Users can view their own applications"
ON public.scholarship_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications"
ON public.scholarship_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
ON public.scholarship_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admin policies for scholarships table
CREATE POLICY "Admins can insert scholarships"
ON public.scholarships
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scholarships"
ON public.scholarships
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete scholarships"
ON public.scholarships
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
