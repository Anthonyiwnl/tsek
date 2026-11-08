const columns = 'id, application_id, file_id, document_type_id, status, result, normalized_result, error_code, metadata, created_at, file_revision, analysis_generation';

export function applicationAnalysesRepository(db) {
  return {
    async begin(ownerId, applicationId, fileId, revision) {
      const { rows } = await db.query(`
        WITH draft AS MATERIALIZED (
          SELECT id, owner_id FROM public.applications
          WHERE owner_id = $1 AND id = $2 AND status = 'draft' FOR SHARE
        )
        UPDATE public.application_files f SET analysis_generation = analysis_generation + 1
        FROM draft WHERE f.owner_id = draft.owner_id AND f.application_id = draft.id
          AND f.id = $3 AND f.revision = $4
        RETURNING f.revision, f.analysis_generation
      `, [ownerId, applicationId, fileId, revision]);
      return rows[0] ?? null;
    },

    async create(ownerId, applicationId, fileId, documentTypeId, record) {
      const { rows } = await db.query(`
        INSERT INTO public.application_analyses
          (owner_id, application_id, file_id, document_type_id, status, result, normalized_result, error_code, metadata, file_revision, analysis_generation)
        SELECT a.owner_id, a.id, f.id, a.document_type_id, $5, $6, $7, $8, $9, $10, $11
        FROM public.applications a
        JOIN public.application_files f ON f.application_id = a.id AND f.owner_id = a.owner_id
        WHERE a.owner_id = $1 AND a.id = $2 AND f.id = $3 AND a.document_type_id = $4 AND a.status = 'draft'
          AND f.revision = $10 AND f.analysis_generation = $11
        FOR SHARE OF a, f
        RETURNING ${columns}
      `, [ownerId, applicationId, fileId, documentTypeId, record.status,
        record.result, record.normalizedResult, record.errorCode, record.metadata, record.fileRevision, record.analysisGeneration]);
      return rows[0] ?? null;
    },

    async list(ownerId, applicationId) {
      const { rows } = await db.query(`
        SELECT ${columns.split(', ').map(column => `r.${column}`).join(', ')},
          (f.revision = r.file_revision AND f.analysis_generation = r.analysis_generation
            AND a.document_type_id = r.document_type_id
            AND NOT EXISTS (
              SELECT 1 FROM public.application_analyses newer
              WHERE newer.owner_id = r.owner_id AND newer.application_id = r.application_id
                AND newer.file_id = r.file_id
                AND (newer.created_at, newer.id) > (r.created_at, r.id)
            )) AS is_current
        FROM public.application_analyses r
        JOIN public.application_files f ON f.id = r.file_id AND f.owner_id = r.owner_id
          AND f.application_id = r.application_id
        JOIN public.applications a ON a.id = r.application_id AND a.owner_id = r.owner_id
        WHERE r.owner_id = $1 AND r.application_id = $2
        ORDER BY r.created_at DESC, r.id DESC
      `, [ownerId, applicationId]);
      return rows;
    },

    async latest(ownerId, applicationId, documentTypeId) {
      const { rows } = await db.query(`
        SELECT DISTINCT ON (r.file_id) r.file_id, r.normalized_result, r.error_code
        FROM public.application_analyses r
        JOIN public.application_files f ON f.id = r.file_id AND f.owner_id = r.owner_id
          AND f.application_id = r.application_id
          AND f.revision = r.file_revision AND f.analysis_generation = r.analysis_generation
        WHERE r.owner_id = $1 AND r.application_id = $2 AND r.document_type_id = $3
        ORDER BY r.file_id, r.created_at DESC, r.id DESC
      `, [ownerId, applicationId, documentTypeId]);
      return rows;
    },
  };
}

const canonical = (value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();

export function normalizeApplicationAnalysis(analysis, requirements) {
  const { documentType, applicantName, address, readability } = analysis.observations;
  const detected = documentType.value;
  const readable = readability.status !== 'unreadable';
  const decisions = requirements.map(requirement => {
    const matches = readable && detected !== null
      && requirement.accepted_document_types.some(type => canonical(type) === canonical(detected));
    const complete = matches && analysis.decisions.outcome === 'complete';
    let reason = 'The detected document type does not match this requirement.';
    if (!readable) reason = 'The document could not be read.';
    else if (detected === null) reason = 'The document type could not be confirmed.';
    else if (complete) reason = 'The document matches this requirement and the extracted fields are complete.';
    else if (matches) reason = 'The document matches this requirement but some fields are missing or uncertain.';
    return {
      id: requirement.id,
      name: requirement.name,
      is_required: requirement.is_required,
      status: complete ? 'complete' : matches ? 'incomplete' : 'uncertain',
      reason,
      matches,
    };
  });
  return {
    detected_document_type: detected,
    document_type_match: decisions.some(decision => decision.matches),
    extracted_fields: { applicant_name: applicantName.value, address: address.value },
    requirements: decisions,
  };
}

export function applicationChecklist(requirements, analyses) {
  const decisions = requirements.map(requirement => {
    const candidates = analyses.flatMap(row => {
      const decision = row.normalized_result?.requirements.find(item => item.id === requirement.id);
      return decision?.matches ? [{ ...decision, file_id: row.file_id }] : [];
    });
    const evidence = candidates.find(item => item.status === 'complete') ?? candidates[0];
    const reason = analyses.some(row => row.error_code)
      ? 'A document analysis failed. Review or analyze the document again.'
      : 'No matching analyzed document is available.';
    return {
      ...requirement,
      status: evidence?.status ?? 'uncertain',
      reason: evidence?.reason ?? reason,
      ...(evidence ? { file_id: evidence.file_id } : {}),
    };
  });
  return { requirements: decisions, is_complete: decisions.every(item => !item.is_required || item.status === 'complete') };
}
