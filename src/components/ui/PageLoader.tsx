import "./PageLoader.css";

interface PageLoaderProps {
  active: boolean;
}

function PageLoader({ active }: PageLoaderProps) {
  return (
    <div
      className={`page-loader${active ? " page-loader--active" : ""}`}
      aria-hidden={!active}
      role="status"
    >
      <div className="page-loader__inner">
        <div className="page-loader__brand">EVORA</div>
        <p className="page-loader__hint">Setting up your workspace</p>
      </div>
      <div className="page-loader__bar">
        <span className="page-loader__bar-fill" />
      </div>
    </div>
  );
}

export default PageLoader;
