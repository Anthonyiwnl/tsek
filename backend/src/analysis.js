export const ANALYSIS_SCHEMA_VERSION = '1.0.0'

const OBSERVATION_FIELDS = ['documentType', 'applicantName', 'address']
const OBSERVATION_KEYS = [...OBSERVATION_FIELDS, 'readability']
const READABILITY_STATUSES = ['clear', 'partially_readable', 'unreadable']
const OUTCOMES = ['complete', 'incomplete', 'unreadable', 'needs_review']

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function addError(errors, path, code, message, section = 'contract') {
  errors.push({ path, code, message, section })
}

function checkUnknownKeys(value, allowedKeys, path, errors, section) {
  if (!isObject(value)) return

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      addError(
        errors,
        `${path}.${key}`,
        'UNKNOWN_FIELD',
        `Unexpected field '${key}'.`,
        section,
      )
    }
  }
}

function checkConfidence(value, path, errors) {
  if (typeof value.confidence !== 'number'
    || !Number.isFinite(value.confidence)
    || value.confidence < 0
    || value.confidence > 1) {
    addError(
      errors,
      `${path}.confidence`,
      'INVALID_CONFIDENCE',
      'Confidence must be a finite number from 0 to 1.',
      'observation',
    )
  }
}

function checkTextObservation(value, path, errors) {
  if (!isObject(value)) {
    addError(errors, path, 'INVALID_OBSERVATION', 'An observation must be an object.', 'observation')
    return
  }

  checkUnknownKeys(value, ['value', 'confidence'], path, errors, 'observation')

  if (!Object.hasOwn(value, 'value')) {
    addError(errors, `${path}.value`, 'MISSING_OBSERVATION_VALUE', 'The observation value is required.', 'observation')
  } else if (value.value !== null && !isNonEmptyString(value.value)) {
    addError(
      errors,
      `${path}.value`,
      'INVALID_OBSERVATION_VALUE',
      'The observation value must be a non-empty string or null.',
      'observation',
    )
  }

  if (!Object.hasOwn(value, 'confidence')) {
    addError(errors, `${path}.confidence`, 'MISSING_CONFIDENCE', 'Observation confidence is required.', 'observation')
  } else {
    checkConfidence(value, path, errors)
  }
}

function checkReadability(value, path, errors) {
  if (!isObject(value)) {
    addError(errors, path, 'INVALID_READABILITY', 'Readability must be an object.', 'observation')
    return
  }

  checkUnknownKeys(value, ['status', 'confidence'], path, errors, 'observation')

  if (!READABILITY_STATUSES.includes(value.status)) {
    addError(
      errors,
      `${path}.status`,
      'INVALID_READABILITY_STATUS',
      `Readability status must be one of: ${READABILITY_STATUSES.join(', ')}.`,
      'observation',
    )
  }

  if (!Object.hasOwn(value, 'confidence')) {
    addError(errors, `${path}.confidence`, 'MISSING_CONFIDENCE', 'Readability confidence is required.', 'observation')
  } else {
    checkConfidence(value, path, errors)
  }
}

function checkSource(value, errors) {
  const path = '$.source'
  if (!isObject(value)) {
    addError(errors, path, 'INVALID_SOURCE', 'Source must be an object.')
    return
  }

  checkUnknownKeys(value, ['applicationId', 'uploadedFileId'], path, errors, 'contract')
  for (const field of ['applicationId', 'uploadedFileId']) {
    if (!isNonEmptyString(value[field])) {
      addError(errors, `${path}.${field}`, 'INVALID_SOURCE_REFERENCE', `${field} must be a non-empty string.`)
    }
  }
}

function checkObservations(value, errors) {
  const path = '$.observations'
  if (!isObject(value)) {
    addError(errors, path, 'INVALID_OBSERVATIONS', 'Observations must be an object.', 'observation')
    return
  }

  checkUnknownKeys(value, OBSERVATION_KEYS, path, errors, 'observation')
  for (const field of OBSERVATION_FIELDS) {
    if (!Object.hasOwn(value, field)) {
      addError(errors, `${path}.${field}`, 'MISSING_OBSERVATION', `${field} observation is required.`, 'observation')
    } else {
      checkTextObservation(value[field], `${path}.${field}`, errors)
    }
  }

  if (!Object.hasOwn(value, 'readability')) {
    addError(errors, `${path}.readability`, 'MISSING_OBSERVATION', 'readability observation is required.', 'observation')
  } else {
    checkReadability(value.readability, `${path}.readability`, errors)
  }
}

function checkDecisions(value, observations, errors) {
  const path = '$.decisions'
  if (!isObject(value)) {
    addError(errors, path, 'INVALID_DECISIONS', 'Decisions must be an object.', 'decision')
    return
  }

  checkUnknownKeys(value, ['outcome', 'missingInformation'], path, errors, 'decision')

  if (!OUTCOMES.includes(value.outcome)) {
    addError(
      errors,
      `${path}.outcome`,
      'INVALID_OUTCOME',
      `Outcome must be one of: ${OUTCOMES.join(', ')}.`,
      'decision',
    )
  }

  if (!Array.isArray(value.missingInformation)) {
    addError(
      errors,
      `${path}.missingInformation`,
      'INVALID_MISSING_INFORMATION',
      'missingInformation must be an array of business-rule decisions.',
      'decision',
    )
    return
  }

  const seenFields = new Set()
  for (const [index, item] of value.missingInformation.entries()) {
    const itemPath = `${path}.missingInformation[${index}]`
    if (!isObject(item)) {
      addError(errors, itemPath, 'INVALID_MISSING_INFORMATION_ITEM', 'Each missing-information entry must be an object.', 'decision')
      continue
    }

    checkUnknownKeys(item, ['field', 'reason'], itemPath, errors, 'decision')
    if (!OBSERVATION_FIELDS.includes(item.field)) {
      addError(
        errors,
        `${itemPath}.field`,
        'INVALID_MISSING_FIELD',
        `field must be one of: ${OBSERVATION_FIELDS.join(', ')}.`,
        'decision',
      )
    } else if (seenFields.has(item.field)) {
      addError(errors, `${itemPath}.field`, 'DUPLICATE_MISSING_FIELD', 'A missing field may only appear once.', 'decision')
    } else {
      seenFields.add(item.field)
    }

    if (!isNonEmptyString(item.reason)) {
      addError(errors, `${itemPath}.reason`, 'INVALID_MISSING_REASON', 'reason must be a non-empty string.', 'decision')
    }
  }

  if (!isObject(observations)) return

  for (const field of OBSERVATION_FIELDS) {
    const observedValue = observations[field]?.value
    const markedMissing = value.missingInformation.some((item) => item?.field === field)
    if (observedValue === null && !markedMissing) {
      addError(
        errors,
        `${path}.missingInformation`,
        'MISSING_DECISION',
        `${field} is null in observations and must be listed as missing information.`,
        'decision',
      )
    }
    if (observedValue !== null && markedMissing) {
      addError(
        errors,
        `${path}.missingInformation`,
        'CONFLICTING_DECISION',
        `${field} was observed but is marked as missing information.`,
        'decision',
      )
    }
  }

  const readabilityStatus = observations.readability?.status
  const missingCount = value.missingInformation.length
  const expectedOutcome = readabilityStatus === 'unreadable'
    ? 'unreadable'
    : missingCount > 0
      ? 'incomplete'
      : readabilityStatus === 'clear'
        ? 'complete'
        : 'needs_review'

  if (OUTCOMES.includes(value.outcome) && value.outcome !== expectedOutcome) {
    addError(
      errors,
      `${path}.outcome`,
      'CONFLICTING_OUTCOME',
      `The outcome must be '${expectedOutcome}' for the supplied observations and missing-information decisions.`,
      'decision',
    )
  }
}

export function validateDocumentAnalysis(value) {
  const errors = []

  if (!isObject(value)) {
    addError(errors, '$', 'INVALID_ANALYSIS', 'Analysis must be a JSON object.')
    return { valid: false, errors }
  }

  checkUnknownKeys(value, ['schemaVersion', 'analysisId', 'source', 'observations', 'decisions'], '$', errors, 'contract')

  if (value.schemaVersion !== ANALYSIS_SCHEMA_VERSION) {
    addError(
      errors,
      '$.schemaVersion',
      'UNSUPPORTED_SCHEMA_VERSION',
      `schemaVersion must be '${ANALYSIS_SCHEMA_VERSION}'.`,
    )
  }
  if (!isNonEmptyString(value.analysisId)) {
    addError(errors, '$.analysisId', 'INVALID_ANALYSIS_ID', 'analysisId must be a non-empty string.')
  }

  checkSource(value.source, errors)
  checkObservations(value.observations, errors)
  checkDecisions(value.decisions, value.observations, errors)

  return { valid: errors.length === 0, errors }
}

export function validateAnalysisResponse(response) {
  let value = response

  if (typeof response === 'string') {
    try {
      value = JSON.parse(response)
    } catch {
      return {
        valid: false,
        value: null,
        errors: [{
          path: '$',
          code: 'MALFORMED_JSON',
          message: 'The analysis response is not valid JSON.',
          section: 'contract',
        }],
      }
    }
  }

  return { value, ...validateDocumentAnalysis(value) }
}

export { OBSERVATION_FIELDS, READABILITY_STATUSES, OUTCOMES }
