import { Stage } from '@/lib/sample-data';

export function Pipeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="pipeline">
      {stages.map((stage, index) => (
        <div key={stage.name} className={`stage stage-${stage.status}`}>
          <span className="stage-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="stage-state">{stage.status}</span>
          <h3>{stage.name}</h3>
          <p>{stage.description}</p>
        </div>
      ))}
    </div>
  );
}
