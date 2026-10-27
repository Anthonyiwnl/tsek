-- Demonstration requirements only; confirm actual rules with the issuing barangay.
INSERT INTO public.document_types (name, description) VALUES
  ('Barangay Clearance', 'Application for a barangay clearance certificate.'),
  ('Certificate of Residency', 'Application for proof of residency.'),
  ('Certificate of Indigency', 'Application for a certificate of indigency.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.document_requirements
  (document_type_id, name, description, accepted_document_types, is_required, sort_order)
SELECT dt.id, req.name, req.description, req.accepted_document_types, req.is_required, req.sort_order
FROM public.document_types dt
CROSS JOIN (VALUES
  ('Valid government-issued ID', 'A clear copy of a current government-issued ID.',
    ARRAY['PhilSys ID', 'Driver''s License', 'Passport', 'Other government ID'], true, 1),
  ('Proof of residency', 'A document showing the applicant''s current barangay address.',
    ARRAY['Utility bill', 'Lease agreement', 'Other proof of residency'], true, 2),
  ('Community Tax Certificate (Cedula)', 'Only if required by the issuing barangay.',
    ARRAY['Cedula'], false, 3)
) AS req(name, description, accepted_document_types, is_required, sort_order)
WHERE dt.name IN ('Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency')
ON CONFLICT (document_type_id, name) DO NOTHING;
