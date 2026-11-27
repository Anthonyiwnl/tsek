import { useResource } from './useResource';
import { Button } from './DesignUI';

type Event = { id: string; event: string; created_at: string; prompt_version?: string | null; actor_id?: string | null };
const labels: Record<string, string> = { snapshot: 'Existing application', draft: 'Draft created', submitted: 'Submitted for review', analysed: 'Document analysed', analysis_failed: 'Document analysis failed', approved: 'Approved', rejected: 'Not approved' };
export default function ApplicationTimeline({ load, staff = false }: { load: (signal: AbortSignal) => Promise<Event[]>; staff?: boolean }) {
  const resource = useResource<Event[]>(load, [load]);
  return <section className="workspace-card"><h2>Application history</h2>
    {resource.loading && <p role="status">Loading history...</p>}
    {Boolean(resource.error) && <p role="alert">History is unavailable.</p>}
    {!resource.loading && !resource.error && !resource.data?.length && <p>No history recorded yet.</p>}
    {!resource.loading && !resource.error && !!resource.data?.length && <ol>{resource.data.map(event => <li key={event.id}>
      <strong>{labels[event.event] ?? 'Application updated'}</strong> · <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
      {staff && event.actor_id && <p>Actor: {event.actor_id}</p>}{staff && event.prompt_version && <p>Prompt: {event.prompt_version}</p>}
    </li>)}</ol>}
    <Button variant="secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh history</Button>
  </section>;
}
