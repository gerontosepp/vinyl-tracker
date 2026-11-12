import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { UpdateBannerComponent } from './shared/components/update-banner/update-banner.component';
import { ScannedRecordWidgetComponent } from './shared/components/scanned-record-widget/scanned-record-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, UpdateBannerComponent, ScannedRecordWidgetComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'frontend';
}
