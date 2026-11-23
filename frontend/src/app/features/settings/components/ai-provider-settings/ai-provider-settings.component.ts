import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { getErrorMessage } from '../../../../core/utils/error';
import { AiAuthStyle, AiConnection, AiPreset } from '../../../../core/types';

/**
 * Provider-independent AI connections for the automatic label photo identification (#393).
 * Keys are write-only: the backend stores them encrypted and only reports whether one exists.
 */
@Component({
  selector: 'app-ai-provider-settings',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
      data-testid="ai-provider-settings"
    >
      <div class="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            {{ 'settings.aiTitle' | translate }}
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {{ 'settings.aiDesc' | translate }}
          </p>
        </div>
        @if (!editing()) {
          <button
            type="button"
            data-testid="ai-add"
            (click)="startCreate()"
            class="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {{ 'settings.aiAdd' | translate }}
          </button>
        }
      </div>

      @if (connections.error()) {
        <p class="text-sm font-semibold text-red-700 dark:text-red-300" role="alert">
          {{ 'settings.aiLoadError' | translate }}
        </p>
      } @else if (editing()) {
        <form class="space-y-4 mt-4" (submit)="$event.preventDefault(); save()">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="ai-name" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                {{ 'settings.aiName' | translate }}
              </label>
              <input
                #nameInput
                id="ai-name"
                type="text"
                autocomplete="off"
                [value]="name()"
                (input)="name.set(nameInput.value)"
                [placeholder]="'settings.aiNamePlaceholder' | translate"
                [class]="inputClass"
              />
            </div>
            <div>
              <label for="ai-preset" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                {{ 'settings.aiPreset' | translate }}
              </label>
              <select
                #presetSelect
                id="ai-preset"
                [value]="kind()"
                (change)="applyPreset(presetSelect.value)"
                [class]="inputClass"
              >
                @for (preset of presets.value() ?? []; track preset.kind) {
                  <option [value]="preset.kind">{{ preset.label }}</option>
                }
              </select>
            </div>
          </div>

          <div>
            <label for="ai-base-url" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              {{ 'settings.aiBaseUrl' | translate }}
            </label>
            <input
              #baseUrlInput
              id="ai-base-url"
              type="url"
              autocomplete="off"
              [value]="baseUrl()"
              (input)="baseUrl.set(baseUrlInput.value)"
              [placeholder]="'settings.aiBaseUrlPlaceholder' | translate"
              [class]="inputClass"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {{ 'settings.aiBaseUrlHint' | translate }}
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="ai-auth-style" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                {{ 'settings.aiAuth' | translate }}
              </label>
              <select
                #authSelect
                id="ai-auth-style"
                [value]="authStyle()"
                (change)="authStyle.set(authSelect.value === 'none' ? 'none' : authSelect.value === 'api-key-header' ? 'api-key-header' : 'bearer')"
                [class]="inputClass"
              >
                <option value="bearer">{{ 'settings.aiAuthBearer' | translate }}</option>
                <option value="api-key-header">{{ 'settings.aiAuthApiKey' | translate }}</option>
                <option value="none">{{ 'settings.aiAuthNone' | translate }}</option>
              </select>
            </div>
            <div>
              <label for="ai-key" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                {{ 'settings.aiKey' | translate }}
              </label>
              <input
                #keyInput
                id="ai-key"
                type="password"
                autocomplete="off"
                [value]="apiKey()"
                (input)="apiKey.set(keyInput.value)"
                [placeholder]="(hasKey() ? 'settings.aiKeyStored' : 'settings.aiKeyPlaceholder') | translate"
                [class]="inputClass"
              />
            </div>
          </div>

          <div>
            <label for="ai-model" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              {{ 'settings.aiModel' | translate }}
            </label>
            <div class="flex gap-2">
              <input
                #modelInput
                id="ai-model"
                type="text"
                autocomplete="off"
                list="ai-model-options"
                [value]="model()"
                (input)="model.set(modelInput.value)"
                [class]="inputClass"
              />
              <button
                type="button"
                data-testid="ai-load-models"
                (click)="loadModels()"
                [disabled]="loadingModels() || !editingId()"
                [attr.title]="(!editingId() ? 'settings.aiSaveFirst' : 'settings.aiModels') | translate"
                class="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {{ (loadingModels() ? 'settings.aiModelsLoading' : 'settings.aiModels') | translate }}
              </button>
            </div>
            <datalist id="ai-model-options">
              @for (option of modelOptions(); track option) {
                <option [value]="option"></option>
              }
            </datalist>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {{ 'settings.aiModelHint' | translate }}
            </p>
            @if (modelsMessage()) {
              <p class="text-xs font-semibold mt-1" [class]="modelsError() ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'">
                {{ modelsMessage() }}
              </p>
            }
          </div>

          @if (testMessage()) {
            <p
              class="text-sm font-semibold"
              [class]="testError() ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'"
              role="status"
            >
              {{ testMessage() }}
            </p>
          }

          <p class="text-xs text-slate-500 dark:text-slate-400">{{ 'settings.aiPrivacy' | translate }}</p>

          <div class="flex flex-wrap justify-end gap-2">
            @if (editingId()) {
              <button
                type="button"
                data-testid="ai-test-form"
                (click)="test()"
                [disabled]="busy() || !editingId()"
                class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {{ (testing() ? 'settings.aiTesting' : 'settings.aiTestSaved') | translate }}
              </button>
            }
            @if (editingId() && hasKey()) {
              <button
                type="button"
                data-testid="ai-remove-key"
                (click)="removeStoredKey()"
                [disabled]="busy()"
                class="px-4 py-2 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
              >
                {{ 'settings.aiRemoveKey' | translate }}
              </button>
            }
            <button
              type="button"
              data-testid="ai-cancel"
              (click)="cancel()"
              [disabled]="saving()"
              class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {{ 'settings.aiCancel' | translate }}
            </button>
            <button
              type="submit"
              data-testid="ai-save"
              [disabled]="saving() || !canSave()"
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {{ (saving() ? 'settings.saving' : 'settings.aiSave') | translate }}
            </button>
          </div>
        </form>
      } @else {
        @if (connections.value()?.length) {
          <ul class="space-y-3 mt-4">
            @for (connection of connections.value() ?? []; track connection.id) {
              <li
                class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                data-testid="ai-connection"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-slate-100">{{ connection.name }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
                      {{ presetLabel(connection.kind) }}
                    </span>
                    @if (connection.isDefault) {
                      <span
                        class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        data-testid="ai-default-badge"
                      >
                        {{ 'settings.aiDefault' | translate }}
                      </span>
                    }
                  </div>
                  <p class="text-sm text-slate-600 dark:text-slate-300 truncate">{{ connection.model }}</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500 truncate">{{ connection.baseUrl }}</p>
                </div>
                <div class="flex flex-wrap gap-2 shrink-0">
                  @if (!connection.isDefault) {
                    <button
                      type="button"
                      data-testid="ai-make-default"
                      (click)="makeDefault(connection)"
                      [disabled]="busy()"
                      [class]="secondaryButton"
                    >
                      {{ 'settings.aiSetDefault' | translate }}
                    </button>
                  }
                  <button type="button" data-testid="ai-edit" (click)="startEdit(connection)" [disabled]="busy()" [class]="secondaryButton">
                    {{ 'settings.aiEdit' | translate }}
                  </button>
                  <button type="button" data-testid="ai-test" (click)="test(connection)" [disabled]="busy()" [class]="secondaryButton">
                    {{ (testingId() === connection.id ? 'settings.aiTesting' : 'settings.aiTest') | translate }}
                  </button>
                  <button
                    type="button"
                    data-testid="ai-delete"
                    (click)="remove(connection)"
                    [disabled]="busy()"
                    class="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    {{ 'settings.aiDelete' | translate }}
                  </button>
                </div>
              </li>
            }
          </ul>
          @if (testMessage()) {
            <p
              class="text-sm font-semibold mt-3"
              [class]="testError() ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'"
              role="status"
            >
              {{ testMessage() }}
            </p>
          }
        } @else if (connections.hasValue()) {
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-4" data-testid="ai-empty">
            {{ 'settings.aiEmpty' | translate }}
          </p>
        }
      }
    </div>
  `,
})
export class AiProviderSettingsComponent {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  readonly inputClass =
    'w-full text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  readonly secondaryButton =
    'px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

  readonly connections = this.apiService.aiConnectionsResource();
  readonly presets = this.apiService.aiPresetsResource();

  readonly editing = signal<'new' | AiConnection | null>(null);
  readonly editingId = computed(() => {
    const editing = this.editing();
    return editing === 'new' || editing === null ? null : editing.id;
  });
  readonly name = signal('');
  readonly kind = signal('openrouter');
  readonly baseUrl = signal('');
  readonly model = signal('');
  readonly apiKey = signal('');
  readonly authStyle = signal<AiAuthStyle>('bearer');
  readonly hasKey = signal(false);

  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly testingId = signal<number | null>(null);
  readonly loadingModels = signal(false);
  readonly modelOptions = signal<string[]>([]);
  readonly modelsMessage = signal('');
  readonly modelsError = signal(false);
  readonly testMessage = signal('');
  readonly testError = signal(false);

  readonly selectedPreset = computed<AiPreset | undefined>(() =>
    (this.presets.value() ?? []).find((preset) => preset.kind === this.kind())
  );
  readonly canSave = computed(() => {
    if (!this.name().trim() || !this.model().trim() || !this.baseUrl().trim()) return false;
    if (this.hasKey() || this.apiKey().trim()) return true;
    return !this.selectedPreset()?.requiresApiKey;
  });
  readonly busy = computed(() => this.saving() || this.testing() || this.loadingModels());

  startCreate(): void {
    this.editing.set('new');
    this.hasKey.set(false);
    this.apiKey.set('');
    this.modelOptions.set([]);
    this.testMessage.set('');
    const preset = this.presets.value()?.find((entry) => entry.kind === 'openrouter') ?? this.presets.value()?.[0];
    this.name.set(preset?.label ?? '');
    this.kind.set(preset?.kind ?? 'openrouter');
    this.baseUrl.set(preset?.baseUrl ?? '');
    this.authStyle.set(preset?.authStyle ?? 'bearer');
    this.model.set('');
  }

  startEdit(connection: AiConnection): void {
    this.editing.set(connection);
    this.name.set(connection.name);
    this.kind.set(connection.kind);
    this.baseUrl.set(connection.baseUrl);
    this.model.set(connection.model);
    this.authStyle.set(connection.authStyle);
    this.hasKey.set(connection.hasApiKey);
    this.apiKey.set('');
    this.modelOptions.set([]);
    this.modelsMessage.set('');
    this.testMessage.set('');
  }

  cancel(): void {
    this.editing.set(null);
    this.apiKey.set('');
    this.testMessage.set('');
    this.modelsMessage.set('');
  }

  applyPreset(kind: string): void {
    const preset = (this.presets.value() ?? []).find((entry) => entry.kind === kind);
    this.kind.set(kind);
    if (!preset) return;
    this.baseUrl.set(preset.baseUrl);
    this.authStyle.set(preset.authStyle);
    if (this.editing() === 'new') {
      this.name.set(preset.label);
    }
  }

  presetLabel(kind: string): string {
    return (this.presets.value() ?? []).find((preset) => preset.kind === kind)?.label ?? kind;
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    const request = {
      name: this.name().trim(),
      kind: this.kind(),
      baseUrl: this.baseUrl().trim(),
      model: this.model().trim(),
      authStyle: this.authStyle(),
      ...(this.apiKey().trim() ? { apiKey: this.apiKey().trim() } : {}),
    };
    try {
      const editingId = this.editingId();
      if (editingId) {
        await firstValueFrom(this.apiService.updateAiConnection(editingId, request));
        this.toastService.showToast(this.languageService.translate('settings.aiSaved'), 'success');
      } else {
        await firstValueFrom(this.apiService.createAiConnection(request));
        this.toastService.showToast(this.languageService.translate('settings.aiCreated'), 'success');
      }
      this.connections.reload();
      this.cancel();
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('settings.aiSaveError')),
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  async removeStoredKey(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.apiService.updateAiConnection(id, {
          name: this.name().trim(),
          kind: this.kind(),
          baseUrl: this.baseUrl().trim(),
          model: this.model().trim(),
          authStyle: this.authStyle(),
          apiKey: '',
        })
      );
      this.hasKey.set(false);
      this.apiKey.set('');
      this.connections.reload();
      this.toastService.showToast(this.languageService.translate('settings.aiKeyRemoved'), 'success');
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('settings.aiSaveError')),
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  async test(connection?: AiConnection): Promise<void> {
    const id = connection?.id ?? this.editingId();
    if (!id) {
      this.testMessage.set(this.languageService.translate('settings.aiSaveFirst'));
      this.testError.set(true);
      return;
    }
    this.testing.set(true);
    this.testingId.set(id);
    this.testMessage.set('');
    this.testError.set(false);
    try {
      const result = await firstValueFrom(this.apiService.testAiConnection(id));
      this.testMessage.set(
        this.languageService.translate('settings.aiTestOk', {
          provider: result.provider,
          model: result.model,
        })
      );
      this.testError.set(false);
      this.toastService.showToast(this.testMessage(), 'success');
    } catch (error) {
      this.testMessage.set(
        getErrorMessage(error, this.languageService.translate('settings.aiTestError'))
      );
      this.testError.set(true);
    } finally {
      this.testing.set(false);
      this.testingId.set(null);
    }
  }

  async loadModels(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    this.loadingModels.set(true);
    this.modelsMessage.set('');
    this.modelsError.set(false);
    try {
      const result = await firstValueFrom(this.apiService.aiConnectionModels(id));
      this.modelOptions.set(result.models);
      if (result.supported) {
        this.modelsMessage.set(
          this.languageService.translate('settings.aiModelsLoaded', { count: result.models.length })
        );
      } else {
        this.modelsMessage.set(this.languageService.translate('settings.aiModelsUnavailable'));
        this.modelsError.set(true);
      }
    } catch (error) {
      this.modelsMessage.set(
        getErrorMessage(error, this.languageService.translate('settings.aiModelsError'))
      );
      this.modelsError.set(true);
    } finally {
      this.loadingModels.set(false);
    }
  }

  async makeDefault(connection: AiConnection): Promise<void> {
    try {
      await firstValueFrom(this.apiService.setDefaultAiConnection(connection.id));
      this.connections.reload();
      this.toastService.showToast(this.languageService.translate('settings.aiDefaultSet'), 'success');
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('settings.aiSaveError')),
        'error'
      );
    }
  }

  async remove(connection: AiConnection): Promise<void> {
    if (!globalThis.confirm(this.languageService.translate('settings.aiDeleteConfirm'))) {
      return;
    }
    try {
      await firstValueFrom(this.apiService.deleteAiConnection(connection.id));
      this.connections.reload();
      this.toastService.showToast(this.languageService.translate('settings.aiDeleted'), 'success');
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('settings.aiSaveError')),
        'error'
      );
    }
  }
}
