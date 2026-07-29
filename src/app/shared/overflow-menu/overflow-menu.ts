import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { OverflowMenuItem } from './overflow-menu.model';

@Component({
  selector: 'app-overflow-menu',
  templateUrl: './overflow-menu.html',
  styleUrl: './overflow-menu.scss',
})
export class OverflowMenu {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly items = input.required<OverflowMenuItem[]>();
  readonly ariaLabel = input('Actions');

  readonly itemSelect = output<string>();

  readonly isOpen = signal(false);

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update((open) => !open);
  }

  onItemClick(item: OverflowMenuItem, event: MouseEvent): void {
    event.stopPropagation();
    if (item.disabled) {
      return;
    }

    this.isOpen.set(false);
    this.itemSelect.emit(item.id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }
}
