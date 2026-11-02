function validRecord(value) {
  return value && typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string' && value.name.trim().length > 0;
}

function uniqueRecords(values) {
  return Array.isArray(values) && values.every(validRecord)
    && new Set(values.map(value => value.id)).size === values.length;
}

/** Load the PostgreSQL catalogue through the backend; never fall back to fixtures. */
export async function loadCatalogue(endpoint, signal, fetchImpl = fetch) {
  const base = endpoint.replace(/\/$/, '');
  async function read(url) {
    const response = await fetchImpl(url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Catalogue unavailable');
    const payload = await response.json();
    return payload?.data;
  }
  const types = await read(base);
  if (!uniqueRecords(types)) throw new Error('Invalid catalogue response');
  return Promise.all(types.map(async type => {
    const detail = await read(`${base}/${encodeURIComponent(type.id)}/requirements`);
    if (!validRecord(detail) || detail.id !== type.id
      || !uniqueRecords(detail.requirements)
      || !detail.requirements.every(item => typeof item.is_required === 'boolean')) {
      throw new Error('Invalid requirements response');
    }
    return {
      id: type.id,
      name: type.name,
      description: typeof type.description === 'string' ? type.description : '',
      requirements: detail.requirements.map(item => ({
        id: item.id, name: item.name, is_required: item.is_required,
      })),
    };
  }));
}
