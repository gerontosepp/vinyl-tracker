import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TOOLTIP_HOVER_DELAY_MS,
  TOOLTIP_LONG_PRESS_MS,
  TOOLTIP_TOUCH_VISIBLE_MS,
  TooltipDirective,
} from './tooltip.directive';

@Component({
  standalone: true,
  imports: [TooltipDirective],
  template: `
    <button type="button" data-testid="icon" [appTooltip]="text()"><svg></svg></button>
    <button type="button" data-testid="labelled" aria-label="Own name" appTooltip="More details"><svg></svg></button>
    <button type="button" data-testid="text" appTooltip="Hint">Visible text</button>
    <button type="button" data-testid="later" appTooltip="Play on Roon">
      @if (showLabel()) {
        <span>Play</span>
      }
    </button>
    <button type="button" data-testid="disabled" appTooltip="Log a listen" [disabled]="disabled()"><svg></svg></button>
  `,
})
class HostComponent {
  readonly text = signal('Delete listen');
  readonly showLabel = signal(false);
  readonly disabled = signal(true);
}

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  const button = (testId: string): HTMLElement => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  const tooltip = (): HTMLElement | null => document.body.querySelector('[role="tooltip"]');

  it('opens after the hover delay and closes on leave', () => {
    button('icon').dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS - 1);
    expect(tooltip()).toBeNull();

    vi.advanceTimersByTime(1);
    expect(tooltip()?.textContent).toBe('Delete listen');
    expect(button('icon').getAttribute('aria-describedby')).toBe(tooltip()?.id);

    button('icon').dispatchEvent(new Event('mouseleave'));
    expect(tooltip()).toBeNull();
    expect(button('icon').hasAttribute('aria-describedby')).toBe(false);
  });

  it('opens immediately on keyboard focus and closes on Escape', () => {
    button('icon').dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(0);
    expect(tooltip()).not.toBeNull();

    button('icon').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tooltip()).toBeNull();
  });

  it('opens on long press and hides again after lifting the finger', () => {
    button('icon').dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(TOOLTIP_LONG_PRESS_MS);
    expect(tooltip()).not.toBeNull();

    button('icon').dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(TOOLTIP_TOUCH_VISIBLE_MS);
    expect(tooltip()).toBeNull();
  });

  it('does not open for a short tap or a scroll', () => {
    button('icon').dispatchEvent(new Event('touchstart'));
    button('icon').dispatchEvent(new Event('touchmove'));
    vi.advanceTimersByTime(TOOLTIP_LONG_PRESS_MS);
    expect(tooltip()).toBeNull();
  });

  it('names icon-only elements but keeps an existing name or visible text', () => {
    expect(button('icon').getAttribute('aria-label')).toBe('Delete listen');
    expect(button('labelled').getAttribute('aria-label')).toBe('Own name');
    expect(button('text').hasAttribute('aria-label')).toBe(false);
  });

  it('follows text changes and stays closed without text', () => {
    fixture.componentInstance.text.set('Remove');
    fixture.detectChanges();
    expect(button('icon').getAttribute('aria-label')).toBe('Remove');

    fixture.componentInstance.text.set('');
    fixture.detectChanges();
    expect(button('icon').hasAttribute('aria-label')).toBe(false);
    button('icon').dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS);
    expect(tooltip()).toBeNull();
  });

  it('removes an open tooltip when the element is destroyed', () => {
    button('icon').dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(0);
    expect(tooltip()).not.toBeNull();
    fixture.destroy();
    expect(tooltip()).toBeNull();
  });

  it('drops its aria-label once the element shows visible text', () => {
    expect(button('later').getAttribute('aria-label')).toBe('Play on Roon');
    fixture.componentInstance.showLabel.set(true);
    TestBed.tick();
    expect(button('later').hasAttribute('aria-label')).toBe(false);
  });

  it('falls back to the native title while the element is disabled', () => {
    expect(button('disabled').getAttribute('title')).toBe('Log a listen');
    fixture.componentInstance.disabled.set(false);
    TestBed.tick();
    expect(button('disabled').hasAttribute('title')).toBe(false);
  });

  it('closes when the page scrolls', () => {
    button('icon').dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(0);
    expect(tooltip()).not.toBeNull();
    document.dispatchEvent(new Event('scroll'));
    expect(tooltip()).toBeNull();
  });
});
