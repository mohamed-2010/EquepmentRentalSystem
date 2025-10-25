-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'branch_manager', 'employee');

-- Create enum for equipment status
CREATE TYPE public.equipment_status AS ENUM ('available', 'rented', 'maintenance');

-- Create enum for rental status
CREATE TYPE public.rental_status AS ENUM ('active', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, branch_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Create equipment table
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  category TEXT,
  daily_rate DECIMAL(10, 2) NOT NULL,
  status equipment_status NOT NULL DEFAULT 'available',
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_number TEXT,
  notes TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create rentals table
CREATE TABLE public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  days_count INTEGER,
  total_amount DECIMAL(10, 2),
  status rental_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create security definer function to get user branch
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for branches
CREATE POLICY "Admins can view all branches" ON public.branches
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can view own branch" ON public.branches
  FOR SELECT USING (id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can insert branches" ON public.branches
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branches" ON public.branches
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branches" ON public.branches
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for equipment
CREATE POLICY "Admins can view all equipment" ON public.equipment
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can view own branch equipment" ON public.equipment
  FOR SELECT USING (branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can insert equipment" ON public.equipment
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can insert own branch equipment" ON public.equipment
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can update all equipment" ON public.equipment
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can update own branch equipment" ON public.equipment
  FOR UPDATE USING (branch_id = public.get_user_branch(auth.uid()));

-- RLS Policies for customers
CREATE POLICY "Admins can view all customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can view own branch customers" ON public.customers
  FOR SELECT USING (branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can insert customers" ON public.customers
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can insert own branch customers" ON public.customers
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can update all customers" ON public.customers
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can update own branch customers" ON public.customers
  FOR UPDATE USING (branch_id = public.get_user_branch(auth.uid()));

-- RLS Policies for rentals
CREATE POLICY "Admins can view all rentals" ON public.rentals
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can view own branch rentals" ON public.rentals
  FOR SELECT USING (branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can insert rentals" ON public.rentals
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can insert own branch rentals" ON public.rentals
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Admins can update all rentals" ON public.rentals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can update own branch rentals" ON public.rentals
  FOR UPDATE USING (branch_id = public.get_user_branch(auth.uid()));

-- RLS Policies for invoices
CREATE POLICY "Admins can view all invoices" ON public.invoices
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can view own branch invoices" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentals
      WHERE rentals.id = invoices.rental_id
      AND rentals.branch_id = public.get_user_branch(auth.uid())
    )
  );

CREATE POLICY "Authenticated users can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);