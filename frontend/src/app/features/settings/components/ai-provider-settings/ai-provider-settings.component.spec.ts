import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AiProviderSettingsComponent } from './ai-provider-settings.component';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { AiConnection, AiPreset } from '../../../../core/types';

const PRESETS: AiPreset[] = [
  {
    kind: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    authStyle: 'bearer',
    requiresApiKey: true,
  },
  {
    kind: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    authStyle: 'none',
    requiresApiKey: false,
  },
];

const connection = (overrides: Partial<AiConnection> = {}): AiConnection => ({
  id: 1,
  name: 'OpenRouter',
  kind: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'test/vision-model',
  hasApiKey: true,
  authStyle: 'bearer',
  extraHeaders: {},
  isDefault: true,
  createdAt: '2026-11-12T18:00:00Z',
  updatedAt: '2026-11-12T18:00:00Z',
  ...overrides,
});

describe('AiProviderSettingsComponent', () => {
  let fixture: ComponentFixture<AiProviderSettingsComponent>;
  let component: AiProviderSettingsComponent;
  let http: HttpTestingController;
  let toast: MockedObject<ToastService>;

  beforeEach(async () => {
    toast = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;
    await TestBed.configureTestingModule({
      imports: [AiProviderSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AiProviderSettingsComponent);
    component = fixture.componentInstance;
    fixture.autoDetectChanges();
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement;
  const input = (id: string) => el().querySelector<HTMLInputElement>(`#${id}`)!;
  const button = (testId: string) => el().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  const type = async (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const choose = async (id: string, value: string) => {
    const select = input(id) as unknown as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  function flushList(list: AiConnection[] = [connection()]): void {
    TestBed.tick();
    http.match((r) => r.url === '/api/users/me/ai/connections' && r.method === 'GET').forEach((r) => r.flush(list));
  }
  async function load(list: AiConnection[] = [connection()]): Promise<void> {
    TestBed.tick();
    http.match((r) => r.url === '/api/users/me/ai/presets').forEach((r) => r.flush(PRESETS));
    flushList(list);
    await fixture.whenStable();
  }

  it('lists connections and shows the empty state without one', async () => {
    await load([]);
    expect(el().querySelector('[data-testid="ai-empty"]')?.textContent).toContain('Noch keine KI-Verbindung');
    expect(button('ai-add')).toBeTruthy();

    component.connections.reload();
    flushList([connection()]);
    await fixture.whenStable();
    expect(el().querySelector('[data-testid="ai-connection"]')?.textContent).toContain('OpenRouter');
    expect(el().querySelector('[data-testid="ai-default-badge"]')?.textContent).toContain('Standard');
  });

  it('creates a connection and sends the key', async () => {
    await load([]);
    button('ai-add')!.click();
    await fixture.whenStable();

    expect(input('ai-name').value).toBe('OpenRouter');
    expect(input('ai-base-url').value).toBe('https://openrouter.ai/api/v1');
    expect(button('ai-save')!.disabled).toBe(true);

    await type('ai-model', 'test/vision-model');
    await type('ai-key', 'sk-or-123');
    expect(button('ai-save')!.disabled).toBe(false);

    const saving = component.save();
    const req = http.expectOne({ url: '/api/users/me/ai/connections', method: 'POST' });
    expect(req.request.body).toEqual({
      name: 'OpenRouter',
      kind: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'test/vision-model',
      authStyle: 'bearer',
      apiKey: 'sk-or-123',
    });
    req.flush(connection());
    await saving;
    flushList();
    await fixture.whenStable();
    expect(toast.showToast).toHaveBeenCalledWith('KI-Verbindung angelegt', 'success');
    expect(el().querySelector('form')).toBeNull();
  });

  it('edits a connection without sending the stored key', async () => {
    await load();
    button('ai-edit')!.click();
    await fixture.whenStable();
    expect(input('ai-name').value).toBe('OpenRouter');
    expect(input('ai-key').placeholder).toContain('Key hinterlegt');

    await type('ai-model', 'other/model');
    const saving = component.save();
    const req = http.expectOne({ url: '/api/users/me/ai/connections/1', method: 'PUT' });
    expect(req.request.body).toEqual({
      name: 'OpenRouter',
      kind: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'other/model',
      authStyle: 'bearer',
    });
    req.flush(connection({ model: 'other/model' }));
    await saving;
    flushList([connection({ model: 'other/model' })]);
    await fixture.whenStable();
    expect(toast.showToast).toHaveBeenCalledWith('KI-Verbindung gespeichert', 'success');
  });

  it('removes a stored key from the edit form', async () => {
    await load();
    button('ai-edit')!.click();
    await fixture.whenStable();

    const removing = component.removeStoredKey();
    const req = http.expectOne({ url: '/api/users/me/ai/connections/1', method: 'PUT' });
    expect(req.request.body).toMatchObject({ apiKey: '' });
    req.flush(connection({ hasApiKey: false }));
    await removing;
    flushList([connection({ hasApiKey: false })]);
    await fixture.whenStable();

    expect(component.hasKey()).toBe(false);
    expect(toast.showToast).toHaveBeenCalledWith('API-Key entfernt', 'success');
  });

  it('tests a saved connection', async () => {
    await load();
    const testing = component.test(connection());
    http.expectOne({ url: '/api/users/me/ai/connections/1/test', method: 'POST' }).flush({
      ok: true,
      provider: 'OpenRouter',
      model: 'test/vision-model',
    });
    await testing;
    await fixture.whenStable();

    expect(el().textContent).toContain('OpenRouter · test/vision-model antwortet.');
    expect(toast.showToast).toHaveBeenCalledWith('OpenRouter · test/vision-model antwortet.', 'success');
  });

  it('loads models for a saved connection', async () => {
    await load();
    button('ai-edit')!.click();
    await fixture.whenStable();
    const loading = component.loadModels();
    http
      .expectOne({ url: '/api/users/me/ai/connections/1/models', method: 'GET' })
      .flush({ models: ['z/model', 'a/model'], supported: true });
    await loading;
    await fixture.whenStable();

    expect(component.modelOptions()).toEqual(['z/model', 'a/model']);
    expect(el().textContent).toContain('2 Modelle geladen');
  });

  it('changes the preset and accepts a local connection without a key', async () => {
    await load([]);
    button('ai-add')!.click();
    await fixture.whenStable();
    await choose('ai-preset', 'ollama');
    expect(input('ai-base-url').value).toBe('http://localhost:11434/v1');
    expect(component.authStyle()).toBe('none');

    await type('ai-model', 'llava');
    expect(button('ai-save')!.disabled).toBe(false);
  });

  it('sets a connection as default and deletes another one', async () => {
    const second = connection({ id: 2, name: 'Ollama', kind: 'ollama', isDefault: false });
    await load([connection(), second]);

    const makingDefault = component.makeDefault(second);
    const defaultReq = http.expectOne({ url: '/api/users/me/ai/connections/2/default', method: 'PUT' });
    defaultReq.flush(second);
    await makingDefault;
    flushList([connection({ isDefault: false }), second]);
    await fixture.whenStable();
    expect(toast.showToast).toHaveBeenCalledWith('Standard-Verbindung geändert', 'success');

    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const deleting = component.remove(second);
    const deleteReq = http.expectOne({ url: '/api/users/me/ai/connections/2', method: 'DELETE' });
    deleteReq.flush(null);
    await deleting;
    flushList([connection({ isDefault: true })]);
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('KI-Verbindung gelöscht', 'success');
    confirm.mockRestore();
  });

  it('reports load and save errors', async () => {
    TestBed.tick();
    http.match((r) => r.url === '/api/users/me/ai/presets').forEach((r) => r.flush(PRESETS));
    http
      .expectOne('/api/users/me/ai/connections')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('konnten nicht geladen werden');

    component.connections.reload();
    flushList([]);
    component.startCreate();
    component.name.set('OpenRouter');
    component.model.set('m');
    component.apiKey.set('sk-bad');
    component.baseUrl.set('https://openrouter.ai/api/v1');
    await fixture.whenStable();

    const saving = component.save();
    http
      .expectOne({ url: '/api/users/me/ai/connections', method: 'POST' })
      .flush(null, { status: 500, statusText: 'Error' });
    await saving;
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(component.saving()).toBe(false);
  });
});
