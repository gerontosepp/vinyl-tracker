import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div
      class="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 transition-colors"
    >
      <div
        class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md w-full max-w-sm transition-colors"
      >
        <h2 class="text-xl font-semibold mb-4 text-center text-gray-700 dark:text-gray-300">
          Reset Password
        </h2>

        <p
          class="text-sm text-gray-600 dark:text-gray-400 mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800/50"
        >
          <strong>Note:</strong> Because your Discogs token is encrypted with your password, you
          must re-enter it here to encrypt it with your new password.
        </p>

        @if (error()) {
          <div
            class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm text-center"
          >
            {{ error() }}
          </div>
        }

        <form (ngSubmit)="handleSubmit()" #forgotForm="ngForm" class="space-y-4">
          <div>
            <label
              for="username"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              [(ngModel)]="username"
              required
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label
              for="newPassword"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              [(ngModel)]="newPassword"
              required
              minlength="8"
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label
              for="confirmPassword"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              [(ngModel)]="confirmPassword"
              required
              minlength="8"
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label
              for="discogsToken"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Discogs Token (Required)
            </label>
            <input
              id="discogsToken"
              name="discogsToken"
              type="password"
              [(ngModel)]="discogsToken"
              required
              placeholder="Re-enter your Discogs Token"
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <button
            type="submit"
            [disabled]="isLoading() || !forgotForm.valid"
            class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-blue-300 cursor-pointer"
          >
            {{ isLoading() ? 'Resetting...' : 'Reset Password' }}
          </button>
        </form>
        <div class="mt-4 text-center text-sm">
          <a routerLink="/login" class="text-blue-600 dark:text-blue-400 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  username = '';
  newPassword = '';
  confirmPassword = '';
  discogsToken = '';
  readonly error = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  async handleSubmit(): Promise<void> {
    this.error.set('');

    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters long');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    this.isLoading.set(true);
    try {
      await firstValueFrom(
        this.apiService.resetPassword(this.username, this.newPassword, this.discogsToken)
      );
      this.router.navigate(['/login']);
    } catch (err: any) {
      console.error(err);
      if (err?.status === 429) {
        this.error.set('Too many attempts. Please wait a minute and try again.');
      } else {
        this.error.set('Failed to reset password. Verify username.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
