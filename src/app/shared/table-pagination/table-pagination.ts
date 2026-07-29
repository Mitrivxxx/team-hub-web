import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-table-pagination',
  templateUrl: './table-pagination.html',
  styleUrl: './table-pagination.scss',
})
export class TablePagination {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalItems = input(0);

  readonly pageChange = output<number>();

  readonly pageLabel = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 0) {
      return 'Page 0 of 0';
    }
    return `Page ${current} of ${total}`;
  });

  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, total, current]);
    if (current > 1) {
      pages.add(current - 1);
    }
    if (current < total) {
      pages.add(current + 1);
    }

    return [...pages].sort((a, b) => a - b);
  });

  readonly showLeadingEllipsis = computed(() => {
    const pages = this.visiblePages();
    return pages.length > 0 && pages[0] > 1;
  });

  readonly showTrailingEllipsis = computed(() => {
    const pages = this.visiblePages();
    const total = this.totalPages();
    return pages.length > 0 && pages[pages.length - 1] < total;
  });

  goTo(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.pageChange.emit(page);
  }
}
