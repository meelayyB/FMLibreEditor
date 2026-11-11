use std::fmt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, PoisonError};

use fmlibre_mem::{Module, Process, find_processes, is_user_pointer, list_modules};

use crate::calibrate::{EntityArrays, calibrate, find_missing};
use crate::clubs::{ClubDetails, ClubSummary, full_finance_class, read_club_details, read_clubs, stadium_class};
use crate::coded::Coded;
use crate::date::FmDate;
use crate::details::{PlayerDetails, read_player_details};
use crate::edit::Field;
use crate::game::{GAME_EXE, GAME_PLUGIN, GameInfo};
use crate::health::{Check, Health, Lock, STRUCTURE};
use crate::locate::{DatePlace, Found, Place, find_game_ui, find_retirement_manager, game_date_from};
use crate::players::{PlayerSummary, read_players};
use crate::profile::{BuildProfile, Layout, PluginFingerprint, layout_for, profile_for};
use crate::retirement::MANAGER_CLASS;
use crate::rtti::{class_of, mangled};
use crate::staff::{StaffDetails, StaffSummary, read_staff, read_staff_details};

/// The environment variable that has the editor treat every build as one it has no profile for, e.g. `1`: to
/// rehearse an update of the game on a build it knows. It only takes away; nothing is written that would not be
/// written to a new build.
pub const IGNORE_PROFILES: &str = "FMLIBRE_IGNORE_PROFILES";

/// Whether [`IGNORE_PROFILES`] is set to anything but `0`.
pub fn profiles_ignored() -> bool {
    std::env::var_os(IGNORE_PROFILES).is_some_and(|value| !value.is_empty() && value != "0")
}

#[derive(Debug)]
pub enum SessionError {
    NotRunning,
    NoSuchProcess(u32),
    SeveralRunning(Vec<u32>),
    Memory(fmlibre_mem::Error),
    PluginNotLoaded,
    UnsupportedEdition(Option<u32>),
    PlayersNotFound,
}

impl fmt::Display for SessionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SessionError::NotRunning => {
                write!(f, "{GAME_EXE} is not running. Start Football Manager 27, load a save and try again.")
            }
            SessionError::NoSuchProcess(pid) => write!(f, "no {GAME_EXE} with pid {pid}"),
            SessionError::SeveralRunning(pids) => {
                let pids: Vec<String> = pids.iter().map(u32::to_string).collect();
                write!(f, "{} copies of {GAME_EXE} are running (pids {}); choose one", pids.len(), pids.join(", "))
            }
            SessionError::Memory(err) => write!(f, "{err}"),
            SessionError::PluginNotLoaded => {
                write!(f, "{GAME_PLUGIN} is not loaded yet; wait for the main menu and try again")
            }
            SessionError::UnsupportedEdition(Some(edition)) => write!(f, "FM{edition} is not supported yet"),
            SessionError::UnsupportedEdition(None) => write!(f, "could not tell which Football Manager this is"),
            SessionError::PlayersNotFound => {
                write!(f, "could not find the player list; load a save (not just the main menu) and try again")
            }
        }
    }
}

impl std::error::Error for SessionError {}

impl Coded for SessionError {
    fn code(&self) -> &'static str {
        match self {
            SessionError::NotRunning => "session.notRunning",
            SessionError::NoSuchProcess(_) => "session.noSuchProcess",
            SessionError::SeveralRunning(_) => "session.severalRunning",
            SessionError::Memory(err) => err.code(),
            SessionError::PluginNotLoaded => "session.pluginNotLoaded",
            SessionError::UnsupportedEdition(Some(_)) => "session.unsupportedEdition",
            SessionError::UnsupportedEdition(None) => "session.unknownEdition",
            SessionError::PlayersNotFound => "session.playersNotFound",
        }
    }

    fn params(&self) -> Vec<(&'static str, String)> {
        match self {
            SessionError::NoSuchProcess(pid) => vec![("pid", pid.to_string()), ("exe", GAME_EXE.to_owned())],
            SessionError::SeveralRunning(pids) => {
                let pids: Vec<String> = pids.iter().map(u32::to_string).collect();
                vec![("count", pids.len().to_string()), ("pids", pids.join(", ")), ("exe", GAME_EXE.to_owned())]
            }
            SessionError::Memory(err) => err.params(),
            SessionError::UnsupportedEdition(Some(edition)) => vec![("edition", edition.to_string())],
            _ => Vec::new(),
        }
    }
}

impl From<fmlibre_mem::Error> for SessionError {
    fn from(err: fmlibre_mem::Error) -> Self {
        SessionError::Memory(err)
    }
}

/// Picks the game process: the one with `pid`, or the only `fm.exe` running.
pub fn find_game(pid: Option<u32>) -> Result<u32, SessionError> {
    let running: Vec<u32> = find_processes(GAME_EXE)?.into_iter().map(|p| p.pid).collect();
    match (pid, running.as_slice()) {
        (Some(pid), _) if running.contains(&pid) => Ok(pid),
        (Some(pid), _) => Err(SessionError::NoSuchProcess(pid)),
        (None, []) => Err(SessionError::NotRunning),
        (None, [only]) => Ok(*only),
        (None, _) => Err(SessionError::SeveralRunning(running)),
    }
}

/// How [`Session::connect`] locates the game's data.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArraySource {
    /// Use the build profile's places when they check out, and look for the rest.
    ProfileFirst,
    /// Look for everything as for a build without a profile: scan for the entity arrays, and search for the in-game
    /// date and the retirement manager. The profile still says whether the build is known.
    ScanOnly,
}

/// What the game had loaded when the editor last read it (see [`Session::save_changed`]).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct SaveMark {
    /// How many saves the game had loaded since it started; none while the editor cannot read the count.
    loads: Option<u64>,
    /// Whether the game has loaded a save since, or been seen with none loaded: at its main menu, its lists empty.
    changed: bool,
}

impl SaveMark {
    /// The mark once the game was seen with `loads` saves loaded and its players' list `empty` or not, each `None`
    /// where it could not be read, which tells nothing. A count first read now is taken as the one the editor read.
    fn seen(self, loads: Option<u64>, empty: Option<bool>) -> SaveMark {
        let loaded = matches!((self.loads, loads), (Some(then), Some(now)) if now != then);
        SaveMark { loads: self.loads.or(loads), changed: self.changed || loaded || empty == Some(true) }
    }
}

/// While it lives, writes leave out the check that the game still has the save the editor read: see
/// [`Session::vouch_for_save`].
pub struct SaveVouched<'a>(&'a Session);

impl Drop for SaveVouched<'_> {
    fn drop(&mut self) {
        self.0.save_vouched.store(false, Ordering::Relaxed);
    }
}

/// A game process with its data located and ready to read.
pub struct Session {
    pub process: Process,
    pub game: GameInfo,
    pub plugin: Module,
    pub fingerprint: PluginFingerprint,
    /// The built-in profile of this build, when there is one.
    pub profile: Option<BuildProfile>,
    pub layout: Layout,
    pub arrays: EntityArrays,
    /// The class of the full club finance record, found the first time it is needed.
    finance_class: OnceLock<Option<u64>>,
    /// The class of stadiums, found the first time it is needed.
    stadium_class: OnceLock<Option<u64>>,
    /// The vtable of the retirement manager, once its class name has been checked.
    retirement_class: OnceLock<u64>,
    /// Where the static pointer to the retirement manager is, once looked for: kept when found, and looked for again
    /// after [`Session::recheck`] when it was not.
    retirement_place: Mutex<Option<Option<Place>>>,
    /// The vtable of the game's own object ([`crate::profile::GameLayout`]), once its class name has been checked.
    game_class: OnceLock<u64>,
    /// Where the static pointer to the game's own object is, once looked for: kept when found, and looked for again
    /// after [`Session::recheck`] when it was not.
    game_place: Mutex<Option<Option<Place>>>,
    /// What the game had loaded when the editor last read it (see [`Session::save_changed`]).
    save_mark: Mutex<SaveMark>,
    /// Whether the writes made now were vouched for by their caller (see [`Session::vouch_for_save`]).
    save_vouched: AtomicBool,
    /// The vtables of the class that holds a human manager's selections, found by its name the first time they are
    /// needed: none when the layout does not place them or the game does not name that class.
    pub(crate) selection_class: OnceLock<Vec<u64>>,
    /// The vtables of loan contracts, found by their class name the first time they are needed: none when the layout
    /// does not place loans or the game does not name that class.
    pub(crate) loan_class: OnceLock<Vec<u64>>,
    /// The memory the editor took in the game (see `own_memory.rs`): the region, its length and how much of it is
    /// handed out.
    pub(crate) own_memory: Mutex<Option<(u64, u64, u64)>>,
    /// Where the game's pools of objects were found that the editor took a slot of, or looked for one in (see
    /// `object_pool.rs`).
    pub(crate) pools_found: Mutex<Vec<u64>>,
    /// What the checks found: worked out the first time it is needed, and again by [`Session::recheck`].
    health: Mutex<Option<Arc<Health>>>,
    /// Whether editing a build without a profile was allowed.
    unknown_build_allowed: AtomicBool,
    /// Whether the places the profile names are passed over, as for a build without one ([`ArraySource::ScanOnly`]).
    search_all: bool,
}

impl Session {
    /// Identifies the build behind `process` and locates its entity arrays. Only reads memory.
    pub fn connect(process: Process, source: ArraySource) -> Result<Self, SessionError> {
        let game = GameInfo::inspect(&process)?;
        let plugin = list_modules(&process)?
            .into_iter()
            .find(|m| m.name.eq_ignore_ascii_case(GAME_PLUGIN))
            .ok_or(SessionError::PluginNotLoaded)?;
        let fingerprint = PluginFingerprint::read(&process, &plugin)?;
        let profile = if profiles_ignored() { None } else { profile_for(fingerprint) };
        let edition = profile.as_ref().map(|p| p.edition).or(game.edition);
        let layout = edition.and_then(layout_for).ok_or(SessionError::UnsupportedEdition(edition))?;
        let hint = profile.as_ref().filter(|_| source == ArraySource::ProfileFirst).map(|p| &p.arrays);
        let player_pointer_bias = profile.as_ref().and_then(|p| p.player_pointer_bias).unwrap_or(0);
        let arrays = calibrate(&process, &plugin, &layout, hint, player_pointer_bias);
        if arrays.players.is_none() {
            return Err(SessionError::PlayersNotFound);
        }
        let session = Self {
            process,
            game,
            plugin,
            fingerprint,
            profile,
            layout,
            arrays,
            finance_class: OnceLock::new(),
            stadium_class: OnceLock::new(),
            retirement_class: OnceLock::new(),
            retirement_place: Mutex::new(None),
            game_class: OnceLock::new(),
            game_place: Mutex::new(None),
            save_mark: Mutex::new(SaveMark::default()),
            save_vouched: AtomicBool::new(false),
            selection_class: OnceLock::new(),
            loan_class: OnceLock::new(),
            own_memory: Mutex::new(None),
            pools_found: Mutex::new(Vec::new()),
            health: Mutex::new(None),
            unknown_build_allowed: AtomicBool::new(false),
            search_all: source == ArraySource::ScanOnly,
        };
        session.mark_read();
        Ok(session)
    }

    /// Whether the editor has a profile for this build of the game: one it has been checked with.
    pub fn known_build(&self) -> bool {
        self.profile.is_some()
    }

    /// Lets the editor write to a build it has no profile for, as far as the checks allow.
    pub fn allow_unknown_build(&self) {
        self.unknown_build_allowed.store(true, Ordering::Relaxed);
    }

    /// Whether the editor writes to this game at all: a known build, or an unknown one it was allowed to edit.
    pub fn writes_allowed(&self) -> bool {
        self.known_build() || self.unknown_build_allowed.load(Ordering::Relaxed)
    }

    /// What the checks found on this game, worked out the first time it is asked for.
    pub fn health(&self) -> Arc<Health> {
        let mut health = self.health.lock().unwrap_or_else(PoisonError::into_inner);
        health.get_or_insert_with(|| Arc::new(crate::health::check(self))).clone()
    }

    /// Runs the checks again, e.g. once the game has moved on or a save has been loaded meanwhile, and takes what the
    /// game has loaded now as what the editor reads (see [`Session::save_changed`]): the lists are to be read again
    /// after it. A retirement manager or a game object that was not found is looked for again.
    pub fn recheck(&self) -> Arc<Health> {
        for place in [&self.retirement_place, &self.game_place] {
            let mut place = place.lock().unwrap_or_else(PoisonError::into_inner);
            if *place == Some(None) {
                *place = None;
            }
        }
        self.mark_read();
        let fresh = Arc::new(crate::health::check(self));
        *self.health.lock().unwrap_or_else(PoisonError::into_inner) = Some(fresh.clone());
        fresh
    }

    /// Looks again for the entity arrays not found when the editor connected, e.g. the staff while a save was still
    /// loading: in the places the build profile gives, then by scanning. What was worked out from the clubs is worked
    /// out afresh once they are found. Returns whether an array was found. Only reads memory.
    pub fn find_missing_arrays(&mut self) -> bool {
        let had_clubs = self.arrays.clubs.is_some();
        let hint = self.profile.as_ref().filter(|_| !self.search_all).map(|profile| &profile.arrays);
        let found = find_missing(&self.process, &self.plugin, &self.layout, hint, &mut self.arrays);
        if !had_clubs && self.arrays.clubs.is_some() {
            self.finance_class = OnceLock::new();
            self.stadium_class = OnceLock::new();
        }
        found
    }

    /// Why `field` may not be written now, if it may not: an unknown build not allowed, another save than the one the
    /// editor read, or its check failed.
    pub fn field_lock(&self, field: &Field) -> Option<Lock> {
        if !self.writes_allowed() {
            return Some(Lock::UnknownBuild);
        }
        if let Some(lock) = self.save_lock() {
            return Some(lock);
        }
        let check = Check::of_field(field);
        (!self.health().passed(check)).then_some(Lock::Failed(check))
    }

    /// Why a player's cohesion with his club may not be written now, if it may not: an unknown build not allowed, or the
    /// lists of cohesion entries did not check out ([`Check::Cohesion`]). Writing it also needs what
    /// [`Session::structure_lock`] asks.
    pub fn cohesion_lock(&self) -> Option<Lock> {
        if !self.writes_allowed() {
            return Some(Lock::UnknownBuild);
        }
        (!self.health().passed(Check::Cohesion)).then_some(Lock::Failed(Check::Cohesion))
    }

    /// Why a change to the game's lists and records (a move, a heal, a captaincy, ...) may not be written now, if it
    /// may not.
    pub fn structure_lock(&self) -> Option<Lock> {
        if !self.writes_allowed() {
            return Some(Lock::UnknownBuild);
        }
        if let Some(lock) = self.save_lock() {
            return Some(lock);
        }
        let health = self.health();
        STRUCTURE.into_iter().find(|&check| !health.passed(check)).map(Lock::Failed)
    }

    /// [`Lock::SaveChanged`] while the game may have another save than the one the editor read, unless the writes
    /// were vouched for ([`Session::vouch_for_save`]).
    fn save_lock(&self) -> Option<Lock> {
        let vouched = self.save_vouched.load(Ordering::Relaxed);
        (!vouched && self.save_changed()).then_some(Lock::SaveChanged)
    }

    /// Whether the game has loaded a save, or been seen with none loaded (at its main menu, its lists empty), since
    /// the editor read it: since it connected, or last ran [`Session::recheck`]. What the editor read then may belong
    /// to another save, even where the lists and objects are where they were, so it writes nothing meanwhile
    /// ([`Lock::SaveChanged`]); once this is so, it stays so until the next `recheck`. The game's count of the saves
    /// it has loaded ([`Session::loads`]) tells a load from a save, which leaves the count as it is; where the editor
    /// cannot read the count, only the empty lists of the main menu tell, as a new game does not change the count.
    pub fn save_changed(&self) -> bool {
        let loads = self.loads();
        let players = self.arrays.players.as_ref();
        let empty = players.and_then(|array| array.locate(&self.process, &self.plugin).ok()).map(|(_, n)| n == 0);
        let mut mark = self.save_mark.lock().unwrap_or_else(PoisonError::into_inner);
        *mark = mark.seen(loads, empty);
        mark.changed
    }

    /// Takes what the game has loaded now as what the editor read: on connecting, and by [`Session::recheck`].
    fn mark_read(&self) {
        let mark = SaveMark { loads: self.loads(), changed: false };
        *self.save_mark.lock().unwrap_or_else(PoisonError::into_inner) = mark;
    }

    /// Has the writes made while what it returns lives leave out the check that the game still has the save the
    /// editor read ([`Lock::SaveChanged`]): for writes worked out from what the game holds now, once their caller has
    /// made sure itself that the game has a save it may write them to. The app gives a stadium renamed in the editor
    /// its name again that way when the game has loaded a save of the same career, whose clubs it has read again.
    #[must_use = "the check is back as soon as what this returns is dropped"]
    pub fn vouch_for_save(&self) -> SaveVouched<'_> {
        self.save_vouched.store(true, Ordering::Relaxed);
        SaveVouched(self)
    }

    /// How many saves the game has loaded since it started, read now from its own object
    /// ([`crate::profile::GameLayout`]); `None` where the layout does not place the count, the static pointer to the
    /// object is not found, or what it points at now is not of the object's class.
    pub fn loads(&self) -> Option<u64> {
        let game = self.layout.game.as_ref()?;
        let place = self.game_place()?;
        let object = self.process.read_u64(self.plugin.base + place.rva).ok()?;
        if !is_user_pointer(object) || !self.is_game_ui(object) {
            return None;
        }
        self.process.read_u64(object + game.loads).ok()
    }

    /// Where the build profile puts the static pointer to the game's own object, unless every place is searched for.
    pub(crate) fn placed_game_ui(&self) -> Option<u64> {
        self.profile.as_ref().filter(|_| !self.search_all)?.game_ui
    }

    /// Where the static pointer to the game's own object is, and how it was found: looked for the first time it is
    /// needed (see [`crate::locate`]). `None` when it cannot be found in this build.
    pub fn game_place(&self) -> Option<Place> {
        let mut place = self.game_place.lock().unwrap_or_else(PoisonError::into_inner);
        *place.get_or_insert_with(|| find_game_ui(self))
    }

    /// Whether `object` is the game's own object, by the name of its class.
    pub(crate) fn is_game_ui(&self, object: u64) -> bool {
        let (Some(game), Ok(vtable)) = (self.layout.game.as_ref(), self.process.read_u64(object)) else {
            return false;
        };
        if self.game_class.get() == Some(&vtable) {
            return true;
        }
        if class_of(&self.process, &self.plugin, object).is_none_or(|class| class != mangled(&game.class)) {
            return false;
        }
        let _ = self.game_class.set(vtable);
        true
    }

    /// The class (vtable) of stadiums, the only objects a stadium field is written to; `None` when it cannot be told.
    pub fn stadium_class(&self) -> Option<u64> {
        *self.stadium_class.get_or_init(|| {
            let array = self.arrays.clubs.as_ref()?;
            stadium_class(&self.process, &self.plugin, array, &self.layout)
        })
    }

    /// The class (vtable) of the full club finance record, the only one the budgets can be
    /// written to; `None` when it cannot be told apart.
    pub fn finance_class(&self) -> Option<u64> {
        *self.finance_class.get_or_init(|| {
            let array = self.arrays.clubs.as_ref()?;
            full_finance_class(&self.process, &self.plugin, array, &self.layout)
        })
    }

    /// The current in-game date, read now where the checks found it (see [`Check::GameDate`]); `None` rather than a
    /// date read from the wrong place.
    pub fn game_date(&self) -> Option<FmDate> {
        self.read_date_at(self.health().date?.rva)
    }

    /// Where the checks found the in-game date, and the date it read then.
    pub fn date_place(&self) -> Option<DatePlace> {
        self.health().date
    }

    /// Where the build places the in-game date: its profile's variable, or for a profile without one the field beside
    /// the arrays. `None` for a build without a profile, or when every place is searched for.
    pub(crate) fn placed_date(&self) -> Option<(u64, Found)> {
        let profile = self.profile.as_ref().filter(|_| !self.search_all)?;
        match profile.current_date {
            Some(rva) => Some((rva, Found::Profile)),
            None => {
                Some((self.arrays.players.as_ref()?.pair_rva + self.layout.cluster.current_date, Found::BesideArrays))
            }
        }
    }

    /// The date at `rva` in the plugin, when it is one the game could be on.
    pub(crate) fn read_date_at(&self, rva: u64) -> Option<FmDate> {
        game_date_from(self.process.read_u32(self.plugin.base + rva).ok()?)
    }

    /// Where the build profile puts the static pointer to the retirement manager, unless every place is searched for.
    pub(crate) fn placed_retirement_manager(&self) -> Option<u64> {
        self.profile.as_ref().filter(|_| !self.search_all)?.retirement_manager
    }

    /// Where the static pointer to the retirement manager is, and how it was found: looked for the first time it is
    /// needed (see [`crate::locate`]). `None` when it cannot be found in this build.
    pub fn retirement_place(&self) -> Option<Place> {
        let mut place = self.retirement_place.lock().unwrap_or_else(PoisonError::into_inner);
        *place.get_or_insert_with(|| find_retirement_manager(self))
    }

    /// Whether `object` is the retirement manager, by the name of its class.
    pub(crate) fn is_retirement_manager(&self, object: u64) -> bool {
        let Ok(vtable) = self.process.read_u64(object) else {
            return false;
        };
        if self.retirement_class.get() == Some(&vtable) {
            return true;
        }
        if class_of(&self.process, &self.plugin, object).is_none_or(|class| class != mangled(MANAGER_CLASS)) {
            return false;
        }
        let _ = self.retirement_class.set(vtable);
        true
    }

    /// Reads every player, with ages on the current in-game date. Only reads memory.
    pub fn players(&self) -> Result<Vec<PlayerSummary>, SessionError> {
        let array = self.arrays.players.as_ref().ok_or(SessionError::PlayersNotFound)?;
        Ok(read_players(&self.process, &self.plugin, array, &self.layout, self.game_date())?)
    }

    /// Reads every club. Only reads memory.
    pub fn clubs(&self) -> Result<Vec<ClubSummary>, SessionError> {
        let Some(array) = self.arrays.clubs.as_ref() else {
            return Ok(Vec::new());
        };
        Ok(read_clubs(&self.process, &self.plugin, array, &self.layout)?)
    }

    /// Reads the full profile of `club`; `None` when its object has changed. Only reads memory.
    pub fn club_details(&self, club: &ClubSummary) -> Result<Option<ClubDetails>, SessionError> {
        Ok(read_club_details(&self.process, &self.layout, club)?)
    }

    /// Reads every member of staff, with ages on the current in-game date. Only reads memory.
    pub fn staff(&self) -> Result<Vec<StaffSummary>, SessionError> {
        let Some(array) = self.arrays.staff.as_ref() else {
            return Ok(Vec::new());
        };
        Ok(read_staff(&self.process, &self.plugin, array, &self.layout, self.game_date())?)
    }

    /// Reads the full profile of `member`; `None` when its object has changed. Only reads memory.
    pub fn staff_details(&self, member: &StaffSummary) -> Result<Option<StaffDetails>, SessionError> {
        Ok(read_staff_details(&self.process, &self.layout, member)?)
    }

    /// Reads the full profile of `player`; `None` when its object has changed since the
    /// players were read. Only reads memory.
    pub fn player_details(&self, player: &PlayerSummary) -> Result<Option<PlayerDetails>, SessionError> {
        let Some(mut details) = read_player_details(&self.process, &self.layout, player)? else {
            return Ok(None);
        };
        // A list the editor does not make sense of leaves the profile without injuries.
        details.injuries = self.injuries(player).unwrap_or_default();
        details.bans = self.bans(player).unwrap_or_default();
        details.ties = self.relations(player).unwrap_or_default();
        details.tie_room = self.relation_room(player).unwrap_or(0);
        details.ties_grow = self.relations_grow(player);
        details.clause_room = self.clause_room(player).unwrap_or(0);
        details.loan = self.loan(player).unwrap_or(None);
        if let Ok(date) = self.planned_retirement(player) {
            (details.retirement_known, details.retires) = (true, date);
        }
        Ok(Some(details))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_load_or_the_main_menu_changes_the_save_until_it_is_read_again() {
        let read = SaveMark { loads: Some(2), changed: false };
        // A save, or a day played: the count stays, and so do the players.
        assert_eq!(read.seen(Some(2), Some(false)), read);
        // What could not be read tells nothing.
        assert_eq!(read.seen(None, None), read);
        // A load raises the count; the main menu empties the lists. Either stays told, whatever is seen after it: a
        // save loaded from the main menu, or a new game started there, which leaves the count as it was.
        let loaded = read.seen(Some(3), Some(false));
        assert!(loaded.changed);
        assert!(loaded.seen(Some(2), Some(false)).changed);
        let menu = read.seen(Some(2), Some(true));
        assert!(menu.changed);
        assert!(menu.seen(Some(2), Some(false)).changed);
        // Where the count cannot be read (macOS, for now), the main menu still tells.
        let uncounted = SaveMark { loads: None, changed: false };
        assert!(!uncounted.seen(None, Some(false)).changed);
        assert!(uncounted.seen(None, Some(true)).changed);
        // A count the editor could not read when it read the lists is the first it reads.
        let first = uncounted.seen(Some(4), Some(false));
        assert_eq!(first, SaveMark { loads: Some(4), changed: false });
        assert!(first.seen(Some(5), Some(false)).changed);
    }
}
