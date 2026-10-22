//! Pure layout computation: distributing a sorted collection evenly over the compartments of
//! all shelves of a medium, assigning copies by stored compartment boundaries and balancing
//! overflowing compartments towards the nearest compartment with free space.

use crate::models::storage::{StorageNeighborsDto, StorageRecordRefDto, StorageSlotDto};
use std::cmp::Ordering;

/// Shelf sort key: artist without a leading article (lowercase), year, title (lowercase), copy.
/// Strings compare byte-wise like PostgreSQL's `COLLATE "C"`; missing artist/year sort last.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShelfKey {
    pub artist: Option<String>,
    pub year: Option<String>,
    pub title: String,
    pub instance_id: i64,
}

fn cmp_nulls_last(a: &Option<String>, b: &Option<String>) -> Ordering {
    match (a, b) {
        (Some(a), Some(b)) => a.as_bytes().cmp(b.as_bytes()),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

impl Ord for ShelfKey {
    fn cmp(&self, other: &Self) -> Ordering {
        cmp_nulls_last(&self.artist, &other.artist)
            .then_with(|| cmp_nulls_last(&self.year, &other.year))
            .then_with(|| self.title.as_bytes().cmp(other.title.as_bytes()))
            .then_with(|| self.instance_id.cmp(&other.instance_id))
    }
}

impl PartialOrd for ShelfKey {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Lower boundary of a compartment: everything from this key up to the next boundary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Bound {
    /// First compartment of a medium.
    Min,
    Key(ShelfKey),
    /// Empty compartment after the last record.
    Max,
}

impl Bound {
    fn admits(&self, key: &ShelfKey) -> bool {
        match self {
            Bound::Min => true,
            Bound::Key(bound) => bound <= key,
            Bound::Max => false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct LayoutItem {
    pub key: ShelfKey,
    pub discogs_id: i64,
    pub artist: Option<String>,
    pub title: String,
    pub thumb_url: Option<String>,
    /// Number of discs (at least 1).
    pub size: u32,
}

impl LayoutItem {
    pub fn record_ref(&self) -> StorageRecordRefDto {
        StorageRecordRefDto {
            discogs_id: self.discogs_id,
            artist: self.artist.clone(),
            title: self.title.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Compartment {
    pub unit_id: i64,
    pub unit_name: String,
    /// 1-based number within the shelf, counted row by row from top left.
    pub number: i32,
    pub row: i32,
    pub column: i32,
    pub capacity: u32,
}

/// Shelf as configured, used to build the flat compartment list.
#[derive(Debug, Clone)]
pub struct ShelfSpec {
    pub unit_id: i64,
    pub unit_name: String,
    pub rows: i32,
    pub columns: i32,
    pub capacity: u32,
}

/// Compartments of all shelves in shelf order, each shelf row by row from top left.
pub fn compartments_of(shelves: &[ShelfSpec]) -> Vec<Compartment> {
    shelves
        .iter()
        .flat_map(|shelf| {
            (0..shelf.rows).flat_map(move |row| {
                (0..shelf.columns).map(move |column| Compartment {
                    unit_id: shelf.unit_id,
                    unit_name: shelf.unit_name.clone(),
                    number: row * shelf.columns + column + 1,
                    row: row + 1,
                    column: column + 1,
                    capacity: shelf.capacity,
                })
            })
        })
        .collect()
}

/// Copies (sorted by [`ShelfKey`]) assigned to compartments; `None` means "no space left".
#[derive(Debug, Clone)]
pub struct Layout {
    pub compartments: Vec<Compartment>,
    pub items: Vec<LayoutItem>,
    pub assignment: Vec<Option<usize>>,
}

impl Layout {
    fn new(compartments: Vec<Compartment>, mut items: Vec<LayoutItem>) -> Self {
        items.sort_by(|a, b| a.key.cmp(&b.key));
        let assignment = vec![None; items.len()];
        Self {
            compartments,
            items,
            assignment,
        }
    }

    /// Space an item takes in a compartment: oversized items count up to the capacity only.
    fn effective_size(&self, item: usize, compartment: usize) -> u32 {
        self.items[item]
            .size
            .min(self.compartments[compartment].capacity)
    }

    /// Occupied space per compartment in discs.
    pub fn used(&self) -> Vec<u32> {
        let mut used = vec![0u32; self.compartments.len()];
        for (item, slot) in self.assignment.iter().enumerate() {
            if let Some(c) = *slot {
                used[c] += self.effective_size(item, c);
            }
        }
        used
    }

    /// Item indices per compartment in shelf order.
    pub fn members(&self) -> Vec<Vec<usize>> {
        let mut members = vec![Vec::new(); self.compartments.len()];
        for (item, slot) in self.assignment.iter().enumerate() {
            if let Some(c) = *slot {
                members[c].push(item);
            }
        }
        members
    }

    pub fn unplaced_count(&self) -> usize {
        self.assignment.iter().filter(|a| a.is_none()).count()
    }

    pub fn index_of_instance(&self, instance_id: i64) -> Option<usize> {
        self.items
            .iter()
            .position(|item| item.key.instance_id == instance_id)
    }

    pub fn slot(&self, item: usize) -> StorageSlotDto {
        match self.assignment[item] {
            Some(c) => {
                let compartment = &self.compartments[c];
                StorageSlotDto {
                    unit_id: Some(compartment.unit_id),
                    unit_name: Some(compartment.unit_name.clone()),
                    compartment: Some(compartment.number),
                    row: Some(compartment.row),
                    column: Some(compartment.column),
                    oversized: self.items[item].size > compartment.capacity,
                    unplaced: false,
                }
            }
            None => StorageSlotDto {
                unit_id: None,
                unit_name: None,
                compartment: None,
                row: None,
                column: None,
                oversized: false,
                unplaced: true,
            },
        }
    }

    /// Previous and next copy in shelf order.
    pub fn neighbors(&self, item: usize) -> StorageNeighborsDto {
        StorageNeighborsDto {
            previous: item
                .checked_sub(1)
                .map(|prev| self.items[prev].record_ref()),
            next: self.items.get(item + 1).map(LayoutItem::record_ref),
        }
    }

    /// Lower boundary of every compartment derived from the current assignment. An empty
    /// compartment shares the boundary of the next filled one; trailing empty ones are `Max`.
    pub fn boundaries(&self) -> Vec<Bound> {
        let members = self.members();
        let mut bounds = vec![Bound::Max; self.compartments.len()];
        let mut next_bound = Bound::Max;
        for c in (0..self.compartments.len()).rev() {
            if let Some(&first) = members[c].first() {
                next_bound = Bound::Key(self.items[first].key.clone());
            }
            bounds[c] = next_bound.clone();
        }
        if let Some(first) = bounds.first_mut() {
            *first = Bound::Min;
        }
        bounds
    }
}

/// Distributes the copies evenly over all compartments so that every compartment has about
/// the same fill ratio relative to its capacity. Copies are never split across compartments.
pub fn distribute(compartments: Vec<Compartment>, items: Vec<LayoutItem>) -> Layout {
    let mut layout = Layout::new(compartments, items);
    let n = layout.compartments.len();
    if n == 0 || layout.items.is_empty() {
        return layout;
    }

    let total_capacity: u64 = layout.compartments.iter().map(|c| c.capacity as u64).sum();
    let total_size: u64 = layout.items.iter().map(|i| i.size as u64).sum();
    // With more discs than space the shelves are simply filled up to their capacity.
    let fill = total_size.min(total_capacity) as f64 / total_capacity as f64;
    let mut targets = Vec::with_capacity(n);
    let mut cumulative = 0u64;
    for compartment in &layout.compartments {
        cumulative += compartment.capacity as u64;
        targets.push(cumulative as f64 * fill);
    }

    let mut used = vec![0u32; n];
    let mut current = 0usize;
    let mut placed_size = 0u64;
    for item in 0..layout.items.len() {
        let size = layout.items[item].size as u64;
        let midpoint = placed_size as f64 + size as f64 / 2.0;
        while current + 1 < n && midpoint > targets[current] {
            current += 1;
        }
        while current < n
            && used[current] > 0
            && used[current] + layout.effective_size(item, current)
                > layout.compartments[current].capacity
        {
            current += 1;
        }
        if current == n {
            break; // the remaining copies do not fit
        }
        used[current] += layout.effective_size(item, current);
        layout.assignment[item] = Some(current);
        placed_size += size;
    }
    layout
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Direction {
    Left,
    Right,
}

/// Assigns every copy to the compartment whose boundary range contains its sort key, then
/// balances overflowing compartments. `bounds` must have one entry per compartment.
pub fn assign(compartments: Vec<Compartment>, bounds: &[Bound], items: Vec<LayoutItem>) -> Layout {
    let mut layout = Layout::new(compartments, items);
    let n = layout.compartments.len();
    if n == 0 {
        return layout;
    }

    let mut current = 0usize;
    for item in 0..layout.items.len() {
        while current + 1 < n
            && bounds
                .get(current + 1)
                .is_some_and(|b| b.admits(&layout.items[item].key))
        {
            current += 1;
        }
        layout.assignment[item] = Some(current);
    }

    balance(&mut layout);
    layout
}

/// Moves edge copies of overflowing compartments towards the nearest compartment with enough
/// free space (fewer hops wins, ties go right). Copies that run off the last compartment
/// have no space left.
fn balance(layout: &mut Layout) {
    let n = layout.compartments.len();
    let mut members = layout.members();
    let mut used = layout.used();
    let capacity: Vec<u32> = layout.compartments.iter().map(|c| c.capacity).collect();
    // Bounded number of cascades; afterwards everything left over is pushed to the right,
    // which always terminates.
    let mut budget = 4 * n + 16;

    while let Some(origin) = (0..n).find(|&c| used[c] > capacity[c]) {
        let excess = used[origin] - capacity[origin];
        let free = |c: usize| capacity[c].saturating_sub(used[c]);
        let nearest = |candidates: Vec<usize>| {
            candidates
                .iter()
                .find(|&&c| free(c) >= excess)
                .or_else(|| candidates.iter().find(|&&c| free(c) > 0))
                .map(|&c| c.abs_diff(origin))
        };
        let right = nearest((origin + 1..n).collect());
        let left = nearest((0..origin).rev().collect());
        let mut direction = match (left, right) {
            (Some(l), Some(r)) if l < r => Direction::Left,
            (Some(_), None) => Direction::Left,
            _ => Direction::Right,
        };
        if budget == 0 {
            direction = Direction::Right;
        } else {
            budget -= 1;
        }

        let mut c = origin;
        loop {
            while used[c] > capacity[c] && members[c].len() > 1 {
                if direction == Direction::Left && c == 0 {
                    direction = Direction::Right; // nothing further left: push the rest right
                }
                let item = match direction {
                    Direction::Right => members[c].pop().expect("non-empty"),
                    Direction::Left => members[c].remove(0),
                };
                used[c] -= layout.effective_size(item, c);
                let target = match direction {
                    Direction::Right => (c + 1 < n).then_some(c + 1),
                    Direction::Left => c.checked_sub(1),
                };
                match target {
                    Some(t) => {
                        used[t] += layout.effective_size(item, t);
                        match direction {
                            Direction::Right => members[t].insert(0, item),
                            Direction::Left => members[t].push(item),
                        }
                        layout.assignment[item] = Some(t);
                    }
                    None => layout.assignment[item] = None,
                }
            }
            let next = match direction {
                Direction::Right => c + 1,
                Direction::Left => match c.checked_sub(1) {
                    Some(prev) => prev,
                    None => break,
                },
            };
            if next >= n || used[next] <= capacity[next] {
                break;
            }
            c = next;
        }
    }

    // Copies only move between neighboring compartments and only leave at the right end, so
    // the assignment stays monotonic and unplaced copies are the last ones in shelf order.
}

/// Copies whose slot differs between two layouts of the same compartments, identified by
/// instance ID. Copies present in only one layout are ignored.
pub fn moved_items(before: &Layout, after: &Layout) -> Vec<(usize, usize)> {
    let before_index: std::collections::HashMap<i64, usize> = before
        .items
        .iter()
        .enumerate()
        .map(|(i, item)| (item.key.instance_id, i))
        .collect();
    after
        .items
        .iter()
        .enumerate()
        .filter_map(|(after_idx, item)| {
            let before_idx = *before_index.get(&item.key.instance_id)?;
            (before.assignment[before_idx] != after.assignment[after_idx])
                .then_some((before_idx, after_idx))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shelf(id: i64, name: &str, rows: i32, columns: i32, capacity: u32) -> ShelfSpec {
        ShelfSpec {
            unit_id: id,
            unit_name: name.to_string(),
            rows,
            columns,
            capacity,
        }
    }

    fn item(n: i64, size: u32) -> LayoutItem {
        LayoutItem {
            key: ShelfKey {
                artist: Some(format!("artist {n:05}")),
                year: Some("1970".to_string()),
                title: format!("title {n}"),
                instance_id: n,
            },
            discogs_id: 1000 + n,
            artist: Some(format!("Artist {n:05}")),
            title: format!("Title {n}"),
            thumb_url: None,
            size,
        }
    }

    fn items(count: i64) -> Vec<LayoutItem> {
        (1..=count).map(|n| item(n, 1)).collect()
    }

    fn counts(layout: &Layout) -> Vec<u32> {
        layout.used()
    }

    #[test]
    fn test_compartments_are_numbered_row_by_row() {
        let compartments = compartments_of(&[shelf(1, "K1", 2, 4, 70), shelf(2, "K2", 1, 2, 70)]);
        assert_eq!(compartments.len(), 10);
        let c = &compartments[5];
        assert_eq!((c.unit_id, c.number, c.row, c.column), (1, 6, 2, 2));
        let c = &compartments[8];
        assert_eq!((c.unit_id, c.number, c.row, c.column), (2, 1, 1, 1));
    }

    #[test]
    fn test_shelf_key_orders_missing_artist_and_year_last() {
        let key = |artist: Option<&str>, year: Option<&str>, id| ShelfKey {
            artist: artist.map(str::to_string),
            year: year.map(str::to_string),
            title: "t".into(),
            instance_id: id,
        };
        let mut keys = [
            key(None, None, 1),
            key(Some("b"), None, 2),
            key(Some("b"), Some("1999"), 3),
            key(Some("a"), Some("2001"), 4),
            key(Some("Z"), None, 5),
        ];
        keys.sort();
        let ids: Vec<i64> = keys.iter().map(|k| k.instance_id).collect();
        assert_eq!(
            ids,
            vec![5, 4, 3, 2, 1],
            "byte order: uppercase before lowercase"
        );
    }

    #[test]
    fn test_distribute_evenly_over_all_shelves() {
        // 600 discs on 12 compartments of 70 → about 50 each, every compartment keeps room.
        let compartments = compartments_of(&[shelf(1, "K1", 2, 2, 70), shelf(2, "K2", 2, 4, 70)]);
        let layout = distribute(compartments, items(600));
        let used = counts(&layout);
        assert_eq!(used.iter().sum::<u32>(), 600);
        assert!(used.iter().all(|&u| (49..=51).contains(&u)), "{used:?}");
        assert_eq!(layout.unplaced_count(), 0);
    }

    #[test]
    fn test_distribute_respects_different_capacities() {
        let compartments =
            compartments_of(&[shelf(1, "Small", 1, 1, 20), shelf(2, "Big", 1, 1, 80)]);
        let layout = distribute(compartments, items(50));
        assert_eq!(counts(&layout), vec![10, 40], "same fill ratio of 50 %");
    }

    #[test]
    fn test_distribute_keeps_sort_order_and_never_splits() {
        let compartments = compartments_of(&[shelf(1, "K", 1, 3, 10)]);
        let mut list = items(12);
        list[4].size = 3; // box set
        let layout = distribute(compartments, list);
        let slots: Vec<usize> = layout.assignment.iter().map(|s| s.unwrap()).collect();
        assert!(
            slots.windows(2).all(|w| w[0] <= w[1]),
            "monotonic: {slots:?}"
        );
        assert!(counts(&layout).iter().all(|&u| u <= 10));
    }

    #[test]
    fn test_distribute_with_too_little_space_leaves_the_last_unplaced() {
        let compartments = compartments_of(&[shelf(1, "K", 1, 2, 5)]);
        let layout = distribute(compartments, items(13));
        assert_eq!(counts(&layout), vec![5, 5]);
        assert_eq!(layout.unplaced_count(), 3);
        assert!(layout.assignment[10..].iter().all(Option::is_none));
    }

    #[test]
    fn test_assign_by_boundaries_moves_nothing_while_there_is_room() {
        let compartments = compartments_of(&[shelf(1, "K", 1, 4, 10)]);
        let base = distribute(compartments.clone(), items(20));
        let bounds = base.boundaries();

        // A new copy sorting between 7 and 8 (instance 7 with a later title).
        let mut with_new = items(20);
        let mut new_item = item(7, 1);
        new_item.key.title = "title 7z".into();
        new_item.key.instance_id = 99;
        with_new.push(new_item);

        let after = assign(compartments, &bounds, with_new);
        let moved = moved_items(&base, &after);
        assert!(
            moved.is_empty(),
            "no other copy changes compartment: {moved:?}"
        );
        let new_idx = after.index_of_instance(99).unwrap();
        let old_idx = base.index_of_instance(7).unwrap();
        assert_eq!(after.assignment[new_idx], base.assignment[old_idx]);
    }

    #[test]
    fn test_full_compartment_balances_towards_nearest_free_neighbor() {
        // Compartments of capacity 3: [3, 3, 1, 3] → a new copy in compartment 1 (full) must
        // move one copy of compartment 1 right into compartment 2, nothing else moves.
        let compartments = compartments_of(&[shelf(1, "K", 1, 4, 3)]);
        let list = items(10);
        let bounds = vec![
            Bound::Min,
            Bound::Key(list[3].key.clone()),
            Bound::Key(list[6].key.clone()),
            Bound::Key(list[7].key.clone()),
        ];
        let base = assign(compartments.clone(), &bounds, list.clone());
        assert_eq!(counts(&base), vec![3, 3, 1, 3]);

        let mut with_new = list;
        let mut new_item = item(4, 1);
        new_item.key.title = "title 4z".into();
        new_item.key.instance_id = 99;
        with_new.push(new_item);

        let after = assign(compartments, &bounds, with_new);
        assert_eq!(counts(&after), vec![3, 3, 2, 3]);
        let moved = moved_items(&base, &after);
        assert_eq!(moved.len(), 1);
        let (_, moved_idx) = moved[0];
        assert_eq!(
            after.items[moved_idx].key.instance_id, 6,
            "last copy of compartment 2"
        );
        assert_eq!(after.assignment[moved_idx], Some(2));
    }

    #[test]
    fn test_balancing_prefers_the_closer_side() {
        // [1, 3, 3, 3, 1]: a new copy in compartment 2 (index 1) → left neighbor is closer.
        let compartments = compartments_of(&[shelf(1, "K", 1, 5, 3)]);
        let list = items(11);
        let bounds = vec![
            Bound::Min,
            Bound::Key(list[1].key.clone()),
            Bound::Key(list[4].key.clone()),
            Bound::Key(list[7].key.clone()),
            Bound::Key(list[10].key.clone()),
        ];
        let base = assign(compartments.clone(), &bounds, list.clone());
        assert_eq!(counts(&base), vec![1, 3, 3, 3, 1]);

        let mut with_new = list;
        let mut new_item = item(3, 1);
        new_item.key.title = "title 3z".into();
        new_item.key.instance_id = 99;
        with_new.push(new_item);

        let after = assign(compartments, &bounds, with_new);
        assert_eq!(counts(&after), vec![2, 3, 3, 3, 1]);
        let moved = moved_items(&base, &after);
        assert_eq!(moved.len(), 1);
        assert_eq!(
            after.items[moved[0].1].key.instance_id, 2,
            "first copy moves left"
        );
    }

    #[test]
    fn test_overflow_without_free_space_marks_the_last_copies_unplaced() {
        let compartments = compartments_of(&[shelf(1, "K", 1, 2, 2)]);
        let list = items(4);
        let bounds = vec![Bound::Min, Bound::Key(list[2].key.clone())];
        let mut with_new = list;
        with_new.push(item(1, 1).tap_instance(99));
        let after = assign(compartments, &bounds, with_new);
        assert_eq!(counts(&after), vec![2, 2]);
        assert_eq!(after.unplaced_count(), 1);
        assert!(
            after.assignment.last().unwrap().is_none(),
            "last in sort order"
        );
    }

    #[test]
    fn test_oversized_box_fills_a_compartment_alone_without_balancing() {
        let compartments = compartments_of(&[shelf(1, "K", 1, 2, 4)]);
        let mut list = items(3);
        list[1].size = 9;
        let bounds = vec![Bound::Min, Bound::Key(list[1].key.clone())];
        let layout = assign(compartments, &bounds, list.clone());
        // Compartment 2 holds the box (counts 4) plus item 3 → overflow → item 3 cannot move
        // right (no compartment), so it has no space.
        assert_eq!(layout.assignment[1], Some(1));
        assert!(layout.slot(1).oversized);
        assert_eq!(layout.unplaced_count(), 1);

        let alone = assign(
            compartments_of(&[shelf(1, "K", 1, 2, 4)]),
            &[Bound::Min, Bound::Key(list[1].key.clone())],
            list[..2].to_vec(),
        );
        assert_eq!(alone.unplaced_count(), 0);
        assert_eq!(alone.used(), vec![1, 4]);
    }

    #[test]
    fn test_boundaries_of_empty_compartments() {
        let compartments = compartments_of(&[shelf(1, "K", 1, 4, 10)]);
        let layout = distribute(compartments.clone(), items(2));
        let bounds = layout.boundaries();
        assert_eq!(bounds[0], Bound::Min);
        // Re-assigning with the derived boundaries reproduces the layout.
        let again = assign(compartments, &bounds, items(2));
        assert_eq!(again.assignment, layout.assignment);
    }

    #[test]
    fn test_neighbors_and_slot() {
        let compartments = compartments_of(&[shelf(7, "Kallax-1", 2, 2, 2)]);
        let layout = distribute(compartments, items(6));
        let neighbors = layout.neighbors(0);
        assert!(neighbors.previous.is_none());
        assert_eq!(neighbors.next.unwrap().discogs_id, 1002);
        let slot = layout.slot(5);
        assert_eq!(slot.unit_name.as_deref(), Some("Kallax-1"));
        assert!(!slot.unplaced);
    }

    #[test]
    fn test_no_compartments_leaves_everything_unassigned() {
        let layout = assign(Vec::new(), &[], items(3));
        assert_eq!(layout.unplaced_count(), 3);
        let layout = distribute(Vec::new(), items(3));
        assert_eq!(layout.unplaced_count(), 3);
    }

    trait TapInstance {
        fn tap_instance(self, id: i64) -> Self;
    }

    impl TapInstance for LayoutItem {
        fn tap_instance(mut self, id: i64) -> Self {
            self.key.title = format!("{}z", self.key.title);
            self.key.instance_id = id;
            self
        }
    }
}
