import { DOCUMENT, DestroyRef, Directive, ElementRef, afterEveryRender, inject, input } from '@angular/core';

/** Delay before a tooltip opens on hover; keyboard focus opens it immediately. */
export const TOOLTIP_HOVER_DELAY_MS = 400;
/** Press duration that opens a tooltip on touch devices, which have no hover. */
export const TOOLTIP_LONG_PRESS_MS = 500;
/** How long a long-press tooltip stays visible after the finger is lifted. */
export const TOOLTIP_TOUCH_VISIBLE_MS = 1500;

const GAP_PX = 8;
let nextId = 0;

/**
 * Consistent tooltip for buttons, links and badges: opens on hover (after a short delay),
 * on keyboard focus and on long press, and closes on leave, blur, click, Escape, scroll and
 * resize. The text is linked via `aria-describedby`; an element without its own accessible
 * name gets it as `aria-label`, so icon-only buttons are announced by screen readers.
 * Disabled controls fire no mouse events in some browsers; they get the native `title`.
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
  host: {
    '(mouseenter)': 'open(hoverDelay)',
    '(mouseleave)': 'close()',
    '(focusin)': 'open(0)',
    '(focusout)': 'close()',
    '(click)': 'close()',
    '(keydown.escape)': 'close()',
    '(touchstart)': 'startLongPress()',
    '(touchmove)': 'cancelLongPress()',
    '(touchend)': 'endLongPress()',
  },
})
export class TooltipDirective {
  readonly appTooltip = input<string | null | undefined>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly id = `app-tooltip-${++nextId}`;
  private tooltip: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the `aria-label` / `title` on the host were set by this directive. */
  private ownsLabel = false;
  private ownsTitle = false;
  private readonly closeOnMove = () => this.close();

  readonly hoverDelay = TOOLTIP_HOVER_DELAY_MS;

  constructor() {
    // After every render: the visible text of the host (e.g. inside @if blocks), its disabled
    // state and the tooltip text may all have changed
    afterEveryRender(() => {
      const text = this.text();
      if (this.tooltip) this.tooltip.textContent = text;
      this.updateLabel(text);
      this.updateDisabledTitle(text);
    });
    inject(DestroyRef).onDestroy(() => this.close());
  }

  open(delay: number): void {
    if (!this.text()) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.show(), delay);
  }

  close(): void {
    this.clearTimer();
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
      this.document.removeEventListener('scroll', this.closeOnMove, true);
      this.document.defaultView?.removeEventListener('resize', this.closeOnMove);
    }
    this.host.removeAttribute('aria-describedby');
  }

  startLongPress(): void {
    this.open(TOOLTIP_LONG_PRESS_MS);
  }

  cancelLongPress(): void {
    if (!this.tooltip) this.clearTimer();
  }

  endLongPress(): void {
    if (!this.tooltip) {
      this.clearTimer();
      return;
    }
    this.clearTimer();
    this.timer = setTimeout(() => this.close(), TOOLTIP_TOUCH_VISIBLE_MS);
  }

  private text(): string {
    return (this.appTooltip() ?? '').trim();
  }

  private show(): void {
    if (!this.tooltip) {
      const tooltip = this.document.createElement('div');
      tooltip.id = this.id;
      tooltip.setAttribute('role', 'tooltip');
      tooltip.className =
        'fixed z-[100] max-w-xs px-2.5 py-1.5 rounded-lg text-xs font-medium leading-snug shadow-lg pointer-events-none ' +
        'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';
      this.document.body.appendChild(tooltip);
      this.tooltip = tooltip;
      // A fixed tooltip would stay behind while the page scrolls
      this.document.addEventListener('scroll', this.closeOnMove, { capture: true, passive: true });
      this.document.defaultView?.addEventListener('resize', this.closeOnMove);
    }
    this.tooltip.textContent = this.text();
    this.host.setAttribute('aria-describedby', this.id);
    this.position(this.tooltip);
  }

  /** Above the element, below if there is no room, and always within the viewport. */
  private position(tooltip: HTMLElement): void {
    const target = this.host.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const viewportWidth = this.document.documentElement.clientWidth;
    let top = target.top - box.height - GAP_PX;
    if (top < GAP_PX) top = target.bottom + GAP_PX;
    const centered = target.left + target.width / 2 - box.width / 2;
    const left = Math.min(Math.max(centered, GAP_PX), Math.max(GAP_PX, viewportWidth - box.width - GAP_PX));
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
  }

  private updateLabel(text: string): void {
    const hasOwnName =
      (this.host.hasAttribute('aria-label') && !this.ownsLabel) || !!this.host.textContent?.trim();
    if (text && !hasOwnName) {
      if (this.host.getAttribute('aria-label') !== text) this.host.setAttribute('aria-label', text);
      this.ownsLabel = true;
    } else if (this.ownsLabel) {
      this.host.removeAttribute('aria-label');
      this.ownsLabel = false;
    }
  }

  private updateDisabledTitle(text: string): void {
    const disabled = (this.host as HTMLButtonElement).disabled === true;
    if (disabled && text) {
      if (this.host.getAttribute('title') !== text) this.host.setAttribute('title', text);
      this.ownsTitle = true;
    } else if (this.ownsTitle) {
      this.host.removeAttribute('title');
      this.ownsTitle = false;
    }
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
