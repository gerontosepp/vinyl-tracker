import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { StorageSlotPipe } from '../../../core/pipes/storage-slot.pipe';
import { StorageMove, StorageNeighbors, StorageRecordRef, StorageSlot } from '../../../core/types';

interface MoveGroup {
  from: StorageSlot;
  to: StorageSlot;
  records: StorageRecordRef[];
}

/** Where a record belongs on the shelf: slot, neighbors and the records that move for it. */
@Component({
  selector: 'app-storage-placement',
  standalone: true,
  imports: [TranslatePipe, StorageSlotPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-3 text-left space-y-2"
      data-testid="storage-placement"
    >
      <div class="flex items-start gap-2">
        <span class="text-lg leading-none" aria-hidden="true">🗄️</span>
        <div class="min-w-0">
          @if (title()) {
            <p class="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              {{ 'storage.placementTitle' | translate }}
            </p>
          }
          @if (slot().unplaced) {
            <p class="font-bold text-amber-700 dark:text-amber-300" data-testid="placement-unplaced">
              {{ 'storage.unplacedHint' | translate }}
            </p>
          } @else {
            <p class="font-bold text-slate-900 dark:text-slate-100" data-testid="placement-slot">
              {{ slot() | storageSlot }}
              <span class="font-medium text-slate-500 dark:text-slate-400 text-sm">
                ({{ 'storage.position' | translate: { row: slot().row ?? '', column: slot().column ?? '' } }})
              </span>
            </p>
            @if (slot().oversized) {
              <p class="text-xs text-amber-700 dark:text-amber-300">{{ 'storage.oversized' | translate }}</p>
            }
          }
        </div>
      </div>

      @if (!slot().unplaced && neighbors(); as near) {
        <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-0.5 pl-7" data-testid="placement-neighbors">
          <li>
            <span class="font-semibold">{{ 'storage.after' | translate }}:</span>
            @if (near.previous; as prev) {
              {{ label(prev) }}
            } @else {
              {{ 'storage.atStart' | translate }}
            }
          </li>
          <li>
            <span class="font-semibold">{{ 'storage.before' | translate }}:</span>
            @if (near.next; as next) {
              {{ label(next) }}
            } @else {
              {{ 'storage.atEnd' | translate }}
            }
          </li>
        </ul>
      }

      @if (showMoves()) {
        @if (moveGroups().length === 0) {
          <p class="text-xs text-emerald-700 dark:text-emerald-300 pl-7" data-testid="placement-no-moves">
            {{ 'storage.noMoves' | translate }}
          </p>
        } @else {
          <div class="text-xs text-slate-700 dark:text-slate-300 pl-7" data-testid="placement-moves">
            <p class="font-semibold">{{ 'storage.moves' | translate: { count: moves().length } }}</p>
            <ul class="mt-1 space-y-1">
              @for (group of moveGroups(); track $index) {
                <li>
                  <span class="font-semibold">{{ group.from | storageSlot: true }} → {{ group.to | storageSlot: true }}</span>:
                  @for (record of group.records; track record.discogsId; let last = $last) {
                    {{ label(record) }}{{ last ? '' : ', ' }}
                  }
                </li>
              }
            </ul>
          </div>
        }
      }
    </div>
  `,
})
export class StoragePlacementComponent {
  readonly slot = input.required<StorageSlot>();
  readonly neighbors = input<StorageNeighbors | null | undefined>(null);
  readonly moves = input<StorageMove[]>([]);
  /** The move list only makes sense right after adding a record. */
  readonly showMoves = input(false);
  readonly title = input(true);

  /** Moves grouped by compartment transition (from → to), in shelf order. */
  readonly moveGroups = computed<MoveGroup[]>(() => {
    const groups: MoveGroup[] = [];
    for (const move of this.moves()) {
      const last = groups[groups.length - 1];
      if (last && sameSlot(last.from, move.from) && sameSlot(last.to, move.to)) {
        last.records.push(move.record);
      } else {
        groups.push({ from: move.from, to: move.to, records: [move.record] });
      }
    }
    return groups;
  });

  label(record: StorageRecordRef): string {
    return record.artist ? `${record.artist} – ${record.title}` : record.title;
  }
}

function sameSlot(a: StorageSlot, b: StorageSlot): boolean {
  return a.unitId === b.unitId && a.compartment === b.compartment && a.unplaced === b.unplaced;
}
