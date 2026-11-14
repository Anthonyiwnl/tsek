const columns = 'id, application_id, file_id, document_type_id, status, result, normalized_result, error_code, metadata, created_at';

export function applicationAnalysesRepository(db) {
  return {
    async create(ownerId, applicationId, fileId, documentTypeId, record) {
      const { rows } = await db.query(`
        INSERT INTO public.application_analyses
          (owner_id, application_id, file_id, document_type_id, status, result, normalized_result, error_code, metadata)
        SELECT a.owner_id, a.id, f.id, a.document_type_id, $5, $6, $7, $8, $9
        FROM public.applications a
        JOIN public.application_files f ON f.application_id = a.id AND f.owner_id = a.owner_id
        WHERE a.owner_id = $1 AND a.id = $2 AND f.id = $3 AND a.document_type_id = $4 AND a.status = 'draft'
        FOR SHARE OF a, f
        RETURNING ${columns}
      `, [ownerId, applicationId, fileId, documentTypeId, record.status,
        record.result, record.normalizedResult, record.errorCode, record.metadata]);
      return rows[0] ?? null;
    },

    async list(ownerId, applicationId) {
      const { rows } = await db.query(`
        SELECT ${columns} FROM public.application_analyses
        WHERE owner_id = $1 AND application_id = $2
        ORDER BY created_at DESC, id DESC
      `, [ownerId, applicationId]);
      return rows;
    },

    async latest(ownerId, applicationId, documentTypeId) {
      const { rows } = await db.query(`
        SELECT DISTINCT ON (file_id) file_id, result, normalized_result, error_code
        FROM public.application_analyses
        WHERE owner_id = $1 AND application_id = $2 AND document_type_id = $3
        ORDER BY file_id, created_at DESC, id DESC
      `, [ownerId, applicationId, documentTypeId]);
      return rows;
    },
  };
}

const documentTypeAliases = new Map([
  ['philippine identification card', 'philsys id'],
  ['statement of account', 'utility bill'],
  ['community tax certificate', 'cedula'],
]);

function normalizeDocumentTitle(value) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function canonicalDocumentType(value) {
  const title = normalizeDocumentTitle(value);
  return documentTypeAliases.get(title) ?? title;
}

export function normalizeApplicationAnalysis(analysis, requirements) {
  const { documentType, applicantName, address, readability } = analysis.observations;
  const detected = documentType.value;
  const canonicalDetected = detected === null ? null : canonicalDocumentType(detected);
  const readable = readability.status !== 'unreadable';
  const decisions = requirements.map(requirement => {
    const matches = readable && canonicalDetected !== null
      && requirement.accepted_document_types.some(type => canonicalDocumentType(type) === canonicalDetected);
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
  const checklistAnalyses = analyses.map(row => {
    const title = row.result?.observations.documentType.value;
    const normalizedTitle = title ? normalizeDocumentTitle(title) : null;
    // Apply current aliases when reading analyses saved under older matching rules.
    if (documentTypeAliases.has(normalizedTitle) || normalizedTitle === 'philsys id') {
      return { ...row, normalized_result: normalizeApplicationAnalysis(row.result, requirements) };
    }
    return row;
  });
  const decisions = requirements.map(requirement => {
    const candidates = checklistAnalyses.flatMap(row => {
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
