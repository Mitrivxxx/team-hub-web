import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgStyle } from '@angular/common';

import { OverflowMenuItem } from './overflow-menu.model';

@Component({
  selector: 'app-overflow-menu',
  imports: [NgStyle],
  templateUrl: './overflow-menu.html',
  styleUrl: './overflow-menu.scss',
})
export class OverflowMenu implements OnInit, OnDestroy, AfterViewChecked {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly dropdown = viewChild<ElementRef<HTMLElement>>('dropdown');

  readonly items = input.required<OverflowMenuItem[]>();
  readonly ariaLabel = input('Actions');

  readonly itemSelect = output<string>();

  readonly isOpen = signal(false);
  readonly menuStyle = signal<Record<string, string>>({});

  private needsPositionUpdate = false;
  private readonly onScrollCapture = (): void => {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  };

  ngOnInit(): void {
    document.addEventListener('scroll', this.onScrollCapture, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onScrollCapture, true);
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.isOpen();
    if (next) {
      this.setInitialPosition();
      this.needsPositionUpdate = true;
    }
    this.isOpen.set(next);
  }

  onItemClick(item: OverflowMenuItem, event: MouseEvent): void {
    event.stopPropagation();
    if (item.disabled) {
      return;
    }

    this.isOpen.set(false);
    this.itemSelect.emit(item.id);
  }

  ngAfterViewChecked(): void {
    if (!this.needsPositionUpdate || !this.isOpen()) {
      return;
    }
    this.needsPositionUpdate = false;
    requestAnimationFrame(() => this.updatePosition());
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

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  private setInitialPosition(): void {
    const triggerEl = this.trigger()?.nativeElement;
    if (!triggerEl) {
      return;
    }

    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = 160;
    let left = rect.right - menuWidth;
    left = Math.min(left, window.innerWidth - menuWidth - 8);
    left = Math.max(8, left);

    this.menuStyle.set({
      top: `${rect.bottom + 4}px`,
      left: `${left}px`,
      visibility: 'hidden',
    });
  }

  private updatePosition(): void {
    const triggerEl = this.trigger()?.nativeElement;
    const dropdownEl = this.dropdown()?.nativeElement;
    if (!triggerEl || !dropdownEl) {
      return;
    }

    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = dropdownEl.offsetWidth || 160;
    const menuHeight = dropdownEl.offsetHeight || 0;
    const gap = 4;
    const viewportPadding = 8;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = rect.top - menuHeight - gap;
    }
    top = Math.max(viewportPadding, top);

    let left = rect.right - menuWidth;
    left = Math.min(left, window.innerWidth - menuWidth - viewportPadding);
    left = Math.max(viewportPadding, left);

    this.menuStyle.set({
      top: `${top}px`,
      left: `${left}px`,
      visibility: 'visible',
    });
  }
}
