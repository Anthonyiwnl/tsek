export type RequirementDecision = {
  id: string;
  name: string;
  status: string;
  reason: string;
  is_required: boolean;
  evidence_lines?: string[];
};

export default function RequirementEvidence({ requirement }: { requirement: RequirementDecision }) {
  if (requirement.status === 'complete') return null;
  return <details className="requirement-evidence">
    <summary aria-label={`Why was this flagged? ${requirement.name}`}>Why was this flagged?</summary>
    {requirement.evidence_lines?.length
      ? <blockquote>{requirement.evidence_lines.join('\n')}</blockquote>
      : <p>No evidence was returned for this requirement.</p>}
  </details>;
}
