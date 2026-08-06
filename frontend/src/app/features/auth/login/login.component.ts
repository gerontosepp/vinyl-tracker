import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div
      class="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 transition-colors"
    >
      <div
        class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md w-full max-w-sm transition-colors"
      >
        <div class="flex flex-col items-center justify-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt="Vinyl Tracker Logo"
            class="w-20 h-20 rounded-full shadow-lg"
          />
          <div class="flex items-center justify-center gap-2">
            <h1 class="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
              Vinyl Tracker
            </h1>
            <span
              class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full"
            >
              v2.1.2
            </span>
          </div>
        </div>

        @if (error()) {
          <div
            class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm text-center"
          >
            {{ error() }}
          </div>
        }

        <form (ngSubmit)="handleSubmit()" #loginForm="ngForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              type="text"
              name="username"
              [(ngModel)]="username"
              required
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            [disabled]="authService.isLoading() || !loginForm.valid"
            class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-blue-300 cursor-pointer"
          >
            {{ authService.isLoading() ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <div class="mt-4 text-center text-sm flex justify-between">
          <a routerLink="/forgot-password" class="text-blue-600 dark:text-blue-400 hover:underline">
            Forgot Password?
          </a>
          <a routerLink="/register" class="text-blue-600 dark:text-blue-400 hover:underline">
            Register here
          </a>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  readonly error = signal<string>('');

  async handleSubmit(): Promise<void> {
    if (!this.username.trim()) return;
    this.error.set('');

    try {
      await this.authService.login(this.username, this.password);
      this.router.navigate(['/']);
    } catch {
      this.error.set('Login failed. Please check your username/password.');
    }
  }
}
