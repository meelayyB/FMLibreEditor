use std::collections::BTreeMap;
use std::fmt;

use fmlibre_mem::{Module, Process};
use serde::{Deserialize, Deserializer};

use crate::game::Storefront;

/// Field offsets inside FM's objects for one edition. They are shared by every
/// storefront build of the same game version, unlike the RVAs in [`BuildProfile`].
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Layout {
    pub edition: u32,
    pub player: PlayerLayout,
    pub contract: ContractLayout,
    pub cluster: ClusterLayout,
    pub staff: StaffLayout,
    pub team: TeamLayout,
    pub club: ClubLayout,
    pub club_info: ClubInfoLayout,
    pub club_finance: ClubFinanceLayout,
    pub nation: NationLayout,
    pub injury: InjuryLayout,
    pub ban: BanLayout,
    pub relation: RelationLayout,
    pub heap: HeapLayout,
    /// A club's stadium; only in the layouts it has been checked in.
    #[serde(default)]
    pub stadium: Option<StadiumLayout>,
    /// The retirements the game has planned; only in the layouts they have been checked in.
    #[serde(default)]
    pub retirement: Option<RetirementLayout>,
    /// What a human manager has picked for his club; only in the layouts it has been checked in.
    #[serde(default)]
    pub selection: Option<SelectionLayout>,
    /// The tactic a selection plays; only in the layouts it has been checked in.
    #[serde(default)]
    pub tactic: Option<TacticLayout>,
    /// Where a player on loan keeps his loan contract; only in the layouts it has been checked in.
    #[serde(default)]
    pub loan: Option<LoanLayout>,
    /// How one of the game's pools of objects keeps its slots (see `object_pool.rs`); only in the layouts it has been
    /// checked in.
    #[serde(default)]
    pub pool: Option<PoolLayout>,
    /// The game's own object, which counts the saves it has loaded; only in the layouts it has been checked in.
    #[serde(default)]
    pub game: Option<GameLayout>,
    /// A player's cohesion with each club (see `cohesion.rs`); only in the layouts it has been checked in.
    #[serde(default)]
    pub cohesion: Option<CohesionLayout>,
    /// A competition; only in the layouts it has been checked in.
    #[serde(default)]
    pub competition: Option<CompetitionLayout>,
    /// The prize money a competition's stages pay (see `prize_money.rs`); only in the layouts it has been checked in.
    #[serde(default)]
    pub prize_money: Option<PrizeMoneyLayout>,
}

/// The game's one object of its class (`game_plugin::GAME_UI` in FM27), made when the game starts and kept until it
/// quits, which a static of the game plugin points at: each build profile places it ([`BuildProfile::game_ui`]). It
/// counts the saves the game has loaded since it started, which tells the editor when the game has loaded a save since
/// the editor read its lists: a save leaves the count as it is.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameLayout {
    /// Its class, as written in C++, which tells it apart.
    pub class: String,
    /// The `u64` count of the saves the game has loaded since it started.
    pub loads: u64,
}

/// A player's cohesion entries: the second list of the record his `relations` pointer leads to, after his ties (see
/// [`RelationLayout`]).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CohesionLayout {
    /// Where the list `(begin, end, capacity)` starts in the record.
    pub list: u64,
    /// Bytes per entry.
    pub size: u64,
    /// `i32`: the index of the club or nation the entry is for.
    pub index: u64,
    /// `u8`: what the entry is for, 1 a club and 2 a nation.
    pub kind: u64,
    /// `i8`: the cohesion, 1..100.
    pub value: u64,
    /// `i32` in the club object: the index its entries name it by.
    pub club_index: u64,
}

/// A competition (`db::COMP`).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CompetitionLayout {
    /// `u32`.
    pub uid: u64,
    /// FM string pointers, to names in the game's language.
    pub name: u64,
    pub short_name: u64,
}

/// The prize money a competition's stages pay, which their settings hold (see `prize_money.rs`).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrizeMoneyLayout {
    /// The classes, as written in C++: a stage played as a league, a stage that has not started yet, and a league's
    /// settings.
    pub stage: String,
    pub future_stage: String,
    pub settings: String,
    /// In either kind of stage: the pointer to its competition.
    pub competition: u64,
    /// In a stage played as a league, and in one that has not started yet: the pointer to its settings.
    pub stage_settings: u64,
    pub future_settings: u64,
    /// In the settings: a list `(begin, end, capacity)` of `u32` amounts in pounds by final position, the first
    /// place first.
    pub by_position: u64,
    /// In the settings: `u32` amounts in pounds per win (kept twice), per draw and per loss.
    pub win: u64,
    pub win_again: u64,
    pub draw: u64,
    pub loss: u64,
}

/// One of the game's pools of objects (see `object_pool.rs`), a static of the game plugin, from where it keeps the
/// list `(begin, end, capacity)` of pointers to its chunks. The rest are `u32`s but for the first free slot.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PoolLayout {
    /// The list of chunks.
    pub chunks: u64,
    /// Pointer to the first free slot, null when none is free. Each free slot's first 8 bytes point at the next.
    pub first_free: u64,
    /// How many slots are free, and how many hold an object.
    pub free: u64,
    pub used: u64,
    /// Bytes per slot.
    pub slot_size: u64,
    /// How many slots the first chunk has, and each later one.
    pub first_chunk: u64,
    pub later_chunks: u64,
}

impl PoolLayout {
    /// One past the last byte of every field, from where the pool keeps its list of chunks.
    pub fn end(&self) -> u64 {
        [
            self.chunks + 24,
            self.first_free + 8,
            self.free + 4,
            self.used + 4,
            self.slot_size + 4,
            self.first_chunk + 4,
            self.later_chunks + 4,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

/// The tactic block a selection's list ([`SelectionLayout::list`]) points at: the eleven slots of the formation, once
/// for when the team has the ball and once for when it has not, each slot an entry of `slot_size` bytes whose
/// `role` holds the role's mask (see `crate::scouting`). The slots are in the order of the selection's.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TacticLayout {
    /// The first in-possession slot.
    pub in_possession: u64,
    /// The first out-of-possession slot.
    pub out_of_possession: u64,
    pub slot_size: u64,
    /// In a slot: the `u64` role mask.
    pub role: u64,
    /// `u32` code of the style the tactic was made from, as text backwards (`CONT`, `TIKI`, `DIRE`).
    pub style: u64,
}

/// Where a player on loan keeps his loan contract: his `record` pointer (shifted like the person block) leads to a
/// record of his other contracts, whose field at `contract` points at the loan contract while he is on loan. The loan
/// contract is an object of `class` (found by its name: see [`crate::rtti`]), laid out as a contract
/// ([`ContractLayout`]) for its owner, its teams, its dates and the squad number: its team is the one he is on loan
/// to, and its end date is the day the loan ends.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoanLayout {
    /// In a player: pointer to the record of his other contracts.
    pub record: u64,
    /// In that record: pointer to the loan contract, null when he is not on loan.
    pub contract: u64,
    /// In that record: the pointers to his other contracts (with a B team, and others), null for none. When a loan
    /// ends and these are all null, the game leaves the player without a record.
    pub others: Vec<u64>,
    /// The class of loan contracts, as written in C++.
    pub class: String,
    /// In the loan contract: its terms, past the fields it shares with a contract; none where they have not been read.
    #[serde(default)]
    pub terms: Option<LoanTermsLayout>,
}

/// Where a loan contract keeps the terms the game's Loan Club tab shows.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoanTermsLayout {
    /// `u16` flags: bit 0, he may play against his own club; bit 1, in cup matches; bit 2, his club may recall him;
    /// bit 12, the loan cannot be terminated.
    pub flags: u64,
    /// `i32`, pounds, -1 for none: the fee for which the club he is on loan to may sign him for good.
    pub option_fee: u64,
    /// `i32`, pounds a month, -1 for none: what that club pays his own each month he plays for it.
    pub monthly_fee: u64,
    /// `i32`, pounds a month, -1 for none: what it pays each month he is not used.
    pub unused_fee: u64,
}

impl LoanTermsLayout {
    /// One past the last byte of the terms.
    pub fn end(&self) -> u64 {
        [self.flags + 2, self.option_fee + 4, self.monthly_fee + 4, self.unused_fee + 4].into_iter().max().unwrap_or(0)
    }
}

/// What a human manager has picked for his club, as the match engine keeps it: for each of his tactics, objects of one
/// class (`class`, found by its name: see [`crate::rtti`]) whose `count` slots of `u32` person ids, from `slots` on,
/// are the starting eleven in the order of the formation's positions and then the substitutes. An empty slot holds
/// `0xFFFF_FFFF`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SelectionLayout {
    /// The class, as written in C++.
    pub class: String,
    /// In an object: a list `(begin, end, capacity)` every live one holds.
    pub list: u64,
    /// In an object: the first slot.
    pub slots: u64,
    pub count: u64,
    /// In a player: the `u32` id the game gives the person, which the slots hold.
    pub player_person: u64,
}

/// The retirements the game has planned, which its retirement manager keeps (`RETIREMENT_MANAGER`, one object a
/// static points at, which each build profile places: [`BuildProfile::retirement_manager`]). It lists them twice: as
/// pointers to the entries, and as an index of 16-byte entries (the person id, 4 spare bytes, the pointer) sorted by
/// person id.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RetirementLayout {
    /// In the manager: the `(begin, end, capacity)` list of pointers to the entries.
    pub planned: u64,
    /// In the manager: the `(begin, end, capacity)` index of the entries by person id.
    pub by_person: u64,
    /// In an entry: the `u32` id of the person who retires (`player_person`), and the date he retires.
    pub person: u64,
    pub date: u64,
    /// In a player: the `u32` id the game gives the person.
    pub player_person: u64,
}

/// A stadium, which a club's senior team points at.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StadiumLayout {
    /// In the senior team: the pointer to the stadium.
    pub team_pointer: u64,
    /// FM string pointer.
    pub name: u64,
    /// `u32` capacities: the whole, the seats, the part in use when it is limited (0 when not) and the most it can
    /// be expanded to.
    pub capacity: u64,
    pub seating: u64,
    pub used: u64,
    pub expansion: u64,
    /// Pointer to the club that owns it.
    pub owner: u64,
}

impl StadiumLayout {
    /// One past the last byte of every stadium field.
    pub fn end(&self) -> u64 {
        [self.name + 8, self.capacity + 4, self.seating + 4, self.used + 4, self.expansion + 4, self.owner + 8]
            .into_iter()
            .max()
            .unwrap_or(0)
    }
}

/// One of a person's relations: a 16-byte entry of the list that starts the record his `relations` pointer leads to.
/// It points at its target, a nation, club, person or competition, and then says how he is tied to it.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RelationLayout {
    /// Pointer to the target.
    pub target: u64,
    /// `u8`: 1 for a club, 3 for a person, 8 for a nation.
    pub target_kind: u64,
    /// `u8`: 9 for a nationality, 70 for a nation he was trained in, 72 for a club he was trained at, 109 for a nation
    /// he needs no work permit in.
    pub relation: u64,
    /// `u16`: a count some relations use; for one he needs no work permit for, the days it has left.
    pub count: u64,
    /// `u8`: for a training, the homegrown rule it meets.
    pub value: u64,
    /// Bytes per entry.
    pub size: u64,
}

/// One current injury of a player. A player's `injuries` pointer leads to a record whose
/// first field is the list `(begin, end, capacity)` of these.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InjuryLayout {
    /// Pointer to the kind of injury.
    pub kind: u64,
    /// The team he was with when it happened.
    pub team: u64,
    /// Date.
    pub started: u64,
    /// `u16` days from `started` until he is back at the latest, and at the soonest.
    pub longest: u64,
    pub shortest: u64,
    /// In the kind of injury: its name, an FM string.
    pub kind_name: u64,
}

impl InjuryLayout {
    /// One past the last byte of every injury field.
    pub fn end(&self) -> u64 {
        [self.kind + 8, self.team + 8, self.started + 4, self.longest + 2, self.shortest + 2]
            .into_iter()
            .max()
            .unwrap_or(0)
    }
}

/// One current ban of a player. The record a player's `injuries` pointer leads to holds,
/// after his list of current injuries, the list `(begin, end, capacity)` of his current
/// absences: his bans, and others such as a call-up. Each is a 32-byte entry, and a ban
/// carries `0xFFFF` at `marker`, where the others hold 0.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BanLayout {
    /// Where the list of absences is in the record.
    pub list: u64,
    /// The date the ban began.
    pub started: u64,
    /// `u16`, `0xFFFF` for a ban.
    pub marker: u64,
    /// `u8`: how many matches he still has to miss.
    pub matches: u64,
}

impl BanLayout {
    /// One past the last byte of every field of an entry.
    pub fn end(&self) -> u64 {
        [self.started + 4, self.marker + 2, self.matches + 1].into_iter().max().unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlayerLayout {
    pub uid: u64,
    pub full_name: u64,
    pub first_name: u64,
    pub last_name: u64,
    pub common_name: u64,
    pub date_of_birth: u64,
    pub current_ability: u64,
    pub potential_ability: u64,
    pub nation: u64,
    /// Pointer to the record whose first field is the list of his relations; see [`RelationLayout`].
    pub relations: u64,
    pub team: u64,
    /// Start of the person block; fields from here on move with the person-block shift.
    pub person_block: u64,
    /// The block with the UID that contracts and captaincies point at, when it does not
    /// start the person block (on macOS it ends it).
    #[serde(default)]
    pub identity: Option<u64>,
    /// Shifts of the person block seen across player classes (player-coaches use 0xF8).
    pub person_block_shifts: Vec<u64>,
    /// `u8` of flags in the identity block, one of which is set for a woman (see [`crate::is_woman`]); unset where the
    /// layout has not placed them yet.
    #[serde(default)]
    pub gender: Option<u64>,
    pub height: u64,
    /// `i32` pounds: his transfer value, which the game shows in the player's currency as a range starting at it
    /// while his club's scouts do not know him well; 300,000,000 when he is not for sale. Unset where the layout has
    /// not placed it.
    #[serde(default)]
    pub transfer_value: Option<u64>,
    pub asking_price: u64,
    pub home_reputation: u64,
    pub current_reputation: u64,
    pub world_reputation: u64,
    pub international_caps: u64,
    pub international_goals: u64,
    pub u21_caps: u64,
    pub u21_goals: u64,
    pub contract: u64,
    /// `u16` 0..10000, live values the game changes every day.
    pub match_sharpness: u64,
    pub condition: u64,
    /// `i16`, -500 when rested and higher the more worn out he is by playing.
    pub jadedness: u64,
    /// `u8` 1..20: his morale, which the game shows in words as his overall happiness.
    pub morale: u64,
    /// `u64` bitmask of his traits (preferred moves), in the order of [`crate::TRAITS`].
    pub traits: u64,
    /// Pointer to the injury record; see [`InjuryLayout`].
    pub injuries: u64,
    /// First of the 15 position ratings, in [`crate::POSITIONS`] order.
    pub positions: u64,
    /// First of the 8 personality ratings, in [`crate::PERSONALITY`] order.
    pub personality: u64,
    /// Attribute offsets by key; see [`crate::ATTRIBUTE_GROUPS`].
    pub attributes: BTreeMap<String, u64>,
}

impl PlayerLayout {
    /// Where `offset` lands in an object whose person block is shifted by `shift`.
    pub fn at(&self, offset: u64, shift: u64) -> u64 {
        if offset >= self.person_block { offset + shift } else { offset }
    }

    /// Where the block that contracts and captaincies point at starts, before any shift.
    pub fn identity(&self) -> u64 {
        self.identity.unwrap_or(self.person_block)
    }

    /// One past the last byte of every direct player field, before any shift.
    pub fn end(&self) -> u64 {
        let fields = [
            self.uid + 4,
            self.full_name + 8,
            self.first_name + 8,
            self.last_name + 8,
            self.common_name + 8,
            self.date_of_birth + 4,
            self.current_ability + 2,
            self.potential_ability + 2,
            self.nation + 8,
            self.team + 8,
            self.relations + 8,
            self.height + 2,
            self.asking_price + 4,
            self.world_reputation + 2,
            self.international_goals + 2,
            self.u21_goals + 1,
            self.contract + 8,
            self.match_sharpness + 2,
            self.condition + 2,
            self.jadedness + 2,
            self.morale + 1,
            self.traits + 8,
            self.injuries + 8,
            self.positions + crate::POSITIONS.len() as u64,
            self.personality + crate::PERSONALITY.len() as u64,
        ];
        let single_bytes = self.attributes.values().chain(&self.gender).map(|offset| offset + 1);
        let value = self.transfer_value.map(|offset| offset + 4);
        fields.into_iter().chain(single_bytes).chain(value).max().unwrap_or(0)
    }

    /// The largest person-block shift.
    pub fn max_shift(&self) -> u64 {
        self.person_block_shifts.iter().copied().max().unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ContractLayout {
    /// Points back at the person block of the player or member of staff the contract belongs to.
    pub owner: u64,
    pub wage: u64,
    pub signed: u64,
    pub expires: u64,
    pub joined: u64,
    pub squad_status: u64,
    pub listing: u64,
    pub squad_number: u64,
    pub team: u64,
    /// The employer's senior team: the same as `team` but for player-coaches.
    pub senior_team: u64,
    pub job: u64,
    /// The list `(begin, end, capacity)` of the contract's clauses and bonuses: 8-byte entries, an amount and a kind.
    pub clauses: u64,
    /// The list of its bonuses for winning competitions: 32-byte entries.
    pub competition_bonuses: u64,
    /// `i32`, pounds per week.
    pub loyalty_bonus: u64,
    /// `i8` each: how happy the player is, and how happy with his playing time, as FMRTE shows them.
    pub happiness: u64,
    pub playing_time_happiness: u64,
    /// Pointer to the record of his reasons to be unhappy: a `u64` count, then that many pointers to 28-byte entries.
    pub unhappiness: u64,
    /// `u8`, the kind of contract (0 part-time, 1 full-time, 2 amateur, 3 youth, 4 non-contract, 10 and 11 the MLS's
    /// senior contracts); none in a layout where it has not been checked.
    #[serde(default)]
    pub contract_type: Option<u64>,
    /// Bytes of a contract: the size of the slots of the game's pool of contracts, which the editor takes one of for a
    /// contract of its making (see `signing.rs`). None in a layout where it does not make contracts.
    #[serde(default)]
    pub size: Option<u64>,
    /// Where a contract the editor makes holds 8 zero bytes in place of what the contract it is modelled on has: places
    /// that hold a pointer in some contracts and nothing in most, to records the editor does not know and must not
    /// share. The unhappiness record and the two lists of extras start empty too.
    #[serde(default)]
    pub cleared: Vec<u64>,
}

impl ContractLayout {
    /// One past the last byte of every contract field.
    pub fn end(&self) -> u64 {
        let contract_type = self.contract_type.map(|offset| offset + 1);
        [
            self.owner + 8,
            self.wage + 4,
            self.signed + 4,
            self.expires + 4,
            self.joined + 4,
            self.squad_status + 1,
            self.listing + 1,
            self.squad_number + 1,
            self.team + 8,
            self.senior_team + 8,
            self.job + 1,
            self.loyalty_bonus + 4,
            self.happiness + 1,
            self.playing_time_happiness + 1,
            self.unhappiness + 8,
        ]
        .into_iter()
        .chain(contract_type)
        .max()
        .unwrap_or(0)
    }
}

/// Static values next to the entity arrays, as offsets from the players `(begin, end)` pair.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClusterLayout {
    pub current_date: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StaffLayout {
    pub uid: u64,
    pub full_name: u64,
    pub first_name: u64,
    pub last_name: u64,
    pub common_name: u64,
    pub nation: u64,
    /// First of the 8 personality ratings, in [`crate::PERSONALITY`] order.
    pub personality: u64,
    pub date_of_birth: u64,
    pub contract: u64,
    pub home_reputation: u64,
    pub current_reputation: u64,
    pub world_reputation: u64,
    pub current_ability: u64,
    pub potential_ability: u64,
    /// Start of the person block; fields from here on move with the person-block shift.
    pub person_block: u64,
    /// The block with the UID that contracts point at, when it does not start the person
    /// block (on macOS it ends it).
    #[serde(default)]
    pub identity: Option<u64>,
    /// Shifts of the person block seen across staff classes (the human manager uses 0x340).
    pub person_block_shifts: Vec<u64>,
    /// `u8` of flags in the identity block, as for players; unset where the layout has not placed them yet.
    #[serde(default)]
    pub gender: Option<u64>,
    /// Attributes stored raw (0..100) by key; see [`crate::STAFF_ATTRIBUTE_GROUPS`].
    pub attributes: BTreeMap<String, u64>,
    /// Ratings stored as shown (1..20) by key.
    pub ratings: BTreeMap<String, u64>,
}

impl StaffLayout {
    /// Where `offset` lands in an object whose person block is shifted by `shift`.
    pub fn at(&self, offset: u64, shift: u64) -> u64 {
        if offset >= self.person_block { offset + shift } else { offset }
    }

    /// Where the block that contracts point at starts, before any shift.
    pub fn identity(&self) -> u64 {
        self.identity.unwrap_or(self.person_block)
    }

    /// One past the last byte of every staff field, before any shift.
    pub fn end(&self) -> u64 {
        let fields = [
            self.uid + 4,
            self.full_name + 8,
            self.first_name + 8,
            self.last_name + 8,
            self.common_name + 8,
            self.nation + 8,
            self.personality + crate::PERSONALITY.len() as u64,
            self.date_of_birth + 4,
            self.contract + 8,
            self.world_reputation + 2,
            self.potential_ability + 2,
        ];
        let single_bytes =
            self.attributes.values().chain(self.ratings.values()).chain(&self.gender).map(|offset| offset + 1);
        fields.into_iter().chain(single_bytes).max().unwrap_or(0)
    }

    pub fn max_shift(&self) -> u64 {
        self.person_block_shifts.iter().copied().max().unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TeamLayout {
    pub club: u64,
    /// `u8`: the kind of team, 0 for the first team.
    pub kind: u64,
    /// `u8`: the oldest its players may be; 100 for a team without a limit.
    pub age_limit: u64,
    /// The team's player pointers as `(begin, end, capacity)`.
    pub players: u64,
    /// Pointers to the person blocks of the captain and the vice-captain, null for none.
    pub captain: u64,
    pub vice_captain: u64,
    pub reputation: u64,
    /// Where the team points at its manager's object, null for none; unset where the layout has not placed it, and a
    /// manager is then left as he is.
    #[serde(default)]
    pub manager: Option<u64>,
}

impl TeamLayout {
    /// One past the last byte of every team field.
    pub fn end(&self) -> u64 {
        [
            self.club + 8,
            self.kind + 1,
            self.age_limit + 1,
            self.players + 24,
            self.captain + 8,
            self.vice_captain + 8,
            self.reputation + 2,
            self.manager.map_or(0, |at| at + 8),
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClubLayout {
    pub uid: u64,
    pub name: u64,
    pub short_name: u64,
    pub women: u64,
    pub teams: u64,
    pub info: u64,
    pub finance: u64,
    /// The club's staff by department, each a list of pointers as `(begin, end, capacity)`: the medical team, the
    /// coaches and the scouts.
    pub medical_staff: u64,
    pub coaching_staff: u64,
    pub scouting_staff: u64,
    /// Where the club points at the member of staff whose job is to be its director of football, null for none; unset
    /// where the layout has not placed it, and a director of football is then left as he is.
    #[serde(default)]
    pub director_of_football: Option<u64>,
}

impl ClubLayout {
    pub fn end(&self) -> u64 {
        [
            self.uid + 4,
            self.name + 8,
            self.short_name + 8,
            self.women + 1,
            self.teams + 8,
            self.info + 8,
            self.finance + 8,
            self.medical_staff + 24,
            self.coaching_staff + 24,
            self.scouting_staff + 24,
            self.director_of_football.map_or(0, |at| at + 8),
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClubInfoLayout {
    pub season_tickets: u64,
    pub founded: u64,
    pub social_media: u64,
    /// First of 6 supporter-mix percentages, in [`crate::SUPPORTER_MIX`] order.
    pub supporter_mix: u64,
    /// First of 6 supporter traits (1..20), in [`crate::SUPPORTER_TRAITS`] order.
    pub supporter_traits: u64,
    pub training: u64,
    pub youth_facilities: u64,
    pub youth_coaching: u64,
    pub youth_recruitment: u64,
}

impl ClubInfoLayout {
    pub fn end(&self) -> u64 {
        [
            self.season_tickets + 4,
            self.founded + 2,
            self.social_media + 4,
            self.supporter_mix + 6,
            self.supporter_traits + 6,
            self.training + 1,
            self.youth_facilities + 1,
            self.youth_coaching + 1,
            self.youth_recruitment + 1,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClubFinanceLayout {
    pub balance: u64,
    pub transfer_budget: u64,
    pub total_wage_budget: u64,
    pub wage_budget: u64,
    pub ticket_price: u64,
    pub corporate: u64,
}

impl ClubFinanceLayout {
    pub fn end(&self) -> u64 {
        [
            self.balance + 4,
            self.transfer_budget + 4,
            self.total_wage_budget + 4,
            self.wage_budget + 4,
            self.ticket_price + 4,
            self.corporate + 1,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NationLayout {
    pub uid: u64,
    pub name: u64,
}

/// What the game's allocator does with the blocks it hands out.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HeapLayout {
    /// Block sizes in bytes, ascending. A buffer of more than the first size and up to the last one sits in
    /// the smallest block at least as large as it; outside that span the block size is not known.
    pub block_sizes: Vec<u64>,
    /// The steps, in bytes, in which the game's allocator sizes the blocks of its strings (a header of 8 bytes, a
    /// count of holders, the length, the text and a NUL), for the names the editor writes (see `stadium_name.rs`).
    /// 16 when not given.
    pub string_step: Option<u64>,
    /// The largest block the game's own allocator hands out: it gets larger ones from the system's allocator, and
    /// gives them back to it, so the editor grows no list into memory of its own past it (see `own_memory.rs`). Not
    /// given where it is not known.
    pub largest_block: Option<u64>,
}

impl HeapLayout {
    /// The size of the block that holds a buffer of `bytes`, where that is known.
    pub fn block_size(&self, bytes: u64) -> Option<u64> {
        let (&smallest, sizes) = self.block_sizes.split_first()?;
        if bytes <= smallest {
            return None;
        }
        sizes.iter().copied().find(|&size| size >= bytes)
    }

    /// The size of a block of the editor's own for a list's buffer of `bytes`, to be at least as large as the game's
    /// allocator would give it, so that the game can hand it out again once it lets the list go. Within the classes
    /// the layout lists, that class; past them, where the class is not known, the next power of two, which holds it (on
    /// the Mac every class past 512 bytes lies below it); a smaller buffer gets its own size, as the classes below the
    /// first come in steps of 8 and then 16. None past `largest_block`: the game would give that block to `free()`.
    pub fn grown_block(&self, bytes: u64) -> Option<u64> {
        if self.largest_block.is_some_and(|largest| bytes > largest) {
            return None;
        }
        if let Some(size) = self.block_size(bytes) {
            return Some(size);
        }
        let past_classes = self.block_sizes.last().is_some_and(|&last| bytes > last);
        Some(if past_classes { bytes.next_power_of_two() } else { bytes })
    }
}

/// Addresses that change with every build of the game plugin.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BuildProfile {
    pub name: String,
    pub edition: u32,
    pub storefront: Storefront,
    pub package_version: Option<String>,
    pub plugin: PluginFingerprint,
    pub arrays: ArrayRvas,
    /// Bytes to subtract from each pointer in the player array before reading the player object. Some Console builds
    /// keep pointers to a base-class subobject rather than to the start of the complete player object.
    pub player_pointer_bias: Option<u64>,
    /// RVA in the game plugin of the in-game date, where it is not next to the arrays at
    /// [`ClusterLayout::current_date`]: on macOS, and on Windows since the November 2026 update (Game Pass
    /// 0.9.2409.0, Steam build 26340721), it is a variable of its own.
    pub current_date: Option<u64>,
    /// RVA in the game plugin of the static pointer to the retirement manager ([`RetirementLayout`]). It is not at
    /// the same distance from the arrays in every build: 0xED60 before the players pair on Game Pass, 0xDAC0 on
    /// Steam.
    pub retirement_manager: Option<u64>,
    /// RVA in the game plugin of a static pointer to the game's own object ([`GameLayout`]), whose count of the saves
    /// loaded tells a load from a save: 0x3C80 before the players pair on Game Pass 0.9.2409.0 and Steam build 26340721.
    pub game_ui: Option<u64>,
}

/// Identifies a build of the game plugin from its headers as mapped in memory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(untagged, deny_unknown_fields)]
pub enum PluginFingerprint {
    /// `game_plugin.dll` on Windows: two values of its PE header.
    Pe { size_of_image: u32, link_timestamp: u32 },
    /// `game_plugin` on macOS: its `LC_UUID`. The arm64 and the Intel half of the universal
    /// binary have one each, so a build has a profile per architecture.
    MachO {
        #[serde(deserialize_with = "uuid_from_text")]
        uuid: [u8; 16],
    },
}

impl PluginFingerprint {
    /// Reads the fingerprint of the game plugin `plugin` from the headers mapped in `process`.
    #[cfg(windows)]
    pub fn read(process: &Process, plugin: &Module) -> fmlibre_mem::Result<Self> {
        let image = fmlibre_mem::PeImage::read(process, plugin.base)?;
        Ok(Self::Pe { size_of_image: image.size_of_image, link_timestamp: image.timestamp })
    }

    /// Reads the fingerprint of the game plugin `plugin` from the headers mapped in `process`.
    #[cfg(target_os = "macos")]
    pub fn read(process: &Process, plugin: &Module) -> fmlibre_mem::Result<Self> {
        let image = fmlibre_mem::MachImage::read(process, plugin.base)?;
        let uuid = image.uuid.ok_or(fmlibre_mem::Error::InvalidMachO { base: plugin.base, reason: "no LC_UUID" })?;
        Ok(Self::MachO { uuid })
    }
}

impl fmt::Display for PluginFingerprint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PluginFingerprint::Pe { size_of_image, link_timestamp } => {
                write!(f, "size of image {size_of_image:#x}, link timestamp {link_timestamp:#010x}")
            }
            PluginFingerprint::MachO { uuid } => write!(f, "UUID {}", uuid_text(uuid)),
        }
    }
}

/// A UUID as macOS writes it, e.g. "9E8E47DE-F704-314C-917D-C32D12637678".
fn uuid_text(uuid: &[u8; 16]) -> String {
    let hex = |bytes: &[u8]| bytes.iter().map(|b| format!("{b:02X}")).collect::<String>();
    let (a, b, c, d, e) = (&uuid[..4], &uuid[4..6], &uuid[6..8], &uuid[8..10], &uuid[10..]);
    format!("{}-{}-{}-{}-{}", hex(a), hex(b), hex(c), hex(d), hex(e))
}

/// A UUID as macOS writes it, e.g. "9E8E47DE-F704-314C-917D-C32D12637678".
fn uuid_from_text<'de, D: Deserializer<'de>>(deserializer: D) -> Result<[u8; 16], D::Error> {
    let text = String::deserialize(deserializer)?;
    let hex: String = text.chars().filter(|&c| c != '-').collect();
    let bytes: Option<Vec<u8>> = (0..hex.len())
        .step_by(2)
        .map(|i| hex.get(i..i + 2).and_then(|pair| u8::from_str_radix(pair, 16).ok()))
        .collect();
    bytes.and_then(|bytes| bytes.try_into().ok()).ok_or_else(|| serde::de::Error::custom(format!("not a UUID: {text}")))
}

/// RVAs in the game plugin of the `(begin, end)` pairs of the entity arrays.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArrayRvas {
    pub players: u64,
    pub staff: u64,
    pub clubs: u64,
}

#[cfg(windows)]
const LAYOUTS: &[&str] = &[include_str!("../../../profiles/fm27/layout.toml")];

/// On macOS the game is built with clang, which lays some of its classes out otherwise.
#[cfg(target_os = "macos")]
const LAYOUTS: &[&str] = &[include_str!("../../../profiles/fm27/layout-macos.toml")];

const BUILDS: &[&str] = &[
    include_str!("../../../profiles/fm27/gamepass-0.9.2355.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2409.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2435.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2437.0.toml"),
    include_str!("../../../profiles/fm27/steam-26227640.toml"),
    include_str!("../../../profiles/fm27/steam-26340721.toml"),
    include_str!("../../../profiles/fm27/steam-26385295.toml"),
    include_str!("../../../profiles/fm27/steam-26227640-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26227640-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26340721-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26340721-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26385295-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26385295-macos-arm64.toml"),
];

/// The built-in object layout for `edition`, if there is one.
pub fn layout_for(edition: u32) -> Option<Layout> {
    LAYOUTS.iter().map(|text| parse::<Layout>(text)).find(|layout| layout.edition == edition)
}

/// The built-in build profile matching `fingerprint`, if there is one.
pub fn profile_for(fingerprint: PluginFingerprint) -> Option<BuildProfile> {
    built_in_profiles().find(|profile| profile.plugin == fingerprint)
}

/// Every built-in build profile, those of macOS among them.
pub fn built_in_profiles() -> impl Iterator<Item = BuildProfile> {
    BUILDS.iter().map(|text| parse::<BuildProfile>(text))
}

fn parse<T: serde::de::DeserializeOwned>(text: &str) -> T {
    toml::from_str(text).expect("built-in profiles are checked by the unit tests")
}

/// What `fmlibre-probe profile` writes in comments around the values of a build profile.
#[derive(Debug, Clone, Default)]
pub struct ProfileNotes {
    /// Lines at the top of the file.
    pub header: Vec<String>,
    /// Lines above the in-game date, above the static pointer to the retirement manager and above the one to the
    /// game's own object.
    pub current_date: Vec<String>,
    pub retirement_manager: Vec<String>,
    pub game_ui: Vec<String>,
}

/// The text of a build profile file, laid out as the built-in ones, with `notes` as comments.
pub fn profile_text(profile: &BuildProfile, notes: &ProfileNotes) -> String {
    let comments = |lines: &[String]| lines.iter().map(|line| format!("# {line}\n")).collect::<String>();
    let quoted = |text: &str| format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""));
    let mut text = comments(&notes.header);
    text += &format!("name = {}\nedition = {}\n", quoted(&profile.name), profile.edition);
    let storefront = match profile.storefront {
        Storefront::GamePass => "gamePass",
        Storefront::Steam => "steam",
        Storefront::Epic => "epic",
        Storefront::Unknown => "unknown",
    };
    text += &format!("storefront = \"{storefront}\"\n");
    if let Some(version) = &profile.package_version {
        text += &format!("package_version = {}\n", quoted(version));
    }
    if let Some(bias) = profile.player_pointer_bias {
        text += &format!("player_pointer_bias = {bias:#X}\n");
    }
    if let Some(rva) = profile.current_date {
        text += &format!("\n{}current_date = {rva:#X}\n", comments(&notes.current_date));
    }
    if let Some(rva) = profile.retirement_manager {
        text += &format!("\n{}retirement_manager = {rva:#X}\n", comments(&notes.retirement_manager));
    }
    if let Some(rva) = profile.game_ui {
        text += &format!("\n{}game_ui = {rva:#X}\n", comments(&notes.game_ui));
    }
    text += "\n# game_plugin as mapped in memory; these values identify the build.\n[plugin]\n";
    match profile.plugin {
        PluginFingerprint::Pe { size_of_image, link_timestamp } => {
            text += &format!("size_of_image = {size_of_image:#X}\nlink_timestamp = {link_timestamp:#X}\n");
        }
        PluginFingerprint::MachO { uuid } => text += &format!("uuid = \"{}\"\n", uuid_text(&uuid)),
    }
    let ArrayRvas { players, staff, clubs } = profile.arrays;
    text += "\n# RVAs in game_plugin of the (begin, end) pointer pairs of the entity arrays.\n[arrays]\n";
    text += &format!("players = {players:#X}\nstaff = {staff:#X}\nclubs = {clubs:#X}\n");
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOWS: &str = include_str!("../../../profiles/fm27/layout.toml");
    const MACOS: &str = include_str!("../../../profiles/fm27/layout-macos.toml");

    #[test]
    fn attribute_groups_cover_the_layout() {
        for text in [WINDOWS, MACOS] {
            let layout: Layout = parse(text);
            let mut grouped: Vec<&str> =
                crate::ATTRIBUTE_GROUPS.iter().flat_map(|(_, keys)| keys.iter().copied()).collect();
            grouped.sort_unstable();
            let mut mapped: Vec<&str> = layout.player.attributes.keys().map(String::as_str).collect();
            mapped.sort_unstable();
            assert_eq!(grouped, mapped);
        }
    }

    #[test]
    fn the_mac_layout_follows_the_windows_one() {
        let (windows, mac): (Layout, Layout) = (parse(WINDOWS), parse(MACOS));
        assert_eq!(windows.player.identity(), windows.player.person_block);
        assert_eq!(windows.staff.identity(), windows.staff.person_block);

        // The player's own fields sit 8 bytes earlier, the person's 0x40, the identity block 0x100 later.
        for (key, &offset) in &windows.player.attributes {
            assert_eq!(mac.player.attributes[key], offset - 8, "{key}");
        }
        assert_eq!(
            (mac.player.positions, mac.player.morale, mac.player.jadedness),
            (windows.player.positions - 8, windows.player.morale - 8, windows.player.jadedness - 8)
        );
        assert_eq!(
            (mac.player.transfer_value, mac.player.asking_price),
            (windows.player.transfer_value.map(|offset| offset - 8), windows.player.asking_price - 8)
        );
        assert_eq!(mac.player.date_of_birth, windows.player.date_of_birth - 0x40);
        assert_eq!(mac.player.traits, windows.player.traits - 0x40);
        assert_eq!(mac.player.relations, windows.player.relations - 0x40);
        assert_eq!(mac.player.international_caps, windows.player.international_caps - 0x40);
        assert_eq!(mac.player.identity(), windows.player.identity() + 0x100);
        assert_eq!(mac.player.uid - mac.player.identity(), windows.player.uid - windows.player.identity());
        // Paul Ifill, a player-coach: his UID at 0x48C.
        assert_eq!(mac.player.at(mac.player.uid, 0xF8), 0x48C);
        assert_eq!(mac.player.at(mac.player.team, 0xF8), mac.player.team);

        // Staff keep their own fields where they are; their identity block also ends the person.
        assert_eq!(mac.staff.attributes, windows.staff.attributes);
        assert_eq!(mac.staff.current_ability, windows.staff.current_ability);
        assert_eq!(mac.staff.uid - mac.staff.identity(), windows.staff.uid - windows.staff.identity());

        // Competitions and their prize money are laid out alike.
        assert!(windows.prize_money.is_some() && windows.competition.is_some());
        assert_eq!(mac.prize_money, windows.prize_money);
        assert_eq!(mac.competition, windows.competition);
        assert_eq!(mac.player.identity() - mac.player.person_block, mac.staff.identity() - mac.staff.person_block);

        // The records the people point at are laid out alike. The kind of contract is left out of a layout until it
        // has been read on that system; where both have it, it sits at the same place.
        let without_kind = |c: &ContractLayout| ContractLayout { contract_type: None, ..c.clone() }.end();
        assert_eq!(without_kind(&mac.contract), without_kind(&windows.contract));
        if mac.contract.contract_type.is_some() {
            assert_eq!(mac.contract.contract_type, windows.contract.contract_type);
        }
        assert_eq!(mac.team.end(), windows.team.end());
        assert_eq!(mac.team.manager, windows.team.manager);
        assert_eq!(mac.club.director_of_football, windows.club.director_of_football);
        assert_eq!(mac.club_finance.end(), windows.club_finance.end());
        assert_eq!(
            (mac.ban.list, mac.ban.started, mac.ban.marker, mac.ban.matches),
            (windows.ban.list, windows.ban.started, windows.ban.marker, windows.ban.matches)
        );
        let relation = |l: &Layout| {
            let r = &l.relation;
            (r.target, r.target_kind, r.relation, r.value, r.size)
        };
        assert_eq!(relation(&mac), relation(&windows));
        let stadium = |l: &Layout| {
            let s = l.stadium.as_ref().expect("stadiums");
            (s.team_pointer, s.name, s.capacity, s.seating, s.used, s.expansion, s.owner)
        };
        assert_eq!(stadium(&mac), stadium(&windows));
        // The retirement manager's lists and entries too; a player keeps the game's id 8 bytes into his identity
        // block. The static pointer to the manager is placed by the build profiles.
        let retirement = |l: &Layout| {
            let r = l.retirement.as_ref().expect("planned retirements");
            (r.planned, r.by_person, r.person, r.date, r.player_person - l.player.identity())
        };
        assert_eq!(retirement(&mac), retirement(&windows));
        // The game's count of the saves it loaded: in the same object, at the same place, on both systems (read on the
        // Mac on Steam build 26385295).
        let game =
            |l: &Layout| l.game.as_ref().map(|game| (game.class.clone(), game.loads)).expect("the game's object");
        assert_eq!(game(&windows), ("game_plugin::GAME_UI".to_owned(), 0x100));
        assert_eq!(game(&mac), game(&windows));
        // The game's own allocator, with the same size classes on both systems; the Mac's go on to 4,096 bytes, read
        // from the allocator itself.
        assert!(mac.heap.block_sizes.starts_with(&windows.heap.block_sizes));
        assert_eq!(mac.heap.block_sizes.last(), mac.heap.largest_block.as_ref());
        assert_eq!(mac.heap.largest_block, windows.heap.largest_block);
    }

    #[test]
    fn fingerprints_parse() {
        let pe: PluginFingerprint = toml::from_str("size_of_image = 0x10\nlink_timestamp = 0x20").expect("PE");
        assert_eq!(pe, PluginFingerprint::Pe { size_of_image: 0x10, link_timestamp: 0x20 });
        let mach_o: PluginFingerprint =
            toml::from_str(r#"uuid = "9E8E47DE-F704-314C-917D-C32D12637678""#).expect("Mach-O");
        assert_eq!(mach_o.to_string(), "UUID 9E8E47DE-F704-314C-917D-C32D12637678");
        assert!(toml::from_str::<PluginFingerprint>(r#"uuid = "9E8E47DE-F704""#).is_err());
        assert!(toml::from_str::<PluginFingerprint>("size_of_image = 1\nlink_timestamp = 2\nuuid = 3").is_err());
    }

    #[test]
    fn a_grown_list_gets_a_block_the_game_can_hand_out_again() {
        let windows: Layout = parse(WINDOWS);
        let mac: Layout = parse(MACOS);
        // Within the classes listed, the class: 20 pointers and room for 3 more in 192 bytes.
        assert_eq!(windows.heap.grown_block(23 * 8), Some(192));
        assert_eq!(mac.heap.grown_block(23 * 8), Some(192));
        // Past Windows' 512, a power of two, at least the class the Mac reads (75 pointers: 600 bytes, a class of 640).
        assert_eq!(windows.heap.grown_block(600), Some(1024));
        assert_eq!(mac.heap.grown_block(600), Some(640));
        for bytes in (520..=4096).step_by(8) {
            let class = mac.heap.grown_block(bytes).expect("a class");
            assert!(windows.heap.grown_block(bytes).expect("a block") >= class, "{bytes}");
        }
        // Below the first class, its own size; past the largest block, none.
        assert_eq!(windows.heap.grown_block(96), Some(96));
        assert_eq!(windows.heap.grown_block(4104), None);
        assert_eq!(mac.heap.grown_block(4104), None);
    }

    #[test]
    fn built_in_profiles_parse() {
        assert!(layout_for(27).is_some());
        let layout: Layout = parse(WINDOWS);
        assert_eq!(layout.player.uid, 0x294);
        assert_eq!(layout.player.at(layout.player.uid, 0xF8), 0x38C);
        assert_eq!(layout.player.at(layout.player.team, 0xF8), 0x130);

        // Lists measured on the test save: 19 pointers in 160 bytes, 29 in 256, 33 to 36 in 288, 41 in 384.
        assert_eq!(layout.heap.block_size(19 * 8), Some(160));
        assert_eq!(layout.heap.block_size(29 * 8), Some(256));
        assert_eq!(layout.heap.block_size(33 * 8), Some(288));
        assert_eq!(layout.heap.block_size(36 * 8), Some(288));
        assert_eq!(layout.heap.block_size(41 * 8), Some(384));
        assert_eq!(layout.heap.block_size(18 * 8), None);
        assert_eq!(layout.heap.block_size(65 * 8), None);

        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1943_6000, link_timestamp: 0x6ADF_B161 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2355.0 profile");
        assert_eq!(profile.storefront, Storefront::GamePass);
        assert_eq!(profile.arrays.players, 0x568_1DC0);
        assert_eq!(profile.edition, layout.edition);
        // The static pointer to the retirement manager, 0xED60 before the players pair on this build.
        assert_eq!(profile.retirement_manager, Some(0x567_3060));

        // The Game Pass update of November 2026: everything 0x2000 further, and the in-game date apart from the arrays.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x175D_A000, link_timestamp: 0x6AE5_63A1 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2409.0 profile");
        assert_eq!(profile.storefront, Storefront::GamePass);
        assert_eq!(profile.package_version.as_deref(), Some("0.9.2409.0"));
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x568_3DC0, 0x568_3E08, 0x568_3F78)
        );
        assert_eq!(profile.current_date, Some(0x562_57C8));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xED60));
        // The static pointer to the game's own object, as far from the players pair as on Steam.
        assert_eq!(profile.game_ui, Some(profile.arrays.players - 0x3C80));

        // The full release on Game Pass (0.9.2435.0): the statics no longer quite as far from each other as before.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1796_9000, link_timestamp: 0x6AE8_CF77 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2435.0 profile");
        assert_eq!(profile.storefront, Storefront::GamePass);
        assert_eq!(profile.package_version.as_deref(), Some("0.9.2435.0"));
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x53B_7DE0, 0x53B_7E28, 0x53B_7F98)
        );
        assert_eq!(profile.current_date, Some(0x535_97C8));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xED70));

        // The same version on Steam, packaged differently: another fingerprint and other RVAs, the manager's static
        // 0xDAC0 before the players pair.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x19E6_9000, link_timestamp: 0x6ADF_B11C };
        let profile = profile_for(fingerprint).expect("Steam build 26227640 profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(profile.arrays.players, 0x570_37D0);
        assert_eq!(profile.edition, layout.edition);
        assert_eq!(profile.retirement_manager, Some(0x56F_5D10));

        // 27.0.0 on Steam (build 26340721): moved as Game Pass 0.9.2409.0 did, the date apart from the arrays.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1821_C000, link_timestamp: 0x6AE5_65AF };
        let profile = profile_for(fingerprint).expect("Steam build 26340721 profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x570_57D0, 0x570_5818, 0x570_5988)
        );
        assert_eq!(profile.current_date, Some(0x56A_F378));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xDAC0));
        assert_eq!(profile.game_ui, Some(profile.arrays.players - 0x3C80));

        // 27.0.1 on Steam (build 26385295), the full release: every static 0x11B040 further than in build 26340721.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x17CB_9000, link_timestamp: 0x6AE8_B5A4 };
        let profile = profile_for(fingerprint).expect("Steam build 26385295 profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x570_57D0 + 0x11_B040, 0x570_5818 + 0x11_B040, 0x570_5988 + 0x11_B040)
        );
        assert_eq!(profile.current_date, Some(0x56A_F378 + 0x11_B040));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xDAC0));

        // On macOS, the Intel half of the same build: told apart by its LC_UUID.
        let uuid = [0x22, 0xCF, 0xE5, 0xC3, 0xB5, 0xCF, 0x3C, 0x00, 0x80, 0x43, 0x1E, 0xA1, 0x90, 0xA6, 0x9B, 0x89];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("Steam build 26227640 on macOS profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(profile.arrays.players, 0x5C8_91C8);
        assert_eq!((profile.arrays.staff, profile.arrays.clubs), (0x5C8_9210, 0x5C8_9380));
        assert_eq!(profile.retirement_manager, Some(0x5C5_FEF0));

        // Its arm64 half, which Apple silicon runs natively: other RVAs, and the date apart.
        let uuid = [0x9E, 0x8E, 0x47, 0xDE, 0xF7, 0x04, 0x31, 0x4C, 0x91, 0x7D, 0xC3, 0x2D, 0x12, 0x63, 0x76, 0x78];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("the arm64 half's profile");
        assert_eq!(profile.arrays.players, 0x56D_2E18);
        assert_eq!(profile.current_date, Some(0x56B_1DB8));
        assert_eq!(profile.retirement_manager, Some(0x56A_82A8));

        // 27.0.0 (Steam build 26340721): new UUIDs for both halves, the Launch Preview's RVAs.
        let uuid = [0xF4, 0x54, 0x03, 0x55, 0x21, 0x86, 0x39, 0xCB, 0x91, 0x19, 0xC7, 0x06, 0xA6, 0xA3, 0x53, 0x46];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.0's arm64 half");
        assert_eq!(profile.arrays.players, 0x56D_2E18);
        assert_eq!(profile.current_date, Some(0x56B_1DB8));
        let uuid = [0x09, 0x81, 0xAB, 0x31, 0xAC, 0x3B, 0x3D, 0x93, 0x94, 0x4F, 0x47, 0xFE, 0x4B, 0x59, 0xCD, 0x9E];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.0's Intel half");
        assert_eq!(profile.arrays.players, 0x5C8_91C8);
        assert_eq!(profile.current_date, Some(0x5C6_9700));

        // 27.0.1 (Steam build 26385295): new UUIDs again, every place moved on with __DATA and the arrays a little more.
        let uuid = [0x2A, 0x2D, 0x0E, 0xD6, 0x32, 0x4E, 0x3D, 0x0D, 0xA2, 0x7D, 0x10, 0xAE, 0xDB, 0xD0, 0xE2, 0x70];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.1's arm64 half");
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x576_EE50, 0x576_EE98, 0x576_F008)
        );
        assert_eq!(profile.current_date, Some(0x574_DDB8));
        assert_eq!(profile.retirement_manager, Some(0x574_42A8));
        assert_eq!(profile.game_ui, Some(0x574_0B60));
        let uuid = [0x94, 0xCD, 0xDC, 0x80, 0x84, 0x74, 0x32, 0x7A, 0x85, 0xE0, 0xE4, 0xFF, 0x95, 0xDC, 0x68, 0x93];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.1's Intel half");
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x5D0_31E8, 0x5D0_3230, 0x5D0_33A0)
        );
        assert_eq!(profile.current_date, Some(0x5CE_3700));
        assert_eq!(profile.retirement_manager, Some(0x5CD_9EF0));
        assert_eq!(profile.game_ui, Some(0x5D0_4CA8));

        // On Windows the Launch Preview's date sits with the arrays.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x19E6_9000, link_timestamp: 0x6ADF_B11C };
        assert_eq!(profile_for(fingerprint).and_then(|profile| profile.current_date), None);

        // The builds of November 2026 on Windows, but Game Pass 0.9.2435.0, which has not been read for it yet, and
        // 27.0.1 on the Mac place the game's own object; on the others the editor looks for it as far from the players
        // pair as there, or else for a pointer to it.
        let placed: Vec<String> =
            built_in_profiles().filter(|profile| profile.game_ui.is_some()).map(|profile| profile.name).collect();
        assert_eq!(
            placed,
            [
                "FM27 0.9.2409.0 (Game Pass)",
                "FM27 Steam build 26340721 (27.0.0)",
                "FM27 Steam build 26385295 (27.0.1)",
                "FM27 Steam build 26385295 (27.0.1, macOS, Intel)",
                "FM27 Steam build 26385295 (27.0.1, macOS, Apple silicon)",
            ]
        );
    }

    /// A profile file left out of [`BUILDS`] would leave its build unknown to the editor.
    #[test]
    fn every_profile_file_is_built_in() {
        let folder = concat!(env!("CARGO_MANIFEST_DIR"), "/../../profiles/fm27");
        let mut files = 0;
        for entry in std::fs::read_dir(folder).expect("the profiles folder") {
            let path = entry.expect("a file of the profiles folder").path();
            let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
            if !name.ends_with(".toml") || name.starts_with("layout") {
                continue;
            }
            let text = std::fs::read_to_string(&path).expect("a profile file");
            assert!(BUILDS.contains(&text.as_str()), "{name} is not built in: add it to BUILDS in profile.rs");
            files += 1;
        }
        assert_eq!(files, BUILDS.len());
        // One profile per build, each for an edition with a layout.
        let profiles: Vec<BuildProfile> = built_in_profiles().collect();
        for (i, profile) in profiles.iter().enumerate() {
            assert!(profiles[i + 1..].iter().all(|other| other.plugin != profile.plugin), "{} twice", profile.name);
            assert_eq!(profile.edition, 27, "{}", profile.name);
        }
    }

    #[test]
    fn profile_text_reads_back() {
        let notes = ProfileNotes {
            header: vec!["FM27 Steam build 1 \"test\"".to_owned()],
            current_date: vec!["13 August 2027 on the save.".to_owned()],
            retirement_manager: vec!["0xDAC0 before the players pair.".to_owned()],
            game_ui: vec!["0x3C80 before the players pair.".to_owned()],
        };
        for profile in built_in_profiles() {
            let text = profile_text(&profile, &notes);
            let read: BuildProfile = toml::from_str(&text).unwrap_or_else(|err| panic!("{text}\n{err}"));
            assert_eq!(read, profile);
        }
        let steam = profile_for(PluginFingerprint::Pe { size_of_image: 0x1821_C000, link_timestamp: 0x6AE5_65AF })
            .expect("Steam build 26340721");
        let text = profile_text(&steam, &notes);
        assert!(text.starts_with("# FM27 Steam build 1 \"test\"\nname = \"FM27 Steam build 26340721 (27.0.0)\"\n"));
        assert!(text.contains("# 13 August 2027 on the save.\ncurrent_date = 0x56AF378\n"), "{text}");
        assert!(text.contains("# 0x3C80 before the players pair.\ngame_ui = 0x5701B50\n"), "{text}");
        assert!(text.contains("\n[plugin]\nsize_of_image = 0x1821C000\nlink_timestamp = 0x6AE565AF\n"), "{text}");
        assert!(text.ends_with("[arrays]\nplayers = 0x57057D0\nstaff = 0x5705818\nclubs = 0x5705988\n"), "{text}");
    }
}
