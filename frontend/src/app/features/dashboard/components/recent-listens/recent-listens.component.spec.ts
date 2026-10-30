import type { Mock, MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { RecentListensComponent } from './recent-listens.component';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { signal } from '@angular/core';
import { ListenEvent } from '../../../../core/types';

registerLocaleData(localeDe);
registerLocaleData(localeEn);

describe('RecentListensComponent', () => {
  let component: RecentListensComponent;
  let fixture: ComponentFixture<RecentListensComponent>;
  let mockApiService: MockedObject<ApiService>;
  let mockLanguageService: {
    language: ReturnType<typeof signal<string>>;
    translate: Mock;
  };

  const sampleListens: ListenEvent[] = [
    {
      id: 42,
      timestamp: '2026-10-12T19:44:12Z',
      record: {
        discogsId: 999,
        title: 'Abbey Road',
        artist: 'The Beatles',
        thumbUrl: 'https://example.com/cover.jpg',
      },
    },
  ];

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: vi.fn().mockName("ApiService.getProxiedImageUrl")
    } as unknown as MockedObject<ApiService>;
    mockApiService.getProxiedImageUrl.mockImplementation((url: string) => url);

    mockLanguageService = {
      language: signal('de'),
      translate: vi.fn().mockName('translate').mockImplementation((key: string) => {
        const translations: Record<string, string> = {
          'dashboard.recentListens': 'Kürzlich Gehört',
          'dashboard.noListens': 'Noch keine Hördurchgänge erfasst.',
        };
        return translations[key] || key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [RecentListensComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: LanguageService, useValue: mockLanguageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecentListensComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('listens', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render listen items and clean cover artwork without hover status badge', () => {
    fixture.componentRef.setInput('listens', sampleListens);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Abbey Road');
    expect(compiled.textContent).toContain('The Beatles');

    // Verify redundant scanned badge does NOT exist in DOM
    const badge = compiled.querySelector('.opacity-0.group-hover\\:opacity-100');
    // Delete button has opacity-0 group-hover:opacity-100, but no text "Gescannt" / "Scanned"
    expect(compiled.textContent).not.toContain('Gescannt:');
    expect(compiled.textContent).not.toContain('Scanned:');
  });

  it('should emit delete event when delete button is clicked', () => {
    fixture.componentRef.setInput('listens', sampleListens);
    fixture.detectChanges();

    const deleteSpy = vi.fn().mockName('deleteSpy');
    component.delete.subscribe(deleteSpy);

    const deleteBtn = fixture.nativeElement.querySelector('[data-testid="delete-listen"]');
    expect(deleteBtn).toBeTruthy();
    deleteBtn.click();

    expect(deleteSpy).toHaveBeenCalledWith(42);
  });

  it('should display empty state when there are no recent listens', () => {
    fixture.componentRef.setInput('listens', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Noch keine Hördurchgänge erfasst.');
  });

  it('uses compact rows with small covers on mobile and tiles from md', () => {
    fixture.componentRef.setInput('listens', sampleListens);
    fixture.detectChanges();

    const list: HTMLElement = fixture.nativeElement.querySelector('[data-testid="recent-listens-list"]');
    expect(list.classList).toContain('flex-col');
    expect(list.classList).toContain('md:grid');

    const cover: HTMLElement = fixture.nativeElement.querySelector('[data-testid="recent-cover"]');
    expect(cover.classList).toContain('w-10');
    expect(cover.classList).toContain('h-10');
    expect(cover.classList).toContain('md:aspect-square');
  });

  it('keeps the delete button visible on touch screens', () => {
    fixture.componentRef.setInput('listens', sampleListens);
    fixture.detectChanges();

    const deleteBtn: HTMLElement = fixture.nativeElement.querySelector('[data-testid="delete-listen"]');
    // Only hidden until hover from md; a plain opacity-0 would hide it on phones
    expect(deleteBtn.classList).not.toContain('opacity-0');
    expect(deleteBtn.classList).toContain('md:opacity-0');
    expect(deleteBtn.classList).toContain('w-11');
    expect(deleteBtn.getAttribute('aria-label')).toContain('Abbey Road');
  });

  it('opens the record details from an entry, while delete still only deletes', () => {
    fixture.componentRef.setInput('listens', sampleListens);
    fixture.detectChanges();
    const opened = vi.fn();
    const deleted = vi.fn();
    component.openRecord.subscribe(opened);
    component.delete.subscribe(deleted);

    const open: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="recent-open"]');
    expect(open.getAttribute('aria-label')).toBe('Details: Abbey Road');
    open.click();
    expect(opened).toHaveBeenCalledWith(sampleListens[0].record);

    // The delete button sits above the open button
    const deleteBtn: HTMLElement = fixture.nativeElement.querySelector('[data-testid="delete-listen"]');
    expect(deleteBtn.classList).toContain('z-20');
    deleteBtn.click();
    expect(deleted).toHaveBeenCalledWith(42);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  describe('show more', () => {
    const many: ListenEvent[] = Array.from({ length: 12 }, (_, i) => ({
      ...sampleListens[0],
      id: i + 1,
    }));
    const rows = () => fixture.nativeElement.querySelectorAll('[data-testid="recent-open"]').length;
    const toggle = () => fixture.nativeElement.querySelector('[data-testid="recent-toggle"]') as HTMLButtonElement | null;

    it('shows only 10 entries by default and all after "show more"', () => {
      fixture.componentRef.setInput('listens', many);
      fixture.detectChanges();
      expect(rows()).toBe(10);
      expect(toggle()?.textContent).toContain('stats.showMore');
      expect(toggle()?.textContent).toContain('12');

      toggle()!.click();
      fixture.detectChanges();
      expect(rows()).toBe(12);
      expect(toggle()?.textContent).toContain('stats.showLess');

      toggle()!.click();
      fixture.detectChanges();
      expect(rows()).toBe(10);
    });

    it('collapses again when a short list replaces the expanded one', () => {
      fixture.componentRef.setInput('listens', many);
      fixture.detectChanges();
      toggle()!.click();
      fixture.detectChanges();
      expect(rows()).toBe(12);

      fixture.componentRef.setInput('listens', many.slice(0, 3));
      fixture.detectChanges();
      fixture.componentRef.setInput('listens', many);
      fixture.detectChanges();
      expect(rows()).toBe(10);
    });

    it('hides the toggle with 10 or fewer entries', () => {
      fixture.componentRef.setInput('listens', many.slice(0, 10));
      fixture.detectChanges();
      expect(rows()).toBe(10);
      expect(toggle()).toBeNull();
    });
  });
});
