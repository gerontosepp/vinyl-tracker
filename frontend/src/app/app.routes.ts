import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'collection',
    canActivate: [authGuard],
    loadComponent: () => import('./features/collection/collection.component').then(m => m.CollectionComponent),
  },
  {
    path: 'statistics',
    canActivate: [authGuard],
    loadComponent: () => import('./features/statistics/statistics.component').then(m => m.StatisticsComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
