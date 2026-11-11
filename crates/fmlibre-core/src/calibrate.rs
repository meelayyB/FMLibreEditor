use std::cmp::Ordering;

use fmlibre_mem::{Module, Process, is_user_pointer};
use serde::Serialize;

use crate::date::FmDate;
use crate::game::GAME_PLUGIN;
use crate::profile::{ArrayRvas, Layout};
use crate::scan::{ScanOptions, scan_object_arrays};
use crate::text::{is_name_like, read_fm_string, read_name_entry};

/// Elements sampled per array when checking what it holds.
const SAMPLES: u64 = 64;

/// Share of sampled elements that must decode before an array is accepted.
const MIN_CONFIDENCE: f32 = 0.9;

/// The latest year a birth date read from the right place falls in: late enough for the youngsters the game creates in
/// a long save. A date that decodes at all is after 1900 (see [`FmDate::from_raw`]).
const LATEST_BIRTH_YEAR: u16 = 2100;

/// Where an entity array's `(begin, end)` pair lives in `game_plugin.dll`. Read the pair
/// again before each use: the game may reallocate the array.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrayRef {
    pub pair_rva: u64,
    /// Bytes to subtract from each array element to reach the complete object.
    pub pointer_bias: u64,
    pub count: u64,
    /// Share of sampled elements that decoded as the expected entity: by a name, or, in the place the build profile
    /// gives, by their other fields (see [`calibrate`]).
    pub confidence: f32,
    /// Share of sampled elements that hold a name that reads as one.
    pub named: f32,
    /// Whether the build profile gave the place; otherwise a scan of the plugin found it.
    pub from_profile: bool,
}

impl ArrayRef {
    /// Reads the current `(begin, end)` pair; returns `begin` and the element count.
    pub fn locate(&self, process: &Process, module: &Module) -> fmlibre_mem::Result<(u64, u64)> {
        let begin = process.read_u64(module.base + self.pair_rva)?;
        let end = process.read_u64(module.base + self.pair_rva + 8)?;
        Ok((begin, end.saturating_sub(begin) / 8))
    }

    pub fn object(&self, pointer: u64) -> u64 {
        pointer.saturating_sub(self.pointer_bias)
    }
}

/// The entity arrays of a running game.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityArrays {
    pub players: Option<ArrayRef>,
    pub staff: Option<ArrayRef>,
    pub clubs: Option<ArrayRef>,
    /// True when every array came from a built-in build profile rather than a scan.
    pub from_profile: bool,
    /// For each array not found, players, staff and clubs in that order: how close the places looked at came.
    #[serde(skip)]
    missed: [Option<Miss>; 3],
}

/// How close the places looked at came to holding an array that was not found: what tells a list whose elements
/// nearly all decoded from a place that holds something else.
#[derive(Debug, Clone, Copy, Default)]
struct Miss {
    /// The place the build profile gives, when it was looked at: its pair's RVA, and the array there as sampled, or
    /// `None` when the pair holds no array.
    profile: Option<(u64, Option<ArrayRef>)>,
    /// Of the arrays a scan found and had not handed to another kind by then, the one most of whose samples decoded;
    /// `None` when the scan found none.
    scanned: Option<ArrayRef>,
}

impl EntityArrays {
    /// What was found, as the probe and the diagnostics report print it: a line for each array, and for one not found,
    /// how close the place the build profile gives and the best of a scan came.
    pub fn describe(&self) -> Vec<String> {
        let mut lines = vec![
            if self.from_profile { "Entity arrays (from the build profile, checked):" } else { "Entity arrays:" }
                .to_owned(),
        ];
        for kind in KINDS {
            let label = kind.label();
            if let Some(array) = self.get(kind) {
                let source = if self.from_profile {
                    ""
                } else if array.from_profile {
                    " (from the build profile)"
                } else {
                    " (found by scanning)"
                };
                lines.push(format!("  {label:<8} {}{source}", sampled(&array)));
                continue;
            }
            lines.push(format!("  {label:<8} not found"));
            let miss = self.missed[kind as usize].unwrap_or_default();
            if let Some((pair_rva, there)) = miss.profile {
                let there = there
                    .map_or_else(|| format!("{GAME_PLUGIN}+{pair_rva:#x}  no array, or an empty one"), |a| sampled(&a));
                lines.push(format!("    in the build profile's place: {there}"));
            }
            let scanned = miss.scanned.map_or_else(|| "none".to_owned(), |a| sampled(&a));
            lines.push(format!("    closest a scan found:         {scanned}"));
        }
        lines
    }

    fn get(&self, kind: Kind) -> Option<ArrayRef> {
        match kind {
            Kind::Player => self.players,
            Kind::Staff => self.staff,
            Kind::Club => self.clubs,
        }
    }

    fn slot(&mut self, kind: Kind) -> &mut Option<ArrayRef> {
        match kind {
            Kind::Player => &mut self.players,
            Kind::Staff => &mut self.staff,
            Kind::Club => &mut self.clubs,
        }
    }
}

/// The kinds of array, numbered as [`EntityArrays::missed`] keeps them.
#[derive(Debug, Clone, Copy)]
enum Kind {
    Player = 0,
    Staff = 1,
    Club = 2,
}

impl Kind {
    fn label(self) -> &'static str {
        match self {
            Kind::Player => "players",
            Kind::Staff => "staff",
            Kind::Club => "clubs",
        }
    }
}

/// The kinds of array, in the order a scan hands them out: the players first, as nothing works without them.
const KINDS: [Kind; 3] = [Kind::Player, Kind::Staff, Kind::Club];

/// Where a pair was found, which decides what tells that its array holds what it should.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Source {
    /// The place the build profile gives: the build keeps the array there, so its elements only have to be the right
    /// objects, which their other fields tell when their names do not.
    Profile,
    /// A pair a scan of the plugin found: only names tell its array apart from the many others.
    Scan,
}

/// Finds the player, staff and club arrays: each in the place the build profile gives when it checks out, the others
/// by scanning the module. Only reads memory.
pub fn calibrate(
    process: &Process,
    module: &Module,
    layout: &Layout,
    hint: Option<&ArrayRvas>,
    player_pointer_bias: u64,
) -> EntityArrays {
    let mut arrays = EntityArrays { players: None, staff: None, clubs: None, from_profile: false, missed: [None; 3] };
    find_missing(process, module, layout, hint, player_pointer_bias, &mut arrays);
    arrays
}

/// Looks for the arrays `arrays` lacks: in the place the build profile gives, then by scanning the module among the
/// arrays not taken already. Those found are kept, and for those still missing, how close the places looked at came.
/// Returns whether one was found. Only reads memory.
pub(crate) fn find_missing(
    process: &Process,
    module: &Module,
    layout: &Layout,
    hint: Option<&ArrayRvas>,
    player_pointer_bias: u64,
    arrays: &mut EntityArrays,
) -> bool {
    let mut found = false;
    let mut missed = [Miss::default(); 3];
    if let Some(hint) = hint {
        for (kind, pair_rva) in [(Kind::Player, hint.players), (Kind::Staff, hint.staff), (Kind::Club, hint.clubs)] {
            if arrays.get(kind).is_none() {
                let pointer_bias = if matches!(kind, Kind::Player) { player_pointer_bias } else { 0 };
                match check(process, module, layout, kind, pair_rva, Source::Profile, pointer_bias) {
                    Ok(array) => {
                        *arrays.slot(kind) = Some(array);
                        found = true;
                    }
                    Err(there) => missed[kind as usize].profile = Some((pair_rva, there)),
                }
            }
        }
    }
    if KINDS.iter().any(|&kind| arrays.get(kind).is_none()) {
        let candidates = scan_object_arrays(process, module, &ScanOptions::default());
        // One array is never handed to two kinds.
        let mut taken: Vec<u64> = KINDS.iter().filter_map(|&kind| arrays.get(kind)).map(|a| a.pair_rva).collect();
        for kind in KINDS {
            if arrays.get(kind).is_some() {
                continue;
            }
            let checked: Vec<Result<ArrayRef, Option<ArrayRef>>> = candidates
                .iter()
                .filter(|candidate| !candidate.pair_rvas.iter().any(|rva| taken.contains(rva)))
                .filter_map(|candidate| {
                    Some(check(process, module, layout, kind, *candidate.pair_rvas.first()?, Source::Scan, 0))
                })
                .collect();
            let best = checked.iter().filter_map(|checked| checked.ok()).max_by(likelier);
            missed[kind as usize].scanned =
                checked.iter().filter_map(|checked| checked.err().flatten()).max_by(likelier);
            if let Some(array) = best {
                let pairs = candidates.iter().find(|candidate| candidate.pair_rvas.contains(&array.pair_rva));
                taken.extend(pairs.map_or_else(|| vec![array.pair_rva], |candidate| candidate.pair_rvas.clone()));
                found = true;
            }
            *arrays.slot(kind) = best;
        }
    }
    arrays.from_profile = KINDS.iter().all(|&kind| arrays.get(kind).is_some_and(|array| array.from_profile));
    for kind in KINDS {
        arrays.missed[kind as usize] = arrays.get(kind).is_none().then_some(missed[kind as usize]);
    }
    found
}

/// Which of two arrays as sampled is likelier the one looked for: the most confident, then the largest, then the one at
/// the lowest RVA.
fn likelier(a: &ArrayRef, b: &ArrayRef) -> Ordering {
    a.confidence.total_cmp(&b.confidence).then(a.count.cmp(&b.count)).then(b.pair_rva.cmp(&a.pair_rva))
}

/// An array as sampled: where its pair is, how many elements it has and how many of its samples decoded.
fn sampled(array: &ArrayRef) -> String {
    format!(
        "{GAME_PLUGIN}+{:#x}  {:>7} elements  {:>3.0}% of samples decoded, {:>3.0}% by a name",
        array.pair_rva,
        array.count,
        array.confidence * 100.0,
        array.named * 100.0
    )
}

/// Samples the array whose pair is at `pair_rva` and accepts it when enough elements decode as `kind`: by a name, or
/// in the place the build profile gives, by their other fields. Otherwise the array as sampled, too few of whose
/// elements decoded, or `None` when the pair holds no array, or an empty one.
fn check(
    process: &Process,
    module: &Module,
    layout: &Layout,
    kind: Kind,
    pair_rva: u64,
    source: Source,
    pointer_bias: u64,
) -> Result<ArrayRef, Option<ArrayRef>> {
    let probe = ArrayRef { pair_rva, pointer_bias, count: 0, confidence: 0.0, named: 0.0, from_profile: false };
    let (begin, count) = probe.locate(process, module).map_err(|_| None)?;
    if count == 0 || !is_user_pointer(begin) {
        return Err(None);
    }
    let samples = count.min(SAMPLES);
    let (mut named, mut fit) = (0, 0);
    for k in 0..samples {
        let index = k * count / samples;
        let Some(pointer) = process.read_u64(begin + index * 8).ok().filter(|&element| is_user_pointer(element)) else {
            continue;
        };
        let object = pointer.saturating_sub(pointer_bias);
        let has_name = is_named(process, layout, kind, object);
        named += u64::from(has_name);
        fit += u64::from(has_name || (source == Source::Profile && has_fields(process, layout, kind, object)));
    }
    let share = |n: u64| n as f32 / samples as f32;
    let confidence = share(fit);
    let array = ArrayRef {
        pair_rva,
        pointer_bias,
        count,
        confidence,
        named: share(named),
        from_profile: source == Source::Profile,
    };
    if confidence >= MIN_CONFIDENCE { Ok(array) } else { Err(Some(array)) }
}

/// Whether `object` holds a name that reads as one where `kind` keeps its names: any of a person's full, first, last
/// and common names (a player's wherever his class puts the person block), or a club's name or short name. A name
/// patch can leave any one of a person's names empty: on a game with a Korean name patch from FMKorea, too many staff
/// had neither a readable surname nor a full name, the two this asked of staff before, and none were found (issue
/// #141).
fn is_named(process: &Process, layout: &Layout, kind: Kind, object: u64) -> bool {
    let pointer_at = |offset: u64| process.read_u64(object + offset).unwrap_or(0);
    let named = |text: Option<String>| text.is_some_and(|t| is_name_like(&t));
    let person = |full: u64, entries: [u64; 3]| {
        named(read_fm_string(process, pointer_at(full)))
            || entries.iter().any(|&entry| named(read_name_entry(process, pointer_at(entry))))
    };
    match kind {
        Kind::Player => {
            let p = &layout.player;
            p.person_block_shifts.iter().any(|&shift| {
                let at = |offset: u64| p.at(offset, shift);
                process.read_u32(object + at(p.uid)).is_ok_and(|uid| uid != 0)
                    && person(at(p.full_name), [at(p.first_name), at(p.last_name), at(p.common_name)])
            })
        }
        // Only where most staff keep their names: the human manager's class, the one that keeps them further on, has
        // one or two objects, and other arrays would get more chances to pass.
        Kind::Staff => {
            let s = &layout.staff;
            person(s.full_name, [s.first_name, s.last_name, s.common_name])
        }
        Kind::Club => {
            let c = &layout.club;
            [c.name, c.short_name].iter().any(|&offset| named(read_fm_string(process, pointer_at(offset))))
        }
    }
}

/// Whether `object` holds `kind`'s other fields where the layout puts them, its names aside: a person's id and a birth
/// date, or a club's id and a senior team that points back at it. Only asked in the place the build profile gives,
/// where nothing but the right objects can be; among a scan's candidates, many arrays would pass it.
fn has_fields(process: &Process, layout: &Layout, kind: Kind, object: u64) -> bool {
    let id_at = |offset: u64| process.read_u32(object + offset).is_ok_and(|uid| uid != 0);
    let born_at = |offset: u64| {
        let raw = process.read_bytes(object + offset, 4).ok();
        raw.and_then(|raw| FmDate::from_raw(u16::from_le_bytes([raw[0], raw[1]]), u16::from_le_bytes([raw[2], raw[3]])))
            .is_some_and(|born| born.year <= LATEST_BIRTH_YEAR)
    };
    match kind {
        Kind::Player => {
            let p = &layout.player;
            p.person_block_shifts
                .iter()
                .any(|&shift| id_at(p.at(p.uid, shift)) && born_at(p.at(p.date_of_birth, shift)))
        }
        Kind::Staff => {
            let s = &layout.staff;
            s.person_block_shifts
                .iter()
                .any(|&shift| id_at(s.at(s.uid, shift)) && born_at(s.at(s.date_of_birth, shift)))
        }
        Kind::Club => {
            let teams = process.read_u64(object + layout.club.teams).unwrap_or(0);
            let senior = if is_user_pointer(teams) { process.read_u64(teams).unwrap_or(0) } else { 0 };
            id_at(layout.club.uid)
                && is_user_pointer(senior)
                && process.read_u64(senior + layout.team.club).ok() == Some(object)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use crate::profile::layout_for;

    /// Memory laid out the way the game lays out its own: FM strings, name-table entries, objects and arrays, which the
    /// tests read back through a [`Process`] opened on themselves, as the editor reads the game.
    #[derive(Default)]
    struct Memory {
        blocks: Vec<Box<[u64]>>,
    }

    impl Memory {
        /// Keeps `bytes` (padded to whole 8-byte words) at an address of their own, and returns it.
        fn keep(&mut self, mut bytes: Vec<u8>) -> u64 {
            bytes.resize(bytes.len().next_multiple_of(8).max(8), 0);
            let words: Box<[u64]> = bytes.as_chunks::<8>().0.iter().map(|word| u64::from_le_bytes(*word)).collect();
            let address = words.as_ptr() as u64;
            self.blocks.push(words);
            address
        }

        /// An FM string: its length in bytes, then its UTF-8 text.
        fn string(&mut self, text: &str) -> u64 {
            let mut bytes = (text.len() as u32).to_le_bytes().to_vec();
            bytes.extend_from_slice(text.as_bytes());
            self.keep(bytes)
        }

        /// A name-table entry, whose first field points at the name's FM string.
        fn name(&mut self, text: &str) -> u64 {
            let string = self.string(text);
            self.keep(string.to_le_bytes().to_vec())
        }

        /// An object of `len` bytes, zero but for `fields`: each written at its offset.
        fn object(&mut self, len: u64, fields: &[(u64, Vec<u8>)]) -> u64 {
            let mut bytes = vec![0u8; len as usize];
            for (offset, value) in fields {
                bytes[*offset as usize..*offset as usize + value.len()].copy_from_slice(value);
            }
            self.keep(bytes)
        }

        /// An array of `elements`, and the `(begin, end)` pair that holds it; the pair's address.
        fn array(&mut self, elements: &[u64]) -> u64 {
            let begin = self.keep(elements.iter().flat_map(|element| element.to_le_bytes()).collect());
            let end = begin + 8 * elements.len() as u64;
            self.keep([begin.to_le_bytes(), end.to_le_bytes()].concat())
        }

        /// Writes the 8-byte `value` at `address`, in a block kept before: for objects that point at each other.
        fn set(&mut self, address: u64, value: u64) {
            let block = self
                .blocks
                .iter_mut()
                .find(|block| {
                    (block.as_ptr() as u64..block.as_ptr() as u64 + 8 * block.len() as u64).contains(&address)
                })
                .expect("a block kept before");
            let index = (address - block.as_ptr() as u64) / 8;
            block[index as usize] = value;
        }
    }

    fn pointer(address: u64) -> Vec<u8> {
        address.to_le_bytes().to_vec()
    }

    /// A date as the game keeps one: the day of the year, then the year.
    fn date(day_of_year: u16, year: u16) -> Vec<u8> {
        [day_of_year.to_le_bytes(), year.to_le_bytes()].concat()
    }

    fn layout() -> Layout {
        layout_for(27).expect("the FM27 layout")
    }

    /// The module whose base the pairs' addresses are taken from: none, so a pair's RVA is its address.
    fn no_module() -> Module {
        Module { name: "test".to_owned(), base: 0, size: 0, path: PathBuf::new() }
    }

    fn this_process() -> Process {
        Process::open_read(std::process::id()).expect("open this process")
    }

    /// A member of staff with `names` (first, last, common), each written where the layout puts it when given.
    fn staff(memory: &mut Memory, layout: &Layout, names: [Option<&str>; 3], uid: u32, born: Option<u16>) -> u64 {
        let s = &layout.staff;
        let mut fields = vec![(s.uid, uid.to_le_bytes().to_vec())];
        for (offset, name) in [s.first_name, s.last_name, s.common_name].into_iter().zip(names) {
            if let Some(name) = name {
                fields.push((offset, pointer(memory.name(name))));
            }
        }
        if let Some(year) = born {
            fields.push((s.date_of_birth, date(100, year)));
        }
        memory.object(s.end() + s.max_shift(), &fields)
    }

    #[test]
    fn staff_are_named_by_any_of_their_names() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        let named = |memory: &mut Memory, names| {
            is_named(&process, &layout, Kind::Staff, staff(memory, &layout, names, 1, None))
        };
        assert!(named(&mut memory, [Some("Mikel"), Some("Arteta"), None]));
        // A celebrity with a common name only, as a name patch leaves her.
        assert!(named(&mut memory, [None, None, Some("아이유")]));
        assert!(named(&mut memory, [Some("카리나"), None, None]));
        assert!(!named(&mut memory, [None, None, None]));
        // Names that are no text are no names.
        assert!(!named(&mut memory, [Some("\u{1}\u{2}"), None, None]));
    }

    #[test]
    fn a_staff_list_with_one_name_each_is_found() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        let elements: Vec<u64> =
            (0..100).map(|i| staff(&mut memory, &layout, [None, None, Some("아이유")], 1 + i, None)).collect();
        let pair = memory.array(&elements);
        let found = check(&process, &no_module(), &layout, Kind::Staff, pair, Source::Scan).expect("found by names");
        assert_eq!((found.count, found.confidence, found.named), (100, 1.0, 1.0));
        assert!(!found.from_profile);
    }

    #[test]
    fn the_profiles_place_takes_staff_without_readable_names() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        let elements: Vec<u64> =
            (0..100).map(|i| staff(&mut memory, &layout, [None, None, None], 1 + i, Some(1975))).collect();
        let pair = memory.array(&elements);
        let module = no_module();
        let found = check(&process, &module, &layout, Kind::Staff, pair, Source::Profile).expect("found by fields");
        assert_eq!((found.confidence, found.named), (1.0, 0.0));
        assert!(found.from_profile);
        // A scan needs names: many arrays hold ids and dates where staff keep theirs.
        assert!(check(&process, &module, &layout, Kind::Staff, pair, Source::Scan).is_err());
    }

    #[test]
    fn objects_without_names_or_fields_are_refused() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        // No id, or an id and no birth date: what a list of something else might hold there.
        let elements: Vec<u64> = (0..100)
            .map(|i| staff(&mut memory, &layout, [None, None, None], if i % 2 == 0 { 0 } else { 7 }, None))
            .collect();
        let pair = memory.array(&elements);
        assert!(check(&process, &no_module(), &layout, Kind::Staff, pair, Source::Profile).is_err());
        // Of 64, every one is looked at: 58 that fit are enough, 57 are not, and how many fit is kept then.
        for (fitting, accepted) in [(58, true), (57, false)] {
            let mut elements: Vec<u64> = (0..fitting)
                .map(|i| staff(&mut memory, &layout, [Some("Ange"), Some("Postecoglou"), None], 1 + i, None))
                .collect();
            elements.extend((fitting..64).map(|_| staff(&mut memory, &layout, [None, None, None], 0, None)));
            let pair = memory.array(&elements);
            let found = check(&process, &no_module(), &layout, Kind::Staff, pair, Source::Profile);
            assert_eq!(found.is_ok(), accepted, "{fitting} of 64");
            let sampled = found.unwrap_or_else(|refused| refused.expect("a list"));
            assert_eq!((sampled.count, sampled.confidence), (64, fitting as f32 / 64.0));
        }
        // An empty list holds nothing to check.
        let pair = memory.array(&[]);
        assert!(
            check(&process, &no_module(), &layout, Kind::Staff, pair, Source::Profile)
                .is_err_and(|refused| refused.is_none())
        );
    }

    #[test]
    fn players_are_named_by_their_common_name_too() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        let p = &layout.player;
        let mut player = |uid: u32, common: &str| {
            let common = pointer(memory.name(common));
            memory.object(p.end() + p.max_shift(), &[(p.uid, uid.to_le_bytes().to_vec()), (p.common_name, common)])
        };
        let (with_id, without) = (player(1, "킬리안 음바페"), player(0, "킬리안 음바페"));
        assert!(is_named(&process, &layout, Kind::Player, with_id));
        // A player always has an id: without one, the name alone does not tell.
        assert!(!is_named(&process, &layout, Kind::Player, without));
    }

    #[test]
    fn a_club_has_its_senior_team() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        let (c, t) = (&layout.club, &layout.team);
        let club_len = [c.uid + 4, c.teams + 8, c.name + 8, c.short_name + 8].into_iter().max().expect("fields");
        let club = |memory: &mut Memory, uid: u32, senior_of: Option<u64>| {
            let club = memory.object(club_len, &[(c.uid, uid.to_le_bytes().to_vec())]);
            // Its list of teams, the senior team first, which belongs to it or to the club given.
            let senior = memory.object(t.club + 8, &[(t.club, pointer(senior_of.unwrap_or(club)))]);
            let teams = memory.keep(pointer(senior));
            memory.set(club + c.teams, teams);
            club
        };
        let own = club(&mut memory, 680, None);
        assert!(has_fields(&process, &layout, Kind::Club, own));
        // Not one whose senior team belongs to another club, or one without an id.
        let other = club(&mut memory, 2, Some(own));
        assert!(!has_fields(&process, &layout, Kind::Club, other));
        let without_id = club(&mut memory, 0, None);
        assert!(!has_fields(&process, &layout, Kind::Club, without_id));
    }

    #[test]
    fn the_profiles_arrays_are_kept_when_one_is_missing() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        let staff_elements: Vec<u64> =
            (0..64).map(|i| staff(&mut memory, &layout, [Some("A"), Some("B"), None], 1 + i, None)).collect();
        let staff_pair = memory.array(&staff_elements);
        // No player list and no club list where the profile puts them: a save still loading, say.
        let (players_pair, clubs_pair) = (memory.array(&[]), memory.array(&[]));
        let hint = ArrayRvas { players: players_pair, staff: staff_pair, clubs: clubs_pair };
        let mut arrays = calibrate(&process, &no_module(), &layout, Some(&hint), 0);
        assert!(arrays.players.is_none() && arrays.clubs.is_none());
        assert!(arrays.staff.is_some_and(|staff| staff.from_profile && staff.pair_rva == staff_pair));
        assert!(!arrays.from_profile);
        // Nothing new to find, and what was found stays.
        assert!(!find_missing(&process, &no_module(), &layout, Some(&hint), 0, &mut arrays));
        assert!(arrays.staff.is_some_and(|staff| staff.pair_rva == staff_pair));
    }

    #[test]
    fn a_missing_array_says_how_close_it_came() {
        let (layout, process, mut memory) = (layout(), this_process(), Memory::default());
        // Where the profile puts the staff, a list half of whose members have a name and the rest nothing; no players
        // and no clubs where it puts them.
        let mut elements: Vec<u64> = (0..32)
            .map(|i| staff(&mut memory, &layout, [Some("Ange"), Some("Postecoglou"), None], 1 + i, None))
            .collect();
        elements.extend((32..64).map(|_| staff(&mut memory, &layout, [None, None, None], 0, None)));
        let staff_pair = memory.array(&elements);
        let (players_pair, clubs_pair) = (memory.array(&[]), memory.array(&[]));
        let hint = ArrayRvas { players: players_pair, staff: staff_pair, clubs: clubs_pair };
        let arrays = calibrate(&process, &no_module(), &layout, Some(&hint), 0);
        assert!(arrays.staff.is_none());
        let lines = arrays.describe();
        let at = |label: &str| lines.iter().position(|line| line.trim_start().starts_with(label)).expect(label);
        let staff_at = at("staff");
        assert_eq!(
            lines[staff_at..staff_at + 3],
            [
                "  staff    not found".to_owned(),
                format!(
                    "    in the build profile's place: {GAME_PLUGIN}+{staff_pair:#x}       64 elements   50% of \
                     samples decoded,  50% by a name"
                ),
                "    closest a scan found:         none".to_owned(),
            ]
        );
        let players_at = at("players");
        assert_eq!(
            lines[players_at + 1],
            format!("    in the build profile's place: {GAME_PLUGIN}+{players_pair:#x}  no array, or an empty one")
        );
    }
}
