//! A club's teams as its squad screen shows them, and their captains.
//!
//! A club's `teams` list starts with its senior team; the others are its youth and reserve
//! teams, each with a kind and an age limit (see [`TeamLayout`]). A team's list holds the
//! players under contract with it, those out on loan too, and the players on loan to it. Its
//! captain and vice-captain are pointers to the person blocks of two of its players; making a
//! player captain writes that pointer as a [`Patch`], undone like a move.

use fmlibre_mem::is_user_pointer;
use serde::{Deserialize, Serialize};

use crate::clubs::ClubSummary;
use crate::players::{PlayerIndex, PlayerSummary};
use crate::profile::TeamLayout;
use crate::session::Session;
use crate::transfer::{MoveError, Patch, Patches, PointerList};

/// The most teams of one club the editor reads; clubs have a handful.
const MOST_TEAMS: u64 = 16;

/// The age limit of a team without one.
const NO_AGE_LIMIT: u8 = 100;

/// One of a club's teams, with its players.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubTeam {
    /// Where it is in the club's list of teams; 0 is the senior team.
    pub index: usize,
    /// The game's code for the kind of team: 0 for the first team, 10 for under-21s and 12
    /// for under-18s on the test save.
    pub kind: u8,
    /// The oldest its players may be, e.g. 21; `None` for a team without a limit.
    pub age_limit: Option<u8>,
    /// UIDs of the captain and the vice-captain.
    pub captain: Option<u32>,
    pub vice_captain: Option<u32>,
    pub players: Vec<SquadMember>,
}

/// A player in a team's list, with what the squad screen shows of him beyond his list row.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadMember {
    pub uid: u32,
    /// Whether he plays for this team. A player under contract with it may play for another
    /// team of the club, or for another club on loan.
    pub plays_here: bool,
    pub loan: Option<Loan>,
    /// As stored: energy and match sharpness 0–10000, jadedness from -500 (rested), morale 1–20.
    pub condition: u16,
    pub match_sharpness: u16,
    pub jadedness: i16,
    pub morale: u8,
    /// How many current injuries he has.
    pub injuries: usize,
    /// How many current bans he has.
    pub bans: usize,
}

/// Which way a player in a team's list is on loan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Loan {
    /// Here on loan from another club.
    In,
    /// On loan to another club.
    Out,
}

/// A team's two captaincies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CaptainRole {
    Captain,
    ViceCaptain,
}

impl CaptainRole {
    fn offset(self, t: &TeamLayout) -> u64 {
        match self {
            CaptainRole::Captain => t.captain,
            CaptainRole::ViceCaptain => t.vice_captain,
        }
    }

    fn other(self) -> Self {
        match self {
            CaptainRole::Captain => CaptainRole::ViceCaptain,
            CaptainRole::ViceCaptain => CaptainRole::Captain,
        }
    }
}

/// A captaincy worked out from the game as it is now, ready to be written.
#[derive(Debug, Clone)]
pub struct CaptainPlan {
    pub club: u32,
    pub team: usize,
    /// The team's kind and age limit, to name it by (see [`ClubTeam`]).
    pub kind: u8,
    pub age_limit: Option<u8>,
    pub role: CaptainRole,
    /// Who holds the role now, and who takes it.
    pub old: Option<u32>,
    pub new: u32,
    /// Whether the new holder held the other role, which then goes to `old`.
    pub swapped: bool,
    patches: Vec<Patch>,
}

impl CaptainPlan {
    /// How many writes it takes: none when he holds the role already.
    pub fn writes(&self) -> usize {
        self.patches.len()
    }
}

/// A captaincy that was written: what undoing it takes.
#[derive(Debug, Clone)]
pub struct CaptainSet {
    pub club: u32,
    pub team: usize,
    pub kind: u8,
    pub age_limit: Option<u8>,
    pub role: CaptainRole,
    pub old: Option<u32>,
    pub new: u32,
    pub swapped: bool,
    patches: Vec<Patch>,
}

impl Session {
    /// Every team of `club` with its players, read now. The lists' pointers are told apart by
    /// `players`, as read before: a pointer the index has no player at is left out.
    pub fn club_teams(&self, club: &ClubSummary, players: &PlayerIndex) -> Result<Vec<ClubTeam>, MoveError> {
        let teams = self.team_objects(club)?;
        teams.into_iter().enumerate().map(|(index, team)| self.club_team(club, index, team, players)).collect()
    }

    /// Works out making `player` the captain or the vice-captain of the team at `team` in the
    /// list of `club`'s teams. He must play for that team; when he holds the other role, the
    /// player who held this one takes it. Nothing is written.
    pub fn plan_captain(
        &self,
        club: &ClubSummary,
        team: usize,
        role: CaptainRole,
        player: &PlayerSummary,
        players: &PlayerIndex,
    ) -> Result<CaptainPlan, MoveError> {
        let object = self.team_object(club, team)?;
        let (p, t) = (&self.layout.player, &self.layout.team);
        if self.process.read_u32(player.address + p.at(p.uid, player.shift))? != player.uid {
            return Err(MoveError::Moved { uid: player.uid });
        }
        let list = PointerList::read(&self.process, object + t.players)?.ok_or(MoveError::NotInTeam)?;
        if self.process.read_u64(player.address + p.team)? != object
            || !list.elements(&self.process)?.contains(&player.address)
        {
            return Err(MoveError::NotInTeam);
        }
        let head = self.process.read_bytes(object, t.end() as usize)?;
        let age_limit = head[t.age_limit as usize];
        let block = player.address + p.identity() + player.shift;
        let (here, there) = (object + role.offset(t), object + role.other().offset(t));
        let (held, other) = (self.process.read_u64(here)?, self.process.read_u64(there)?);
        let mut patches = Patches::default();
        patches.push(here, held.to_le_bytes(), block.to_le_bytes());
        let swapped = other == block && held != block;
        if swapped {
            patches.push(there, other.to_le_bytes(), held.to_le_bytes());
        }
        Ok(CaptainPlan {
            club: club.uid,
            team,
            kind: head[t.kind as usize],
            age_limit: (age_limit != NO_AGE_LIMIT).then_some(age_limit),
            role,
            old: self.captain_uid(held, players),
            new: player.uid,
            swapped,
            patches: patches.0,
        })
    }

    /// Writes a planned captaincy, each write only over what the plan found.
    pub fn apply_captain(&self, plan: &CaptainPlan) -> Result<CaptainSet, MoveError> {
        self.apply_patches(&plan.patches)?;
        let CaptainPlan { club, team, kind, age_limit, role, old, new, swapped, ref patches } = *plan;
        Ok(CaptainSet { club, team, kind, age_limit, role, old, new, swapped, patches: patches.clone() })
    }

    /// Gives the role back to whoever held it, provided the team still has it as it was left.
    pub fn undo_captain(&self, done: &CaptainSet) -> Result<(), MoveError> {
        self.undo_patches(&done.patches)
    }

    /// The teams of `club`, each pointing back at it.
    fn team_objects(&self, club: &ClubSummary) -> Result<Vec<u64>, MoveError> {
        let (c, t) = (&self.layout.club, &self.layout.team);
        let not_a_club = || MoveError::NotAClub { uid: club.uid };
        if self.process.read_u32(club.address + c.uid)? != club.uid {
            return Err(not_a_club());
        }
        let Some(list) = PointerList::read(&self.process, club.address + c.teams)? else {
            return Ok(Vec::new());
        };
        if list.len() > MOST_TEAMS {
            return Err(not_a_club());
        }
        let teams = list.elements(&self.process)?;
        for &team in &teams {
            if !is_user_pointer(team) || self.process.read_u64(team + t.club)? != club.address {
                return Err(not_a_club());
            }
        }
        Ok(teams)
    }

    fn team_object(&self, club: &ClubSummary, index: usize) -> Result<u64, MoveError> {
        self.team_objects(club)?.get(index).copied().ok_or(MoveError::NoTeam { index })
    }

    fn club_team(
        &self,
        club: &ClubSummary,
        index: usize,
        team: u64,
        players: &PlayerIndex,
    ) -> Result<ClubTeam, MoveError> {
        let t = &self.layout.team;
        let bytes = self.process.read_bytes(team, t.end() as usize)?;
        let u64_at =
            |offset: u64| u64::from_le_bytes(bytes[offset as usize..offset as usize + 8].try_into().expect("8 bytes"));
        let elements = match PointerList::read(&self.process, team + t.players)? {
            Some(list) => list.elements(&self.process)?,
            None => Vec::new(),
        };
        let age_limit = bytes[t.age_limit as usize];
        Ok(ClubTeam {
            index,
            kind: bytes[t.kind as usize],
            age_limit: (age_limit != NO_AGE_LIMIT).then_some(age_limit),
            captain: self.captain_uid(u64_at(t.captain), players),
            vice_captain: self.captain_uid(u64_at(t.vice_captain), players),
            players: elements.into_iter().filter_map(|object| self.squad_member(club, team, object, players)).collect(),
        })
    }

    /// The player whose identity block `block` is, if the index has him there.
    fn captain_uid(&self, block: u64, players: &PlayerIndex) -> Option<u32> {
        let p = &self.layout.player;
        if !is_user_pointer(block) {
            return None;
        }
        let uid = self.process.read_u32(block + (p.uid - p.identity())).ok()?;
        players.get(uid).filter(|player| player.address + p.identity() + player.shift == block).map(|player| player.uid)
    }

    /// The player at `object` in the list of `team`, if the index has him at that address.
    fn squad_member(&self, club: &ClubSummary, team: u64, object: u64, players: &PlayerIndex) -> Option<SquadMember> {
        let (p, t) = (&self.layout.player, &self.layout.team);
        let object = self.arrays.players.as_ref().map_or(object, |array| array.object(object));
        let player = p.person_block_shifts.iter().find_map(|&shift| {
            let uid = self.process.read_u32(object + p.at(p.uid, shift)).ok()?;
            players.get(uid).filter(|player| player.address == object && player.shift == shift)
        })?;
        let buf = self.process.read_bytes(object, (p.end() + player.shift) as usize).ok()?;
        let at = |offset: u64| p.at(offset, player.shift) as usize;
        let u16_at = |offset: u64| u16::from_le_bytes([buf[at(offset)], buf[at(offset) + 1]]);
        let u64_at = |offset: u64| u64::from_le_bytes(buf[at(offset)..at(offset) + 8].try_into().expect("8 bytes"));

        // He is on loan when the team he plays for and the team his contract is with belong to different clubs.
        let club_of = |team: u64| {
            is_user_pointer(team)
                .then(|| self.process.read_u64(team + t.club).ok())
                .flatten()
                .filter(|&c| is_user_pointer(c))
        };
        let plays_for = u64_at(p.team);
        let contract = u64_at(p.contract);
        let employer = is_user_pointer(contract)
            .then(|| self.process.read_u64(contract + self.layout.contract.team).ok())
            .flatten()
            .and_then(club_of);
        let playing = club_of(plays_for);
        let loan = match (playing, employer) {
            (Some(playing), Some(employer)) if playing != employer => {
                Some(if playing == club.address { Loan::In } else { Loan::Out })
            }
            _ => None,
        };
        Some(SquadMember {
            uid: player.uid,
            plays_here: plays_for == team,
            loan,
            condition: u16_at(p.condition),
            match_sharpness: u16_at(p.match_sharpness),
            jadedness: u16_at(p.jadedness) as i16,
            morale: buf[at(p.morale)],
            injuries: self.injury_count(player),
            bans: self.ban_count(player),
        })
    }
}
