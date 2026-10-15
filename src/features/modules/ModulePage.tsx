import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import "./ModulePage.css";

interface ModulePageProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Stand-in for sidebar pages that are not built yet. */
function ModulePage({ icon: Icon, title, description }: ModulePageProps) {
  return (
    <div className="module-page">
      <span className="module-page__icon">
        <Icon size={32} strokeWidth={1.5} />
      </span>
      <h1 className="module-page__title">{title}</h1>
      <p className="module-page__text">{description}</p>
      <Link className="module-page__link" to="/dashboard">
        ← Back to Dashboard
      </Link>
    </div>
  );
}

export default ModulePage;
