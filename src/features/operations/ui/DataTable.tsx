import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { ErrorBlock } from "./states";

export interface Column<T> {
  key: string;
  header: string;
  /** Server-side ordering key; makes the header clickable. */
  sortKey?: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: string;
  onSort?: (sort: string) => void;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  empty: ReactNode;
  caption: string;
}

function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSort,
  loading,
  error,
  onRetry,
  empty,
  caption,
}: DataTableProps<T>) {
  if (error && !rows) return <ErrorBlock message={error} onRetry={onRetry} />;

  const nextSort = (key: string) => (sort === key ? `-${key}` : key);

  return (
    <div className={`ops-table-wrap ${loading && rows ? "ops-table-wrap--busy" : ""}`}>
      {error && rows && (
        <div className="ops-callout ops-callout--danger" role="alert">
          Couldn’t refresh: {error}{" "}
          {onRetry && (
            <button type="button" className="ops-link" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      {rows && rows.length === 0 && !loading ? (
        empty
      ) : (
        <div className="ops-table-scroll">
          <table className="ops-table">
            <caption className="ops-sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => {
                  const active =
                    column.sortKey && (sort === column.sortKey || sort === `-${column.sortKey}`);
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={column.className}
                      aria-sort={
                        active ? (sort?.startsWith("-") ? "descending" : "ascending") : undefined
                      }
                    >
                      {column.sortKey && onSort ? (
                        <button
                          type="button"
                          className="ops-th-sort"
                          onClick={() => onSort(nextSort(column.sortKey!))}
                        >
                          {column.header}
                          {active ? (
                            sort?.startsWith("-") ? (
                              <ArrowDown size={14} />
                            ) : (
                              <ArrowUp size={14} />
                            )
                          ) : (
                            <ChevronsUpDown size={14} className="ops-th-sort__idle" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows
                ? rows.map((row) => (
                    <tr
                      key={rowKey(row)}
                      className={onRowClick ? "ops-row--click" : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (event) => {
                              if (event.key === "Enter" && event.target === event.currentTarget) {
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                      tabIndex={onRowClick ? 0 : undefined}
                    >
                      {columns.map((column) => (
                        <td key={column.key} className={column.className}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                : Array.from({ length: 6 }, (_, index) => (
                    <tr key={index} aria-hidden="true">
                      {columns.map((column) => (
                        <td key={column.key}>
                          <span className="ops-skeleton__line" style={{ height: 14, width: "70%" }} />
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DataTable;
