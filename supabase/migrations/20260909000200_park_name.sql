-- Correct the documented park rename only when the seeded old name remains.
-- Other admin-maintained metadata is preserved.
update public.coasters set park = 'Plopsaland Deutschland'
where id = 'b33a184b-eb33-5373-abef-8530c7b1e732' and park = 'Holiday Park';
