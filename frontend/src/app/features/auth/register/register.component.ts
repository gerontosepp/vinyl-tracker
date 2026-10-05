import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
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
              v2.4.1
            </span>
          </div>
        </div>
        <h2 class="text-xl font-semibold mb-4 text-center text-gray-700 dark:text-gray-300">
          Register
        </h2>

        @if (error()) {
          <div
            class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm text-center"
          >
            {{ error() }}
          </div>
        }

        <form (ngSubmit)="handleSubmit()" #registerForm="ngForm" class="space-y-4">
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
              for="password"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              [(ngModel)]="password"
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
              Confirm Password
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
          <button
            type="submit"
            [disabled]="authService.isLoading() || !registerForm.valid"
            class="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-green-300 cursor-pointer"
          >
            {{ authService.isLoading() ? 'Registering...' : 'Register' }}
          </button>
        </form>
        <div class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{{ ' ' }}
          <a routerLink="/login" class="text-blue-600 dark:text-blue-400 hover:underline">
            Login here
          </a>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  confirmPassword = '';
  readonly error = signal<string>('');

  async handleSubmit(): Promise<void> {
    this.error.set('');

    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters long');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    try {
      await this.authService.register(this.username, this.password);
      this.router.navigate(['/']);
    } catch (err: any) {
      if (err?.status === 429) {
        this.error.set('Too many attempts. Please wait a minute and try again.');
      } else {
        this.error.set('Registration failed. Username may be taken.');
      }
    }
  }
}
