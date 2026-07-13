import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className = '' }) => {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between border-t border-border py-4 ${className}`}>
      {/* Mobile */}
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">
            Showing page <span className="font-semibold text-text-primary">{currentPage}</span> of{' '}
            <span className="font-semibold text-text-primary">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-button shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-button border border-border bg-white px-2 py-2 text-sm font-medium text-text-muted hover:bg-app-page disabled:opacity-50 focus-ring"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative inline-flex items-center border border-border px-3.5 py-2 text-sm font-medium focus-ring ${
                    isActive
                      ? 'z-10 bg-crimson text-white border-crimson'
                      : 'bg-white text-text-muted hover:bg-app-page'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-button border border-border bg-white px-2 py-2 text-sm font-medium text-text-muted hover:bg-app-page disabled:opacity-50 focus-ring"
            >
              <span className="sr-only">Next</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
export default Pagination;
