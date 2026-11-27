/** Document checks and checklist readiness describe different milestones. */
export default function ApplicationTracker({ status, fileCount, checkedCount, checking, loading, failed, unavailable, ready }: {
  status: string;
  fileCount: number | null;
  checkedCount: number;
  checking: boolean;
  loading: boolean;
  failed: boolean;
  unavailable: boolean;
  ready: boolean;
}) {
  const decided = status === 'approved' || status === 'rejected';
  const current = decided ? 4 : status === 'submitted' || ready ? 3 : fileCount === null ? -1 : fileCount ? 2 : 1;
  let checkDetail = 'Waiting for documents';
  if (unavailable) checkDetail = 'Progress unavailable';
  else if (checking) checkDetail = 'Checking documents';
  else if (loading && fileCount !== 0) checkDetail = 'Loading progress';
  else if (fileCount) {
    checkDetail = checkedCount === fileCount ? 'Checked'
      : checkedCount ? `${checkedCount} of ${fileCount} documents checked`
      : failed ? 'Analysis needs a retry' : 'Ready to analyze';
  }
  const steps = [
    ['Draft', 'Created'],
    ['Documents', fileCount === null ? 'Waiting' : fileCount ? 'Uploaded' : 'Not uploaded yet'],
    ['TSEK check', checkDetail],
    ['Barangay review', decided ? 'Reviewed' : status === 'submitted' ? 'Waiting for staff' : ready ? 'Submit when ready' : 'Not yet'],
    ['Decision', status === 'approved' ? 'Approved' : status === 'rejected' ? 'Not approved' : 'Not yet'],
  ];
  return <ol className="application-tracker" aria-label="Application progress">
    {steps.map(([label, detail], index) => {
      const done = index === 2
        ? fileCount !== null && fileCount > 0 && checkedCount === fileCount && !checking && !unavailable
        : index < current || (decided && index === 4);
      return <li key={label} aria-current={index === current ? 'step' : undefined}
        className={`${done ? 'is-done' : ''}${index === current ? ' is-current' : ''}${index === 4 && status === 'rejected' ? ' is-rejected' : ''}`}>
        <div className="tracker-line"><span className="tracker-dot" aria-hidden="true">
          {done ? <img src={`/figma/ticket/${index === 4 && status === 'rejected' ? 'step-rejected' : 'step-check'}.svg`} alt="" /> : index + 1}
        </span>{index < steps.length - 1 && <span className="tracker-connector" aria-hidden="true"><span className="tracker-fill" /></span>}</div><strong>{label}</strong><small>{detail}</small>
      </li>;
    })}
  </ol>;
}
