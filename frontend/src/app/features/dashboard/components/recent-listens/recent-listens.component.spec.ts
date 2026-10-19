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

    const deleteBtn = fixture.nativeElement.querySelector('button[title="Delete Scan"]');
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
});
