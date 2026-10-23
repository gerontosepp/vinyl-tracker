import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { getErrorMessage } from '../../../../core/utils/error';

/** Cheaper model suggested next to the default one. */
export const BUDGET_OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';

/**
 * OpenRouter API key and model for the automatic label photo identification. The key is
 * write-only: the backend stores it encrypted and only reports whether one is configured.
 */
@Component({
  selector: 'app-openrouter-settings',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
      data-testid="openrouter-settings"
    >
      <div class="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            {{ 'settings.openRouterTitle' | translate }}
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {{ 'settings.openRouterDesc' | translate }}
          </p>
        </div>
        @if (settings.hasValue()) {
          <span
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
            [class]="hasKey() ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-400'"
            data-testid="openrouter-status"
          >
            {{ (hasKey() ? 'settings.openRouterActive' : 'settings.openRouterInactive') | translate }}
          </span>
        }
      </div>

      @if (settings.error()) {
        <p class="text-sm font-semibold text-red-700 dark:text-red-300" role="alert">
          {{ 'settings.openRouterLoadError' | translate }}
        </p>
      } @else {
        <form class="space-y-4 mt-4" (submit)="$event.preventDefault(); save()">
          <div>
            <label for="openrouter-key" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              {{ 'settings.openRouterKey' | translate }}
            </label>
            <input
              #keyInput
              id="openrouter-key"
              type="password"
              autocomplete="off"
              [value]="apiKey()"
              (input)="apiKey.set(keyInput.value)"
              [placeholder]="(hasKey() ? 'settings.openRouterKeyStored' : 'settings.openRouterKeyPlaceholder') | translate"
              [class]="inputClass"
            />
          </div>
          <div>
            <label for="openrouter-model" class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              {{ 'settings.openRouterModel' | translate }}
            </label>
            <input
              #modelInput
              id="openrouter-model"
              type="text"
              autocomplete="off"
              [value]="model()"
              (input)="model.set(modelInput.value)"
              [class]="inputClass"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {{ 'settings.openRouterModelHint' | translate: { model: budgetModel } }}
            </p>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ 'settings.openRouterPrivacy' | translate }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            @if (hasKey()) {
              <button
                type="button"
                data-testid="openrouter-remove"
                (click)="removeKey()"
                [disabled]="saving()"
                class="px-4 py-2 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
              >
                {{ 'settings.openRouterRemove' | translate }}
              </button>
            }
            <button
              type="submit"
              data-testid="openrouter-save"
              [disabled]="saving() || !canSave()"
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {{ (saving() ? 'settings.saving' : 'settings.openRouterSave') | translate }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class OpenRouterSettingsComponent {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  readonly budgetModel = BUDGET_OPENROUTER_MODEL;
  readonly inputClass =
    'w-full text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  readonly settings = this.apiService.openRouterSettingsResource();
  readonly hasKey = computed(() => this.settings.hasValue() && this.settings.value().hasApiKey);
  /** New key typed by the user; empty keeps the stored one. */
  readonly apiKey = signal('');
  readonly model = linkedSignal(() => (this.settings.hasValue() ? this.settings.value().model : ''));
  readonly saving = signal(false);
  readonly canSave = computed(
    () =>
      this.settings.hasValue() &&
      (this.apiKey().trim() !== '' || this.model().trim() !== this.settings.value().model)
  );

  save(): Promise<void> {
    const apiKey = this.apiKey().trim();
    return this.submit({ ...(apiKey ? { apiKey } : {}), model: this.model().trim() }, 'settings.openRouterSaved');
  }

  removeKey(): Promise<void> {
    return this.submit({ apiKey: '', model: this.model().trim() }, 'settings.openRouterRemoved');
  }

  private async submit(request: { apiKey?: string; model: string }, successKey: string): Promise<void> {
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(this.apiService.updateOpenRouterSettings(request));
      this.settings.value.set(updated);
      this.apiKey.set('');
      this.toastService.showToast(this.languageService.translate(successKey), 'success');
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('settings.openRouterSaveError')),
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }
}
