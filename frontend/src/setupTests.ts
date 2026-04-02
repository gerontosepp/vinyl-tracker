import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
 
vi.mock('recharts', async () => {
  const OriginalModule = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
    BarChart: () => null,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: () => null,
    AreaChart: () => null,
    Area: () => null,
    PieChart: () => null,
    Pie: () => null,
    CartesianGrid: () => null,
  };
});
 
// Global mocks for JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
 
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;
 
Object.defineProperty(window, 'isSecureContext', {
  value: true,
  writable: true,
});
 
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: function (key: string) {
      return store[key] || null;
    },
    setItem: function (key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function (key: string) {
      delete store[key];
    },
    clear: function () {
      store = {};
    },
  };
})();
 
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
