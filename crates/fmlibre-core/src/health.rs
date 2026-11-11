//! Checks that the editor reads the running game right, before it writes to it.
//!
//! After an update of the game the editor may still find its data, yet read some of it from the wrong place: a field
//! that moved reads the bytes of another. Each check samples players, staff or clubs and asks whether what the layout
//! reads looks like the game's own data, beyond the range one value has to keep: birth dates people are born on,
//! goalkeepers better at goalkeeping than the rest, contracts that point back at their players. A check that does not
//! pass keeps what it covers from being written ([`Check::of_field`], [`STRUCTURE`]). The in-game date is only used
//! where it fits what the game's own data says about today: contracts signed before it, and injuries begun before it
//! and not over yet. Where the build's own place for it does not hold such a date, the values in the plugin's
//! writable data that read as dates are weighed the same way (see [`crate::locate`]). Only reads memory.

use std::collections::HashMap;
use std::fmt;

use fmlibre_mem::{Process, is_user_pointer};
use serde::Serialize;

use crate::calibrate::ArrayRef;
use crate::date::FmDate;
use crate::edit::{Entity, Field};
use crate::game::GAME_PLUGIN;
use crate::locate::{DatePlace, Found, date_candidates};
use crate::profile::{CohesionLayout, Layout};
use crate::session::Session;

/// The share of the players sampled who have an entry for their club in their list of cohesion entries, at least. On
/// the macOS Steam save (25 July 2026) most senior players had one; those who had only just joined did not.
const MOST_WITH_COHESION: f64 = 0.5;

/// How many players, members of staff and clubs each check looks at, spread evenly over their arrays.
const SAMPLES: u64 = 2_000;

/// Fewer objects than this tell nothing: the check does not pass.
const LEAST_SAMPLED: u64 = 50;

/// Fewer current injuries than this among the players sampled tell nothing about the date.
const LEAST_INJURIES: u64 = 20;

/// The longest list of current injuries read.
const MOST_INJURIES: u64 = 16;

/// What the editor checks before it writes, and what each check keeps from being written when it does not pass.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Check {
    /// The in-game date is set, the contracts the game holds were signed before it, and its current injuries began
    /// before it and are not over by then. Without it the editor shows no ages and dates no contract.
    GameDate,
    /// Players' birth dates, heights, abilities and reputations hold values people have, and their current ability is
    /// within their potential without being it for most. Guards those fields and the rest of the player's own
    /// (nation, asking price, caps, traits).
    Players,
    /// Current and potential ability are in range, and current ability is within potential for nearly every player.
    /// Kept separate from the rest of the player's details so a moved birth date, height or reputation field does not
    /// unnecessarily make known-good ability fields read-only.
    Abilities,
    /// Position ratings go up to 20, and each player rates 20 where he is natural.
    Positions,
    /// Attributes go up to 100 as stored; goalkeepers rate higher at goalkeeping than the rest, strikers at finishing
    /// and centre-backs at tackling.
    Attributes,
    /// The eight personality ratings go up to 20.
    Personality,
    /// Energy, match sharpness, jadedness and morale stay in the ranges the game keeps them in, and most players are
    /// fresh. Nearly all are at 35% sharpness or more, or else some are rested: players the game creates, such as its
    /// youth intakes, start below 35%.
    LiveValues,
    /// Players' contracts point back at them, and some were signed after the player joined. Guards the contract
    /// fields; with [`Check::Teams`], [`Check::Staff`] and [`Check::Clubs`], every change to the game's lists and
    /// records ([`STRUCTURE`]).
    Contracts,
    /// A player's team belongs to a club and lists him.
    Teams,
    /// Members of staff have birth dates, abilities and attributes in range and contracts that point back at them,
    /// and goalkeeping coaches, physios and scouts are better than others at what their job is about.
    Staff,
    /// A club's senior team points back at the club.
    Clubs,
    /// Players' lists of cohesion entries hold only clubs and nations, with values of 1–100, and most players have
    /// an entry for their club (see `cohesion.rs`). Guards Max cohesion.
    Cohesion,
}

/// The checks a change to the game's lists and records needs (moves, swaps, healing, captains, ties, clauses,
/// retirements): it follows pointers from players, staff and clubs into contracts and teams.
pub const STRUCTURE: [Check; 4] = [Check::Contracts, Check::Teams, Check::Staff, Check::Clubs];

impl Check {
    pub const ALL: [Check; 12] = [
        Check::GameDate,
        Check::Players,
        Check::Abilities,
        Check::Positions,
        Check::Attributes,
        Check::Personality,
        Check::LiveValues,
        Check::Contracts,
        Check::Teams,
        Check::Staff,
        Check::Clubs,
        Check::Cohesion,
    ];

    /// The name of the check in error codes' parameters and in the app: `gameDate`, `liveValues`, ...
    pub fn key(self) -> &'static str {
        match self {
            Check::GameDate => "gameDate",
            Check::Players => "players",
            Check::Abilities => "abilities",
            Check::Positions => "positions",
            Check::Attributes => "attributes",
            Check::Personality => "personality",
            Check::LiveValues => "liveValues",
            Check::Contracts => "contracts",
            Check::Teams => "teams",
            Check::Staff => "staff",
            Check::Clubs => "clubs",
            Check::Cohesion => "cohesion",
        }
    }

    /// The check that has to pass before `field` is written.
    pub fn of_field(field: &Field) -> Check {
        let key = field.key.as_str();
        match field.entity {
            Entity::Staff => Check::Staff,
            Entity::Club => Check::Clubs,
            Entity::Player if matches!(key, "current_ability" | "potential_ability") => Check::Abilities,
            Entity::Player if key.starts_with("attribute.") => Check::Attributes,
            Entity::Player if key.starts_with("position.") => Check::Positions,
            Entity::Player if key.starts_with("personality.") => Check::Personality,
            Entity::Player if key.starts_with("contract.") || key.starts_with("loan.") => Check::Contracts,
            Entity::Player if matches!(key, "condition" | "match_sharpness" | "jadedness" | "morale") => {
                Check::LiveValues
            }
            Entity::Player => Check::Players,
        }
    }
}

impl fmt::Display for Check {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Check::GameDate => "the in-game date",
            Check::Players => "the players' own values",
            Check::Abilities => "current and potential ability",
            Check::Positions => "the position ratings",
            Check::Attributes => "the attributes",
            Check::Personality => "the personality ratings",
            Check::LiveValues => "energy, match sharpness, jadedness and morale",
            Check::Contracts => "the contracts",
            Check::Teams => "the teams",
            Check::Staff => "the staff",
            Check::Clubs => "the clubs",
            Check::Cohesion => "the cohesion with clubs",
        })
    }
}

/// What one check found: how many of the objects it looked at fit, and whether that is enough.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub check: Check,
    pub passed: bool,
    pub fit: u64,
    pub sampled: u64,
    /// What else it measured, in a few words, for the probe and the diagnostics report.
    #[serde(skip)]
    pub note: String,
}

impl fmt::Display for CheckResult {
    /// The check as the probe and the diagnostics report list it: "pass  staff   1980 of  2000 fit; ...".
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let verdict = if self.passed { "pass" } else { "FAIL" };
        write!(f, "{verdict}  {:<12} {:>5} of {:>5} fit", self.check.key(), self.fit, self.sampled)?;
        if !self.note.is_empty() {
            write!(f, "; {}", self.note)?;
        }
        Ok(())
    }
}

/// What the checks found on the running game.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub results: Vec<CheckResult>,
    /// Where the in-game date was found, and what it read then; `None` when no date passed [`Check::GameDate`].
    #[serde(skip)]
    pub date: Option<DatePlace>,
    /// What the date was weighed against.
    #[serde(skip)]
    pub evidence: DateEvidence,
}

/// What the game's own data says about the in-game date: when contracts were signed and players joined their clubs,
/// none of it after the date, and the current injuries, each begun on or before the date and not over by then.
#[derive(Debug, Clone, Default)]
pub struct DateEvidence {
    /// The dates contracts were signed and players joined their clubs.
    pub signed: Vec<FmDate>,
    /// Each current injury: the day it began, and the day he is back at the latest.
    pub injuries: Vec<(FmDate, FmDate)>,
}

impl DateEvidence {
    /// How `date` fits the evidence.
    pub fn fit(&self, date: FmDate) -> DateFit {
        let before: Vec<FmDate> = self.signed.iter().copied().filter(|&day| day <= date).collect();
        let within = self.injuries.iter().filter(|&&(began, back)| began <= date && date <= back).count();
        DateFit {
            before: before.len() as u64,
            contracts: self.signed.len() as u64,
            since_latest: before.iter().max().map(|&latest| days_between(latest, date)),
            within: within as u64,
            injuries: self.injuries.len() as u64,
        }
    }
}

/// How a date fits [`DateEvidence`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DateFit {
    /// The contract dates on or before it, of how many.
    pub before: u64,
    pub contracts: u64,
    /// Days from the latest contract date on or before it.
    pub since_latest: Option<i64>,
    /// The current injuries it falls within, begun on or before it and not over by then, of how many.
    pub within: u64,
    pub injuries: u64,
}

impl DateFit {
    /// Enough contracts, nearly none of them dated after it, and the latest before it less than a year earlier. A date
    /// read from the wrong place passes neither way: an unset or old one comes before many contracts, a later one long
    /// after the last.
    pub fn contracts_hold(&self) -> bool {
        let after = self.contracts - self.before;
        self.contracts >= LEAST_SAMPLED && after * 100 <= self.contracts && self.since_latest.is_some_and(|d| d <= 366)
    }

    /// Whether nearly all current injuries have begun by it and are not over, with enough of them to tell (`None`
    /// otherwise). A date some days off fails: the injuries begun since, or over meanwhile, no longer fit it.
    pub fn injuries_hold(&self) -> Option<bool> {
        (self.injuries >= LEAST_INJURIES).then_some(self.within * 10 >= self.injuries * 9)
    }

    /// What a date where the build places it must meet: the contracts, and the injuries when they tell.
    pub fn holds(&self) -> bool {
        self.contracts_hold() && self.injuries_hold() != Some(false)
    }

    /// What a date found by searching must meet: the contracts, and enough injuries that fit it.
    pub fn holds_strictly(&self) -> bool {
        self.contracts_hold() && self.injuries_hold() == Some(true)
    }

    /// Whether the date this is the fit of fits the same evidence better than the one `other` is the fit of: no more
    /// contract dates after it and no fewer current injuries that fit it, and better on at least one of the two.
    pub fn beats(&self, other: &DateFit) -> bool {
        let (ours, theirs) = ((self.before, self.within), (other.before, other.within));
        ours.0 >= theirs.0 && ours.1 >= theirs.1 && ours != theirs
    }

    fn note(&self) -> String {
        let latest = match self.since_latest {
            Some(days) => format!("the latest before it {days} days earlier"),
            None => "none before it".to_owned(),
        };
        format!(
            "{} of {} contract dates after it; {latest}; {} of {} current injuries fit it",
            self.contracts - self.before,
            self.contracts,
            self.within,
            self.injuries
        )
    }
}

impl Health {
    /// Whether `check` passed.
    pub fn passed(&self, check: Check) -> bool {
        self.results.iter().any(|result| result.check == check && result.passed)
    }

    /// The checks that did not pass, in [`Check::ALL`] order.
    pub fn failed(&self) -> Vec<Check> {
        self.results.iter().filter(|result| !result.passed).map(|result| result.check).collect()
    }
}

/// Why the editor will not write a change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lock {
    /// The game is a build the editor has no profile for, and editing it was not allowed.
    UnknownBuild,
    /// A check the change needs did not pass on this game.
    Failed(Check),
    /// The game has loaded a save, or gone back to its main menu, since the editor read it (see
    /// [`crate::Session::save_changed`]): what the editor read may be another save's.
    SaveChanged,
}

impl Lock {
    pub(crate) fn code(self) -> &'static str {
        match self {
            Lock::UnknownBuild => "guard.unknownBuild",
            Lock::Failed(_) => "guard.failed",
            Lock::SaveChanged => "guard.saveChanged",
        }
    }

    pub(crate) fn params(self) -> Vec<(&'static str, String)> {
        match self {
            Lock::UnknownBuild | Lock::SaveChanged => Vec::new(),
            Lock::Failed(check) => vec![("check", check.key().to_owned())],
        }
    }
}

impl fmt::Display for Lock {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Lock::UnknownBuild => f.write_str(
                "the editor has not been checked with this version of the game, so it does not write to it unless \
                 editing is allowed",
            ),
            Lock::Failed(check) => {
                write!(f, "{check} did not check out in this version of the game, so the editor leaves them unchanged")
            }
            Lock::SaveChanged => f.write_str(
                "the game has loaded a save, or gone back to its main menu, since the editor read it, so the editor \
                 writes nothing until it reads the game again",
            ),
        }
    }
}

/// How many of the objects a check looked at fit.
#[derive(Debug, Default, Clone, Copy)]
struct Tally {
    fit: u64,
    sampled: u64,
}

impl Tally {
    fn add(&mut self, fits: bool) {
        self.sampled += 1;
        self.fit += u64::from(fits);
    }

    /// Whether enough were looked at and at least `least` of them (a share) fit.
    fn holds(self, least: f64) -> bool {
        self.sampled >= LEAST_SAMPLED && self.fit as f64 >= least * self.sampled as f64
    }

    fn result(self, check: Check, least: f64, note: String) -> CheckResult {
        CheckResult { check, passed: self.holds(least), fit: self.fit, sampled: self.sampled, note }
    }
}

/// The mean of the values added, and how many there were.
#[derive(Debug, Default, Clone, Copy)]
struct Mean {
    sum: f64,
    count: u64,
}

impl Mean {
    fn add(&mut self, value: f64) {
        self.sum += value;
        self.count += 1;
    }

    fn value(self) -> Option<f64> {
        (self.count > 0).then(|| self.sum / self.count as f64)
    }
}

/// Players' live values: whether they are in the ranges the game keeps them in, and how many players are fresh, at 35%
/// sharpness or more, and rested.
#[derive(Debug, Default, Clone, Copy)]
struct LiveTally {
    in_range: Tally,
    fresh: Tally,
    sharp: Tally,
    rested: Tally,
}

impl LiveTally {
    fn add(&mut self, sharpness: u16, jadedness: i16, condition: u16, morale: u8) {
        self.in_range
            .add(condition <= 10_000 && sharpness <= 10_000 && (-500..=10_000).contains(&jadedness) && morale <= 20);
        self.fresh.add(condition >= 5_000);
        self.sharp.add(sharpness >= 3_500);
        self.rested.add(jadedness < 0);
    }

    /// Most players are fresh on any day. The game keeps match sharpness at 35% or above, but not for the players it
    /// creates: on the Mac test save on 2 July 2027, 2,796 of 40,378 players were below it, 2,716 of them created by
    /// the game, its youth intake among them. Then some players have to be rested (jadedness below zero) instead.
    fn result(self) -> CheckResult {
        let mut result = self.in_range.result(Check::LiveValues, 0.99, String::new());
        result.passed &= self.fresh.holds(0.6) && (self.sharp.holds(0.99) || self.rested.holds(0.01));
        result.note = format!(
            "{} of {} at 35% sharpness or more, {} at 50% energy or more, {} rested",
            self.sharp.fit, self.sharp.sampled, self.fresh.fit, self.rested.fit
        );
        result
    }
}

/// `count` indices spread evenly over an array of `len` elements, at most [`SAMPLES`] of them.
fn sample(len: u64) -> impl Iterator<Item = u64> {
    let count = len.min(SAMPLES);
    (0..count).map(move |k| k * len / count)
}

/// The elements [`sample`] picks of the array of `len` pointers at `begin`.
fn sampled_objects(process: &Process, array: &ArrayRef, begin: u64, len: u64) -> Vec<u64> {
    sample(len)
        .filter_map(|index| process.read_u64(begin + index * 8).ok())
        .map(|pointer| array.object(pointer))
        .filter(|&object| is_user_pointer(object))
        .collect()
}

/// A player as the checks read him: his object's bytes, with the person block where his class keeps it.
struct SampledPlayer {
    object: u64,
    shift: u64,
    bytes: Vec<u8>,
}

impl SampledPlayer {
    fn u8(&self, layout: &Layout, offset: u64) -> u8 {
        self.bytes[layout.player.at(offset, self.shift) as usize]
    }

    fn u16(&self, layout: &Layout, offset: u64) -> u16 {
        let at = layout.player.at(offset, self.shift) as usize;
        u16::from_le_bytes([self.bytes[at], self.bytes[at + 1]])
    }

    fn u64(&self, layout: &Layout, offset: u64) -> u64 {
        let at = layout.player.at(offset, self.shift) as usize;
        u64::from_le_bytes(self.bytes[at..at + 8].try_into().expect("8 bytes"))
    }

    fn date(&self, layout: &Layout, offset: u64) -> Option<FmDate> {
        FmDate::from_raw(self.u16(layout, offset), self.u16(layout, offset + 2))
    }

    fn positions(&self, layout: &Layout) -> [u8; 15] {
        std::array::from_fn(|i| self.u8(layout, layout.player.positions + i as u64))
    }
}

/// Reads the players [`sample`] picks.
fn sample_players(session: &Session) -> Vec<SampledPlayer> {
    let Some(array) = session.arrays.players.as_ref() else {
        return Vec::new();
    };
    let Ok((begin, len)) = array.locate(&session.process, &session.plugin) else {
        return Vec::new();
    };
    let (process, p) = (&session.process, &session.layout.player);
    let mut shifts: HashMap<u64, u64> = HashMap::new();
    sampled_objects(process, array, begin, len)
        .into_iter()
        .filter_map(|object| {
            let mut bytes = process.read_bytes(object, p.end() as usize).ok()?;
            let class = u64::from_le_bytes(bytes[..8].try_into().expect("8 bytes"));
            let shift = *shifts.entry(class).or_insert_with(|| crate::players::person_shift(process, p, object));
            if shift > 0 {
                bytes = process.read_bytes(object, (p.end() + shift) as usize).ok()?;
            }
            Some(SampledPlayer { object, shift, bytes })
        })
        .collect()
}

/// Index of the goalkeeper's, the centre-back's and the striker's rating in [`crate::POSITIONS`].
const GK: usize = 0;
const DC: usize = 3;
const ST: usize = 12;

/// The attributes only goalkeepers are good at.
const GOALKEEPING: [&str; 9] = [
    "aerial_reach",
    "command_of_area",
    "communication",
    "handling",
    "kicking",
    "one_on_ones",
    "punching",
    "reflexes",
    "rushing_out",
];

/// How much higher, as stored (0–100), goalkeepers rate on average at goalkeeping than outfield players, strikers
/// at finishing than centre-backs, and centre-backs at tackling than strikers, for the attributes to be read right;
/// and among staff, goalkeeping coaches at goalkeeping, physios at physiotherapy and scouts at judging potential. On
/// the Game Pass test save (9 September 2026) these gaps were 42, 37 and 36, and 39, 51 and 30. With the players'
/// attributes read one byte off, the first three were 23, -4 and -5.
const GAP: f64 = 20.0;

/// Runs every check on the running game, and finds the in-game date.
pub(crate) fn check(session: &Session) -> Health {
    let layout = &session.layout;
    let process = &session.process;
    let players = sample_players(session);

    let mut own = Tally::default();
    let mut abilities = Tally::default();
    // Current ability within the potential, and the two not the same for most: a potential read in place of the
    // current ability would equal it.
    let mut within = Tally::default();
    let mut same = Tally::default();
    let mut positions = Tally::default();
    let mut natural = Tally::default();
    let mut attributes = Tally::default();
    let mut personality = Tally::default();
    let mut live = LiveTally::default();
    let mut contracts = Tally::default();
    // Contracts signed after the player joined: renewals, which a date read in place of the other cannot show.
    let mut renewed = Tally::default();
    let mut teams = Tally::default();
    // Lists of cohesion entries that hold, and those with an entry for the player's club.
    let (mut cohesion_lists, mut cohesion_own) = (Tally::default(), Tally::default());
    // Goalkeeping by goalkeepers and by the rest; finishing and tackling by strikers and by centre-backs.
    let (mut keepers, mut outfield) = (Mean::default(), Mean::default());
    let (mut striker_finishing, mut defender_finishing) = (Mean::default(), Mean::default());
    let (mut striker_tackling, mut defender_tackling) = (Mean::default(), Mean::default());
    // The dates contracts were signed and players joined their clubs, and the current injuries.
    let mut evidence = DateEvidence::default();

    let p = &layout.player;
    let attribute = |player: &SampledPlayer, key: &str| p.attributes.get(key).map(|&at| player.u8(layout, at));
    for player in &players {
        let born = player.date(layout, p.date_of_birth).is_some_and(|born| (1900..=2020).contains(&born.year));
        let height = (140..=220).contains(&player.u16(layout, p.height));
        let ability = (1..=200).contains(&player.u16(layout, p.current_ability));
        let potential = player.u16(layout, p.potential_ability) as i16;
        let potential = potential != 0 && (-200..=200).contains(&potential);
        let reputation = [p.home_reputation, p.current_reputation, p.world_reputation]
            .iter()
            .all(|&at| player.u16(layout, at) <= 10_000);
        own.add(born && height && ability && potential && reputation);
        abilities.add(ability && potential);
        let (current, potential) = (player.u16(layout, p.current_ability), player.u16(layout, p.potential_ability));
        if (1..=200).contains(&potential) {
            within.add(current <= potential);
            same.add(current == potential);
        }

        let ratings = player.positions(layout);
        positions.add(ratings.iter().all(|&rating| rating <= 20));
        natural.add(ratings.contains(&20));

        attributes.add(p.attributes.values().all(|&at| player.u8(layout, at) <= 100));
        let goalkeeping: Vec<u8> = GOALKEEPING.iter().filter_map(|key| attribute(player, key)).collect();
        let goalkeeping = goalkeeping.iter().map(|&v| f64::from(v)).sum::<f64>() / goalkeeping.len().max(1) as f64;
        if ratings[GK] == 20 {
            keepers.add(goalkeeping);
        } else if ratings[GK] <= 5 {
            outfield.add(goalkeeping);
        }
        let (finishing, tackling) = (attribute(player, "finishing"), attribute(player, "tackling"));
        if let (Some(finishing), Some(tackling)) = (finishing, tackling) {
            if ratings[ST] == 20 && ratings[DC] <= 10 {
                striker_finishing.add(f64::from(finishing));
                striker_tackling.add(f64::from(tackling));
            } else if ratings[DC] == 20 && ratings[ST] <= 10 {
                defender_finishing.add(f64::from(finishing));
                defender_tackling.add(f64::from(tackling));
            }
        }

        personality.add((0..crate::PERSONALITY.len() as u64).all(|i| player.u8(layout, p.personality + i) <= 20));

        live.add(
            player.u16(layout, p.match_sharpness),
            player.u16(layout, p.jadedness) as i16,
            player.u16(layout, p.condition),
            player.u8(layout, p.morale),
        );

        // His contract, when he has one, points back at him; and its dates.
        let contract = player.u64(layout, p.contract);
        if is_user_pointer(contract) {
            let fits = contract_fits(process, layout, contract, player.object + p.identity() + player.shift);
            contracts.add(fits.is_some());
            if let Some((signing, joining)) = fits {
                if let (Some(signing), Some(joining)) = (signing, joining) {
                    renewed.add(signing > joining);
                }
                evidence.signed.extend([signing, joining].into_iter().flatten());
            }
        }

        // His current injuries, when he was ever injured.
        let record = player.u64(layout, p.injuries);
        if is_user_pointer(record) {
            evidence.injuries.extend(current_injuries(process, layout, record));
        }

        // His team belongs to a club and lists him.
        let team = player.u64(layout, p.team);
        if is_user_pointer(team) {
            teams.add(team_lists(process, layout, team, player.object));
        }

        // His cohesion entries are for clubs and nations, from 1 to 100, and one is for his club.
        let record = player.u64(layout, p.relations);
        if let Some(c) = &layout.cohesion
            && is_user_pointer(team)
            && is_user_pointer(record)
            && let Some(club) = club_cohesion_index(process, layout, c, team)
        {
            let list = crate::cohesion::read_list(process, c, record).ok().flatten();
            let holds = list.map(|(_, bytes)| crate::cohesion::list_holds(c, &bytes, club));
            cohesion_lists.add(holds.is_some_and(|(holds, _)| holds));
            if let Some((true, own)) = holds {
                cohesion_own.add(own);
            }
        }
    }

    let gap = |high: Mean, low: Mean| high.value().zip(low.value()).map(|(high, low)| high - low);
    let gaps =
        [gap(keepers, outfield), gap(striker_finishing, defender_finishing), gap(defender_tackling, striker_tackling)];
    let shown = |gap: Option<f64>| gap.map_or_else(|| "-".to_owned(), |gap| format!("{gap:.0}"));
    let signature = gaps.iter().all(|gap| gap.is_some_and(|gap| gap >= GAP));

    let (date, date_result) = find_date(session, &evidence);
    let staff = check_staff(session);
    let clubs = check_clubs(session);
    let mut cohesion = cohesion_lists.result(Check::Cohesion, 0.99, String::new());
    cohesion.passed &= cohesion_own.holds(MOST_WITH_COHESION);
    cohesion.note = match layout.cohesion {
        Some(_) => format!("{} of {} have an entry for their club", cohesion_own.fit, cohesion_own.sampled),
        None => "the layout does not place it".to_owned(),
    };

    let mut attributes = attributes.result(Check::Attributes, 0.99, String::new());
    attributes.passed &= signature;
    attributes.note = format!(
        "goalkeeping gap {}, finishing gap {}, tackling gap {} (at least {GAP:.0} each)",
        shown(gaps[0]),
        shown(gaps[1]),
        shown(gaps[2])
    );
    let mut positions = positions.result(Check::Positions, 0.99, String::new());
    positions.passed &= natural.holds(0.95);
    positions.note = format!("{} of {} rate 20 somewhere", natural.fit, natural.sampled);
    let mut own = own.result(Check::Players, 0.97, String::new());
    own.passed &= within.holds(0.95) && same.fit * 2 <= same.sampled;
    own.note = format!("{} of {} within their potential, {} of them at it", within.fit, within.sampled, same.fit);
    let mut abilities = abilities.result(Check::Abilities, 0.99, String::new());
    abilities.passed &= within.holds(0.95) && same.fit * 2 <= same.sampled;
    abilities.note = format!("{} of {} within their potential, {} of them at it", within.fit, within.sampled, same.fit);
    let mut contracts = contracts.result(Check::Contracts, 0.95, String::new());
    contracts.passed &= renewed.sampled >= LEAST_SAMPLED && renewed.fit * 20 >= renewed.sampled;
    contracts.note = format!("{} of {} signed after the player joined", renewed.fit, renewed.sampled);

    Health {
        results: vec![
            date_result,
            own,
            abilities,
            positions,
            attributes,
            personality.result(Check::Personality, 0.99, String::new()),
            live.result(),
            contracts,
            teams.result(Check::Teams, 0.95, String::new()),
            staff,
            clubs,
            cohesion,
        ],
        date,
        evidence,
    }
}

/// The index the cohesion entries of the players of the team at `team` name its club by; `None` where the team leads
/// to no club.
fn club_cohesion_index(process: &Process, layout: &Layout, c: &CohesionLayout, team: u64) -> Option<i32> {
    let club = process.read_u64(team + layout.team.club).ok().filter(|&club| is_user_pointer(club))?;
    let bytes = process.read_bytes(club + c.club_index, 4).ok()?;
    Some(i32::from_le_bytes(bytes.try_into().ok()?))
}

/// The current injuries that the injury record at `record` lists: the day each began, and the day he is back at the
/// latest. None when the list does not look like one.
fn current_injuries(process: &Process, layout: &Layout, record: u64) -> Vec<(FmDate, FmDate)> {
    let Ok(header) = process.read_bytes(record, 16) else {
        return Vec::new();
    };
    let begin = u64::from_le_bytes(header[..8].try_into().expect("8 bytes"));
    let end = u64::from_le_bytes(header[8..].try_into().expect("8 bytes"));
    let listed = is_user_pointer(begin) && end > begin && (end - begin).is_multiple_of(8);
    if !listed || end - begin > 8 * MOST_INJURIES {
        return Vec::new();
    }
    let Ok(list) = process.read_bytes(begin, (end - begin) as usize) else {
        return Vec::new();
    };
    let i = &layout.injury;
    list.as_chunks::<8>()
        .0
        .iter()
        .map(|word| u64::from_le_bytes(*word))
        .filter(|&injury| is_user_pointer(injury))
        .filter_map(|injury| {
            let bytes = process.read_bytes(injury, i.end() as usize).ok()?;
            let u16_at = |at: u64| u16::from_le_bytes([bytes[at as usize], bytes[at as usize + 1]]);
            let began = FmDate::from_raw(u16_at(i.started), u16_at(i.started + 2))?;
            Some((began, began.plus_days(i64::from(u16_at(i.longest)))))
        })
        .collect()
}

/// Finds the in-game date: where the build places it when that fits the evidence, or else the one date among the
/// values in the plugin's writable data that fits it strictly. When the evidence cannot tell such values apart, the
/// editor goes without a date.
fn find_date(session: &Session, evidence: &DateEvidence) -> (Option<DatePlace>, CheckResult) {
    let result = |place: Option<DatePlace>, note: String| CheckResult {
        check: Check::GameDate,
        passed: place.is_some(),
        fit: place.map_or(0, |place| evidence.fit(place.date).before),
        sampled: evidence.signed.len() as u64,
        note,
    };
    let placed = session.placed_date().map(|(rva, found)| (rva, session.read_date_at(rva), found));
    let mut why = String::new();
    match placed {
        Some((rva, Some(date), found)) => {
            let fit = evidence.fit(date);
            if fit.holds() {
                let place = DatePlace { rva, date, found };
                return (Some(place), result(Some(place), fit.note()));
            }
            why = format!("{} where the build puts it does not fit ({}); ", iso(date), fit.note());
        }
        Some((_, None, _)) => why = "no date where the build puts it; ".to_owned(),
        None => {}
    }
    match pick_date(&date_candidates(session), evidence) {
        Ok((place, chosen)) => {
            let note = format!(
                "{}; read at {GAME_PLUGIN}+{:#x}, {}{}",
                evidence.fit(place.date).note(),
                place.rva,
                place.found.describe(),
                chosen.map_or(String::new(), |chosen| format!("; {chosen}"))
            );
            (Some(place), result(Some(place), note))
        }
        Err(search) => (None, result(None, why + &search)),
    }
}

/// The date among `candidates` that fits `evidence` strictly, and the best place to read it: the profile's, else a
/// variable of its own (one near where other builds keep the date first) rather than the field beside the arrays,
/// which the game leaves unset after a load.
///
/// More than one date can fit. The game keeps a value for the day before, and the evidence leaves some room, so the
/// day before fits as well unless enough contracts were signed and injuries begun on the day to rule it out: on the
/// Game Pass save of 23 September 2026, `game_plugin.dll+0x56546f8` held the 22nd and fitted as well as the date; on
/// 0.9.2435.0, `+0x53886f8` held 10 January 2028 and fitted too, if less well than the 11th. Then the date is, in turn:
/// - the latest of them, when the field beside the arrays holds it: where the builds before November 2026 kept the
///   date, and 0.9.2409.0 keeps it there too once the game has moved on a day after a load;
/// - the one of them read about as far from the players' array as other builds keep their date ([`Found::Guessed`]):
///   the date's own variable has kept its distance from build to build, and the day before is far from it;
/// - the one of them that fits better than every other ([`DateFit::beats`]): each contract signed and each injury
///   begun on the day counts against the day before.
///
/// Otherwise no date is used. Along with the place, a note on how the date was chosen among several, if it was.
fn pick_date(candidates: &[DatePlace], evidence: &DateEvidence) -> Result<(DatePlace, Option<String>), String> {
    let fitting: Vec<DatePlace> =
        candidates.iter().copied().filter(|place| evidence.fit(place.date).holds_strictly()).collect();
    let mut dates: Vec<FmDate> = fitting.iter().map(|place| place.date).collect();
    dates.sort_unstable();
    dates.dedup();
    let rank = |place: &DatePlace| match place.found {
        Found::Profile => 0,
        Found::Guessed => 1,
        Found::Searched => 2,
        Found::BesideArrays => 3,
    };
    let read_at = |date: FmDate| {
        fitting.iter().copied().filter(|place| place.date == date).min_by_key(|place| (rank(place), place.rva))
    };
    let listed = |dates: &[FmDate]| dates.iter().map(|&date| iso(date)).collect::<Vec<_>>().join(", ");
    let several = match dates.as_slice() {
        [] => return Err(format!("{} values in the plugin's data read as dates, and none fits", candidates.len())),
        [date] => return Ok((read_at(*date).expect("the date fits"), None)),
        several => several,
    };

    let latest = *several.last().expect("several dates");
    let beside = fitting.iter().find(|place| place.found == Found::BesideArrays).map(|place| place.date);
    let mut guessed: Vec<FmDate> =
        fitting.iter().filter(|place| place.found == Found::Guessed).map(|place| place.date).collect();
    guessed.sort_unstable();
    guessed.dedup();
    let fits: Vec<(FmDate, DateFit)> = several.iter().map(|&date| (date, evidence.fit(date))).collect();
    let best = fits
        .iter()
        .find(|(date, fit)| fits.iter().all(|(other, other_fit)| other == date || fit.beats(other_fit)))
        .map(|&(date, _)| date);
    let pick = if beside == Some(latest) {
        Some((latest, "the latest, which the field beside the arrays holds"))
    } else if let [date] = guessed.as_slice() {
        Some((*date, "the one read about as far from the players' array as other builds keep the date"))
    } else {
        best.map(|date| (date, "the one that fits the contracts and the current injuries better than any other"))
    };
    if let Some((date, how)) = pick {
        let chosen = format!("of the {} dates that fit ({}), {how}", several.len(), listed(several));
        return Ok((read_at(date).expect("the date fits"), Some(chosen)));
    }

    let beside = match beside {
        Some(date) => format!("the field beside the arrays holds {}, not the latest", iso(date)),
        None => "the field beside the arrays holds none of them".to_owned(),
    };
    let guessed = match guessed.len() {
        0 => "none is read where other builds keep the date".to_owned(),
        count => format!("{count} are read where other builds keep the date"),
    };
    Err(format!(
        "values in the plugin's data read as {} dates that fit, and nothing tells them apart, so none is used: {}; \
         {beside}; {guessed}; none fits better than every other",
        several.len(),
        listed(several)
    ))
}

/// A date as YYYY-MM-DD.
pub(crate) fn iso(date: FmDate) -> String {
    format!("{:04}-{:02}-{:02}", date.year, date.month, date.day)
}

/// Whether the contract at `contract` points back at the identity block at `owner`; if so, the date it was signed and
/// the date the player joined, where they are set.
fn contract_fits(
    process: &Process,
    layout: &Layout,
    contract: u64,
    owner: u64,
) -> Option<(Option<FmDate>, Option<FmDate>)> {
    let c = &layout.contract;
    let bytes = process.read_bytes(contract, c.end() as usize).ok()?;
    let u16_at = |at: u64| u16::from_le_bytes([bytes[at as usize], bytes[at as usize + 1]]);
    let u64_at = |at: u64| u64::from_le_bytes(bytes[at as usize..at as usize + 8].try_into().expect("8 bytes"));
    if u64_at(c.owner) != owner {
        return None;
    }
    let date = |at: u64| FmDate::from_raw(u16_at(at), u16_at(at + 2));
    Some((date(c.signed), date(c.joined)))
}

/// Whether `team` belongs to a club with a UID and its list of players holds `player`.
fn team_lists(process: &Process, layout: &Layout, team: u64, player: u64) -> bool {
    let club = process.read_u64(team + layout.team.club).unwrap_or(0);
    if !is_user_pointer(club) || process.read_u32(club + layout.club.uid).unwrap_or(0) == 0 {
        return false;
    }
    let Ok(header) = process.read_bytes(team + layout.team.players, 16) else {
        return false;
    };
    let begin = u64::from_le_bytes(header[..8].try_into().expect("8 bytes"));
    let end = u64::from_le_bytes(header[8..].try_into().expect("8 bytes"));
    if !is_user_pointer(begin) || end <= begin || end - begin > 8 * 5_000 || !(end - begin).is_multiple_of(8) {
        return false;
    }
    process
        .read_bytes(begin, (end - begin) as usize)
        .is_ok_and(|list| list.as_chunks::<8>().0.iter().any(|slot| u64::from_le_bytes(*slot) == player))
}

/// Days from `from` to `to`.
fn days_between(from: FmDate, to: FmDate) -> i64 {
    let day = |date: FmDate| {
        let years = i64::from(date.year) - 1;
        years * 365 + years / 4 - years / 100 + years / 400 + i64::from(date.day_of_year())
    };
    day(to) - day(from)
}

/// Members of staff: birth dates, abilities, attributes and ratings in range, and contracts that point back at them.
fn check_staff(session: &Session) -> CheckResult {
    let mut tally = Tally::default();
    let mut contracts = Tally::default();
    // Goalkeeping by goalkeeping coaches and by other coaches, physiotherapy by physios and by coaches, judging
    // potential by scouts and by physios.
    let (mut keeper_coaches, mut coaches_goalkeeping) = (Mean::default(), Mean::default());
    let (mut physios_physiotherapy, mut coaches_physiotherapy) = (Mean::default(), Mean::default());
    let (mut scouts_judging, mut physios_judging) = (Mean::default(), Mean::default());
    let (process, layout) = (&session.process, &session.layout);
    let s = &layout.staff;
    let objects = session
        .arrays
        .staff
        .as_ref()
        .and_then(|array| array.locate(process, &session.plugin).ok().map(|(begin, len)| (array, begin, len)))
        .map(|(array, begin, len)| sampled_objects(process, array, begin, len))
        .unwrap_or_default();
    let mut shifts: HashMap<u64, u64> = HashMap::new();
    for object in objects {
        let Ok(head) = process.read_bytes(object, 8) else {
            continue;
        };
        let class = u64::from_le_bytes(head[..8].try_into().expect("8 bytes"));
        let shift = *shifts.entry(class).or_insert_with(|| crate::staff::person_shift(process, s, object));
        let Ok(bytes) = process.read_bytes(object, (s.end() + shift) as usize) else {
            continue;
        };
        let at = |offset: u64| s.at(offset, shift) as usize;
        let u16_at = |offset: u64| u16::from_le_bytes([bytes[at(offset)], bytes[at(offset) + 1]]);
        let born = FmDate::from_raw(u16_at(s.date_of_birth), u16_at(s.date_of_birth + 2));
        let born = born.is_none_or(|born| (1900..=2020).contains(&born.year));
        let ability = u16_at(s.current_ability) <= 200 && (-200..=200).contains(&(u16_at(s.potential_ability) as i16));
        let reputation = [s.home_reputation, s.current_reputation, s.world_reputation]
            .iter()
            .all(|&offset| u16_at(offset) <= 10_000);
        let attributes = s.attributes.values().all(|&offset| bytes[at(offset)] <= 100)
            && s.ratings.values().all(|&offset| bytes[at(offset)] <= 20)
            && (0..crate::PERSONALITY.len() as u64).all(|i| bytes[at(s.personality + i)] <= 20);
        tally.add(born && ability && reputation && attributes);

        let contract = u64::from_le_bytes(bytes[at(s.contract)..at(s.contract) + 8].try_into().expect("8 bytes"));
        if !is_user_pointer(contract) {
            continue;
        }
        let fits = contract_fits(process, layout, contract, object + s.identity() + shift).is_some();
        contracts.add(fits);
        // What his job makes him good at.
        let Some(job) = fits.then(|| process.read_bytes(contract + layout.contract.job, 1).ok()).flatten() else {
            continue;
        };
        let job = if job[0] > 1 && job[0] % 2 == 1 { job[0] - 1 } else { job[0] };
        let attribute = |key: &str| s.attributes.get(key).map(|&offset| f64::from(bytes[at(offset)]));
        let (Some(goalkeeping), Some(physiotherapy), Some(judging)) =
            (attribute("goalkeeping"), attribute("physiotherapy"), attribute("judging_potential"))
        else {
            continue;
        };
        match job {
            GOALKEEPING_COACH => keeper_coaches.add(goalkeeping),
            COACH | ASSISTANT => {
                coaches_goalkeeping.add(goalkeeping);
                coaches_physiotherapy.add(physiotherapy);
            }
            PHYSIO | HEAD_PHYSIO => {
                physios_physiotherapy.add(physiotherapy);
                physios_judging.add(judging);
            }
            SCOUT | CHIEF_SCOUT => scouts_judging.add(judging),
            _ => {}
        }
    }
    let gap = |high: Mean, low: Mean| high.value().zip(low.value()).map(|(high, low)| high - low);
    let gaps = [
        gap(keeper_coaches, coaches_goalkeeping),
        gap(physios_physiotherapy, coaches_physiotherapy),
        gap(scouts_judging, physios_judging),
    ];
    let shown = |gap: Option<f64>| gap.map_or_else(|| "-".to_owned(), |gap| format!("{gap:.0}"));
    let mut result = tally.result(Check::Staff, 0.97, String::new());
    result.passed &= contracts.holds(0.95) && gaps.iter().all(|gap| gap.is_some_and(|gap| gap >= GAP));
    result.note = format!(
        "{} of {} contracts point back; goalkeeping gap {}, physiotherapy gap {}, judging gap {} (at least {GAP:.0})",
        contracts.fit,
        contracts.sampled,
        shown(gaps[0]),
        shown(gaps[1]),
        shown(gaps[2])
    );
    result
}

/// Job codes of contracts (see [`crate::job_name`]), whose members of staff are better at some things than others.
const COACH: u8 = 2;
const PHYSIO: u8 = 12;
const SCOUT: u8 = 14;
const ASSISTANT: u8 = 20;
const GOALKEEPING_COACH: u8 = 34;
const CHIEF_SCOUT: u8 = 44;
const HEAD_PHYSIO: u8 = 50;

/// Clubs whose senior team points back at them, with a reputation in range.
fn check_clubs(session: &Session) -> CheckResult {
    let mut tally = Tally::default();
    let (process, layout) = (&session.process, &session.layout);
    let objects = session
        .arrays
        .clubs
        .as_ref()
        .and_then(|array| array.locate(process, &session.plugin).ok().map(|(begin, len)| (array, begin, len)))
        .map(|(array, begin, len)| sampled_objects(process, array, begin, len))
        .unwrap_or_default();
    for club in objects {
        let teams = process.read_u64(club + layout.club.teams).unwrap_or(0);
        if !is_user_pointer(teams) {
            continue;
        }
        let senior = process.read_u64(teams).unwrap_or(0);
        let belongs = is_user_pointer(senior) && process.read_u64(senior + layout.team.club).ok() == Some(club);
        let reputation = process
            .read_bytes(senior + layout.team.reputation, 2)
            .is_ok_and(|rep| u16::from_le_bytes([rep[0], rep[1]]) <= 10_000);
        tally.add(belongs && reputation);
    }
    tally.result(Check::Clubs, 0.95, String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn samples_spread_over_the_array() {
        assert_eq!(sample(5).collect::<Vec<_>>(), [0, 1, 2, 3, 4]);
        let picked: Vec<u64> = sample(10_000).collect();
        assert_eq!(picked.len(), SAMPLES as usize);
        assert_eq!((picked[0], picked[1], picked[SAMPLES as usize - 1]), (0, 5, 9_995));
        assert_eq!(sample(0).count(), 0);
    }

    #[test]
    fn a_check_needs_enough_objects() {
        let tally = |fit, sampled| Tally { fit, sampled };
        assert!(tally(97, 100).holds(0.97));
        assert!(!tally(96, 100).holds(0.97));
        assert!(!tally(10, 10).holds(0.5));
        assert!(tally(LEAST_SAMPLED, LEAST_SAMPLED).holds(1.0));
    }

    fn date(year: u16, month: u8, day: u8) -> FmDate {
        FmDate { year, month, day }
    }

    /// Contracts signed over the year before `today`, as on the test save, and 60 current injuries begun over the six
    /// weeks before it, with a few days to three weeks still to go.
    fn evidence_on(today: FmDate) -> DateEvidence {
        let signed = (0..300).map(|k| today.plus_days(-k)).collect();
        let injuries = (0..60)
            .map(|k| {
                let began = today.plus_days(-(k % 42));
                (began, today.plus_days(1 + k % 20))
            })
            .collect();
        DateEvidence { signed, injuries }
    }

    #[test]
    fn the_date_must_come_after_the_contracts() {
        let today = date(2026, 9, 9);
        let evidence = evidence_on(today);
        assert!(evidence.fit(today).contracts_hold());
        // A date from before most contracts, and one long after the last.
        assert!(!evidence.fit(date(2026, 7, 1)).contracts_hold());
        assert!(!evidence.fit(date(2031, 1, 1)).contracts_hold());
        // A few contracts dated after it are tolerated, many are not.
        let mut early = evidence.clone();
        early.signed.extend((1..=3).map(|k| today.plus_days(k)));
        assert!(early.fit(today).contracts_hold());
        early.signed.extend((1..=10).map(|k| today.plus_days(k)));
        assert!(!early.fit(today).contracts_hold());
        // Too few contracts tell nothing.
        let few = DateEvidence { signed: evidence.signed[..10].to_vec(), ..evidence.clone() };
        assert!(!few.fit(today).contracts_hold());
    }

    #[test]
    fn the_date_must_fall_within_the_current_injuries() {
        let today = date(2027, 8, 13);
        let evidence = evidence_on(today);
        assert_eq!(evidence.fit(today).injuries_hold(), Some(true));
        // Contracts cannot tell a date some weeks off: the latest before it is less than a year earlier, and nearly
        // none come after it. The injuries can: begun since, or over by then.
        for days in [-19, -6, 19, 200] {
            let fit = evidence.fit(today.plus_days(days));
            assert_eq!(fit.injuries_hold(), Some(false), "{days} days off");
            assert!(!fit.holds_strictly(), "{days} days off");
        }
        assert!(evidence.fit(today.plus_days(200)).contracts_hold());
        // Too few injuries tell nothing: where the build puts the date, the contracts are enough; a date found by
        // searching needs both.
        let few = DateEvidence { injuries: evidence.injuries[..10].to_vec(), ..evidence.clone() };
        assert_eq!(few.fit(today).injuries_hold(), None);
        assert!(few.fit(today).holds() && !few.fit(today).holds_strictly());
    }

    /// As [`evidence_on`] the day before `today`, with every injury a day longer: no contract was signed and no injury
    /// began on `today`, so the day before fits as well as the date.
    fn quiet_day(today: FmDate) -> DateEvidence {
        let mut evidence = evidence_on(today.plus_days(-1));
        evidence.injuries.iter_mut().for_each(|(_, back)| *back = back.plus_days(1));
        evidence
    }

    #[test]
    fn a_searched_date_must_be_the_one_that_fits() {
        let today = date(2027, 8, 13);
        let evidence = evidence_on(today);
        let place = |rva, date, found| DatePlace { rva, date, found };
        // As on the Steam test save: the date's own variable, the field beside the arrays, the database's timestamp
        // and two dates the game keeps for later.
        let candidates = [
            place(0x56C_C45C, date(2030, 10, 21), Found::Searched),
            place(0x570_6018, today, Found::BesideArrays),
            place(0x56A_F378, today, Found::Searched),
            place(0x570_5E08, today.plus_days(-19), Found::Searched),
            place(0x56B_B968, date(2029, 1, 1), Found::Searched),
        ];
        let picked = |candidates: &[DatePlace]| pick_date(candidates, &evidence).map(|(place, _)| place);
        assert_eq!(picked(&candidates), Ok(candidates[2]));
        // The field beside the arrays alone, as right after a load it would not be.
        assert_eq!(picked(&candidates[..2]), Ok(candidates[1]));
        // A second date that fits leaves the editor without one when nothing tells them apart: a date the day after,
        // which every contract and injury fits as well, and which is later than the field beside the arrays.
        let mut later = candidates.to_vec();
        later.push(place(0x100, today.plus_days(1), Found::Searched));
        assert!(picked(&later).is_err());
        // The day before is told apart by the field beside the arrays, and without it by the contract signed and the
        // injuries begun on the day.
        let mut before = candidates.to_vec();
        before.push(place(0x200, today.plus_days(-1), Found::Searched));
        assert_eq!(picked(&before), Ok(candidates[2]));
        let without_beside: Vec<DatePlace> =
            before.iter().copied().filter(|p| p.found != Found::BesideArrays).collect();
        assert_eq!(picked(&without_beside), Ok(candidates[2]));
        // A date the injuries cannot vouch for leaves the editor without one too.
        let few = DateEvidence { injuries: evidence.injuries[..10].to_vec(), ..evidence.clone() };
        assert!(pick_date(&candidates, &few).is_err());
        assert!(pick_date(&[], &evidence).is_err());
    }

    #[test]
    fn the_field_beside_the_arrays_tells_the_date_from_the_day_before() {
        // As on the Game Pass save of 23 September 2026: on a day on which no contract was signed and no injury began,
        // the day before fits the evidence as well as the date.
        let today = date(2026, 9, 23);
        let evidence = quiet_day(today);
        assert!(evidence.fit(today).holds_strictly() && evidence.fit(today.plus_days(-1)).holds_strictly());
        assert!(!evidence.fit(today).beats(&evidence.fit(today.plus_days(-1))));
        let place = |rva, date, found| DatePlace { rva, date, found };
        let candidates = [
            place(0x562_57C8, today, Found::Searched),
            place(0x565_46F8, today.plus_days(-1), Found::Searched),
            place(0x568_4608, today, Found::BesideArrays),
            place(0x564_28C4, date(2026, 10, 25), Found::Searched),
        ];
        let (picked, note) = pick_date(&candidates, &evidence).expect("a date");
        // Read from the date's own variable, not the field, which a load leaves unset.
        assert_eq!(picked, candidates[0]);
        assert!(note.is_some_and(|note| note.contains("2026-09-22, 2026-09-23")));
        // Right after a load the field holds no date, and nothing tells the two apart.
        let loaded = [candidates[0], candidates[1], candidates[3]];
        let refused = pick_date(&loaded, &evidence).expect_err("no date");
        assert!(refused.contains("holds none of them"), "{refused}");
        // A field that held the day before would not be followed either.
        let behind = [candidates[0], place(0x568_4608, today.plus_days(-1), Found::BesideArrays)];
        assert!(pick_date(&behind, &evidence).is_err());
    }

    #[test]
    fn where_other_builds_keep_the_date_tells_it_from_the_day_before() {
        // As on Game Pass 0.9.2435.0, where the field beside the arrays held no date after a day in the game, on a day
        // on which no contract was signed and no injury began.
        let today = date(2028, 1, 11);
        let evidence = quiet_day(today);
        let place = |rva, date, found| DatePlace { rva, date, found };
        let candidates = [
            place(0x535_97C8, today, Found::Guessed),
            place(0x538_86F8, today.plus_days(-1), Found::Searched),
            place(0x535_9E40, date(2027, 12, 1), Found::Guessed),
        ];
        let (picked, note) = pick_date(&candidates, &evidence).expect("a date");
        assert_eq!(picked, candidates[0]);
        assert!(note.is_some_and(|note| note.contains("as other builds keep the date")));
        // Read where the guess put it rather than anywhere else that holds the date.
        let elsewhere = [place(0x100, today, Found::Searched), candidates[0], candidates[1]];
        assert_eq!(pick_date(&elsewhere, &evidence).map(|(place, _)| place), Ok(candidates[0]));
        // Two dates near where other builds keep it tell nothing.
        let both = [candidates[0], place(0x535_97D0, today.plus_days(-1), Found::Guessed)];
        let refused = pick_date(&both, &evidence).expect_err("no date");
        assert!(refused.contains("2 are read where other builds keep the date"), "{refused}");
    }

    #[test]
    fn the_date_fits_better_than_the_day_before() {
        // As on Game Pass 0.9.2435.0 on 11 January 2028, with no profile: contracts were signed and injuries began on
        // the day, so the day before fitted less well, but still well enough; the field beside the arrays held no date.
        let today = date(2028, 1, 11);
        let evidence = evidence_on(today);
        let (on_the_day, the_day_before) = (evidence.fit(today), evidence.fit(today.plus_days(-1)));
        assert!(on_the_day.holds_strictly() && the_day_before.holds_strictly());
        assert!(on_the_day.beats(&the_day_before));
        assert!(!the_day_before.beats(&on_the_day) && !on_the_day.beats(&on_the_day));
        let place = |rva, date, found| DatePlace { rva, date, found };
        let candidates =
            [place(0x538_86F8, today.plus_days(-1), Found::Searched), place(0x535_97C8, today, Found::Searched)];
        let (picked, note) = pick_date(&candidates, &evidence).expect("a date");
        assert_eq!(picked, candidates[1]);
        assert!(note.is_some_and(|note| note.contains("better than any other")));
        // Where each fits better on one count, neither is used: a contract signed on the day, and an injury still
        // listed though over the day before.
        let mut torn = quiet_day(today);
        torn.signed.push(today);
        torn.injuries.push((today.plus_days(-10), today.plus_days(-1)));
        let (on_the_day, the_day_before) = (torn.fit(today), torn.fit(today.plus_days(-1)));
        assert!(on_the_day.holds_strictly() && the_day_before.holds_strictly());
        assert!(!on_the_day.beats(&the_day_before) && !the_day_before.beats(&on_the_day));
        let refused = pick_date(&candidates, &torn).expect_err("no date");
        assert!(refused.contains("none fits better than every other"), "{refused}");
    }

    #[test]
    fn live_values_check_out_after_a_youth_intake() {
        let passes = |values: &[(u16, i16, u16, u8)]| {
            let mut live = LiveTally::default();
            for &(sharpness, jadedness, condition, morale) in values {
                live.add(sharpness, jadedness, condition, morale);
            }
            live.result().passed
        };
        // Before the youth intake: no one below 35% sharpness, nearly all fresh, a third rested.
        let season: Vec<_> =
            (0..300).map(|k| (3_500 + k * 20, if k % 3 == 0 { -500 } else { 90 }, 9_000 + k, 12)).collect();
        assert!(passes(&season));
        // After it, one in fourteen below 35%, as on the test save on 2 July 2027.
        let intake: Vec<_> = season
            .iter()
            .enumerate()
            .map(|(k, &(sharpness, jadedness, condition, morale))| {
                (if k % 14 == 0 { 3_000 } else { sharpness }, jadedness, condition, morale)
            })
            .collect();
        assert!(passes(&intake));
        // Read from the wrong place: no one rested where some are below 35% sharpness, or no one fresh.
        let restless: Vec<_> =
            intake.iter().map(|&(sharpness, _, condition, morale)| (sharpness, 90, condition, morale)).collect();
        assert!(!passes(&restless));
        let tired: Vec<_> =
            season.iter().map(|&(sharpness, jadedness, _, morale)| (sharpness, jadedness, 150, morale)).collect();
        assert!(!passes(&tired));
    }

    #[test]
    fn fields_map_to_their_checks() {
        let layout = crate::profile::layout_for(27).expect("FM27 layout");
        let check = |entity, key: &str| {
            let field = crate::edit::fields(&layout, entity).into_iter().find(|f| f.key == key).expect(key);
            Check::of_field(&field)
        };
        assert_eq!(check(Entity::Player, "attribute.finishing"), Check::Attributes);
        assert_eq!(check(Entity::Player, "position.st"), Check::Positions);
        assert_eq!(check(Entity::Player, "personality.ambition"), Check::Personality);
        assert_eq!(check(Entity::Player, "contract.wage"), Check::Contracts);
        assert_eq!(check(Entity::Player, "morale"), Check::LiveValues);
        assert_eq!(check(Entity::Player, "current_ability"), Check::Abilities);
        assert_eq!(check(Entity::Player, "potential_ability"), Check::Abilities);
        assert_eq!(check(Entity::Player, "date_of_birth"), Check::Players);
        assert_eq!(check(Entity::Player, "trait.49"), Check::Players);
        assert_eq!(check(Entity::Staff, "contract.wage"), Check::Staff);
        assert_eq!(check(Entity::Club, "finance.balance"), Check::Clubs);
    }
}
