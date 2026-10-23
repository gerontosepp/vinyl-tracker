import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OpenRouterSettingsComponent } from './openrouter-settings.component';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5';

describe('OpenRouterSettingsComponent', () => {
  let fixture: ComponentFixture<OpenRouterSettingsComponent>;
  let http: HttpTestingController;
  let toast: MockedObject<ToastService>;

  beforeEach(async () => {
    toast = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;
    await TestBed.configureTestingModule({
      imports: [OpenRouterSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OpenRouterSettingsComponent);
    fixture.autoDetectChanges();
  });

  afterEach(() => http.verify());

  async function load(hasApiKey: boolean, model = DEFAULT_MODEL): Promise<void> {
    TestBed.tick();
    http.expectOne('/api/users/me/openrouter').flush({ hasApiKey, model, defaultModel: DEFAULT_MODEL });
    await fixture.whenStable();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const input = (id: string) => el().querySelector<HTMLInputElement>(`#${id}`)!;
  const button = (testId: string) => el().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  const type = async (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  it('shows that no key is configured and enables saving once a key is typed', async () => {
    await load(false);
    expect(button('openrouter-save')!.disabled).toBe(true);
    expect(el().querySelector('[data-testid="openrouter-status"]')?.textContent).toContain('Nicht eingerichtet');
    expect(input('openrouter-model').value).toBe(DEFAULT_MODEL);
    expect(button('openrouter-remove')).toBeNull();

    await type('openrouter-key', ' sk-or-123 ');
    expect(button('openrouter-save')!.disabled).toBe(false);
  });

  it('saves a new key and model and clears the key field', async () => {
    await load(false);
    await type('openrouter-key', 'sk-or-123');
    await type('openrouter-model', 'anthropic/claude-haiku-5.5');

    button('openrouter-save')!.click();
    const req = http.expectOne({ url: '/api/users/me/openrouter', method: 'PUT' });
    expect(req.request.body).toEqual({ apiKey: 'sk-or-123', model: 'anthropic/claude-haiku-5.5' });
    req.flush({ hasApiKey: true, model: 'anthropic/claude-haiku-5.5', defaultModel: DEFAULT_MODEL });
    await fixture.whenStable();
    await fixture.whenStable();

    expect(input('openrouter-key').value).toBe('');
    expect(el().querySelector('[data-testid="openrouter-status"]')?.textContent).toContain('Aktiv');
    expect(toast.showToast).toHaveBeenCalledWith('Label-Erkennung gespeichert', 'success');
  });

  it('changes only the model without sending a key', async () => {
    await load(true);
    expect(input('openrouter-key').placeholder).toContain('Key hinterlegt');
    await type('openrouter-model', 'google/gemini-3-flash-preview');

    button('openrouter-save')!.click();
    const req = http.expectOne({ url: '/api/users/me/openrouter', method: 'PUT' });
    expect(req.request.body).toEqual({ model: 'google/gemini-3-flash-preview' });
    req.flush({ hasApiKey: true, model: 'google/gemini-3-flash-preview', defaultModel: DEFAULT_MODEL });
  });

  it('removes the stored key', async () => {
    await load(true);
    button('openrouter-remove')!.click();
    const req = http.expectOne({ url: '/api/users/me/openrouter', method: 'PUT' });
    expect(req.request.body).toEqual({ apiKey: '', model: DEFAULT_MODEL });
    req.flush({ hasApiKey: false, model: DEFAULT_MODEL, defaultModel: DEFAULT_MODEL });
    await fixture.whenStable();
    await fixture.whenStable();
    expect(toast.showToast).toHaveBeenCalledWith('API-Key entfernt', 'success');
  });

  it('reports load and save errors', async () => {
    TestBed.tick();
    http.expectOne('/api/users/me/openrouter').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('konnten nicht geladen werden');
  });

  it('reports a rejected save as toast', async () => {
    await load(false);
    await type('openrouter-key', 'sk-or-bad');
    button('openrouter-save')!.click();
    http.expectOne({ url: '/api/users/me/openrouter', method: 'PUT' }).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    await fixture.whenStable();
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(fixture.componentInstance.saving()).toBe(false);
  });
});
