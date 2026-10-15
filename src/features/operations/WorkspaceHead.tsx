import type { ReactNode } from "react";
import { Plus } from "lucide-react";

interface WorkspaceHeadProps {
  title: string;
  description: string;
  count?: number;
  action?: { label: string; onClick: () => void };
  extra?: ReactNode;
}

function WorkspaceHead({ title, description, count, action, extra }: WorkspaceHeadProps) {
  return (
    <div className="ops-wshead">
      <div>
        <h2 className="ops-wshead__title">
          {title}
          {count !== undefined && <span className="ops-count">{count.toLocaleString()}</span>}
        </h2>
        <p className="ops-wshead__desc">{description}</p>
      </div>
      <div className="ops-wshead__actions">
        {extra}
        {action && (
          <button type="button" className="ops-btn ops-btn--primary" onClick={action.onClick}>
            <Plus size={17} strokeWidth={2.2} /> {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export default WorkspaceHead;
