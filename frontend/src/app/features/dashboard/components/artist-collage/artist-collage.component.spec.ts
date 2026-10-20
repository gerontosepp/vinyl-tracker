import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArtistCollageComponent } from './artist-collage.component';
import { ApiService } from '../../../../core/services/api.service';

describe('ArtistCollageComponent', () => {
  let fixture: ComponentFixture<ArtistCollageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtistCollageComponent],
      providers: [{ provide: ApiService, useValue: { getProxiedImageUrl: (url: string) => `proxy:${url}` } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ArtistCollageComponent);
  });

  function render(urls: string[]): HTMLElement {
    fixture.componentRef.setInput('thumbUrls', urls);
    fixture.componentRef.setInput('alt', 'The Beatles');
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[data-testid="artist-collage"]');
  }

  const urls = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'];

  it('fills the tile with a single cover', () => {
    const grid = render(urls.slice(0, 1));
    expect(grid.querySelectorAll('img').length).toBe(1);
    expect(grid.classList.contains('grid-cols-2')).toBe(false);
    expect(grid.querySelector('img')?.getAttribute('src')).toBe('proxy:a.jpg');
    expect(grid.querySelector('img')?.getAttribute('alt')).toBe('The Beatles');
  });

  it('puts two covers side by side', () => {
    const grid = render(urls.slice(0, 2));
    expect(grid.classList.contains('grid-cols-2')).toBe(true);
    expect(grid.classList.contains('grid-rows-2')).toBe(false);
  });

  it('uses a 2×2 grid for three or more covers and shows at most four', () => {
    const grid = render(urls.slice(0, 3));
    expect(grid.classList.contains('grid-rows-2')).toBe(true);
    expect(grid.querySelectorAll('img').length).toBe(3);
    expect(render(urls).querySelectorAll('img').length).toBe(4);
  });

  it('shows a placeholder without covers', () => {
    const grid = render([]);
    expect(grid.querySelectorAll('img').length).toBe(0);
    expect(grid.textContent).toContain('🎤');
  });
});
