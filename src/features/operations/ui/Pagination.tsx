import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  onPage: (page: number) => void;
  noun: string;
}

function Pagination({ page, totalPages, count, pageSize, onPage, noun }: PaginationProps) {
  if (count === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);

  return (
    <nav className="ops-pagination" aria-label={`${noun} pages`}>
      <span className="ops-pagination__summary">
        {from.toLocaleString()}–{to.toLocaleString()} of {count.toLocaleString()} {noun}
      </span>
      <div className="ops-pagination__controls">
        <button
          type="button"
          className="ops-icon-btn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="ops-pagination__page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="ops-icon-btn"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
