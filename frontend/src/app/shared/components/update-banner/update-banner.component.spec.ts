import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppUpdateService } from '../../../core/services/app-update.service';
import { UpdateBannerComponent } from './update-banner.component';

describe('UpdateBannerComponent', () => {
  const updateReady = signal(false);
  const update = { updateReady, reload: vi.fn(), dismiss: vi.fn() };

  beforeEach(() => {
    updateReady.set(false);
    update.reload.mockReset();
    update.dismiss.mockReset();
    TestBed.configureTestingModule({
      imports: [UpdateBannerComponent],
      providers: [{ provide: AppUpdateService, useValue: update }],
    });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(UpdateBannerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('stays hidden without a new version', () => {
    expect(render().querySelector('[role="status"]')).toBeNull();
  });

  it('offers a reload when a new version is ready', () => {
    updateReady.set(true);
    const el = render();

    expect(el.querySelector('[role="status"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="update-reload"]')!.click();
    expect(update.reload).toHaveBeenCalled();
  });

  it('can be dismissed', () => {
    updateReady.set(true);
    const el = render();

    el.querySelector<HTMLButtonElement>('[data-testid="update-dismiss"]')!.click();
    expect(update.dismiss).toHaveBeenCalled();
  });
});
