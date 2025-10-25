-- Add DELETE RLS policies to allow actual deletions
-- This enables admins to delete any rows and branch users to delete rows for their branch

-- Equipment DELETE policies
CREATE POLICY "Admins can delete all equipment" ON public.equipment
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can delete own branch equipment" ON public.equipment
  FOR DELETE USING (branch_id = public.get_user_branch(auth.uid()));

-- Customers DELETE policies
CREATE POLICY "Admins can delete all customers" ON public.customers
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can delete own branch customers" ON public.customers
  FOR DELETE USING (branch_id = public.get_user_branch(auth.uid()));

-- Rentals DELETE policies
CREATE POLICY "Admins can delete all rentals" ON public.rentals
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can delete own branch rentals" ON public.rentals
  FOR DELETE USING (branch_id = public.get_user_branch(auth.uid()));

-- Rental items DELETE policies
CREATE POLICY "Admins can delete rental items" ON public.rental_items
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch users can delete own branch rental items" ON public.rental_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rentals r
      WHERE r.id = rental_items.rental_id
      AND r.branch_id = public.get_user_branch(auth.uid())
    )
  );

-- Optional: Invoices DELETE (if desired)
-- CREATE POLICY "Admins can delete invoices" ON public.invoices
--   FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
