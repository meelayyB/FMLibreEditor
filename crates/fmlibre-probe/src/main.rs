Warning: truncated output (original token count: 79735)
Total output lines: 7118

//! `fmlibre-probe`: a look inside a running Football Manager process.
//!
//! Use it to check that FMLibreEditor can attach to a given build (Steam, Epic, Game
//! Pass) and to map where the game keeps its data. Only `set` writes to the game, one
//! field at a time, through the same checks as the app.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use anyhow::{Context, Result, anyhow, bail, ensure};
use clap::{Args, Parser, Subcommand, ValueEnum};
use fmlibre_core::{
    ATTRIBUTE_GROUPS, ArrayCandidate, ArrayRvas, ArraySource, AttributeBound, BuildProfile, Buyer, CaptainRole,
    ClubIndex, Entity, ExportFormat, ExportHeader, Exported, Field, FmDate, Found, GAME_EXE, GAME_PLUGIN, GameInfo,
    GraphicsIndex, Kind, Loan, MANAGER, MoveTerms, PERSONALITY, POSITIONS, Picture, PlayerFilter, PlayerIndex,
    PlayerOrder, PlayerSort, PrizeAmount, PrizeMoney, PrizeStage, ProfileNotes, Purpose, STAFF_ATTRIBUTE_GROUPS,
    SUPPORTER_MIX, SUPPORTER_TRAITS, Scale, ScanOptions, ScoutOrder, ScoutRequest, Session, SessionError, StaffIndex,
    Target, Tie, TieTarget, date_line, diagnostics_report, find_game, job_name, nations, profile_text, retirement_line,
    saves_loaded_line, scan_object_arrays, sort_players,
};
#[cfg(target_os = "macos")]
use fmlibre_mem::MachImage;
#[cfg(windows)]
use fmlibre_mem::PeImage;
use fmlibre_mem::{Module, Process, is_current_process_elevated, is_user_pointer, list_modules, regions};
use serde::Serialize;

#[cfg(windows)]
const KEY_MODULES: [&str; 4] = [GAME_EXE, "UnityPlayer.dll", "GameAssembly.dll", GAME_PLUGIN];
#[cfg(target_os = "macos")]
const KEY_MODULES: [&str; 4] = [GAME_EXE, "UnityPlayer.dylib", "GameAssembly.dylib", GAME_PLUGIN];

/// What being allowed more than a user is called: it opens the game on Windows, and not on macOS.
#[cfg(windows)]
const ELEVATED: &str = "Running as administrator";
#[cfg(target_os = "macos")]
const ELEVATED: &str = "Running as root";

#[derive(Parser)]
#[command(
    name = "fmlibre-probe",
    version,
    about = "Probe for a running Football Manager 27 process. Only `set` writes to the game.",
    after_help = "Addresses and lengths are hexadecimal; ADDR is 0x... or module+0x..., e.g. game_plugin.dll+0x10 \
                  (game_plugin+0x10 on macOS); INDEX is decimal."
)]
struct Cli {
    /// Process id to use when several copies of the game are running.
    #[arg(long, global = true)]
    pid: Option<u32>,

    /// Also write the report (info and scan) as JSON to this file.
    #[arg(long, global = true, value_name = "FILE")]
    json: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Command>,
}

#[cfg(target_os = "macos")]
#[derive(Subcommand)]
enum BridgeAction {
    /// Install the bridge and its launcher, and have Steam start FM27 through the launcher.
    Setup {
        /// The folder with libfmlibre_bridge.dylib and fmlibre-launch; by default the probe's own.
        #[arg(long, value_name = "FOLDER")]
        from: Option<PathBuf>,
    },
    /// Take the launcher out of FM27's Steam launch options and remove the bridge.
    Remove,
}

#[derive(Subcommand)]
enum Command {
    /// Show the process, storefront, modules and the layout of the game plugin (default).
    Info,
    /// Run the checks the editor makes before it writes, and show what each found.
    Health,
    /// Print the report the app's Copy diagnostics copies for a bug report: the game and its build, where its data was
    /// found, and what the checks found. It holds no names or paths.
    Diagnostics,
    /// Identify the build and locate the player, staff and club arrays, the in-game date and the retirement manager.
    Calibrate {
        /// Ignore the build profile and look for everything, as for an unknown build.
        #[arg(long)]
        scan: bool,
    },
    /// Work out a build profile for the running game as for a build without one: the entity arrays, the in-game date
    /// and the retirement manager, looked for and checked as the editor checks before it writes. Prints the profile,
    /// and compares it with the built-in one when there is one.
    Profile {
        /// Also write the profile to this file, e.g. profiles/fm27/steam-26340721.toml.
        #[arg(long, value_name = "FILE")]
        out: Option<PathBuf>,
    },
    /// Show everything FMLibreEditor reads for the player with this UID.
    Player {
        /// The player's unique ID.
        uid: u32,
    },
    /// List staff (managers, coaches, scouts...), the human manager first, then best first.
    Staff {
        /// Words to look for in names (accents and case are ignored), or a staff id.
        text: Option<String>,
        /// How many to print.
        #[arg(long, default_value_t = 25)]
        limit: usize,
        /// Also write every matching member of staff, not only the ones printed, to this file: what their profiles
        /// hold, as CSV, or as JSON for a name ending in .json.
        #[arg(long, value_name = "FILE")]
        export: Option<PathBuf>,
        /// In the CSV file, semicolons between the values instead of commas, as Excel takes them in many languages.
        #[arg(long, requires = "export")]
        semicolon: bool,
    },
    /// List clubs, highest reputation first, optionally only those matching TEXT.
    Clubs {
        /// Words to look for in club names (accents and case are ignored), or a UID.
        text: Option<String>,
        /// How many to print.
        #[arg(long, default_value_t = 25)]
        limit: usize,
        /// Also write every matching club, not only the ones printed, to this file: what their profiles hold, as CSV,
        /// or as JSON for a name ending in .json.
        #[arg(long, value_name = "FILE")]
        export: Option<PathBuf>,
        /// In the CSV file, semicolons between the values instead of commas, as Excel takes them in many languages.
        #[arg(long, requires = "export")]
        semicolon: bool,
    },
    /// Show everything FMLibreEditor reads for the club with this UID.
    Club {
        /// The club's unique ID.
        uid: u32,
    },
    /// Show everything FMLibreEditor reads for the member of staff with this id.
    StaffMember {
        /// The staff id.
        uid: u32,
    },
    /// Where clubs keep their staff, job by job: how many of each job the club's medical, coaching and scouting lists
    /// hold, and at which offsets the club or one of its teams points at a member of staff itself. Only reads memory
    StaffPlaces {
        /// Only this job code (see `staff`), with more of its people named.
        #[arg(long)]
        job: Option<u8>,
        /// Instead, what this offset of every club holds: nothing, a member of staff (by job), or something else.
        #[arg(long, value_parser = parse_hex)]
        club_offset: Option<u64>,
        /// Instead, what this offset of every team holds, by the kind of team: nothing, a member of staff (by job, and
        /// whether his contract is with that team), or something else; with the clubs whose senior team holds no one
        /// there while their departments have staff.
        #[arg(long, value_parser = parse_hex)]
        team_offset: Option<u64>,
        /// Instead, what this offset of every member of staff's contract holds, by job: zero, the contract's team or
        /// senior team, or something else; and the class of the contracts.
        #[arg(long, value_parser = parse_hex)]
        contract_offset: Option<u64>,
    },
    /// Count the classes of the contracts of players and of staff (db::FULL_CONTRACT, db::BASIC_CONTRACT, ...), with a
    /// few people of each. Only reads memory
    ContractClasses,
    /// Read LEN bytes at ADDR as 8-byte words and name those that point at a member of staff (his object, identity or
    /// person block): his id, name, job and club. Only reads memory
    StaffAt {
        /// Where to start, e.g. a hit from `refs`.
        addr: String,
        /// How many bytes to read.
        #[arg(long, default_value = "0x100")]
        len: String,
    },
    /// Find every pointer to these members of staff (their object or person block) in the game's memory, and say what
    /// holds each: a club or one of its teams (and where in it), his contract, an entry of someone's relations, a list
    /// of staff, a thread's stack, or else the object whose vtable comes last before it, by class and offset. Counted
    /// for each member of staff, then over all of them. Only reads memory
    StaffRefs {
        /// The members of staff's ids.
        #[arg(required = true)]
        ids: Vec<u32>,
        /// How far before a pointer to look for the vtable of the object that holds it.
        #[arg(long, default_value = "0x400")]
        back: String,
        /// Also print where each pointer is whose holder's name holds this text.
        #[arg(long)]
        show: Option<String>,
    },
    /// List players, best first, optionally only those matching TEXT.
    Players {
        /// Words to look for in player names (accents and case are ignored), or a UID.
        text: Option<String>,
        /// How many players to print.
        #[arg(long, default_value_t = 25)]
        limit: usize,
        #[command(flatten)]
        filter: PlayerFilterArgs,
        /// Also write every matching player, not only the ones printed, to this file: what their profiles hold, as
        /// CSV, or as JSON for a name ending in .json.
        #[arg(long, value_name = "FILE")]
        export: Option<PathBuf>,
        /// In the CSV file, semicolons between the values instead of commas, as Excel takes them in many languages.
        #[arg(long, requires = "export")]
        semicolon: bool,
    },
    /// List the fields the editor can change, or with --stats check them against every object.
    Fields {
        #[arg(value_enum)]
        entity: EntityArg,
        /// Read every player, member of staff or club and show the values each field holds.
        #[arg(long)]
        stats: bool,
    },
    /// Show the editable fields of one player, member of staff or club.
    Get {
        #[arg(value_enum)]
        entity: EntityArg,
        /// UID of the player or club, or staff id.
        uid: u32,
        /// Field keys, from `fields`; all fields when none are given.
        fields: Vec<String>,
    },
    /// Change one field of a player, member of staff or club in the running game.
    Set {
        #[arg(value_enum)]
        entity: EntityArg,
        /// UID of the player or club, or staff id.
        uid: u32,
        /// The field's key, from `fields`.
        field: String,
        /// The new value as stored (attributes 0-100), as shown with --shown (1-20), or a
        /// date as YYYY-MM-DD.
        #[arg(allow_negative_numbers = true)]
        value: String,
        /// VALUE is as the game shows it.
        #[arg(long)]
        shown: bool,
        /// Write the old value back afterwards and check it: tests a field without changing the save.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before writing the old value back, to look at the game.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Move a player to another club's senior team in the running game.
    Move {
        /// The player's UID.
        uid: u32,
        /// The UID of the club he joins.
        club: u32,
        /// A new wage in pounds per week; the contract's otherwise.
        #[arg(long)]
        wage: Option<i64>,
        /// A new contract end as YYYY-MM-DD; the contract's otherwise.
        #[arg(long)]
        expires: Option<String>,
        /// A transfer fee in pounds, which the club he joins pays his old one: out of its balance and transfer budget,
        /// into the other's balance.
        #[arg(long)]
        fee: Option<i64>,
        /// The UID of a player of the club's senior team to release in the same move, to make room in a full squad
        /// list: he takes that player's place in it.
        #[arg(long)]
        release: Option<u32>,
        /// Move him back afterwards and check it: tests a move without changing the save.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before moving him back, to look at the game meanwhile.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Make the loan of a player permanent in the running game: he stays at the club he is on loan to, now under
    /// contract with it, and leaves his own club.
    Permanent {
        /// The player's UID.
        uid: u32,
        /// A new wage in pounds per week; his contract's otherwise.
        #[arg(long)]
        wage: Option<i64>,
        /// A new contract end as YYYY-MM-DD; his contract's otherwise.
        #[arg(long)]
        expires: Option<String>,
        /// Put it all back afterwards and check it: tests the change without changing the save.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before putting it back, to look at the game meanwhile.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Show the name of the stadium a club plays at and the names it can take in place; with NAME, rename it in the
    /// running game. Without a club, how many stadiums' names the editor can change, by the size of their blocks.
    StadiumName {
        /// The club's UID.
        club: Option<u32>,
        /// The new name.
        name: Option<String>,
        /// Put the old name back afterwards and check it: tests the change without changing the save.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before putting it back, to look at the game meanwhile.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Show the prize money competitions pay by final position and per match, as the settings of their stages hold
    /// it, optionally only for those matching TEXT. With --place, --win, --draw or --loss, change it in the running
    /// game, in each settings of the one competition TEXT names, to see whether the game pays what they say.
    Prizes {
        /// Words to look for in the competitions' names (accents and case are ignored), or a competition's UID.
        text: Option<String>,
        /// Only the settings at this address, as listed: for one of a competition's groups.
        #[arg(long, value_name = "ADDR")]
        settings: Option<String>,
        /// Change what a final position pays (1 for the first place) to AMOUNT pounds; may be given more than once.
        #[arg(long, num_args = 2, value_names = ["POSITION", "AMOUNT"])]
        place: Option<Vec<u32>>,
        /// Change what a win pays to AMOUNT pounds (both of the words the game keeps for it).
        #[arg(long, value_name = "AMOUNT")]
        win: Option<u32>,
        /// Change what a draw pays to AMOUNT pounds.
        #[arg(long, value_name = "AMOUNT")]
        draw: Option<u32>,
        /// Change what a loss pays to AMOUNT pounds.
        #[arg(long, value_name = "AMOUNT")]
        loss: Option<u32>,
        /// Also list the settings that pay nothing, and those no stage holds.
        #[arg(long)]
        all: bool,
        /// Put the amounts back afterwards and check them: tests the change without changing the save.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before putting them back, to look at the game meanwhile.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Work out a move as the app's transfer dialog does, on the player's contract, and say whether it can be made.
    /// Writes nothing.
    Plan {
        /// The player's UID.
        uid: u32,
        /// The UID of the club he would join.
        club: u32,
        /// The UID of a player of that club to release in the same move, to make room.
        #[arg(long)]
        release: Option<u32>,
    },
    /// Release a player from his club in the running game: he becomes a free agent.
    Release {
        /// The player's UID.
        uid: u32,
        /// Bring him back afterwards and check it: tests a release without changing the save.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before bringing him back, to look at the game meanwhile.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Move a member of staff to another club in the running game, in the departments he works in.
    StaffMove {
        /// The member of staff's id.
        id: u32,
        /// The UID of the club he joins.
        club: u32,
        /// The job he takes there (a job code, see `staff-job`), where it is; his own job, in the departments he works
        /// in, when left out.
        #[arg(long)]
        job: Option<u8>,
        /// Move him back afterwards and check it: tests a move without changing the save.
        #[arg(long)]
        restore: bool,
    },
    /// Give a member of staff another job at his club in the running game (a job code, see `staff`).
    StaffJob {
        /// The member of staff's id.
        id: u32,
        /// The new job's code: 2 coach, 10 director of football, 12 physio, 14 scout, 16 manager, 20 assistant coach,
        /// 26 fitness coach, 34 goalkeeping coach, 38 chief doctor, 46 doctor, 60 performance analyst, 62 head
        /// performance analyst, 86 loan manager, 88 technical director, ...
        job: u8,
        /// Give him his old job back afterwards and check it.
        #[arg(long)]
        restore: bool,
    },
    /// Sign a member of staff who has no club for a club in the running game, as JOB, under a contract the editor makes
    /// in a slot of the game's own pool of contracts, modelled on one of the club's staff's.
    StaffSign {
        /// The member of staff's id.
        id: u32,
        /// The UID of the club he joins.
        club: u32,
        /// The job he takes (a job code, see `staff-job`).
        job: u8,
        /// Pounds per week; the model's when left out.
        #[arg(long)]
        wage: Option<i64>,
        /// The contract's end, as YYYY-MM-DD; 30 June at the end of next season when left out.
        #[arg(long, value_parser = parse_iso_date)]
        expires: Option<FmDate>,
        /// Undo it afterwards and check it: tests a signing without changing the save.
        #[arg(long)]
        restore: bool,
    },
    /// Show a player's current injuries, and with --heal heal them in the running game.
    Heal {
        /// The player's UID.
        uid: u32,
        /// Heal them: empty his list of current injuries.
        #[arg(long)]
        heal: bool,
        /// With --heal, list them again afterwards and check it.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before listing them again, to look at the game.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Show a player's current bans, and with --lift lift them in the running game; with no UID, list every player
    /// who has one.
    Bans {
        /// The player's UID.
        uid: Option<u32>,
        /// Lift them: take them out of his list of absences.
        #[arg(long, requires = "uid")]
        lift: bool,
        /// With --lift, list them again afterwards and check it.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before listing them again, to look at the game.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// List the retirements the game has planned; with a UID, show the player's, and with --keep keep him from
    /// retiring in the running game: his plan taken out, and the trait to play on as long as possible.
    Retirements {
        /// The player's UID.
        uid: Option<u32>,
        /// Keep him from retiring.
        #[arg(long, requires = "uid")]
        keep: bool,
        /// With --keep, put it all back afterwards and check it.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before putting it back, to look at the game.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Show a player's ties: his secondary nationalities, and the nations and clubs he was trained in.
    Ties {
        /// The player's UID.
        uid: u32,
        /// Also print every entry of his list of relations as stored, the kinds the editor leaves alone included.
        #[arg(long)]
        all: bool,
    },
    /// List the players on loan: the club they are on loan to, the club they belong to, and the days the loan runs
    /// from and to. With a UID, only that player.
    Loans {
        /// Only this player.
        uid: Option<u32>,
        /// Only loans to or from the club with this UID.
        #[arg(long)]
        club: Option<u32>,
        /// Also print each loan contract's bytes from the squad number on.
        #[arg(long)]
        raw: bool,
        /// How many loans to print.
        #[arg(long, default_value_t = 40)]
        max: usize,
    },
    /// Count the kinds of relation in every player's list of relations; with --kind, the targets of that kind, the
    /// counts it holds, and a few players who have one with the club they play for.
    RelationKinds {
        /// The kind of relation to look into, as `ties --all` prints it (`rel`).
        #[arg(long)]
        kind: Option<u8>,
        /// How many players to name for each target.
        #[arg(long, default_value_t = 4)]
        examples: usize,
    },
    /// Point one of a player's ties at another nation or club, or give a training another homegrown rule.
    TieSet {
        /// The player's UID.
        uid: u32,
        /// The tie's number, from `ties`.
        index: usize,
        /// The UID of the nation it points at instead.
        #[arg(long, conflicts_with = "club")]
        nation: Option<u32>,
        /// The UID of the club it points at instead.
        #[arg(long)]
        club: Option<u32>,
        /// The homegrown rule of a training: 1 for 15-21, 2 for 0-21, 5 for 15-21 excluding loans, 10 for 0-19.
        #[arg(long)]
        rule: Option<u8>,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Take one of a player's ties out of his list.
    TieRemove {
        /// The player's UID.
        uid: u32,
        /// The tie's number, from `ties`.
        index: usize,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Give a player another tie: where his list has no room, it is grown into memory the editor takes.
    TieAdd {
        /// The player's UID.
        uid: u32,
        #[arg(value_enum)]
        tie: TieArg,
        /// The UID of the nation, or of the club for a club he was trained at.
        target: u32,
        /// The homegrown rule of a training: 1 for 15-21, 2 for 0-21, 5 for 15-21 excluding loans, 10 for 0-19.
        #[arg(long)]
        rule: Option<u8>,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Swap two players between their clubs in the running game.
    Swap {
        /// The UID of one player.
        uid: u32,
        /// The UID of the player he swaps with.
        other: u32,
        /// Swap them back afterwards and check it: tests a swap without changing the save.
        #[arg(long)]
        restore: bool,
    },
    /// What a scout would tell the human manager's club: with --position, the players to sign there (for the roles
    /// given, or the best role of the position for each player); with --squad, the squad line by line and the players
    /// to let go; with --tactics, the tactics the manager plays. Only reads memory.
    Scout {
        /// The club (the human manager's when none).
        #[arg(long)]
        club: Option<u32>,
        /// The position to recommend players for, e.g. dr, dc, amr.
        #[arg(long)]
        position: Option<String>,
        /// Roles to recommend for, by key (e.g. ifb, pfb); the best of the position's when none.
        #[arg(long)]
        ip: Option<String>,
        #[arg(long)]
        oop: Option<String>,
        /// firstTeam, rotation, future or any.
        #[arg(long, default_value = "firstTeam")]
        purpose: String,
        #[arg(long)]
        max_age: Option<u16>,
        /// Only players at least this likely (0-100) to join.
        #[arg(long)]
        min_probability: Option<u8>,
        /// score, fit, probability or fee.
        #[arg(long, default_value = "score")]
        order: String,
        #[arg(long, default_value_t = 25)]
        limit: usize,
        /// Show the squad line by line and the players to let go.
        #[arg(long)]
        squad: bool,
        /// Show the tactics the manager plays (a pass over the game's memory).
        #[arg(long)]
        tactics: bool,
    },
    /// Show a club's teams: their kind, captains and players with their live values.
    Teams {
        /// The club's UID.
        club: u32,
    },
    /// How full a club's senior squad list is, and the players a move to the club can release to make room (move
    /// --release), the one the app suggests first. Without a club, the clubs whose lists are full, best known first.
    Room {
        /// The club's UID.
        club: Option<u32>,
        /// Without a club, stop after this many.
        #[arg(long, default_value_t = 20)]
        max: usize,
    },
    /// Make a player the captain or vice-captain of his team in the running game.
    Captain {
        /// The club's UID.
        club: u32,
        /// The player's UID; he must play for the team.
        uid: u32,
        /// Make him vice-captain instead.
        #[arg(long)]
        vice: bool,
        /// Which of the club's teams, 0 for the senior team.
        #[arg(long, default_value_t = 0)]
        team: usize,
        /// Give the role back afterwards and check it.
        #[arg(long)]
        restore: bool,
        /// With --restore, how many seconds to wait before giving it back, to look at the game.
        #[arg(long, default_value_t = 0)]
        hold: u64,
    },
    /// Read the graphics packs (logos, faces, flags) and show what they hold. Needs no game.
    Graphics {
        /// The graphics folder; by default Documents\Sports Interactive\Football Manager 27\graphics
        /// (~/Library/Application Support/Sports Interactive/Football Manager 27/graphics on macOS).
        #[arg(long)]
        root: Option<PathBuf>,
        /// Club UIDs to look up.
        clubs: Vec<u32>,
    },
    /// macOS: show whether Football Manager loads the FMLibreEditor bridge when Steam starts it,
    /// or set it up or take it out (Steam must not be running). Needs no game.
    #[cfg(target_os = "macos")]
    Bridge {
        #[command(subcommand)]
        action: Option<BridgeAction>,
    },
    /// Find (begin, end) arrays of game objects in the game plugin and count their vtables.
    Scan {
        /// Smallest array to report.
        #[arg(long, default_value_t = 500)]
        min: u64,
        /// Largest array to report.
        #[arg(long, default_value_t = 2_000_000)]
        max: u64,
        /// How many arrays to print.
        #[arg(long, default_value_t = 25)]
        top: usize,
    },
    /// Hex-dump memory at ADDR.
    Dump {
        /// Address to dump, e.g. 0x1d2f0a40 or game_plugin.dll+0x1000.
        addr: String,
        /// Number of bytes to dump.
        #[arg(long, default_value = "0x200")]
        len: String,
        /// Write the raw bytes to this file instead of printing them (unreadable pages as zeros), e.g. to compare
        /// two moments of the game.
        #[arg(long)]
        out: Option<PathBuf>,
    },
    /// Follow the (begin, end) pair stored at PAIR and dump element INDEX of that array.
    Element {
        /// Address of the (begin, end) pair, e.g. game_plugin.dll+0x57037d0.
        pair: String,
        /// Element index (decimal).
        index: u64,
        /// Number of bytes of the element to dump.
        #[arg(long, default_value = "0x400")]
        len: String,
    },
    /// Print the field at OFFSET of each element of the array at PAIR, e.g. a UID.
    Column {
        /// Address of the (begin, end) pair, e.g. game_plugin.dll+0x57037d0.
        pair: String,
        /// Field offset inside each element, e.g. 0x294.
        offset: String,
        /// Field type.
        #[arg(long = "type", value_enum, default_value_t = FieldType::U32)]
        kind: FieldType,
        /// How many elements to print, from the start of the array.
        #[arg(long, default_value_t = 20)]
        first: u64,
        /// Search the whole array for elements whose field equals this decimal value.
        #[arg(long)]
        find: Option<u64>,
    },
    /// Search the game's memory for text (as UTF-8 and UTF-16), bytes or a number.
    Find {
        /// What to look for: text by default; hex bytes or a number with --as.
        pattern: String,
        /// How to read PATTERN.
        #[arg(long = "as", value_enum, default_value_t = PatternKind::Text)]
        kind: PatternKind,
        /// Only search this module, e.g. game_plugin.dll.
        #[arg(long)]
        module: Option<String>,
        /// Stop after this many hits.
        #[arg(long, default_value_t = 20)]
        max: usize,
        /// Only report hits with these hex bytes within --within bytes of them, e.g. a person's UID beside a date.
        #[arg(long)]
        near: Option<String>,
        /// How far from a hit --near may be, in bytes, before or after it.
        #[arg(long, default_value = "0x40")]
        within: String,
    },
    /// Hash every 4 KiB page of the game's readable memory into OUT; with --against an earlier OUT, also save the
    /// pages whose hash changed (or that are new) to OUT.pages, as (u64 address, 4096 bytes) records. Taken around
    /// one change in the game, the saved pages hold the bytes it wrote.
    Pages {
        /// File for the page hashes: (u64 address, u64 hash) records.
        out: PathBuf,
        /// An earlier hash file to compare with.
        #[arg(long)]
        against: Option<PathBuf>,
    },
    /// Find the pointers to ADDR in the game's memory, e.g. everything that refers to a player.
    Refs {
        /// The address pointed at; `player` and `club` print object addresses.
        addr: String,
        /// Also count pointers into the SPAN bytes from ADDR on, e.g. into a person block.
        #[arg(long, default_value = "1")]
        span: String,
        /// Stop after this many hits.
        #[arg(long, default_value_t = 100)]
        max: usize,
    },
    /// Find the (begin, end) arrays in the game's memory that hold the 8-byte slot at ADDR,
    /// e.g. a hit from `refs`, and the object each array belongs to.
    Holders {
        /// The address of an array slot.
        addr: String,
        /// Stop after this many hits.
        #[arg(long, default_value_t = 20)]
        max: usize,
    },
    /// Read every team's player list and show how the game's allocator spaces their buffers.
    Squads,
    /// How the game's allocator places the buffers of the players' lists of relations: by capacity, how far apart
    /// they are, what precedes and follows them, and which blocks between them hold no list.
    RelationBlocks {
        /// The capacity, in entries, to look into closely.
        #[arg(long, default_value_t = 3)]
        entries: u64,
        /// How many blocks around the first buffers to print.
        #[arg(long, default_value_t = 24)]
        show: usize,
    },
    /// Find the game's own allocators in the game plugin's writable data and show, for each, the header it puts
    /// before a block and its size classes: the block each size asked for gets. Only reads memory
    Allocators,
    /// Find where clubs or players keep a value seen in another tool: from each club and its senior
    /// team, or from each player, follow pointers up to --depth hops and print the places where every
    /// one given holds its own value, under several encodings.
    Related {
        /// A club UID and the value seen for it, e.g. 602=42; give several clubs.
        #[arg(long = "club", value_parser = parse_club_value, required_unless_present = "players", conflicts_with = "players")]
        clubs: Vec<(u32, f64)>,
        /// A player UID and the value seen for him, e.g. 85139014=-500; give several players.
        #[arg(long = "player", value_parser = parse_club_value)]
        players: Vec<(u32, f64)>,
        /// How many pointers to follow from the club and its senior team.
        #[arg(long, default_value_t = 2)]
        depth: usize,
        /// How many bytes to read from each object.
        #[arg(long, default_value = "0x400")]
        span: String,
        /// How far a value may be from the one seen, in the units seen (percentages are often rounded).
        #[arg(long, default_value_t = 1.0)]
        tolerance: f64,
        /// Accept a field on any scale: the values seen must lie on one line (seen = a * stored + b) with the
        /// stored ones, within --tolerance. Give four or more, as any two points make a line.
        #[arg(long)]
        linear: bool,
    },
    /// Find a player field whose average over a club's senior team is a value seen for the club:
    /// for each offset of the player object, the mean over the players who play for the team.
    TeamAverage {
        /// A club UID and the value seen for it, e.g. 680=48; give several clubs.
        #[arg(long = "club", value_parser = parse_club_value, required = true)]
        clubs: Vec<(u32, f64)>,
        /// How far a mean may be from the value seen.
        #[arg(long, default_value_t = 0.6)]
        tolerance: f64,
    },
    /// Show, for each senior player of a club, the value FM27 Editor (Jackhamerp24's, GPL-3.0) edits as team
    /// cohesion: his entry for the club in the second list of the record his `relations` pointer leads to. The places
    /// are the layout's `[cohesion]`, or those given for a layout without it: where they do not hold, it says where
    /// the squad's lists name a club in common. (What FM27 Editor edits as tactical familiarity, player +0x190 on
    /// Windows, is his versatility.) With --set, it sets the cohesion of the club's senior players: this writes.
    Cohesion {
        /// The UIDs of the clubs; give several to compare them.
        #[arg(required = true)]
        clubs: Vec<u32>,
        /// Where the list of cohesion entries starts in the record of relations: the layout's, else 0x18.
        #[arg(long, conflicts_with = "set")]
        list: Option<String>,
        /// Where the club keeps the `i32` index its cohesion entries name it by: the layout's, else 0x8.
        #[arg(long, conflicts_with = "set")]
        club_index: Option<String>,
        /// Also print each list's entries as stored.
        #[arg(long)]
        raw: bool,
        /// Set to this, 1..100, the cohesion of each senior player who has an entry for the club; one club only.
        #[arg(long, value_parser = clap::value_parser!(i8).range(1..=100))]
        set: Option<i8>,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Find where clubs or players keep a value in records that point back at them: every pointer to
    /// each club's senior team (or club, with --to-club), or to each player's object or person block,
    /// is found in memory, and the bytes around it are compared, at the same distance from the
    /// pointer, with the value seen for that club or player.
    Nearby {
        /// A club UID and the value seen for it, e.g. 680=48; give several clubs.
        #[arg(long = "club", value_parser = parse_club_value, required_unless_present = "players", conflicts_with = "players")]
        clubs: Vec<(u32, f64)>,
        /// A player UID and the value seen for him, e.g. 85139014=63; give several players.
        #[arg(long = "player", value_parser = parse_club_value)]
        players: Vec<(u32, f64)>,
        /// Look around pointers to the club object instead of its senior team.
        #[arg(long)]
        to_club: bool,
        /// How far around each pointer to look, in bytes.
        #[arg(long, default_value = "0x800")]
        window: String,
        /// How far a value may be from the one seen, in the units seen.
        #[arg(long, default_value_t = 0.6)]
        tolerance: f64,
        /// Compare kinds of record that each one given has up to this many of (a team has a few of its own; a
        /// player is pointed at by many more records).
        #[arg(long, default_value_t = 4)]
        per_kind: usize,
        /// Also compare the bytes around pointers in records without a vtable before them, such as list entries.
        #[arg(long)]
        bare: bool,
        /// Players: look for records that name each one by his UID (a u32) instead of pointing at him.
        #[arg(long, requires = "players")]
        by_uid: bool,
    },
    /// Print the current injuries of the players of one club.
    Injuries {
        /// The club's UID.
        club: u32,
    },
    /// Scan the player object for fields no layout names yet: u16 values in a range across all
    /// players, pointer lists that only a few players have, and the values of one club's players.
    Stats {
        /// Smallest u16 value a candidate takes.
        #[arg(long, default_value_t = 0)]
        min: u16,
        /// Largest u16 value a candidate takes.
        #[arg(long, default_value_t = 10_000)]
        max: u16,
        /// Also print, for the players of the club with this UID, each candidate's value.
        #[arg(long)]
        club: Option<u32>,
        /// Also list the pointers only some players have, marking those this player (UID) has.
        #[arg(long)]
        player: Option<u32>,
    },
    /// Count the values one field holds across all players, with their average age and a few names: what
    /// codes a field uses, or which offset holds a value the game shows.
    Histogram {
        /// Offset in the player object (before any person-block shift), or with --contract in his contract.
        offset: String,
        #[arg(long = "type", value_enum, default_value_t = FieldType::U8)]
        kind: FieldType,
        /// Read the field from the player's contract.
        #[arg(long)]
        contract: bool,
        /// Only players of clubs whose name contains this text.
        #[arg(long)]
        club: Option<String>,
        /// Show at most this many values, the most frequent first.
        #[arg(long, default_value_t = 30)]
        top: usize,
    },
    /// List the C++ classes game_plugin names whose names hold TEXT (case ignored), e.g. UNHAPP or PROMISE:
    /// the type names the compiler keeps for each class with virtual functions (MSVC's on Windows, the Itanium
    /// C++ ABI's on macOS, where templates are left out).
    Types {
        /// Text the class name must hold, e.g. HAPPINESS.
        text: String,
        /// Print at most this many names.
        #[arg(long, default_value_t = 200)]
        max: usize,
    },
    /// Find the objects of one C++ class in the game's memory: its vtables, from its type name, and every object
    /// that starts with one of them.
    Instances {
        /// The class, as `types` prints it, e.g. db::ACTUAL_PLAYER.
        class: String,
        /// Print at most this many objects.
        #[arg(long, default_value_t = 20)]
        max: usize,
        /// Only objects whose first --span bytes hold these hex bytes, e.g. a player's UID or an address.
        #[arg(long)]
        holds: Option<String>,
        /// How many bytes of each object --holds looks at, and `instances` prints.
        #[arg(long, default_value = "0x80")]
        span: String,
        /// Instead of the objects, what each 8-byte place of them holds across all of them: how many are zero, how many
        /// a pointer into the heap, into a module, or something else, and the commonest values.
        #[arg(long)]
        fields: bool,
        /// Also name the players, staff, clubs, teams and contracts each object points at.
        #[arg(long)]
        names: bool,
    },
    /// List the extras of contracts: with a UID, one player's clauses and bonuses; without, how many contracts hold
    /// each kind of entry, its amounts and a few players who have one.
    Clauses {
        /// A player's UID.
        uid: Option<u32>,
    },
    /// Give one of a player's contract clauses another amount or condition.
    ClauseSet {
        /// The player's UID.
        uid: u32,
        /// The clause's number, from `clauses`.
        index: usize,
        /// The new amount, in pounds.
        #[arg(long)]
        amount: Option<u32>,
        /// The new condition.
        #[arg(long)]
        condition: Option<u16>,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Take one of a player's contract clauses out of his contract.
    ClauseRemove {
        /// The player's UID.
        uid: u32,
        /// The clause's number, from `clauses`.
        index: usize,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Give a player's contract a release clause, where its list has room.
    ClauseAdd {
        /// The player's UID.
        uid: u32,
        /// The release clause's amount, in pounds.
        amount: u32,
        #[command(flatten)]
        restore: RestoreArgs,
    },
    /// Show the record a contract's +0x30 points at, which seems to hold the player's unhappiness: with a UID, his
    /// entries; without, how many players have how many, and a few of them.
    Concerns {
        /// A player's UID.
        uid: Option<u32>,
    },
    /// Show the memory region that holds ADDR and the start of its allocation.
    Region {
        /// Any address in the game process.
        addr: String,
    },
    /// Show the (begin, end) arrays inside the object at ADDR and name the players, staff
    /// and clubs they hold.
    Lists {
        /// The object's address, e.g. a club or a team.
        addr: String,
        /// How many bytes of the object to look through.
        #[arg(long, default_value = "0x800")]
        len: String,
    },
    /// List the game's pools of objects (see object_pool.rs): where each keeps its chunks, the size of its slots, how
    /// many are free and used, and the class of the objects in it. Only reads memory
    Pools {
        /// Only the pool whose chunks hold this address, e.g. a contract's, and which of its slots does.
        #[arg(long)]
        holding: Option<String>,
        /// Follow each pool's chain of free slots and check it against the pool's count.
        #[arg(long)]
        walk: bool,
    },
}

/// Putting a change back afterwards, to test it without changing the save.
#[derive(Args, Clone, Copy)]
struct RestoreArgs {
    /// Put it back afterwards and check it.
    #[arg(long)]
    restore: bool,
    /// With --restore, how many seconds to wait first, to look at the game meanwhile.
    #[arg(long, default_value_t = 0)]
    hold: u64,
}

/// A tie of a player to a nation or club.
#[derive(Clone, Copy, ValueEnum)]
enum TieArg {
    /// A secondary nationality.
    Nationality,
    /// A nation he was trained in.
    Nation,
    /// A club he was trained at.
    Club,
    /// A nation he needs no work permit in (England, Scotland).
    Permit,
}

#[derive(Clone, Copy, ValueEnum)]
enum EntityArg {
    Player,
    Staff,
    Club,
}

impl From<EntityArg> for Entity {
    fn from(arg: EntityArg) -> Self {
        match arg {
            EntityArg::Player => Entity::Player,
            EntityArg::Staff => Entity::Staff,
            EntityArg::Club => Entity::Club,
        }
    }
}

#[derive(Clone, Copy, ValueEnum)]
enum PatternKind {
    /// Text, matched as UTF-8 and as UTF-16LE.
    Text,
    /// Bytes such as "c7 80 ea 07".
    Hex,
    /// A little-endian u16, decimal or 0x-prefixed hex.
    U16,
    /// A little-endian u32, decimal or 0x-prefixed hex.
    U32,
}

#[derive(Clone, Copy, ValueEnum)]
enum FieldType {
    U8,
    U16,
    U32,
    U64,
}

impl FieldType {
    fn width(self) -> usize {
        match self {
            FieldType::U8 => 1,
            FieldType::U16 => 2,
            FieldType::U32 => 4,
            FieldType::U64 => 8,
        }
    }

    fn decode(self, bytes: &[u8]) -> u64 {
        let mut buf = [0u8; 8];
        buf[..bytes.len()].copy_from_slice(bytes);
        u64::from_le_bytes(buf)
    }
}

fn main() -> ExitCode {
    // Unoptimized, parsing this many commands and running them takes more stack than the 1 MB Windows gives the
    // main thread (macOS gives it 8 MB), so the probe runs on a thread of its own with more.
    let probe = std::thread::Builder::new().stack_size(16 << 20).spawn(|| match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("error: {err:#}");
            ExitCode::FAILURE
        }
    });
    // A panic has already printed its message.
    match probe {
        Ok(probe) => probe.join().unwrap_or(ExitCode::FAILURE),
        Err(err) => {
            eprintln!("error: could not start the probe: {err}");
            ExitCode::FAILURE
        }
    }
}

fn run(cli: Cli) -> Result<()> {
    if let Some(Command::Graphics { root, clubs }) = cli.command {
        return graphics(root, &clubs);
    }
    #[cfg(target_os = "macos")]
    if let Some(Command::Bridge { action }) = cli.command {
        return bridge(action);
    }
    let elevated = is_current_process_elevated();
    let writes = matches!(
        cli.command,
        Some(
            Command::Set { .. }
                | Command::Move { .. }
                | Command::Permanent { .. }
                | Command::StadiumName { name: Some(_), .. }
                | Command::Prizes { place: Some(_), .. }
                | Command::Prizes { win: Some(_), .. }
                | Command::Prizes { draw: Some(_), .. }
                | Command::Prizes { loss: Some(_), .. }
                | Command::Release { .. }
                | Command::StaffMove { .. }
                | Command::StaffJob { .. }
                | Command::StaffSign { .. }
                | Command::Swap { .. }
                | Command::Heal { heal: true, .. }
                | Command::Bans { lift: true, .. }
                | Command::Retirements { keep: true, .. }
                | Command::ClauseSet { .. }
                | Command::ClauseRemove { .. }
                | Command::ClauseAdd { .. }
                | Command::TieSet { .. }
                | Command::TieRemove { .. }
                | Command::TieAdd { .. }
                | Command::Captain { .. }
                | Command::Cohesion { set: Some(_), .. }
        )
    );
    let process = attach(cli.pid, elevated, writes)?;
    let json = cli.json.as_deref();
    // The probe is how a new build gets its profile: its write commands work on a build without one, as far as the
    // checks allow.
    let connect = |process: Process, source: ArraySource| -> Result<Session, SessionError> {
        let session = Session::connect(process, source)?;
        if writes && !session.known_build() {
            eprintln!("note: no build profile for this build; writing where the checks pass (see `health`)");
            session.allow_unknown_build();
        }
        Ok(session)
    };

    match cli.command.unwrap_or(Command::Info) {
        Command::Info => {
            let (game, modules) = inspect(&process)?;
            info(&process, &game, &modules, elevated, json)
        }
        Command::Health => health(&connect(process, ArraySource::ProfileFirst)?),
        Command::Diagnostics => {
            print!("{}", diagnostics_report(&connect(process, ArraySource::ProfileFirst)?, env!("CARGO_PKG_VERSION")));
            Ok(())
        }
        Command::Calibrate { scan } => {
            let source = if scan { ArraySource::ScanOnly } else { ArraySource::ProfileFirst };
            calibrate(&connect(process, source)?)
        }
        Command::Profile { out } => profile(&connect(process, ArraySource::ScanOnly)?, out.as_deref()),
        Command::Player { uid } => player(&connect(process, ArraySource::ProfileFirst)?, uid),
        Command::Staff { text, limit, export, semicolon } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let export = export.as_deref().map(|path| (path, export_format(path, semicolon)));
            staff(&session, text.as_deref(), limit, export)
        }
        Command::StaffMember { uid } => staff_member(&connect(process, ArraySource::ProfileFirst)?, uid),
        Command::StaffPlaces { club_offset: Some(offset), .. } => {
            club_slot(&connect(process, ArraySource::ProfileFirst)?, offset)
        }
        Command::StaffPlaces { team_offset: Some(offset), job, .. } => {
            team_slot(&connect(process, ArraySource::ProfileFirst)?, offset, job)
        }
        Command::StaffPlaces { contract_offset: Some(offset), job, .. } => {
            staff_contract_word(&connect(process, ArraySource::ProfileFirst)?, offset, job)
        }
        Command::StaffPlaces { job, .. } => staff_places(&connect(process, ArraySource::ProfileFirst)?, job),
        Command::ContractClasses => contract_classes(&connect(process, ArraySource::ProfileFirst)?),
        Command::StaffAt { addr, len } => {
            let modules = list_modules(&process).context("listing modules")?;
            let session = connect(process, ArraySource::ProfileFirst)?;
            staff_at(&session, resolve(&addr, &modules)?, parse_hex(&len)?)
        }
        Command::StaffRefs { ids, back, show } => {
            staff_refs(&connect(process, ArraySource::ProfileFirst)?, &ids, parse_hex(&back)?, show.as_deref())
        }
        Command::Clubs { text, limit, export, semicolon } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let export = export.as_deref().map(|path| (path, export_format(path, semicolon)));
            clubs(&session, text.as_deref(), limit, export)
        }
        Command::Club { uid } => club(&connect(process, ArraySource::ProfileFirst)?, uid),
        Command::Players { text, limit, filter, export, semicolon } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let export = export.as_deref().map(|path| (path, export_format(path, semicolon)));
            players(&session, text.as_deref(), limit, &filter, export)
        }
        Command::Fields { entity, stats } => {
            fields(&connect(process, ArraySource::ProfileFirst)?, entity.into(), stats)
        }
        Command::Get { entity, uid, fields } => {
            get(&connect(process, ArraySource::ProfileFirst)?, entity.into(), uid, &fields)
        }
        Command::Set { entity, uid, field, value, shown, restore, hold } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            set(&session, entity.into(), uid, &field, &value, shown, restore.then_some(hold))
        }
        Command::Move { uid, club, wage, expires, fee, release, restore, hold } => {
            let expires = expires.as_deref().map(parse_iso_date).transpose()?.map(FmDate::to_number);
            let terms = MoveTerms { wage, expires };
            let session = connect(process, ArraySource::ProfileFirst)?;
            move_player(&session, uid, club, terms, fee, release, restore.then_some(hold))
        }
        Command::Permanent { uid, wage, expires, restore, hold } => {
            let expires = expires.as_deref().map(parse_iso_date).transpose()?.map(FmDate::to_number);
            let session = connect(process, ArraySource::ProfileFirst)?;
            make_permanent(&session, uid, MoveTerms { wage, expires }, restore.then_some(hold))
        }
        Command::StadiumName { club, name, restore, hold } => {
            stadium_name(&connect(process, ArraySource::ProfileFirst)?, club, name.as_deref(), restore.then_some(hold))
        }
        Command::Prizes { text, settings, place, win, draw, loss, all, restore, hold } => {
            let mut amounts: Vec<(PrizeAmount, u32)> = place
                .unwrap_or_default()
                .chunks(2)
                .map(|pair| (PrizeAmount::Place(pair[0] as usize), pair[1]))
                .collect();
            amounts.extend(win.map(|amount| (PrizeAmount::Win, amount)));
            amounts.extend(draw.map(|amount| (PrizeAmount::Draw, amount)));
            amounts.extend(loss.map(|amount| (PrizeAmount::Loss, amount)));
            let settings = settings.as_deref().map(parse_hex).transpose()?;
            let session = connect(process, ArraySource::ProfileFirst)?;
            prizes(&session, text.as_deref(), settings, &amounts, all, restore.then_some(hold))
        }
        Command::Plan { uid, club, release } => {
            plan_move(&connect(process, ArraySource::ProfileFirst)?, uid, club, release)
        }
        Command::Release { uid, restore, hold } => {
            release_player(&connect(process, ArraySource::ProfileFirst)?, uid, restore, hold)
        }
        Command::StaffMove { id, club, job, restore } => {
            staff_change(&connect(process, ArraySource::ProfileFirst)?, id, StaffAction::Move(club, job), restore)
        }
        Command::StaffSign { id, club, job, wage, expires, restore } => {
            let terms = MoveTerms { wage, expires: expires.map(FmDate::to_number) };
            staff_change(
                &connect(process, ArraySource::ProfileFirst)?,
                id,
                StaffAction::Sign(club, job, terms),
                restore,
            )
        }
        Command::StaffJob { id, job, restore } => {
            staff_change(&connect(process, ArraySource::ProfileFirst)?, id, StaffAction::Job(job), restore)
        }
        Command::Heal { uid, heal, restore, hold } => {
            let restore_after = restore.then_some(hold);
            heal_player(&connect(process, ArraySource::ProfileFirst)?, uid, heal, restore_after)
        }
        Command::Bans { uid, lift, restore, hold } => {
            let restore_after = restore.then_some(hold);
            ban_list(&connect(process, ArraySource::ProfileFirst)?, uid, lift, restore_after)
        }
        Command::Retirements { uid, keep, restore, hold } => {
            let restore_after = restore.then_some(hold);
            retirements(&connect(process, ArraySource::ProfileFirst)?, uid, keep, restore_after)
        }
        Command::Ties { uid, all } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            tie_change(&session, uid, None, RestoreArgs { restore: false, hold: 0 })?;
            if all { relation_entries(&session, uid) } else { Ok(()) }
        }
        Command::Loans { uid, club, raw, max } => {
            list_loans(&connect(process, ArraySource::ProfileFirst)?, uid, club, raw, max)
        }
        Command::RelationKinds { kind, examples } => {
            relation_kinds(&connect(process, ArraySource::ProfileFirst)?, kind, examples)
        }
        Command::TieSet { uid, index, nation, club, rule, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let target = nation.map(TieUid::Nation).or(club.map(TieUid::Club));
            tie_change(&session, uid, Some(TieAction::Set { index, target, rule }), restore)
        }
        Command::TieRemove { uid, index, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            tie_change(&session, uid, Some(TieAction::Remove { index }), restore)
        }
        Command::TieAdd { uid, tie, target, rule, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let (tie, target) = match tie {
                TieArg::Nationality => (Tie::Nationality, TieUid::Nation(target)),
                TieArg::Nation => (Tie::TrainedInNation, TieUid::Nation(target)),
                TieArg::Club => (Tie::TrainedAtClub, TieUid::Club(target)),
                TieArg::Permit => (Tie::WorkPermit, TieUid::Nation(target)),
            };
            tie_change(&session, uid, Some(TieAction::Add { tie, target, rule }), restore)
        }
        Command::Swap { uid, other, restore } => {
            swap_players(&connect(process, ArraySource::ProfileFirst)?, uid, other, restore)
        }
        Command::Scout { club, position, ip, oop, purpose, max_age, min_probability, order, limit, squad, tactics } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let order = match order.as_str() {
                "fit" => ScoutOrder::Fit,
                "probability" => ScoutOrder::Probability,
                "fee" => ScoutOrder::Fee,
                _ => ScoutOrder::Score,
            };
            let purpose = match purpose.as_str() {
                "rotation" => Purpose::Rotation,
                "future" => Purpose::Future,
                "any" => Purpose::Any,
                _ => Purpose::FirstTeam,
            };
            let request = position.map(|position| ScoutRequest {
                position,
                in_possession: ip,
                out_of_possession: oop,
                purpose,
                max_age,
                min_probability,
                order,
                limit: Some(limit),
                ..ScoutRequest::default()
            });
            scout(&session, club, request, squad, tactics)
        }
        Command::Teams { club } => teams(&connect(process, ArraySource::ProfileFirst)?, club),
        Command::Room { club, max } => room(&connect(process, ArraySource::ProfileFirst)?, club, max),
        Command::Captain { club, uid, vice, team, restore, hold } => {
            let role = if vice { CaptainRole::ViceCaptain } else { CaptainRole::Captain };
            let session = connect(process, ArraySource::ProfileFirst)?;
            captain(&session, club, team, role, uid, restore.then_some(hold))
        }
        Command::Graphics { .. } => unreachable!("handled before attaching"),
        #[cfg(target_os = "macos")]
        Command::Bridge { .. } => unreachable!("handled before attaching"),
        Command::Scan { min, max, top } => {
            let (game, modules) = inspect(&process)?;
            let opts = ScanOptions { min_count: min, max_count: max, ..ScanOptions::default() };
            scan(&process, &game, &modules, &opts, top, json)
        }
        Command::Dump { addr, len, out } => {
            let modules = list_modules(&process).context("listing modules")?;
            let (addr, len) = (resolve(&addr, &modules)?, parse_hex(&len)?);
            match out {
                Some(path) => dump_raw(&process, addr, len, &path),
                None => dump(&process, &modules, addr, len),
            }
        }
        Command::Element { pair, index, len } => {
            let modules = list_modules(&process).context("listing modules")?;
            element(&process, &modules, resolve(&pair, &modules)?, index, parse_hex(&len)?)
        }
        Command::Column { pair, offset, kind, first, find } => {
            let modules = list_modules(&process).context("listing modules")?;
            column(&process, &modules, resolve(&pair, &modules)?, parse_hex(&offset)?, kind, first, find)
        }
        Command::Find { pattern, kind, module, max, near, within } => {
            let modules = list_modules(&process).context("listing modules")?;
            let near =
                near.map(|near| Ok::<_, anyhow::Error>((parse_bytes(&near)?, parse_hex(&within)?))).transpose()?;
            find(&process, &modules, &pattern, kind, module.as_deref(), max, near)
        }
        Command::Pages { out, against } => pages(&process, &out, against.as_deref()),
        Command::Refs { addr, span, max } => {
            let modules = list_modules(&process).context("listing modules")?;
            refs(&process, &modules, resolve(&addr, &modules)?, parse_hex(&span)?, max)
        }
        Command::Squads => squads(&connect(process, ArraySource::ProfileFirst)?),
        Command::RelationBlocks { entries, show } => {
            relation_blocks(&connect(process, ArraySource::ProfileFirst)?, entries, show)
        }
        Command::Allocators => allocators(&connect(process, ArraySource::ProfileFirst)?),
        Command::Related { clubs, players, depth, span, tolerance, linear } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let roots = related_roots(&session, &clubs, &players)?;
            related(&session, &roots, depth, parse_hex(&span)?, tolerance, linear)
        }
        Command::TeamAverage { clubs, tolerance } => {
            team_average(&connect(process, ArraySource::ProfileFirst)?, &clubs, tolerance)
        }
        Command::Cohesion { clubs, list, club_index, raw, set, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let layout = session.layout.cohesion.as_ref();
            let place = |given: Option<String>, laid: Option<u64>, otherwise: u64| -> Result<u64> {
                Ok(given.as_deref().map(parse_hex).transpose()?.or(laid).unwrap_or(otherwise))
            };
            let places = CohesionPlaces {
                list: place(list, layout.map(|c| c.list), 0x18)?,
                club_index: place(club_index, layout.map(|c| c.club_index), 0x8)?,
                raw,
            };
            cohesion(&session, &clubs, &places)?;
            match set {
                Some(value) => set_cohesion(&session, &clubs, value, restore),
                None => Ok(()),
            }
        }
        Command::Nearby { clubs, players, to_club, window, tolerance, per_kind, bare, by_uid } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            let of_players = !players.is_empty();
            let seen = if of_players { players } else { clubs };
            let targets = if by_uid {
                seen.iter().enumerate().map(|(i, &(uid, _))| (u64::from(uid), i)).collect()
            } else {
                nearby_targets(&session, &seen, of_players, to_club)?
            };
            let options = NearbyOptions { by_uid, window: parse_hex(&window)?, tolerance, per_kind, bare };
            nearby(&session, &seen, &targets, &options)
        }
        Command::Injuries { club } => injuries(&connect(process, ArraySource::ProfileFirst)?, club),
        Command::Stats { min, max, club, player } => {
            stats(&connect(process, ArraySource::ProfileFirst)?, min, max, club, player)
        }
        Command::Histogram { offset, kind, contract, club, top } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            histogram(&session, parse_hex(&offset)?, kind, contract, club.as_deref(), top)
        }
        Command::Types { text, max } => {
            let modules = list_modules(&process).context("listing modules")?;
            types(&process, &modules, &text, max)
        }
        Command::Instances { class, max, holds, span, fields, names } => {
            let modules = list_modules(&process).context("listing modules")?;
            let holds = holds.map(|bytes| parse_bytes(&bytes)).transpose()?;
            let max = if fields { usize::MAX } else { max };
            let span = parse_hex(&span)?;
            if names {
                let session = connect(process, ArraySource::ProfileFirst)?;
                let names = object_names(&session)?;
                let process = &session.process;
                instances(process, &modules, &class, max, holds.as_deref(), span, fields, Some(&names))
            } else {
                instances(&process, &modules, &class, max, holds.as_deref(), span, fields, None)
            }
        }
        Command::Clauses { uid } => clauses(&connect(process, ArraySource::ProfileFirst)?, uid),
        Command::ClauseSet { uid, index, amount, condition, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            clause_change(&session, uid, ClauseAction::Set { index, amount, condition }, restore)
        }
        Command::ClauseRemove { uid, index, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            clause_change(&session, uid, ClauseAction::Remove { index }, restore)
        }
        Command::ClauseAdd { uid, amount, restore } => {
            let session = connect(process, ArraySource::ProfileFirst)?;
            clause_change(&session, uid, ClauseAction::Add { amount }, restore)
        }
        Command::Concerns { uid } => concerns(&connect(process, ArraySource::ProfileFirst)?, uid),
        Command::Region { addr } => {
            let modules = list_modules(&process).context("listing modules")?;
            let addr = resolve(&addr, &modules)?;
            let r = fmlibre_mem::region_at(&process, addr).with_context(|| format!("{addr:#x} is not mapped"))?;
            println!(
                "{addr:#x} is in {:#x}..{:#x} ({:#x} bytes), allocated at {:#x}; {} {}{}",
                r.base,
                r.end(),
                r.size,
                r.allocation_base,
                r.protection(),
                if r.is_image() {
                    "image"
                } else if r.is_private() {
                    "private"
                } else {
                    "mapped"
                },
                if r.is_committed() { "" } else { ", not committed" }
            );
            dump(&process, &modules, r.allocation_base, 0x40)
        }
        Command::Holders { addr, max } => {
            let modules = list_modules(&process).context("listing modules")?;
            holders(&process, &modules, resolve(&addr, &modules)?, max)
        }
        Command::Lists { addr, len } => {
            let modules = list_modules(&process).context("listing modules")?;
            let session = connect(process, ArraySource::ProfileFirst)?;
            lists(&session, &modules, resolve(&addr, &modules)?, parse_hex(&len)?)
        }
        Command::Pools { holding, walk } => {
            let modules = list_modules(&process).context("listing modules")?;
            let holding = holding.map(|addr| resolve(&addr, &modules)).transpose()?;
            pools(&connect(process, ArraySource::ProfileFirst)?, holding, walk)
        }
    }
}

/// Prints the game's pools of objects; with `holding`, only the one whose chunks hold that address. With `walk`, each
/// one's chain of free slots is followed and counted.
fn pools(session: &Session, holding: Option<u64>, walk: bool) -> Result<()> {
    let started = Instant::now();
    let pools = session.object_pools();
    let plugin = &session.plugin;
    println!(
        "{} pool(s) in the plugin's writable data, found in {:.2} s",
        pools.len(),
        started.elapsed().as_secs_f64()
    );
    for pool in &pools {
        let size = u64::from(pool.slot_size);
        let chunk_of = |address: u64| {
            pool.chunks
                .iter()
                .enumerate()
                .find(|&(index, &chunk)| address >= chunk && address - chunk < pool.slots_of(index) * size)
        };
        if let Some(address) = holding {
            let Some((index, &chunk)) = chunk_of(address) else {
                continue;
            };
            let slot = (address - chunk) / size;
            println!(
                "{address:#x} is in chunk {index} ({chunk:#x}), slot {slot}, {} bytes into it",
                (address - chunk) % size
            );
        }
        // The class of its objects: that of the first slot of its first chunk that holds one.
        let first = pool.chunks[0];
        let class = (0..pool.slots_of(0).min(16))
            .map(|slot| first + slot * size)
            .find(|&slot| session.process.read_u64(slot).is_ok_and(|word| plugin.contains(word)))
            .and_then(|slot| fmlibre_core::rtti::class_of(&session.process, plugin, slot))
            .unwrap_or_else(|| "-".to_owned());
        println!(
            "  {:#x} (+{:#x})  {:>6} bytes  {:>3} chunk(s) {:>7} slots: {:>7} free {:>7} used  {class}",
            pool.at,
            pool.at - plugin.base,
            pool.slot_size,
            pool.chunks.len(),
            pool.slots(),
            pool.free,
            pool.used,
        );
        if walk {
            let (mut at, mut steps, mut seen) = (pool.first_free, 0u64, std::collections::HashSet::new());
            let broke = loop {
                if at == 0 {
                    break None;
                }
                if !pool.is_slot(at) || !seen.insert(at) || steps > u64::from(pool.free) {
                    break Some(at);
                }
                steps += 1;
                at = match session.process.read_u64(at) {
                    Ok(next) => next,
                    Err(_) => break Some(at),
                };
            };
            match broke {
                None if steps == u64::from(pool.free) => println!("      chain of {steps} free slots, as counted"),
                None => println!("      chain of {steps} free slots, but {} counted", pool.free),
                Some(at) => println!("      chain breaks after {steps} free slots, at {at:#x}"),
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// refs and lists

/// Prints every 8-byte-aligned value in readable memory that points into `addr..addr + span`.
/// Hashes every readable 4 KiB page (FNV-1a over its words) and, against an earlier run, saves the changed pages.
fn pages(process: &Process, out: &Path, against: Option<&Path>) -> Result<()> {
    const CHUNK: u64 = 8 << 20;
    const PAGE: usize = 0x1000;
    let started = Instant::now();
    let earlier: std::collections::HashMap<u64, u64> = match against {
        Some(path) => std::fs::read(path)
            .with_context(|| format!("reading {}", path.display()))?
            .as_chunks::<16>()
            .0
            .iter()
            .map(|r| {
                let (a, h) = r.split_at(8);
                (u64::from_le_bytes(a.try_into().unwrap()), u64::from_le_bytes(h.try_into().unwrap()))
            })
            .collect(),
        None => Default::default(),
    };
    let (mut hashes, mut saved) = (Vec::new(), Vec::new());
    let (mut scanned, mut changed) = (0u64, 0usize);
    for region in regions(process, 0x1_0000, 0x7FFF_FFFF_0000).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                for (i, page) in chunk.chunks(PAGE).enumerate() {
                    let at = base + (i * PAGE) as u64;
                    let mut hash = 0xcbf2_9ce4_8422_2325u64;
                    for word in page.as_chunks::<8>().0 {
                        hash = (hash ^ u64::from_le_bytes(*word)).wrapping_mul(0x0100_0000_01b3);
                    }
                    hashes.extend_from_slice(&at.to_le_bytes());
                    hashes.extend_from_slice(&hash.to_le_bytes());
                    if against.is_some() && earlier.get(&at) != Some(&hash) && page.len() == PAGE {
                        saved.extend_from_slice(&at.to_le_bytes());
                        saved.extend_from_slice(page);
                        changed += 1;
                    }
                }
            }
            scanned += len;
            offset += CHUNK;
        }
    }
    std::fs::write(out, &hashes).with_context(|| format!("writing {}", out.display()))?;
    if against.is_some() {
        let mut path = out.as_os_str().to_owned();
        path.push(".pages");
        std::fs::write(&path, &saved).context("writing the changed pages")?;
    }
    println!(
        "{} pages hashed ({:.0} MiB), {changed} changed, in {:.1} s.",
        hashes.len() / 16,
        scanned as f64 / 1_048_576.0,
        started.elapsed().as_secs_f64()
    );
    Ok(())
}

fn refs(process: &Process, modules: &[Module], addr: u64, span: u64, max: usize) -> Result<()> {
    ensure!(span > 0, "the span is empty");
    const CHUNK: u64 = 8 << 20;
    let started = Instant::now();
    let (mut scanned, mut hits) = (0u64, 0usize);

    'regions: for region in regions(process, 0x1_0000, 0x7FFF_FFFF_0000).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                for (i, word) in chunk.as_chunks::<8>().0.iter().enumerate() {
                    let value = u64::from_le_bytes(*word);
                    if value.wrapping_sub(addr) >= span {
                        continue;
                    }
                    let at = base + (i * 8) as u64;
                    let into = if value == addr { String::new() } else { format!("+{:#x}", value - addr) };
                    println!("{at:#014x}  {:<34} {into:<7} {}", describe_address(at, modules), neighbours(process, at));
                    hits += 1;
                    if hits >= max {
                        break 'regions;
                    }
                }
            }
            scanned += len;
            offset += CHUNK;
        }
    }
    println!(
        "{hits} hit(s){}; scanned {:.0} MiB in {:.1} s.",
        if hits >= max { " (stopped at --max)" } else { "" },
        scanned as f64 / 1_048_576.0,
        started.elapsed().as_secs_f64()
    );
    Ok(())
}

/// Prints every (begin, end) pair in readable memory whose array holds the slot at `addr`,
/// with the nearest vtable before the pair: the class of the object that owns the array.
fn holders(process: &Process, modules: &[Module], addr: u64, max: usize) -> Result<()> {
    const CHUNK: u64 = 8 << 20;
    // Longer arrays are the game-wide ones, and random words make false pairs that long.
    const LONGEST: u64 = 8 * 20_000;
    let started = Instant::now();
    let mut hits = 0usize;

    'regions: for region in regions(process, 0x1_0000, 0x7FFF_FFFF_0000).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            // One extra word, so that a pair split by the chunk boundary is still seen.
            let len = (region.size - offset).min(CHUNK + 8);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                let words: Vec<u64> = chunk.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
                for (i, pair) in words.windows(2).enumerate() {
                    let (begin, end) = (pair[0], pair[1]);
                    if begin > addr
                        || addr >= end
                        || end - begin > LONGEST
                        || !begin.is_multiple_of(8)
                        || !(addr - begin).is_multiple_of(8)
                    {
                        continue;
                    }
                    let at = base + (i * 8) as u64;
                    let owner = (1..=0x80u64)
                        .map(|back| at - back * 8)
                        .find_map(|slot| {
                            let value = process.read_u64(slot).ok()?;
                            let module = modules.iter().find(|m| m.contains(value) && m.name == GAME_PLUGIN)?;
                            Some(format!("vtable {}+{:#x} at -{:#x}", module.name, value - module.base, at - slot))
                        })
                        .unwrap_or_default();
                    println!(
                        "{at:#014x}  {:<34} index {} of {}  {owner}",
                        describe_address(at, modules),
                        (addr - begin) / 8,
                        (end - begin) / 8
                    );
                    hits += 1;
                    if hits >= max {
                        break 'regions;
                    }
                }
            }
            offset += CHUNK;
        }
    }
    println!("{hits} pair(s) in {:.1} s.", started.elapsed().as_secs_f64());
    Ok(())
}

/// Reads the player list of every team (team + 0x38: begin, end, capacity) and reports,
/// per capacity, the spacing of list buffers that share a 64 KiB page (a slab allocator
/// puts blocks of one size class at multiples of that size), and whether the rest of the
/// block the layout's heap gives them is zero.
fn relation_blocks(session: &Session, entries: u64, show: usize) -> Result<()> {
    use std::collections::{BTreeMap, BTreeSet};
    let process = &session.process;
    let size = session.layout.relation.size;
    let players = session.players()?;
    // Every list's buffer, by capacity in bytes.
    let mut by_capacity: BTreeMap<u64, Vec<u64>> = BTreeMap::new();
    for player in &players {
        let Some((begin, capacity)) = session.relation_buffer(player) else { continue };
        by_capacity.entry(capacity).or_default().push(begin);
    }
    println!("buffers by capacity (bytes): count, and the commonest distance to the next buffer of that capacity");
    for (capacity, begins) in &mut by_capacity {
        begins.sort_unstable();
        let mut gaps: BTreeMap<u64, usize> = BTreeMap::new();
        for pair in begins.windows(2) {
            let gap = pair[1] - pair[0];
            if gap <= 4096 {
                *gaps.entry(gap).or_default() += 1;
            }
        }
        let mut top: Vec<_> = gaps.into_iter().collect();
        top.sort_by_key(|entry| std::cmp::Reverse(entry.1));
        let top: Vec<String> = top.iter().take(5).map(|(gap, n)| format!("{gap}x{n}")).collect();
        println!("  {capacity:>4}: {:>5}  gaps {}", begins.len(), top.join(" "));
    }
    // A closer look at one capacity: the 8 bytes before each buffer, the bytes after it to the next buffer.
    let capacity = entries * size;
    let Some(begins) = by_capacity.get(&capacity) else {
        println!("no list of {entries} entries");
        return Ok(());
    };
    let known: BTreeSet<u64> = by_capacity.values().flatten().copied().collect();
    let mut before: BTreeMap<String, usize> = BTreeMap::new();
    for &begin in begins {
        let word = process.read_bytes(begin - 8, 8).map(|b| hex(&b)).unwrap_or_else(|_| "unreadable".into());
        *before.entry(word).or_default() += 1;
    }
    let mut top: Vec<_> = before.into_iter().collect();
    top.sort_by_key(|entry| std::cmp::Reverse(entry.1));
    println!("the 8 bytes before a buffer of {capacity} bytes, commonest first:");
    for (word, n) in top.iter().take(6) {
        println!("  {word}  x{n}");
    }
    // The neighbourhood of the first buffers: each block of `stride` bytes from the first, which list holds it (if
    // any), and its first 16 bytes.
    let stride = {
        let mut gaps: BTreeMap<u64, usize> = BTreeMap::new();
        for pair in begins.windows(2) {
            let gap = pair[1] - pair[0];
            if gap <= 1024 {
                *gaps.entry(gap).or_default() += 1;
            }
        }
        gaps.into_iter().max_by_key(|g| g.1).map_or(capacity, |g| g.0)
    };
    for chunk in [0x1000u64, 0x4000, 0x10000, 0x40000] {
        let mut offsets: BTreeMap<u64, usize> = BTreeMap::new();
        for &begin in begins {
            *offsets.entry((begin & (chunk - 1)) % stride).or_default() += 1;
        }
        let mut top: Vec<_> = offsets.into_iter().collect();
        top.sort_by_key(|entry| std::cmp::Reverse(entry.1));
        let top: Vec<String> = top.iter().take(6).map(|(o, n)| format!("{o}x{n}")).collect();
        println!("  in chunks of {chunk:#x}: offset mod {stride}: {}", top.join(" "));
    }
    let mut bases: BTreeMap<u64, (usize, u64, u64)> = BTreeMap::new();
    for &begin in begins {
        if let Some(region) = fmlibre_mem::regions(process, begin, begin + 1).into_iter().next() {
            let slot = bases.entry(region.base).or_insert((0, region.size, region.allocation_base));
            slot.0 += 1;
        }
    }
    println!("regions holding them: {}", bases.len());
    for (base, (n, size, allocation)) in bases.iter().take(12) {
        println!("  {base:#x} size {size:#x} (allocation {allocation:#x}): {n}");
    }
    println!("blocks of {stride} bytes from the buffer at {:#x}:", begins[begins.len() / 2]);
    let start = begins[begins.len() / 2];
    for i in 0..show as u64 {
        let at = start + i * stride;
        let bytes = process.read_bytes(at, 16).map(|b| hex(&b)).unwrap_or_else(|_| "unreadable".into());
        let first = process.read_u64(at).unwrap_or(0);
        let tag = if known.contains(&at) {
            "list"
        } else if is_user_pointer(first) && first.abs_diff(at) < 0x100000 {
            "near ptr"
        } else {
            ""
        };
        println!("  {at:#x}  {bytes}  {tag}");
    }
    if let Ok(region) = fmlibre_mem::regions(process, start, start + 1).into_iter().next().ok_or(()) {
        println!(
            "region: base {:#x} size {:#x} allocation base {:#x}",
            region.base, region.size, region.allocation_base
        );
    }
    Ok(())
}

/// Bytes as hex, with a space after each 8.
fn hex(bytes: &[u8]) -> String {
    bytes.chunks(8).map(|c| c.iter().map(|b| format!("{b:02x}")).collect::<String>()).collect::<Vec<_>>().join(" ")
}

/// `allocators`: the game's own allocators, found in the game plugin's writable data by their shape: a list of their
/// size classes, then a list of one entry per size asked for, up to the largest they hand out, each pointing at the
/// class that serves it (null where the system's allocator does), then the bytes of the header they write before a
/// block (the size asked for) and a byte that is 1 while they are in use. A block holds the largest size its class
/// serves and the header. Seen on the Mac (arm64): the lists of the game's objects come from one without a header, of
/// 34 classes up to 4,096 bytes; its strings from one with a header of 8 bytes.
fn allocators(session: &Session) -> Result<()> {
    const SHAPE: usize = 0x38;
    let process = &session.process;
    let plugin = &session.plugin;
    let word = |bytes: &[u8], at: usize| u64::from_le_bytes(bytes[at..at + 8].try_into().expect("8 bytes"));
    let list = |bytes: &[u8], at: usize, most: u64| {
        let (begin, end, capacity) = (word(bytes, at), word(bytes, at + 8), word(bytes, at + 16));
        let fits = is_user_pointer(begin)
            && begin < end
            && end <= capacity
            && (end - begin).is_multiple_of(8)
            && (end - begin) / 8 <= most;
        fits.then_some((begin, (end - begin) / 8))
    };
    let mut found = 0;
    for region in regions(process, plugin.base, plugin.end()).into_iter().filter(|r| r.is_writable()) {
        let Ok(bytes) = process.read_bytes(region.base, region.size as usize) else { continue };
        for at in (0..bytes.len().saturating_sub(SHAPE)).step_by(8) {
            let shape = &bytes[at..at + SHAPE];
            let header = u32::from_le_bytes(shape[0x30..0x34].try_into().expect("4 bytes"));
            if shape[0x34] != 1 || ![0, 4, 8, 16].contains(&header) {
                continue;
            }
            let (Some((classes_at, classes)), Some((sizes_at, sizes))) =
                (list(shape, 0, 64), list(shape, 0x18, 0x1_0001))
            else {
                continue;
            };
            if sizes < 65 {
                continue;
            }
            let (Ok(classes), Ok(by_size)) = (
                process.read_bytes(classes_at, classes as usize * 8),
                process.read_bytes(sizes_at, sizes as usize * 8),
            ) else {
                continue;
            };
            let classes: Vec<u64> = classes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
            let by_size: Vec<u64> = by_size.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
            if by_size.iter().any(|class| *class != 0 && !classes.contains(class)) {
                continue;
            }
            // Runs of sizes served by one class: the block holds the largest of them and the header.
            let mut blocks = Vec::new();
            let mut start = 0;
            for size in 1..=by_size.len() {
                if size == by_size.len() || by_size[size] != by_size[start] {
                    if by_size[start] != 0 {
                        let largest = size as u64 - 1;
                        blocks.push(format!("{} ({}-{largest})", largest + u64::from(header), start.max(1)));
                    }
                    start = size;
                }
            }
            found += 1;
            println!(
                "{GAME_PLUGIN}+{:#x}: header {header} bytes, {} classes, sizes up to {} from them, larger from the system",
                region.base + at as u64 - plugin.base,
                classes.len(),
                by_size.len() - 1
            );
            for line in blocks.chunks(8) {
                println!("  blocks {}", line.join(", "));
            }
        }
    }
    println!("{found} allocator(s) in {}'s writable data", GAME_PLUGIN);
    Ok(())
}

fn squads(session: &Session) -> Result<()> {
    let process = &session.process;
    let mut lists: Vec<(u64, u64, u64)> = Vec::new(); // (begin, length, capacity)
    let mut teams = 0;
    for club in session.clubs()? {
        let Ok(begin) = process.read_u64(club.address + session.layout.club.teams) else { continue };
        let Ok(end) = process.read_u64(club.address + session.layout.club.teams + 8) else { continue };
        if !is_user_pointer(begin) || end < begin || end - begin > 8 * 16 {
            continue;
        }
        for i in 0..(end - begin) / 8 {
            let Ok(team) = process.read_u64(begin + i * 8) else { continue };
            let Ok(words) = process.read_bytes(team + 0x38, 24) else { continue };
            let w: Vec<u64> = words.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
            teams += 1;
            if is_user_pointer(w[0]) && w[1] > w[0] && w[2] >= w[1] {
                lists.push((w[0], (w[1] - w[0]) / 8, (w[2] - w[0]) / 8));
            }
        }
    }
    let with_room = lists.iter().filter(|l| l.2 > l.1).count();
    println!("{teams} teams, {} non-empty lists, {with_room} with capacity above their length", lists.len());

    // Squad numbers: repeated within one team's list, and within one club's lists taken together.
    let number_of = |player: u64| -> Option<u8> {
        let contract = process.read_u64(player + session.layout.player.contract).ok()?;
        if !is_user_pointer(contract) {
            return None;
        }
        let number = process.read_bytes(contract + session.layout.contract.squad_number, 1).ok()?[0];
        (number != 255).then_some(number)
    };
    let (mut in_team, mut in_club, mut clubs_seen) = (0, 0, 0);
    for club in session.clubs()? {
        let teams_at = club.address + session.layout.club.teams;
        let (Ok(begin), Ok(end)) = (process.read_u64(teams_at), process.read_u64(teams_at + 8)) else { continue };
        if !is_user_pointer(begin) || end <= begin || end - begin > 8 * 16 {
            continue;
        }
        clubs_seen += 1;
        let mut club_numbers: std::collections::HashMap<u8, std::collections::HashSet<u64>> = Default::default();
        for i in 0..(end - begin) / 8 {
            let Ok(team) = process.read_u64(begin + i * 8) else { continue };
            let (Ok(b), Ok(e)) = (process.read_u64(team + 0x38), process.read_u64(team + 0x40)) else { continue };
            if !is_user_pointer(b) || e <= b || e - b > 8 * 5000 {
                continue;
            }
            let mut team_numbers: std::collections::HashMap<u8, usize> = Default::default();
            for element in process.read_bytes(b, (e - b) as usize).unwrap_or_default().as_chunks::<8>().0 {
                let player = u64::from_le_bytes(*element);
                if let Some(number) = number_of(player) {
                    *team_numbers.entry(number).or_default() += 1;
                    club_numbers.entry(number).or_default().insert(player);
                }
            }
            in_team += team_numbers.values().filter(|&&n| n > 1).count();
        }
        in_club += club_numbers.values().filter(|players| players.len() > 1).count();
    }
    println!(
        "squad numbers over {clubs_seen} clubs: {in_team} repeated within a team's list, {in_club} repeated \
         across a club's lists"
    );

    // Which team lists hold each player: the team the player is at, the contract's team, both, neither.
    let mut listed: std::collections::HashMap<u64, Vec<u64>> = std::collections::HashMap::new();
    for club in session.clubs()? {
        let teams_at = club.address + session.layout.club.teams;
        let (Ok(begin), Ok(end)) = (process.read_u64(teams_at), process.read_u64(teams_at + 8)) else { continue };
        if !is_user_pointer(begin) || end < begin || end - begin > 8 * 16 {
            continue;
        }
        for i in 0..(end - begin) / 8 {
            let Ok(team) = process.read_u64(begin + i * 8) else { continue };
            let (Ok(b), Ok(e)) = (process.read_u64(team + 0x38), process.read_u64(team + 0x40)) else { continue };
            if !is_user_pointer(b) || e <= b || e - b > 8 * 5000 {
                continue;
            }
            for element in process.read_bytes(b, (e - b) as usize).unwrap_or_default().as_chunks::<8>().0 {
                listed.entry(u64::from_le_bytes(*element)).or_default().push(team);
            }
        }
    }
    let (mut at_team, mut at_contract, mut both, mut neither, mut extra) = (0, 0, 0, 0, 0);
    let pl = &session.layout.player;
    for player in session.players()? {
        let team = process.read_u64(player.address + pl.team).unwrap_or(0);
        let contract = process.read_u64(player.address + pl.at(pl.contract, player.shift)).unwrap_or(0);
        let contract_team = if is_user_pointer(contract) {
            process.read_u64(contract + session.layout.contract.team).unwrap_or(0)
        } else {
            0
        };
        let lists = listed.get(&player.address).map(Vec::as_slice).unwrap_or_default();
        let (in_team, in_contract) = (lists.contains(&team), lists.contains(&contract_team));
        match (in_team, in_contract) {
            (true, true) => both += 1,
            (true, false) => at_team += 1,
            (false, true) => at_contract += 1,
            (false, false) => neither += 1,
        }
        if lists.iter().any(|t| *t != team && *t != contract_team) {
            extra += 1;
        }
    }
    println!(
        "team lists: {both} players listed at both their team and their contract's team, {at_team} only at \
         their team, {at_contract} only at their contract's team, {neither} at neither, {extra} also elsewhere"
    );

    // How players, their contracts and the two team pointers of a contract relate.
    let p = &session.layout.player;
    let (mut no_contract, mut same, mut loaned, mut split, mut no_team, mut sibling) = (0, 0, 0, 0, 0, 0);
    let club_of = |team: u64| process.read_u64(team + session.layout.team.club).unwrap_or(0);
    let mut examples: Vec<String> = Vec::new();
    for player in session.players()? {
        let team = process.read_u64(player.address + p.team).unwrap_or(0);
        let contract = process.read_u64(player.address + p.at(p.contract, player.shift)).unwrap_or(0);
        if !is_user_pointer(contract) {
            no_contract += 1;
            continue;
        }
        let first = process.read_u64(contract + session.layout.contract.team).unwrap_or(0);
        let second = process.read_u64(contract + session.layout.contract.team + 8).unwrap_or(0);
        if !is_user_pointer(team) {
            no_team += 1;
        } else if first != second {
            split += 1;
            if examples.len() < 5 {
                examples.push(format!("{} ({:?})", player.name, player.club));
            }
        } else if team == first {
            same += 1;
        } else if club_of(team) == club_of(first) {
            sibling += 1;
        } else {
            loaned += 1;
        }
    }
    println!(
        "players: {no_contract} without a contract, {no_team} with a contract but no team, {same} at their \
         contract's team, {sibling} at another team of the same club, {loaned} at another club (on loan?), \
         {split} whose contract names two teams"
    );
    if !examples.is_empty() {
        println!("  two teams: {}", examples.join(", "));
    }

    // Per capacity, which decides the block: the GCD of the distances between lists on the
    // same 64 KiB page, the block the layout's heap gives, and how many words after the
    // capacity are zero (at most 8), with how many lists have each count.
    let mut by_capacity: std::collections::BTreeMap<u64, Vec<u64>> = std::collections::BTreeMap::new();
    for &(begin, _, capacity) in &lists {
        by_capacity.entry(capacity).or_default().push(begin);
    }
    fn gcd(a: u64, b: u64) -> u64 {
        if b == 0 { a } else { gcd(b, a % b) }
    }
    let (mut zeroed, mut other) = (0, 0);
    println!("capacity  lists  spacing (bytes, gcd on shared pages)  block  zero words after the capacity: lists");
    for (capacity, mut begins) in by_capacity {
        begins.sort_unstable();
        let mut g = 0;
        for pair in begins.windows(2) {
            if pair[1] - pair[0] < 0x10000 && pair[1] >> 16 == pair[0] >> 16 {
                g = gcd(g, pair[1] - pair[0]);
            }
        }
        let block = session.layout.heap.block_size(capacity * 8);
        let mut zeros: std::collections::BTreeMap<u64, usize> = std::collections::BTreeMap::new();
        for &begin in &begins {
            let after = process.read_bytes(begin + capacity * 8, 64).unwrap_or_default();
            let count = after.as_chunks::<8>().0.iter().take_while(|w| u64::from_le_bytes(**w) == 0).count() as u64;
            *zeros.entry(count).or_default() += 1;
            match block {
                Some(block) if count * 8 >= block - capacity * 8 => zeroed += 1,
                Some(_) => other += 1,
                None => {}
            }
        }
        let zeros: Vec<String> = zeros.iter().map(|(count, lists)| format!("{count}: {lists}")).collect();
        println!(
            "{capacity:>8}  {:>5}  {:>6}  {:>5}  {}",
            begins.len(),
            if g == 0 { "-".to_owned() } else { g.to_string() },
            block.map_or("-".to_owned(), |block| block.to_string()),
            zeros.join(", ")
        );
    }
    println!(
        "lists in a block the layout's heap knows: {zeroed} with the rest of it zero, {other} with other data there"
    );
    Ok(())
}

/// Prints, for each player of the club `club`, the records of the list his +0xF8 record
/// starts with: a type pointer (+0x08), a team (+0x18), a date (+0x20), the word after it,
/// two u16 (+0x28, +0x2A) and four bytes (+0x30).
fn injuries(session: &Session, club: u32) -> Result<()> {
    let process = &session.process;
    let modules = list_modules(process)?;
    // How long the lists are across all plain players: an empty one would be a state the game itself makes.
    let mut lengths: std::collections::BTreeMap<u64, usize> = std::collections::BTreeMap::new();
    let mut without = 0;
    for player in session.players()?.into_iter().filter(|p| p.shift == 0) {
        let history = process.read_u64(player.address + 0xF8).unwrap_or(0);
        if !is_user_pointer(history) {
            without += 1;
            continue;
        }
        let (begin, end) = (process.read_u64(history)?, process.read_u64(history + 8)?);
        *lengths.entry(end.saturating_sub(begin) / 8).or_default() += 1;
    }
    println!("players without the record: {without}; with it, by list length: {lengths:?}");
    let date = |raw: u32| -> String {
        let (day, year) = ((raw & 0x1FF) as u16, (raw >> 16) as u16);
        FmDate::from_raw(day, year)
            .map_or_else(|| format!("{raw:#010x}"), |d| format!("{:04}-{:02}-{:02}", d.year, d.month, d.day))
    };
    for player in session.players()?.into_iter().filter(|p| p.club_uid == Some(club) && p.shift == 0) {
        let history = process.read_u64(player.address + 0xF8)?;
        if !is_user_pointer(history) {
            continue;
        }
        let (begin, end) = (process.read_u64(history)?, process.read_u64(history + 8)?);
        if !is_user_pointer(begin) || end <= begin || end - begin > 8 * 64 {
            continue;
        }
        println!("{} (UID {})", player.name, player.uid);
        for slot in (begin..end).step_by(8) {
            let record = process.read_u64(slot)?;
            let b = process.read_bytes(record, 0x38)?;
            let u64_at = |o: usize| u64::from_le_bytes(b[o..o + 8].try_into().expect("8 bytes"));
            let u32_at = |o: usize| u32::from_le_bytes(b[o..o + 4].try_into().expect("4 bytes"));
            let u16_at = |o: usize| u16::from_le_bytes([b[o], b[o + 1]]);
            println!(
                "  {record:#x}: type {} team {:#x} date {} ({:#06x}) then {:#010x}; {} {}; bytes {:02x} {:02x} {:02x} {:02x}",
                pointer_hint(u64_at(8), &modules),
                u64_at(0x18),
                date(u32_at(0x20)),
                u16_at(0x20),
                u32_at(0x24),
                u16_at(0x28),
                u16_at(0x2A),
                b[0x30],
                b[0x31],
                b[0x32],
                b[0x33]
            );
        }
    }
    Ok(())
}

/// Scans the plain player objects (person block not shifted) for fields the layout does not
/// name: u16 offsets whose every value lies in `min..=max` and that vary, and pointer pairs
/// that hold a short list for a few players only.
fn stats(session: &Session, min: u16, max: u16, club: Option<u32>, player: Option<u32>) -> Result<()> {
    let process = &session.process;
    let p = &session.layout.player;
    let len = p.end() as usize;
    let players: Vec<_> = session.players()?.into_iter().filter(|player| player.shift == 0).collect();
    let mut objects = Vec::with_capacity(players.len());
    for player in &players {
        if let Ok(bytes) = process.read_bytes(player.address, len) {
            objects.push((player, bytes));
        }
    }
    let total = objects.len();
    println!("{total} plain players, {len:#x} bytes each");

    // u16 offsets in range for every player, with how many distinct values and their mean.
    println!("u16 offsets with every value in {min}..={max}:");
    println!("{:>8}  {:>9}  {:>8}  {:>8}  {:>8}", "offset", "distinct", "mean", "lowest", "highest");
    let mut candidates = Vec::new();
    for offset in (0..len - 1).step_by(2) {
        let values: Vec<u16> = objects.iter().map(|(_, b)| u16::from_le_bytes([b[offset], b[offset + 1]])).collect();
        if !values.iter().all(|v| (min..=max).contains(v)) {
            continue;
        }
        let mut distinct = values.clone();
        distinct.sort_unstable();
        distinct.dedup();
        // A constant is no live value, and a handful of values is a code, not an amount.
        if distinct.len() < 20 {
            continue;
        }
        let mean = values.iter().map(|&v| f64::from(v)).sum::<f64>() / total as f64;
        println!(
            "{offset:#8x}  {:>9}  {mean:>8.0}  {:>8}  {:>8}",
 …29735 tokens truncated…et(club).with_context(|| format!("no club with UID {club}"))?;
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let leaver = release.map(|leaver| players.get(leaver).with_context(|| format!("no player with UID {leaver}")));
    let leaver = leaver.transpose()?;
    let plan = match leaver {
        Some(leaver) => session.plan_club_move_releasing(player, to, MoveTerms::default(), leaver, &human),
        None => session.plan_club_move(player, to, MoveTerms::default(), &human),
    };
    let releasing = leaver.map_or(String::new(), |leaver| format!(", releasing {} (UID {})", leaver.name, leaver.uid));
    match plan {
        Ok(plan) => {
            println!("{} (UID {uid}) -> {}{releasing}: can be made, {} writes", player.name, to.name, plan.writes())
        }
        Err(err) => println!("{} (UID {uid}) -> {}{releasing}: refused: {err}", player.name, to.name),
    }
    Ok(())
}

fn release_player(session: &Session, uid: u32, restore: bool, hold: u64) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let plan = session.plan_release(player, &human)?;
    let from = clubs.get(plan.from_club).map_or("?", |c| c.name.as_str());
    println!("{} (UID {uid}): released by {from}, {} writes", player.name, plan.writes());

    // A release is written and undone like a move: as the patches it was planned as.
    let done = session.apply_club_move(&plan)?;
    if plan.leaves_a_human_club() {
        println!("  out of {} of the human club's selections", done.selections());
    }
    // Read him again as the lists would.
    let club_now = |label: &str| -> Result<Option<u32>> {
        let now = session.players()?.into_iter().find(|p| p.uid == uid).context("the player is gone")?;
        println!("  {label} {}", now.club.as_deref().unwrap_or("no club"));
        Ok(now.club_uid)
    };
    ensure!(club_now("now at")?.is_none(), "the player still reads as being at a club");
    if restore {
        if hold > 0 {
            println!("  bringing him back in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_club_move(&done)?;
        ensure!(club_now("back at")? == Some(plan.from_club), "the player is not back at {from}");
    }
    Ok(())
}

/// What `staff_change` does: a move to the club with this UID (as the job with this code, if given), a new job by its
/// code, or a signing for the club with this UID as the job with this code, on these terms.
enum StaffAction {
    Move(u32, Option<u8>),
    Job(u8),
    Sign(u32, u8, MoveTerms),
}

fn staff_change(session: &Session, id: u32, action: StaffAction, restore: bool) -> Result<()> {
    let staff = StaffIndex::new(session.staff()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let member = staff.get(id).with_context(|| format!("no member of staff with id {id}"))?;
    let job = |code: u8| match code {
        0 => "-".to_owned(),
        _ => job_name(code).map_or_else(|| format!("job {code}"), str::to_owned),
    };
    let club = |uid: u32| clubs.get(uid).with_context(|| format!("no club with UID {uid}"));
    let plan = match action {
        StaffAction::Move(to, new_job) => session.plan_staff_move(member, club(to)?, new_job)?,
        StaffAction::Job(code) => session.plan_staff_job(member, code)?,
        StaffAction::Sign(to, code, terms) => session.plan_staff_signing(member, club(to)?, code, terms)?,
    };
    let name = |uid: u32| if uid == 0 { "-" } else { clubs.get(uid).map_or("?", |c| c.name.as_str()) };
    // Who manages the clubs the change is about, where a manager comes or goes.
    let managers = |label: &str| -> Result<()> {
        if plan.job.0 != MANAGER && plan.job.1 != MANAGER {
            return Ok(());
        }
        let mut uids = vec![plan.from_club, plan.to_club];
        uids.dedup();
        for uid in uids.into_iter().filter(|&uid| uid != 0) {
            let held = session.club_manager(club(uid)?)?;
            let who =
                held.map_or_else(|| "no one".to_owned(), |id| staff.get(id).map_or(id.to_string(), |s| s.name.clone()));
            println!("  {label} manager of {}: {who}", name(uid));
        }
        Ok(())
    };
    managers("before:")?;
    println!(
        "{} (id {id}): {} -> {}, {} -> {}",
        member.name,
        name(plan.from_club),
        name(plan.to_club),
        job(plan.job.0),
        job(plan.job.1)
    );
    if let Some(made) = plan.contract {
        println!("  a new contract: £{} per week, to {}", made.wage, made.expires);
    }
    let done = session.apply_staff_plan(&plan)?;
    if done.grew {
        println!("  (a department list had no room: grown into memory of the editor's own)");
    }
    let now = |label: &str| -> Result<()> {
        let read = session.staff()?.into_iter().find(|s| s.uid == id).context("the member of staff is gone")?;
        let contract =
            read.contract_expires.map_or_else(String::new, |end| format!(", contract to {}", iso_date(Some(end))));
        println!(
            "  {label} {} as {}{contract}",
            read.club.as_deref().unwrap_or("-"),
            read.job.map_or("-".to_owned(), job)
        );
        Ok(())
    };
    now("now at")?;
    managers("now:")?;
    if restore {
        session.undo_staff_change(&done)?;
        now("back at")?;
        managers("back:")?;
    }
    Ok(())
}

fn heal_player(session: &Session, uid: u32, heal: bool, restore_after: Option<u64>) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let show = |label: &str| -> Result<usize> {
        let injuries = session.injuries(player)?;
        println!(
            "{} (UID {uid}) {label}: {} current injur{}",
            player.name,
            injuries.len(),
            if injuries.len() == 1 { "y" } else { "ies" }
        );
        for injury in &injuries {
            println!(
                "  {}: since {}, back between {} and {}",
                injury.name.as_deref().unwrap_or("?"),
                iso_date(injury.started),
                iso_date(injury.back_soonest),
                iso_date(injury.back_latest)
            );
        }
        Ok(injuries.len())
    };
    let before = show("now")?;
    if !heal {
        return Ok(());
    }
    let done = session.apply_heal(&session.plan_heal(player)?)?;
    ensure!(show("healed")? == 0, "he still has injuries");
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  listing them again in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_heal(&done)?;
        ensure!(show("restored")? == before, "his injuries are not all back");
    }
    Ok(())
}

fn ban_list(session: &Session, uid: Option<u32>, lift: bool, restore_after: Option<u64>) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let Some(uid) = uid else {
        let mut banned = 0;
        for player in players.iter() {
            let bans = session.bans(player).unwrap_or_default();
            if !bans.is_empty() {
                banned += 1;
                let matches: Vec<String> = bans.iter().map(|ban| ban.matches.to_string()).collect();
                println!(
                    "{:>10}  {:<26}  {:<26}  matches {}",
                    player.uid,
                    clip(&player.name, 26),
                    clip(player.club.as_deref().unwrap_or("-"), 26),
                    matches.join(" + ")
                );
            }
        }
        println!("{banned} player(s) with a ban.");
        return Ok(());
    };
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let show = |label: &str| -> Result<usize> {
        let bans = session.bans(player)?;
        println!("{} (UID {uid}) {label}: {} current ban(s)", player.name, bans.len());
        for ban in &bans {
            println!("  {} match(es), from {}", ban.matches, iso_date(ban.started));
        }
        Ok(bans.len())
    };
    let before = show("now")?;
    if !lift {
        return Ok(());
    }
    let done = session.apply_lift_bans(&session.plan_lift_bans(player)?)?;
    ensure!(show("lifted")? == 0, "he still has bans");
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  listing them again in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_lift_bans(&done)?;
        ensure!(show("restored")? == before, "his bans are not all back");
    }
    Ok(())
}

fn retirements(session: &Session, uid: Option<u32>, keep: bool, restore_after: Option<u64>) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let Some(uid) = uid else {
        let planned = session.planned_retirements()?.context("the planned retirements are not found in this build")?;
        // Who each one is, by the id the game gives him: a member of staff keeps it where a player does, in the
        // identity block.
        let (p, s) = (&session.layout.player, &session.layout.staff);
        let r = session.layout.retirement.as_ref().context("the layout does not place the planned retirements")?;
        let mut names: std::collections::HashMap<u32, String> = std::collections::HashMap::new();
        for player in players.iter() {
            if let Ok(id) = session.process.read_u32(player.address + p.at(r.player_person, player.shift)) {
                let club = player.club.as_deref().unwrap_or("no club");
                names.insert(id, format!("{} (UID {}, {club})", player.name, player.uid));
            }
        }
        let staff_person = s.identity() + (r.player_person - p.identity());
        for member in session.staff()? {
            if let Ok(id) = session.process.read_u32(member.address + s.at(staff_person, member.shift)) {
                let club = member.club.as_deref().unwrap_or("no club");
                names.entry(id).or_insert_with(|| format!("{} (staff {}, {club})", member.name, member.uid));
            }
        }
        for retirement in &planned {
            let name = names.get(&retirement.person).map_or("?", String::as_str);
            println!("  {}  {:#07x}  {name}", iso_date(retirement.date), retirement.person);
        }
        println!("{} planned retirement(s).", planned.len());
        return Ok(());
    };
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let show = |label: &str| -> Result<(Option<FmDate>, Vec<u8>)> {
        let date = session.planned_retirement(player)?;
        let details = session.player_details(player)?.context("the player has moved in memory")?;
        let traits: Vec<u8> = details.traits.into_iter().filter(|&bit| bit == 48 || bit == 49).collect();
        println!(
            "{} (UID {uid}) {label}: retires {}; traits 48 (retire at top) {}, 49 (play on) {}",
            player.name,
            date.map_or_else(|| "not planned".to_owned(), |date| iso_date(Some(date))),
            if traits.contains(&48) { "yes" } else { "no" },
            if traits.contains(&49) { "yes" } else { "no" },
        );
        Ok((date, traits))
    };
    let before = show("now")?;
    if !keep {
        return Ok(());
    }
    let done = session.apply_retirement(&session.plan_keep_playing(player)?)?;
    ensure!(show("kept")? == (None, vec![49]), "he still retires, or his traits are not the ones written");
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  putting it back in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_retirement(&done)?;
        ensure!(show("restored")? == before, "his plan or traits are not as they were");
        println!("  restored");
    }
    Ok(())
}

/// A nation or club by UID, for a tie.
#[derive(Clone, Copy)]
enum TieUid {
    Nation(u32),
    Club(u32),
}

/// What `tie_change` does to a player's ties.
enum TieAction {
    Set { index: usize, target: Option<TieUid>, rule: Option<u8> },
    Remove { index: usize },
    Add { tie: Tie, target: TieUid, rule: Option<u8> },
}

/// Where a relation to a person points into a player's object, and into a member of staff's (Windows).
const PERSON_IN_PLAYER: u64 = 0x288;
const PERSON_IN_STAFF: u64 = 0x100;

/// Prints every entry of a player's list of relations as stored: the target, its class and name where known, and the
/// bytes after it (a count, the kind of target, the kind of relation, a value, a level).
fn relation_entries(session: &Session, uid: u32) -> Result<()> {
    let (process, layout) = (&session.process, &session.layout);
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let known = nations(players.iter().map(|p| (p.nation_address, p.nation.as_deref(), p.nation_uid)));
    let club_name = |club: u64| -> Option<String> {
        let uid = process.read_u32(club + layout.club.uid).ok()?;
        clubs.get(uid).map(|c| format!("{} (club {uid})", c.name))
    };
    let staff = session.staff()?;
    // A relation to a person points into his object: on Windows a player's at +0x288 past his person block's shift, a
    // member of staff's at +0x100 (see docs/recon/fm27-nationality.md). Elsewhere, the people whose objects are close.
    let person_name = |person: u64| -> Option<String> {
        let player = players.iter().find(|p| p.address + PERSON_IN_PLAYER + p.shift == person);
        let found = player.map(|p| format!("{} (player {})", p.name, p.uid)).or_else(|| {
            let member = staff.iter().find(|s| s.address + PERSON_IN_STAFF + s.shift == person)?;
            Some(format!("{} (staff {})", member.name, member.uid))
        });
        found.or_else(|| {
            let close = |address: u64| (person as i64 - address as i64).unsigned_abs() <= 0x400;
            let offset = |address: u64| person as i64 - address as i64;
            let mut near: Vec<String> = players
                .iter()
                .filter(|p| close(p.address))
                .map(|p| format!("player {} {:+#x}", p.uid, offset(p.address)))
                .collect();
            near.extend(
                staff.iter().filter(|s| close(s.address)).map(|s| format!("staff {} {:+#x}", s.uid, offset(s.address))),
            );
            Some(format!("near: {}", near.join(", ")))
        })
    };
    let entries = session.relation_entries(player)?;
    println!("{} entries:", entries.len());
    println!("    #  target          count kind rel  value level e  f   class / name");
    for (index, bytes) in entries {
        let target = u64::from_le_bytes(bytes[..8].try_into().expect("8 bytes"));
        let count = u16::from_le_bytes([bytes[8], bytes[9]]);
        let (kind, relation) = (bytes[10], bytes[11]);
        let class = (is_user_pointer(target) && target >= 0x100_0000)
            .then(|| fmlibre_core::rtti::class_of(process, &session.plugin, target))
            .flatten()
            .unwrap_or_default();
        let name = match kind {
            _ if !is_user_pointer(target) => None,
            1 => club_name(target),
            3 => person_name(target),
            4 => process.read_u64(target + layout.team.club).ok().and_then(club_name).map(|c| format!("team of {c}")),
            8 => known.iter().find(|n| n.address == target).map(|n| format!("{} (nation {:?})", n.name, n.uid)),
            _ => None,
        };
        println!(
            "  {index:>3}  {target:#014x} {count:>5} {kind:>4} {relation:>4} {:>5} {:>5} {:>2} {:02x}   {class} {}",
            bytes[12],
            bytes[13],
            bytes[14],
            bytes[15],
            name.unwrap_or_default()
        );
    }
    Ok(())
}

/// Lists the players on loan, and checks the loan contracts found against the players whose team belongs to another
/// club than their contract's team.
fn list_loans(session: &Session, only: Option<u32>, club: Option<u32>, raw: bool, max: usize) -> Result<()> {
    let (process, layout) = (&session.process, &session.layout);
    ensure!(session.loans_known(), "this game's layout does not place loans, or the game does not name their class");
    let loan = layout.loan.as_ref().context("no loan layout")?;
    let p = &layout.player;
    let date = |d: Option<FmDate>| d.map_or("-".to_owned(), |d| format!("{:04}-{:02}-{:02}", d.year, d.month, d.day));
    let club_of = |team: u64| -> Option<u64> {
        let club = process.read_u64(team + layout.team.club).ok()?;
        is_user_pointer(club).then_some(club)
    };
    let (mut records, mut pointers, mut found, mut away, mut away_found, mut shown) = (0, 0, 0, 0, 0, 0);
    let mut slots: std::collections::BTreeMap<(usize, String), (usize, Vec<String>)> =
        std::collections::BTreeMap::new();
    let today = session.game_date();
    println!("In-game date: {}", date(today));
    for player in session.players()? {
        if only.is_some_and(|uid| uid != player.uid) {
            continue;
        }
        let record = process.read_u64(player.address + p.at(loan.record, player.shift))?;
        if is_user_pointer(record) {
            records += 1;
            if is_user_pointer(process.read_u64(record + loan.contract)?) {
                pointers += 1;
            }
            // What each slot of the record points at, by class: what else the record keeps.
            for (slot, word) in process.read_bytes(record, 0x40)?.as_chunks::<8>().0.iter().enumerate() {
                let word = u64::from_le_bytes(*word);
                if is_user_pointer(word) && word >= 0x100_0000 {
                    let class = fmlibre_core::rtti::class_of(process, &session.plugin, word).unwrap_or_default();
                    let seen = slots.entry((slot * 8, class)).or_insert((0, Vec::new()));
                    seen.0 += 1;
                    if seen.1.len() < 3 {
                        seen.1.push(format!("{} {}", player.uid, player.name));
                    }
                }
            }
        }
        // Away from his club: the team he plays for belongs to another club than his contract's team.
        let team = process.read_u64(player.address + p.team)?;
        let contract = process.read_u64(player.address + p.at(p.contract, player.shift))?;
        let employer = if is_user_pointer(contract) { process.read_u64(contract + layout.contract.team)? } else { 0 };
        let is_away = is_user_pointer(team) && is_user_pointer(employer) && club_of(team) != club_of(employer);
        away += usize::from(is_away);
        let Some(details) = session.loan(&player)? else {
            if is_away && only.is_some() {
                println!("{} (UID {}) plays away from his club but has no loan contract", player.name, player.uid);
            }
            continue;
        };
        found += 1;
        away_found += usize::from(is_away);
        if club.is_some() && club != details.club_uid && club != details.parent_uid {
            continue;
        }
        shown += 1;
        if shown > max {
            continue;
        }
        println!(
            "{:>11}  {:<26} {} -> {}  {} to {}  number {}  wage {}",
            player.uid,
            player.name,
            details.parent.as_deref().unwrap_or("?"),
            details.club.as_deref().unwrap_or("?"),
            date(details.from),
            date(details.until),
            details.squad_number.map_or("-".to_owned(), |n| n.to_string()),
            details.wage,
        );
        if let Some(t) = details.terms {
            let yes = |b: bool| if b { "yes" } else { "no" };
            let amount = |a: Option<i32>| a.map_or("-".to_owned(), |a| a.to_string());
            println!(
                "             recall {}, terminate {}, cup matches {}, against own club {}, option fee {}, monthly fee \
                 {} (unused {}), flags {:#06x}",
                yes(t.can_be_recalled),
                yes(t.can_be_terminated),
                yes(t.cup_matches),
                yes(t.against_own_club),
                amount(t.option_fee),
                amount(t.monthly_fee),
                amount(t.unused_fee),
                t.flags
            );
        }
        if raw && let Some(at) = session.loan_contract(player.address, player.shift)? {
            let bytes = process.read_bytes(at + 0x58, 0xA8)?;
            for (i, line) in bytes.chunks(16).enumerate() {
                let hex: Vec<String> = line.iter().map(|b| format!("{b:02x}")).collect();
                println!("      +{:#05x}  {}", 0x58 + i * 16, hex.join(" "));
            }
        }
    }
    println!(
        "{found} loan contract(s) ({shown} shown); {records} players with a record of other contracts, {pointers} of \
         them pointing at a contract; {away} players away from their club's teams, {away_found} of them with a loan \
         contract"
    );
    println!("What the records of other contracts point at, by slot and class:");
    for ((slot, class), (count, names)) in &slots {
        println!("  +{slot:#04x}  {count:>6}  {class}  e.g. {}", names.join(", "));
    }
    Ok(())
}

/// Counts the kinds of relation across every player; for one kind, its targets with the players who have it.
fn relation_kinds(session: &Session, only: Option<u8>, examples: usize) -> Result<()> {
    use std::collections::BTreeMap;
    let (process, layout) = (&session.process, &session.layout);
    let players = session.players()?;
    let clubs = ClubIndex::new(session.clubs()?);
    let known = nations(players.iter().map(|p| (p.nation_address, p.nation.as_deref(), p.nation_uid)));
    let target_name = |kind: u8, target: u64| -> String {
        let club = |club: u64| {
            let uid = process.read_u32(club + layout.club.uid).ok()?;
            clubs.get(uid).map(|c| c.name.clone())
        };
        let name = match kind {
            _ if !is_user_pointer(target) => Some("(none)".to_owned()),
            1 => club(target),
            4 => process.read_u64(target + layout.team.club).ok().and_then(club).map(|c| format!("team of {c}")),
            8 => known.iter().find(|n| n.address == target).map(|n| n.name.clone()),
            _ => None,
        };
        name.unwrap_or_else(|| format!("{target:#x}"))
    };
    // kind -> (players with one, entries); for the kind asked: target -> (players, counts, values, examples).
    let mut kinds: BTreeMap<(u8, u8), (usize, usize)> = BTreeMap::new();
    type Seen = (usize, BTreeMap<u16, usize>, BTreeMap<u16, usize>, Vec<String>);
    let mut targets: BTreeMap<String, Seen> = BTreeMap::new();
    let mut read = 0;
    // Room for a club he was trained at: [with one already, with room, without one: with room, with a favoured or
    // disliked club, with a favoured or disliked person only, with none of those].
    let mut club_room = [0usize; 6];
    for player in &players {
        let Ok(entries) = session.relation_entries(player) else { continue };
        read += 1;
        let has = |relations: &[u8]| entries.iter().any(|(_, bytes)| relations.contains(&bytes[11]));
        let room = session.relation_room(player).unwrap_or(0) > 0;
        let without = !has(&[72]);
        club_room[0] += usize::from(!without);
        club_room[1] += usize::from(room);
        if without {
            let slot = if room {
                2
            } else if has(&[3, 4]) {
                3
            } else if has(&[1, 2]) {
                4
            } else {
                5
            };
            club_room[slot] += 1;
        }
        let mut seen = std::collections::HashSet::new();
        for (_, bytes) in entries {
            let (kind, relation) = (bytes[10], bytes[11]);
            let slot = kinds.entry((relation, kind)).or_default();
            slot.1 += 1;
            if seen.insert((relation, kind)) {
                slot.0 += 1;
            }
            if only != Some(relation) {
                continue;
            }
            let target = u64::from_le_bytes(bytes[..8].try_into().expect("8 bytes"));
            let entry = targets.entry(target_name(kind, target)).or_default();
            entry.0 += 1;
            *entry.1.entry(u16::from_le_bytes([bytes[8], bytes[9]])).or_default() += 1;
            *entry.2.entry(u16::from(bytes[12])).or_default() += 1;
            if entry.3.len() < examples {
                let club = player.club.as_deref().unwrap_or("-");
                entry.3.push(format!(
                    "{} {} ({}, {club})",
                    player.uid,
                    player.name,
                    player.nation.as_deref().unwrap_or("?")
                ));
            }
        }
    }
    println!("{read} players' lists read.");
    match only {
        None => {
            println!("  rel kind  players  entries");
            for ((relation, kind), (with, entries)) in kinds {
                println!("  {relation:>3} {kind:>4}  {with:>7}  {entries:>7}");
            }
            let [with, room, without_room, clubs, people, none] = club_room;
            println!("Trained at a club (72): {with} players; room for another tie: {room}.");
            // Lists by length and capacity (in entries): the full ones, and those with room past their length.
            let mut full: BTreeMap<u64, usize> = BTreeMap::new();
            let mut spare: BTreeMap<(u64, u64), usize> = BTreeMap::new();
            for player in &players {
                let Some((len, cap)) = session.relation_capacity(player) else { continue };
                if len == cap {
                    *full.entry(len).or_default() += 1;
                } else {
                    *spare.entry((len, cap)).or_default() += 1;
                }
            }
            println!("Full lists by length: {full:?}");
            println!("Lists with room, (length, capacity): {spare:?}");
            println!(
                "Without a club: {} players; {without_room} with room, {clubs} with a favoured or disliked club (3, 4), \
                 {people} with only a favoured or disliked person (1, 2), {none} with none of those.",
                without_room + clubs + people + none
            );
        }
        Some(relation) => {
            let mut rows: Vec<_> = targets.into_iter().collect();
            rows.sort_by_key(|row| std::cmp::Reverse(row.1.0));
            println!("Relation {relation}: {} target(s)", rows.len());
            for (target, (with, counts, values, names)) in rows.iter().take(40) {
                let top = |map: &BTreeMap<_, usize>| {
                    let mut v: Vec<_> = map.iter().collect();
                    v.sort_by(|a, b| b.1.cmp(a.1));
                    v.iter().take(6).map(|(k, n)| format!("{k}x{n}")).collect::<Vec<_>>().join(" ")
                };
                println!("  {with:>6}  {target}  counts [{}] values [{}]", top(counts), top(values));
                for name in names {
                    println!("            {name}");
                }
            }
        }
    }
    Ok(())
}

/// Lists a player's ties, after changing them as `action` says (and putting them back with --restore).
fn tie_change(session: &Session, uid: u32, action: Option<TieAction>, restore: RestoreArgs) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let known = nations(players.iter().map(|p| (p.nation_address, p.nation.as_deref(), p.nation_uid)));
    let show = |label: &str| -> Result<()> {
        let ties = session.relations(player)?;
        let room = session.relation_room(player)?;
        println!("{} (UID {uid}) {label}: {} tie(s), room for {room} more", player.name, ties.len());
        for tie in ties {
            let (kind, name) = match tie.tie {
                Tie::Nationality | Tie::TrainedInNation | Tie::WorkPermit => {
                    let nation = known.iter().find(|n| n.address == tie.target).map(|n| n.name.as_str());
                    let kind = match tie.tie {
                        Tie::Nationality => "nationality",
                        Tie::TrainedInNation => "trained in nation",
                        _ => "no work permit in",
                    };
                    (kind, nation.unwrap_or("?"))
                }
                Tie::TrainedAtClub => ("trained at club", clubs.get(tie.target_uid).map_or("?", |c| c.name.as_str())),
            };
            let rule = tie.rule.map_or(String::new(), |rule| format!(", homegrown rule {rule}"));
            let days = tie.days.map_or(String::new(), |days| format!(", {days} days left"));
            println!("  #{:<3} {kind:<18} {name} (UID {}){rule}{days}", tie.index, tie.target_uid);
        }
        Ok(())
    };
    show("now")?;
    let Some(action) = action else {
        return Ok(());
    };
    let target = |by: TieUid| -> Result<TieTarget> {
        Ok(match by {
            TieUid::Nation(uid) => TieTarget::Nation(
                known.iter().find(|n| n.uid == Some(uid)).with_context(|| format!("no nation with UID {uid}"))?,
            ),
            TieUid::Club(uid) => TieTarget::Club(clubs.get(uid).with_context(|| format!("no club with UID {uid}"))?),
        })
    };
    let plan = match action {
        TieAction::Set { index, target: by, rule } => {
            session.plan_relation_change(player, index, by.map(target).transpose()?, rule)?
        }
        TieAction::Remove { index } => session.plan_relation_removal(player, index)?,
        TieAction::Add { tie, target: by, rule } => session.plan_relation_add(player, tie, target(by)?, rule)?,
    };
    let done = session.apply_relation(&plan)?;
    if done.grew {
        println!("  (the list had no room: grown into memory of the editor's own)");
    }
    show("changed")?;
    if restore.restore {
        if restore.hold > 0 {
            println!("  putting it back in {} s", restore.hold);
            std::thread::sleep(std::time::Duration::from_secs(restore.hold));
        }
        session.undo_relation(&done)?;
        show("restored")?;
    }
    Ok(())
}

fn swap_players(session: &Session, uid: u32, other: u32, restore: bool) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let first = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let second = players.get(other).with_context(|| format!("no player with UID {other}"))?;
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let plan = session.plan_club_swap(first, second, &human)?;
    let name = |club: u32| clubs.get(club).map_or("?", |c| c.name.as_str());
    println!(
        "{} ({}) <-> {} ({}), {} writes",
        first.name,
        name(plan.from_club),
        second.name,
        name(plan.to_club),
        plan.writes()
    );
    // A swap is written and undone like a move: as the patches it was planned as.
    let done = session.apply_club_move(&plan)?;
    if plan.leaves_a_human_club() {
        println!("  out of {} of the human club's selections", done.selections());
    }
    // Read both again as the lists would.
    let clubs_now = |label: &str| -> Result<(Option<u32>, Option<u32>)> {
        let now = PlayerIndex::new(session.players()?);
        let (a, b) = (now.get(uid).context("gone")?, now.get(other).context("gone")?);
        println!(
            "  {label}: {} at {}, {} at {}",
            a.name,
            a.club.as_deref().unwrap_or("-"),
            b.name,
            b.club.as_deref().unwrap_or("-")
        );
        Ok((a.club_uid, b.club_uid))
    };
    ensure!(clubs_now("now")? == (Some(plan.to_club), Some(plan.from_club)), "the players did not swap clubs");
    if restore {
        session.undo_club_move(&done)?;
        ensure!(clubs_now("back")? == (Some(plan.from_club), Some(plan.to_club)), "the players are not back");
    }
    Ok(())
}

fn scout(
    session: &Session,
    club: Option<u32>,
    request: Option<ScoutRequest>,
    squad: bool,
    tactics: bool,
) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let uid = club.or_else(|| human.first().copied()).context("no club given and no human manager with a club")?;
    let club = clubs.get(uid).with_context(|| format!("no club with UID {uid}"))?;
    let finances = session.club_details(club)?.and_then(|details| details.finances);
    let buyer = Buyer {
        club,
        transfer_budget: finances.map(|f| i64::from(f.transfer_budget)),
        wage_budget: finances.map(|f| i64::from(f.wage_budget)),
    };
    let name = |uid: Option<u32>| uid.and_then(|uid| players.get(uid)).map_or("-", |p| p.name.as_str());
    println!(
        "{}: transfer budget {:?}, wage budget {:?}, wage room {:?} a week",
        club.name,
        buyer.transfer_budget,
        buyer.wage_budget,
        session.wage_room(&buyer, &players)
    );

    if tactics {
        let started = Instant::now();
        let tactics = session.club_tactics(club, &players)?;
        println!("\n{} tactic(s) in {:.1} s", tactics.len(), started.elapsed().as_secs_f64());
        for (i, tactic) in tactics.iter().enumerate() {
            println!("tactic {i} (style {}, {} copies)", tactic.style.as_deref().unwrap_or("?"), tactic.copies);
            for s in &tactic.slots {
                println!(
                    "  {:>2}  {:<5} {:<5} {:<5} {}",
                    s.index,
                    s.in_possession.unwrap_or(&s.in_possession_mask),
                    s.out_of_possession.unwrap_or(&s.out_of_possession_mask),
                    s.position.unwrap_or("?"),
                    name(s.player)
                );
            }
        }
    }

    if squad {
        let started = Instant::now();
        let report = session.squad_report(club, &players)?;
        println!(
            "\nsquad: {} players, level {} (average ability of the best eleven), average age {:.1}, in {:.2} s",
            report.size,
            report.level,
            report.average_age.unwrap_or(0.0),
            started.elapsed().as_secs_f64()
        );
        for line in &report.lines {
            let names: Vec<String> = line
                .players
                .iter()
                .map(|d| format!("{} {} ({})", d.player.name, d.player.current_ability, d.player.age.unwrap_or(0)))
                .collect();
            let cover: Vec<&str> = line.cover.iter().map(|d| d.player.name.as_str()).collect();
            println!(
                "  {:<10} {:<8} {}/{}{}{}  {}  | cover: {}",
                line.key,
                format!("{:?}", line.status),
                line.players.len(),
                line.target,
                if line.weak { " weak" } else { "" },
                if line.ageing { " ageing" } else { "" },
                names.join(", "),
                cover.join(", ")
            );
        }
        println!("let go:");
        for d in &report.departures {
            let reasons: Vec<String> = d
                .reasons
                .iter()
                .map(|r| r.value.map_or_else(|| r.code.to_owned(), |v| format!("{}={v}", r.code)))
                .collect();
            println!(
                "  {:<24} {:>3} {:<10} #{:<2} CA {:>3}  {:?}  priority {:>2}  value {:>11}  wage {:>8}  {}",
                clip(&d.player.name, 24),
                d.player.age.unwrap_or(0),
                d.line,
                d.rank,
                d.player.current_ability,
                d.action,
                d.priority,
                d.value.map_or_else(|| "-".to_owned(), |v| v.to_string()),
                d.wage.map_or_else(|| "-".to_owned(), |v| v.to_string()),
                reasons.join(" ")
            );
        }
    }

    let Some(request) = request else {
        return Ok(());
    };
    let started = Instant::now();
    let scouted = session.scout(&request, &buyer, &players, &clubs, &human)?;
    println!(
        "\n{} ({} / {}, {:?}): {} of {} players can play there, in {:.2} s",
        request.position,
        request.in_possession.as_deref().unwrap_or("any"),
        request.out_of_possession.as_deref().unwrap_or("any"),
        request.purpose,
        scouted.candidates,
        scouted.examined,
        started.elapsed().as_secs_f64(),
    );
    let fitting = |f: &fmlibre_core::Fitting| {
        format!(
            "{:>10}  {:<24} {:>3} {:<22} fit {:>3} ({:<4} {:>4.1} / {:<4} {:>4.1}, pos {:>2})",
            f.player.uid,
            clip(&f.player.name, 24),
            f.player.age.map_or_else(String::new, |age| age.to_string()),
            clip(f.player.club.as_deref().unwrap_or("(free)"), 22),
            f.fit,
            f.in_possession_role.unwrap_or("-"),
            f.in_possession.unwrap_or(0.0),
            f.out_of_possession_role.unwrap_or("-"),
            f.out_of_possession.unwrap_or(0.0),
            f.position_rating,
        )
    };
    println!("the club's own:");
    for f in &scouted.squad {
        println!("  {}", fitting(f));
    }
    println!("recommended:");
    for s in &scouted.suggestions {
        let reasons: Vec<String> = s.reasons.iter().map(|r| format!("{}{:+}", r.code, r.points)).collect();
        println!(
            "  {}  prob {:>3}  score {:>3}  fee {:>11}  wage {:>8}  {}{}",
            fitting(&s.fitting),
            s.probability,
            s.score,
            s.fee.map_or_else(|| "-".to_owned(), |fee| fee.to_string()),
            s.wage.map_or_else(|| "-".to_owned(), |wage| wage.to_string()),
            reasons.join(" "),
            s.owner_club.as_deref().map_or_else(String::new, |owner| format!("  (contract with {owner})"))
        );
    }
    Ok(())
}

fn teams(session: &Session, uid: u32) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let club = clubs.get(uid).with_context(|| format!("no club with UID {uid}"))?;
    let name = |uid: Option<u32>| uid.and_then(|uid| players.get(uid)).map_or("-", |p| p.name.as_str());
    for team in session.club_teams(club, &players)? {
        println!(
            "{} team {} (kind {}, {}): captain {}, vice-captain {}, {} players",
            club.name,
            team.index,
            team.kind,
            team.age_limit.map_or_else(|| "no age limit".to_owned(), |age| format!("under {age}")),
            name(team.captain),
            name(team.vice_captain),
            team.players.len()
        );
        for member in &team.players {
            let tags = [
                (!member.plays_here).then_some("elsewhere"),
                (member.loan == Some(Loan::In)).then_some("loan in"),
                (member.loan == Some(Loan::Out)).then_some("loan out"),
                (member.injuries > 0).then_some("injured"),
            ];
            let tags: Vec<&str> = tags.into_iter().flatten().collect();
            println!(
                "  {:>10}  {:<28}  energy {:>5}  sharpness {:>5}  jadedness {:>4}  morale {:>2}  {}",
                member.uid,
                clip(name(Some(member.uid)), 28),
                member.condition,
                member.match_sharpness,
                member.jadedness,
                member.morale,
                tags.join(", ")
            );
        }
    }
    Ok(())
}

fn room(session: &Session, uid: Option<u32>, max: usize) -> Result<()> {
    let clubs = ClubIndex::new(session.clubs()?);
    let Some(uid) = uid else {
        // Best known first, as the club search lists them.
        let full: Vec<_> = clubs
            .search("")
            .into_iter()
            .filter_map(|club| match session.senior_squad_room(club) {
                Ok((players, room)) if players > 0 && players >= room => Some((club, players)),
                _ => None,
            })
            .collect();
        println!("{} clubs have a full senior squad list", full.len());
        for (club, players) in full.into_iter().take(max) {
            println!("  {:>10}  {:<32}  {players} players", club.uid, clip(&club.name, 32));
        }
        return Ok(());
    };
    let players = PlayerIndex::new(session.players()?);
    let club = clubs.get(uid).with_context(|| format!("no club with UID {uid}"))?;
    let (listed, room) = session.senior_squad_room(club)?;
    let state = if listed >= room { "full" } else { "has room" };
    println!("{}: its senior team lists {listed} players, with room for {room} ({state})", club.name);
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let makers = session.room_makers(club, &players, &human)?;
    println!("  {} of them can be released to make room, the first suggested", makers.len());
    for maker in makers {
        let player = players.get(maker.uid);
        let tags = [maker.injured.then_some("injured"), maker.captain.then_some("captain")];
        let tags: Vec<&str> = tags.into_iter().flatten().collect();
        println!(
            "  {:>10}  {:<28}  CA {:>3}  {}",
            maker.uid,
            clip(player.map_or("-", |p| p.name.as_str()), 28),
            player.map_or(0, |p| p.current_ability),
            tags.join(", ")
        );
    }
    Ok(())
}

fn captain(
    session: &Session,
    club_uid: u32,
    team: usize,
    role: CaptainRole,
    uid: u32,
    restore_after: Option<u64>,
) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let club = clubs.get(club_uid).with_context(|| format!("no club with UID {club_uid}"))?;
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let name = |uid: Option<u32>| uid.and_then(|uid| players.get(uid)).map_or("-", |p| p.name.as_str());
    let holders = |label: &str| -> Result<(Option<u32>, Option<u32>)> {
        let teams = session.club_teams(club, &players)?;
        let now = teams.get(team).context("the team is gone")?;
        println!("  {label}: captain {}, vice-captain {}", name(now.captain), name(now.vice_captain));
        Ok((now.captain, now.vice_captain))
    };
    let before = holders("now")?;
    let plan = session.plan_captain(club, team, role, player, &players)?;
    println!(
        "{} becomes {role:?} of {} team {team} after {}; {} writes{}",
        player.name,
        club.name,
        name(plan.old),
        plan.writes(),
        if plan.swapped { ", the two captains swap" } else { "" }
    );
    let done = session.apply_captain(&plan)?;
    let after = holders("set")?;
    let holder = match role {
        CaptainRole::Captain => after.0,
        CaptainRole::ViceCaptain => after.1,
    };
    ensure!(holder == Some(uid), "he does not hold the role");
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  giving it back in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_captain(&done)?;
        ensure!(holders("restored")? == before, "the captains are not as they were");
    }
    Ok(())
}

fn clubs(session: &Session, text: Option<&str>, limit: usize, export: Option<(&Path, ExportFormat)>) -> Result<()> {
    let started = Instant::now();
    let index = ClubIndex::new(session.clubs()?);
    let elapsed = started.elapsed();
    let hits = index.search(text.unwrap_or(""));
    if let Some((path, format)) = export {
        export_to(session, path, "clubs", |header, out| session.export_clubs(&hits, format, header, out))?;
    }
    println!(
        "Read {} clubs in {:.1} s; {} shown of {} matching.",
        index.len(),
        elapsed.as_secs_f64(),
        hits.len().min(limit),
        hits.len()
    );
    println!();
    println!("{:>10}  {:<32}  {:<20}  {:>5}  {:>7}", "UID", "Name", "Short name", "Rep", "Founded");
    for c in hits.iter().take(limit) {
        let name = if c.women { format!("{} (women)", c.name) } else { c.name.clone() };
        println!(
            "{:>10}  {:<32}  {:<20}  {:>5}  {:>7}",
            c.uid,
            clip(&name, 32),
            clip(c.short_name.as_deref().unwrap_or("-"), 20),
            c.reputation.map_or_else(String::new, |r| r.to_string()),
            c.founded.map_or_else(String::new, |y| y.to_string())
        );
    }
    Ok(())
}

fn club(session: &Session, uid: u32) -> Result<()> {
    let index = ClubIndex::new(session.clubs()?);
    let summary = index.get(uid).with_context(|| format!("no club with UID {uid}"))?;
    let d = session.club_details(summary)?.context("the club's data changed while reading; try again")?;
    let c = &d.summary;
    println!("{} (UID {}){}", c.name, c.uid, if c.women { ", women's club" } else { "" });
    let teams = session.process.read_u64(summary.address + session.layout.club.teams).unwrap_or(0);
    println!("  addresses      object {:#x}, teams {teams:#x}", summary.address);
    println!("  short name     {}", c.short_name.as_deref().unwrap_or("-"));
    println!("  reputation     {}", c.reputation.map_or_else(|| "-".to_owned(), |r| r.to_string()));
    println!("  founded        {}", c.founded.map_or_else(|| "-".to_owned(), |y| y.to_string()));
    if session.layout.team.manager.is_some() {
        let manager = match session.club_manager(summary) {
            Ok(None) => "no one".to_owned(),
            Ok(Some(id)) => {
                let staff = StaffIndex::new(session.staff()?);
                staff.get(id).map_or_else(|| format!("id {id}"), |s| format!("{} ({id})", s.name))
            }
            Err(err) => format!("- ({err})"),
        };
        println!("  manager        {manager}");
    }
    println!("  season tickets {}", d.season_tickets.map_or_else(|| "-".to_owned(), |n| n.to_string()));
    println!("  social media   {}", d.social_media.map_or_else(|| "-".to_owned(), |n| n.to_string()));
    let mix: Vec<String> =
        SUPPORTER_MIX.iter().filter_map(|k| d.supporter_mix.get(k).map(|v| format!("{k} {v}%"))).collect();
    println!("  supporters     {}", mix.join(", "));
    let traits: Vec<String> =
        SUPPORTER_TRAITS.iter().filter_map(|k| d.supporter_traits.get(k).map(|v| format!("{k} {v}"))).collect();
    println!("  traits         {}", traits.join(", "));
    let facilities: Vec<String> = d.facilities.iter().map(|(k, v)| format!("{k} {v}")).collect();
    println!("  facilities     {}", facilities.join(", "));
    match &d.finances {
        Some(f) => println!(
            "  finances       balance £{}, transfer budget £{}, wage budget £{} p/w (total £{}), ticket £{:.0}",
            f.balance, f.transfer_budget, f.wage_budget, f.total_wage_budget, f.ticket_price
        ),
        None => println!("  finances       not kept for this club"),
    }
    match &d.stadium {
        Some(s) => println!(
            "  stadium        {}: capacity {}, seated {}, in use {}, can grow to {}",
            s.name.as_deref().unwrap_or("(no name)"),
            s.capacity,
            s.seating,
            if s.used == 0 { "all".to_owned() } else { s.used.to_string() },
            s.expansion
        ),
        None => println!("  stadium        not found"),
    }
    Ok(())
}

/// "2026-07-18", or "-" when the date is unknown.
fn iso_date(date: Option<FmDate>) -> String {
    date.map_or_else(|| "-".to_owned(), |d| format!("{:04}-{:02}-{:02}", d.year, d.month, d.day))
}

/// Shortens `text` to at most `width` characters.
fn clip(text: &str, width: usize) -> String {
    if text.chars().count() <= width {
        return text.to_owned();
    }
    let mut out: String = text.chars().take(width - 1).collect();
    out.push('…');
    out
}

// ---------------------------------------------------------------------------
// info

#[derive(Serialize)]
struct InfoReport<'a> {
    elevated: bool,
    game: &'a GameInfo,
    modules: Vec<ModuleReport>,
    plugin: Option<PluginReport>,
}

#[derive(Serialize)]
struct ModuleReport {
    name: String,
    base: String,
    size: String,
    path: PathBuf,
}

#[cfg(windows)]
#[derive(Serialize)]
struct PluginReport {
    link_timestamp: String,
    size_of_image: String,
    sections: Vec<SectionReport>,
    export_count: usize,
    build_stamp: Option<String>,
    writable_regions: usize,
    writable_bytes: u64,
}

#[cfg(target_os = "macos")]
#[derive(Serialize)]
struct PluginReport {
    uuid: Option<String>,
    size: String,
    sections: Vec<SectionReport>,
    writable_regions: usize,
    writable_bytes: u64,
}

#[derive(Serialize)]
struct SectionReport {
    name: String,
    rva: String,
    size: String,
    flags: String,
}

fn info(process: &Process, game: &GameInfo, modules: &[Module], elevated: bool, json: Option<&Path>) -> Result<()> {
    println!("FMLibreEditor probe {} (read-only)", env!("CARGO_PKG_VERSION"));
    println!("{ELEVATED}: {}", if elevated { "yes" } else { "no" });
    println!();
    println!("Game process");
    println!("  pid          {}", game.pid);
    println!("  exe          {}", game.exe_path.display());
    println!("  storefront   {}", game.storefront.label());
    println!("  edition      {}", game.edition.map_or_else(|| "unknown".to_owned(), |e| format!("FM{e}")));
    if let Some(name) = &game.package_full_name {
        println!("  package      {name}");
    }
    if let Some(version) = &game.package_version {
        println!("  version      {version}");
    }

    println!();
    println!("Key modules");
    let mut module_reports = Vec::new();
    for name in KEY_MODULES {
        match find_module(modules, name) {
            Some(m) => {
                println!("  {:<18} base {:#014x}  size {:#010x}", m.name, m.base, m.size);
                module_reports.push(ModuleReport {
                    name: m.name.clone(),
                    base: format!("{:#x}", m.base),
                    size: format!("{:#x}", m.size),
                    path: m.path.clone(),
                });
            }
            None => println!("  {name:<18} not loaded"),
        }
    }

    let plugin = match find_module(modules, GAME_PLUGIN) {
        Some(module) => Some(plugin_report(process, module)?),
        None => {
            println!();
            println!("{GAME_PLUGIN} is not loaded yet; wait for the main menu and run the probe again.");
            None
        }
    };

    if let Some(path) = json {
        write_json(path, &InfoReport { elevated, game, modules: module_reports, plugin })?;
    }
    Ok(())
}

#[cfg(windows)]
fn plugin_report(process: &Process, module: &Module) -> Result<PluginReport> {
    let pe = PeImage::read(process, module.base).with_context(|| format!("reading {GAME_PLUGIN} headers"))?;
    println!();
    println!("{GAME_PLUGIN} (headers read from memory)");
    println!("  link timestamp   {:#010x}", pe.timestamp);
    println!("  size of image    {:#x}", pe.size_of_image);
    println!("  sections");
    for s in &pe.sections {
        println!("    {:<9} rva {:#010x}  size {:#010x}  {}", s.name, s.rva, s.virtual_size, s.flags());
    }

    let exports = pe.exports(process).unwrap_or_default();
    println!("  exports          {}", exports.len());
    let build_stamp = exports
        .iter()
        .find(|e| e.name == "game_plugin_plugin_build_timestamp")
        .map(|e| describe_symbol(process, &pe, e.rva));
    if let Some(stamp) = &build_stamp {
        println!("  build stamp      {stamp}");
    }

    let writable: Vec<_> =
        regions(process, module.base, module.end()).into_iter().filter(|r| r.is_writable()).collect();
    let writable_bytes: u64 = writable.iter().map(|r| r.size).sum();
    println!("  writable memory  {} regions, {:.1} MiB", writable.len(), writable_bytes as f64 / 1_048_576.0);

    Ok(PluginReport {
        link_timestamp: format!("{:#010x}", pe.timestamp),
        size_of_image: format!("{:#x}", pe.size_of_image),
        sections: pe
            .sections
            .iter()
            .map(|s| SectionReport {
                name: s.name.clone(),
                rva: format!("{:#x}", s.rva),
                size: format!("{:#x}", s.virtual_size),
                flags: s.flags(),
            })
            .collect(),
        export_count: exports.len(),
        build_stamp,
        writable_regions: writable.len(),
        writable_bytes,
    })
}

#[cfg(target_os = "macos")]
fn plugin_report(process: &Process, module: &Module) -> Result<PluginReport> {
    let image = MachImage::read(process, module.base).with_context(|| format!("reading {GAME_PLUGIN} headers"))?;
    println!();
    println!("{GAME_PLUGIN} (headers read from memory)");
    println!("  UUID             {}", image.uuid_text().as_deref().unwrap_or("none"));
    println!("  size             {:#x}", image.size());
    println!("  segments");
    for s in &image.segments {
        println!("    {:<13} rva {:#010x}  size {:#010x}  {}", s.name, s.rva, s.size, s.flags());
    }

    let writable: Vec<_> =
        regions(process, module.base, module.end()).into_iter().filter(|r| r.is_writable()).collect();
    let writable_bytes: u64 = writable.iter().map(|r| r.size).sum();
    println!("  writable memory  {} regions, {:.1} MiB", writable.len(), writable_bytes as f64 / 1_048_576.0);

    Ok(PluginReport {
        uuid: image.uuid_text(),
        size: format!("{:#x}", image.size()),
        sections: image
            .segments
            .iter()
            .flat_map(|segment| {
                segment.sections.iter().map(|s| SectionReport {
                    name: format!("{},{}", s.segment, s.name),
                    rva: format!("{:#x}", s.rva),
                    size: format!("{:#x}", s.size),
                    flags: segment.flags(),
                })
            })
            .collect(),
        writable_regions: writable.len(),
        writable_bytes,
    })
}

/// Best-effort description of an exported symbol: a string, a pointer to a string, or raw bytes.
#[cfg(windows)]
fn describe_symbol(process: &Process, pe: &PeImage, rva: u32) -> String {
    let location = match pe.section_for_rva(rva.into()) {
        Some(s) => format!("rva {rva:#x} in {} [{}]", s.name, s.flags()),
        None => format!("rva {rva:#x}"),
    };
    let Ok(bytes) = process.read_bytes(pe.base + u64::from(rva), 64) else {
        return format!("{location}, unreadable");
    };
    if let Some(text) = ascii_prefix(&bytes) {
        return format!("\"{text}\" ({location})");
    }
    let value = u64::from_le_bytes(bytes[..8].try_into().expect("8 bytes"));
    if let Some(text) = process.read_bytes(value, 64).ok().as_deref().and_then(ascii_prefix) {
        return format!("-> \"{text}\" ({location})");
    }
    let hex: Vec<String> = bytes[..16].iter().map(|b| format!("{b:02x}")).collect();
    format!("{} ({location})", hex.join(" "))
}

/// The printable ASCII text at the start of `bytes`, if it is at least 4 characters long.
#[cfg(windows)]
fn ascii_prefix(bytes: &[u8]) -> Option<String> {
    let len = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    let text = &bytes[..len];
    (len >= 4 && text.iter().all(|&b| b == b' ' || b.is_ascii_graphic()))
        .then(|| String::from_utf8_lossy(text).into_owned())
}

// ---------------------------------------------------------------------------
// scan

#[derive(Serialize)]
struct ScanReport<'a> {
    game: &'a GameInfo,
    plugin_base: String,
    min_count: u64,
    max_count: u64,
    arrays: &'a [ArrayCandidate],
}

fn scan(
    process: &Process,
    game: &GameInfo,
    modules: &[Module],
    opts: &ScanOptions,
    top: usize,
    json: Option<&Path>,
) -> Result<()> {
    let module = find_module(modules, GAME_PLUGIN)
        .with_context(|| format!("{GAME_PLUGIN} is not loaded yet; wait for the main menu"))?;
    let section = section_names(process, module);

    println!(
        "Scanning writable memory of {GAME_PLUGIN} for object arrays ({}..={} elements)...",
        opts.min_count, opts.max_count
    );
    let started = Instant::now();
    let arrays = scan_object_arrays(process, module, opts);
    println!("Found {} arrays in {:.1} s.", arrays.len(), started.elapsed().as_secs_f64());
    if arrays.is_empty() {
        println!("No arrays found. Load a save (not just the main menu) and scan again.");
    } else {
        println!();
        println!("{:>9}  {:<26}  top vtables: rva (section) x count", "elements", "pair rva (section)");
        for array in arrays.iter().take(top) {
            let pairs: Vec<String> =
                array.pair_rvas.iter().map(|&rva| format!("{rva:#x} ({})", section(rva))).collect();
            let vtables: Vec<String> = array
                .vtables
                .iter()
                .take(4)
                .map(|v| format!("{:#x} ({}) x{}", v.rva, section(v.rva), v.count))
                .collect();
            println!("{:>9}  {:<26}  {}", array.count, pairs.join(", "), vtables.join(", "));
        }
        if arrays.len() > top {
            println!("... {} more (use --top to show them)", arrays.len() - top);
        }
    }

    if let Some(path) = json {
        let report = ScanReport {
            game,
            plugin_base: format!("{:#x}", module.base),
            min_count: opts.min_count,
            max_count: opts.max_count,
            arrays: &arrays,
        };
        write_json(path, &report)?;
    }
    Ok(())
}

/// Names the section of `module` an RVA is in, or "?".
#[cfg(windows)]
fn section_names(process: &Process, module: &Module) -> impl Fn(u64) -> String {
    let pe = PeImage::read(process, module.base).ok();
    move |rva| pe.as_ref().and_then(|pe| pe.section_for_rva(rva)).map_or_else(|| "?".to_owned(), |s| s.name.clone())
}

/// Names the section of `module` an RVA is in, e.g. "__DATA,__bss", or "?".
#[cfg(target_os = "macos")]
fn section_names(process: &Process, module: &Module) -> impl Fn(u64) -> String {
    let image = MachImage::read(process, module.base).ok();
    move |rva| {
        image
            .as_ref()
            .and_then(|image| image.section_for_rva(rva))
            .map_or_else(|| "?".to_owned(), |s| format!("{},{}", s.segment, s.name))
    }
}

// ---------------------------------------------------------------------------
// dump / element

/// Writes `len` bytes at `addr` to `path`, a page at a time; pages that cannot be read are written as zeros.
fn dump_raw(process: &Process, addr: u64, len: u64, path: &Path) -> Result<()> {
    const PAGE: u64 = 0x1000;
    let mut bytes = Vec::with_capacity(len as usize);
    let mut unread = 0u64;
    let mut at = addr;
    while at < addr + len {
        let chunk = (PAGE - at % PAGE).min(addr + len - at);
        match process.read_bytes(at, chunk as usize) {
            Ok(page) => bytes.extend_from_slice(&page),
            Err(_) => {
                bytes.resize(bytes.len() + chunk as usize, 0);
                unread += chunk;
            }
        }
        at += chunk;
    }
    std::fs::write(path, &bytes).with_context(|| format!("writing {}", path.display()))?;
    println!("{len:#x} bytes at {addr:#x} written to {} ({unread:#x} unreadable)", path.display());
    Ok(())
}

fn dump(process: &Process, modules: &[Module], addr: u64, len: u64) -> Result<()> {
    let bytes =
        process.read_bytes(addr, len as usize).with_context(|| format!("reading {len:#x} bytes at {addr:#x}"))?;
    println!("{} ({len:#x} bytes)", describe_address(addr, modules));
    println!();
    for (i, line) in bytes.chunks(16).enumerate() {
        let hex: Vec<String> = line.iter().map(|b| format!("{b:02x}")).collect();
        let ascii: String =
            line.iter().map(|&b| if b == b' ' || b.is_ascii_graphic() { b as char } else { '.' }).collect();
        println!("{:#014x}  {:<47}  {ascii}", addr + (i * 16) as u64, hex.join(" "));
    }
    println!();
    println!("As 64-bit values:");
    let plugin = find_module(modules, GAME_PLUGIN);
    for (i, chunk) in bytes.as_chunks::<8>().0.iter().enumerate() {
        let value = u64::from_le_bytes(*chunk);
        let (lo, hi) = (value as u32, (value >> 32) as u32);
        // The class the compiler names for a vtable here, or for the object a pointer leads to.
        let class = plugin.and_then(|plugin| {
            let object = if plugin.contains(value) { addr + i as u64 * 8 } else { value };
            (is_user_pointer(value) && value >= 0x100_0000)
                .then(|| fmlibre_core::rtti::class_of(process, plugin, object))
                .flatten()
        });
        let class = class.map_or(String::new(), |name| format!(" [{name}]"));
        println!("  +{:#06x}  {value:#018x}  lo={lo:<10} hi={hi:<10} {}{class}", i * 8, pointer_hint(value, modules));
    }
    Ok(())
}

fn element(process: &Process, modules: &[Module], pair: u64, index: u64, len: u64) -> Result<()> {
    let (begin, count) = read_pair(process, pair)?;
    ensure!(index < count, "index {index} is out of range; the array has {count} elements");
    let object = process.read_u64(begin + index * 8)?;
    println!("Array at {} has {count} elements; element {index} is {object:#x}.", describe_address(pair, modules));
    dump(process, modules, object, len)
}

fn column(
    process: &Process,
    modules: &[Module],
    pair: u64,
    offset: u64,
    kind: FieldType,
    first: u64,
    find: Option<u64>,
) -> Result<()> {
    let (begin, count) = read_pair(process, pair)?;
    let limit = if find.is_some() { count } else { first.min(count) };
    let pointers = process.read_bytes(begin, (limit * 8) as usize)?;
    println!("Array at {} has {count} elements; field +{offset:#x}:", describe_address(pair, modules));

    let mut matches = 0;
    for (index, chunk) in pointers.as_chunks::<8>().0.iter().enumerate() {
        let object = u64::from_le_bytes(*chunk);
        let Ok(bytes) = process.read_bytes(object + offset, kind.width()) else {
            println!("{index:>8}  {object:#014x}  unreadable");
            continue;
        };
        let value = kind.decode(&bytes);
        if find.is_some_and(|wanted| wanted != value) {
            continue;
        }
        matches += 1;
        println!("{index:>8}  {object:#014x}  {value}");
    }
    if let Some(wanted) = find {
        println!("{matches} element(s) have {wanted} at +{offset:#x}.");
    }
    Ok(())
}

/// Reads the (begin, end) pointer pair stored at `pair`; returns `begin` and the element count.
fn read_pair(process: &Process, pair: u64) -> Result<(u64, u64)> {
    let begin = process.read_u64(pair)?;
    let end = process.read_u64(pair + 8)?;
    ensure!(
        end > begin && (end - begin).is_multiple_of(8),
        "{pair:#x} does not hold a (begin, end) pointer pair ({begin:#x}, {end:#x})"
    );
    Ok((begin, (end - begin) / 8))
}

/// "module+0x..." for module addresses, plain hex otherwise.
fn describe_address(addr: u64, modules: &[Module]) -> String {
    match modules.iter().find(|m| m.contains(addr)) {
        Some(m) => format!("{}+{:#x}", m.name, addr - m.base),
        None => format!("{addr:#x}"),
    }
}

fn pointer_hint(value: u64, modules: &[Module]) -> String {
    if let Some(m) = modules.iter().find(|m| m.contains(value)) {
        format!("-> {}+{:#x}", m.name, value - m.base)
    } else if is_user_pointer(value) && value >= 0x100_0000 {
        "-> heap?".to_owned()
    } else {
        String::new()
    }
}

// ---------------------------------------------------------------------------
// helpers

fn find_module<'a>(modules: &'a [Module], name: &str) -> Option<&'a Module> {
    modules.iter().find(|m| m.name.eq_ignore_ascii_case(name))
}

/// Resolves "0x1234" or "module.dll+0x1234" to an absolute address.
fn resolve(expr: &str, modules: &[Module]) -> Result<u64> {
    match expr.split_once('+') {
        Some((name, offset)) => {
            let module = find_module(modules, name.trim()).with_context(|| format!("module {name} is not loaded"))?;
            Ok(module.base + parse_hex(offset)?)
        }
        None => parse_hex(expr),
    }
}

/// Each encoding turns the bytes at an offset into a number in the units a tool shows, if they fit.
type Encoding = (&'static str, usize, fn(&[u8]) -> f64);

const ENCODINGS: [Encoding; 11] = [
    ("u8", 1, |b| f64::from(b[0])),
    ("i8", 1, |b| f64::from(b[0] as i8)),
    ("i16", 2, |b| f64::from(i16::from_le_bytes([b[0], b[1]]))),
    ("i32", 4, |b| f64::from(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))),
    ("u8 of 255", 1, |b| f64::from(b[0]) * 100.0 / 255.0),
    ("u16/100", 2, |b| f64::from(u16::from_le_bytes([b[0], b[1]])) / 100.0),
    ("u16/10", 2, |b| f64::from(u16::from_le_bytes([b[0], b[1]])) / 10.0),
    ("u16 of 65535", 2, |b| f64::from(u16::from_le_bytes([b[0], b[1]])) * 100.0 / 65535.0),
    ("u32/100", 4, |b| f64::from(u32::from_le_bytes([b[0], b[1], b[2], b[3]])) / 100.0),
    ("f32", 4, |b| f64::from(f32::from_le_bytes([b[0], b[1], b[2], b[3]]))),
    ("f32*100", 4, |b| f64::from(f32::from_le_bytes([b[0], b[1], b[2], b[3]])) * 100.0),
];

/// Whether the 8-byte word holding `offset` (counted from an 8-aligned start) looks like an
/// address: a byte of a pointer matches a value by chance far too often.
fn in_address(bytes: &[u8], offset: usize) -> bool {
    let word = offset / 8 * 8;
    if word + 8 > bytes.len() {
        return false;
    }
    let value = u64::from_le_bytes(bytes[word..word + 8].try_into().expect("8 bytes"));
    // A value in the address range is a pointer only if it points into mapped memory: a contract keeps its happiness
    // in bytes that, read as one word, look like an address.
    (0x1_0000_0000..0x8000_0000_0000).contains(&value)
        && MAPPED.get().is_none_or(|mapped| {
            let after = mapped.partition_point(|&(start, _)| start <= value);
            after > 0 && value < mapped[after - 1].1
        })
}

/// The game's mapped regions, `(start, end)` in order, once a search has noted them (see `in_address`).
static MAPPED: std::sync::OnceLock<Vec<(u64, u64)>> = std::sync::OnceLock::new();

/// Notes the game's mapped regions for `in_address`.
fn note_mapped(process: &Process) {
    let mut mapped: Vec<(u64, u64)> = regions(process, 0x1_0000, 0x7FFF_FFFF_0000)
        .into_iter()
        .filter(|r| r.is_readable())
        .map(|r| (r.base, r.base + r.size))
        .collect();
    mapped.sort_unstable();
    let _ = MAPPED.set(mapped);
}

fn team_average(session: &Session, clubs: &[(u32, f64)], tolerance: f64) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let index = ClubIndex::new(session.clubs()?);
    let p = &session.layout.player;
    let len = (p.end() + p.max_shift()) as usize;
    // Every senior player's object, by club, read as it is now.
    let mut squads = Vec::new();
    for &(uid, _) in clubs {
        let club = index.get(uid).with_context(|| format!("no club with UID {uid}"))?;
        let team = session.club_teams(club, &players)?.into_iter().next().context("the club has no team")?;
        let objects: Vec<Vec<u8>> = team
            .players
            .iter()
            .filter(|member| member.plays_here)
            .filter_map(|member| players.get(member.uid))
            .filter_map(|player| session.process.read_bytes(player.address, len).ok())
            .collect();
        println!("{} ({uid}): {} players", club.name, objects.len());
        squads.push(objects);
    }
    let mut hits = 0;
    for &(name, size, decode) in &ENCODINGS {
        for offset in (0..len - size).step_by(size) {
            let means: Vec<f64> = squads
                .iter()
                .map(|squad| {
                    let values: Vec<f64> = squad.iter().map(|bytes| decode(&bytes[offset..offset + size])).collect();
                    values.iter().sum::<f64>() / values.len().max(1) as f64
                })
                .collect();
            if means.iter().zip(clubs).all(|(&m, &(_, want))| m.is_finite() && (m - want).abs() <= tolerance) {
                let shown: Vec<String> = means.iter().map(|m| format!("{m:.2}")).collect();
                println!("  player +{offset:#x} {name}: {}", shown.join(" "));
                hits += 1;
            }
        }
    }
    println!("{hits} places");
    Ok(())
}

/// The bytes of one entry of the list `cohesion` reads: the `i32` index of a club or a nation, a `u8` kind, the `i8`
/// value, and two bytes FM27 Editor leaves alone.
const COHESION_ENTRY: usize = 8;
/// The kind of entry that names a club; one of kind 2 names a nation.
const COHESION_CLUB: u8 = 1;
/// The longest list `cohesion` reads, as FM27 Editor.
const MOST_COHESION_ENTRIES: u64 = 500;
/// How much of a club object `cohesion` looks through for the index the squad's lists name in common.
const CLUB_SPAN: usize = 0x100;

/// One entry of a player's list of cohesion entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct CohesionEntry {
    index: i32,
    kind: u8,
    value: i8,
}

/// The entries of a list of cohesion entries, from its bytes.
fn cohesion_entries(bytes: &[u8]) -> Vec<CohesionEntry> {
    let (entries, _) = bytes.as_chunks::<COHESION_ENTRY>();
    entries
        .iter()
        .map(|entry| CohesionEntry {
            index: i32::from_le_bytes([entry[0], entry[1], entry[2], entry[3]]),
            kind: entry[4],
            value: i8::from_le_bytes([entry[5]]),
        })
        .collect()
}

/// Whether the words `begin`, `end` and `capacity` look like those of a list of cohesion entries, or of an empty one.
fn is_cohesion_list(begin: u64, end: u64, capacity: u64) -> bool {
    let size = COHESION_ENTRY as u64;
    (begin == 0 && end == 0 && capacity == 0)
        || (is_user_pointer(begin)
            && begin <= end
            && end <= capacity
            && (end - begin).is_multiple_of(size)
            && (capacity - begin).is_multiple_of(size)
            && (end - begin) / size <= MOST_COHESION_ENTRIES)
}

/// What `cohesion` found in a player's record of relations.
enum CohesionList {
    /// He has no record of relations.
    NoRecord,
    /// The record, at this address, holds no list at the place given: its three words there.
    NotAList(u64, [u64; 3]),
    /// The list's entries, and its bytes.
    Entries(Vec<CohesionEntry>, Vec<u8>),
}

fn cohesion_list(session: &Session, player: &fmlibre_core::PlayerSummary, list: u64) -> Result<CohesionList> {
    let (process, p) = (&session.process, &session.layout.player);
    let record = process.read_u64(player.address + p.at(p.relations, player.shift))?;
    if !is_user_pointer(record) {
        return Ok(CohesionList::NoRecord);
    }
    let words = process.read_bytes(record + list, 24)?;
    let word = |i: usize| u64::from_le_bytes(words[i * 8..i * 8 + 8].try_into().expect("8 bytes"));
    let (begin, end, capacity) = (word(0), word(1), word(2));
    if !is_cohesion_list(begin, end, capacity) {
        return Ok(CohesionList::NotAList(record, [begin, end, capacity]));
    }
    let bytes = if end > begin { process.read_bytes(begin, (end - begin) as usize)? } else { Vec::new() };
    Ok(CohesionList::Entries(cohesion_entries(&bytes), bytes))
}

/// Where `cohesion` reads; see the command's options.
struct CohesionPlaces {
    list: u64,
    club_index: u64,
    raw: bool,
}

/// The index of a club in most lists of a squad, and how many lists name it, from how many lists name each index.
fn most_named(named: &BTreeMap<i32, usize>) -> Option<(i32, usize)> {
    named.iter().map(|(&index, &count)| (index, count)).max_by_key(|&(index, count)| (count, std::cmp::Reverse(index)))
}

fn cohesion(session: &Session, clubs: &[u32], places: &CohesionPlaces) -> Result<()> {
    let process = &session.process;
    let players = PlayerIndex::new(session.players()?);
    let index = ClubIndex::new(session.clubs()?);
    println!(
        "Cohesion: the list at +{:#x} of each player's record of relations, the club's index at +{:#x}.",
        places.list, places.club_index
    );
    for &uid in clubs {
        let club = index.get(uid).with_context(|| format!("no club with UID {uid}"))?;
        let club_bytes = process.read_bytes(club.address, CLUB_SPAN)?;
        let at = places.club_index as usize;
        ensure!(at + 4 <= CLUB_SPAN, "--club-index is past the first {CLUB_SPAN:#x} bytes of the club");
        let own = i32::from_le_bytes(club_bytes[at..at + 4].try_into().expect("4 bytes"));
        let team = session.club_teams(club, &players)?.into_iter().next().context("the club has no team")?;
        let squad: Vec<_> = team
            .players
            .iter()
            .filter(|member| member.plays_here)
            .filter_map(|member| players.get(member.uid))
            .collect();
        println!();
        println!("{} ({uid}): index {own} ({own:#x}), {} senior players", club.name, squad.len());
        println!("  {:>10}  {:<28}  cohesion  other entries", "UID", "player");
        let (mut cohesions, mut without) = (Vec::new(), 0);
        // For each index of a club, how many of the squad's lists name it: the club's own should be in almost all.
        let mut named: BTreeMap<i32, usize> = BTreeMap::new();
        let mut not_lists = Vec::new();
        for player in &squad {
            let mut raw = None;
            let (cohesion, others) = match cohesion_list(session, player, places.list)? {
                CohesionList::NoRecord => ("none".to_owned(), "no record of relations".to_owned()),
                CohesionList::NotAList(record, words) => {
                    not_lists.push((player.uid, record, words));
                    ("?".to_owned(), "no list there".to_owned())
                }
                CohesionList::Entries(entries, bytes) => {
                    let mut clubs_named: Vec<i32> =
                        entries.iter().filter(|e| e.kind == COHESION_CLUB).map(|e| e.index).collect();
                    clubs_named.sort_unstable();
                    clubs_named.dedup();
                    for index in clubs_named {
                        *named.entry(index).or_default() += 1;
                    }
                    let own_entry = entries.iter().position(|e| e.kind == COHESION_CLUB && e.index == own);
                    let others: Vec<String> = entries
                        .iter()
                        .enumerate()
                        .filter(|&(i, _)| Some(i) != own_entry)
                        .map(|(_, e)| format!("kind {} #{} = {}", e.kind, e.index, e.value))
                        .collect();
                    raw = Some(bytes);
                    let cohesion = match own_entry.map(|i| entries[i].value) {
                        Some(value) => {
                            cohesions.push(value);
                            value.to_string()
                        }
                        None => {
                            without += 1;
                            "-".to_owned()
                        }
                    };
                    (cohesion, others.join(", "))
                }
            };
            println!("  {:>10}  {:<28}  {cohesion:>8}  {others}", player.uid, clip(&player.name, 28));
            if let Some(bytes) = raw.filter(|bytes| places.raw && !bytes.is_empty()) {
                println!("  {:>42}{}", "", hex(&bytes));
            }
        }
        if cohesions.is_empty() {
            println!("  Cohesion: no list names the club by index {own}.");
        } else {
            let mean = cohesions.iter().map(|&value| f64::from(value)).sum::<f64>() / cohesions.len() as f64;
            let (low, high) = (cohesions.iter().min().expect("one"), cohesions.iter().max().expect("one"));
            println!(
                "  Cohesion with the club: mean {mean:.1}, from {low} to {high}, over {} players; {without} without an \
                 entry for it.",
                cohesions.len()
            );
        }
        // Where most of the squad's lists name another club than the index read, that is likely the club's index.
        if let Some((common, count)) = most_named(&named).filter(|&(common, _)| common != own) {
            let held: Vec<String> = (0..=CLUB_SPAN - 4)
                .step_by(4)
                .filter(|&at| i32::from_le_bytes(club_bytes[at..at + 4].try_into().expect("4 bytes")) == common)
                .map(|at| format!("+{at:#x}"))
                .collect();
            let held = if held.is_empty() {
                format!("the club holds it nowhere in its first {CLUB_SPAN:#x} bytes")
            } else {
                format!("the club holds it at {}", held.join(", "))
            };
            println!("  {count} of the {} lists name a club by index {common} ({common:#x}): {held}.", squad.len());
        }
        if let Some(&(uid, record, [begin, end, capacity])) = not_lists.first() {
            println!(
                "  {} records hold no list at +{:#x}: player {uid}'s holds {begin:#x} {end:#x} {capacity:#x} there. Its \
                 first 0x60 bytes:",
                not_lists.len(),
                places.list
            );
            println!("    {}", hex(&process.read_bytes(record, 0x60)?));
        }
    }
    Ok(())
}

/// `cohesion --set`: sets the cohesion of a club's senior players through the editor's checks, and with --restore puts
/// it back and checks it is as it was.
fn set_cohesion(session: &Session, clubs: &[u32], value: i8, restore: RestoreArgs) -> Result<()> {
    let [uid] = clubs else { bail!("--set takes one club") };
    ensure!(session.layout.cohesion.is_some(), "this layout does not place cohesion");
    let players = PlayerIndex::new(session.players()?);
    let index = ClubIndex::new(session.clubs()?);
    let club = index.get(*uid).with_context(|| format!("no club with UID {uid}"))?;
    let team = session.club_teams(club, &players)?.into_iter().next().context("the club has no team")?;
    let squad: Vec<_> =
        team.players.iter().filter(|member| member.plays_here).filter_map(|m| players.get(m.uid)).collect();
    // Each senior player's cohesion with the club, in the team's order.
    let read =
        || -> Result<Vec<Option<i8>>> { squad.iter().map(|player| Ok(session.cohesion(player, club)?)).collect() };
    let shown = |values: &[Option<i8>]| {
        let set: Vec<f64> = values.iter().flatten().map(|&value| f64::from(value)).collect();
        format!("mean {:.1} over {} players", set.iter().sum::<f64>() / set.len().max(1) as f64, set.len())
    };
    let before = read()?;
    let mut plans = Vec::new();
    for player in &squad {
        plans.extend(session.plan_cohesion(player, club, value)?);
    }
    println!();
    println!(
        "Setting to {value} the cohesion of {} of {}'s senior players; {} without an entry for the club are left alone.",
        plans.len(),
        club.name,
        squad.len() - plans.len()
    );
    let mut done = Vec::new();
    for plan in &plans {
        match session.apply_cohesion(plan) {
            Ok(set) => done.push(set),
            Err(err) => {
                // One player at a time: those written are put back, so that it is all or nothing.
                for set in done.iter().rev() {
                    let _ = session.undo_cohesion(set);
                }
                return Err(err.into());
            }
        }
    }
    let after = read()?;
    ensure!(after.iter().flatten().all(|&now| now == value), "the cohesion is not what was written");
    println!("  set: {}", shown(&after));
    if restore.restore {
        if restore.hold > 0 {
            println!("  putting it back in {} s", restore.hold);
            std::thread::sleep(std::time::Duration::from_secs(restore.hold));
        }
        for set in done.iter().rev() {
            session.undo_cohesion(set)?;
        }
        let restored = read()?;
        ensure!(restored == before, "the cohesion is not as it was");
        println!("  restored: {}", shown(&restored));
    }
    Ok(())
}

/// The addresses whose pointers `nearby` looks for, each with the index of the club or player it
/// stands for: a club's senior team (or the club itself, with `to_club`), or a player's object and
/// the block of his that contracts and other records point at.
fn nearby_targets(
    session: &Session,
    seen: &[(u32, f64)],
    of_players: bool,
    to_club: bool,
) -> Result<std::collections::HashMap<u64, usize>> {
    let process = &session.process;
    let mut targets = std::collections::HashMap::new();
    if of_players {
        let players = PlayerIndex::new(session.players()?);
        for (i, &(uid, _)) in seen.iter().enumerate() {
            let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
            targets.insert(player.address, i);
            targets.insert(player.address + session.layout.player.identity() + player.shift, i);
        }
        return Ok(targets);
    }
    let clubs = ClubIndex::new(session.clubs()?);
    for (i, &(uid, _)) in seen.iter().enumerate() {
        let club = clubs.get(uid).with_context(|| format!("no club with UID {uid}"))?;
        let target = if to_club {
            club.address
        } else {
            process.read_u64(process.read_u64(club.address + session.layout.club.teams)?)?
        };
        targets.insert(target, i);
    }
    Ok(targets)
}

/// How `nearby` looks: see the command's options.
struct NearbyOptions {
    by_uid: bool,
    window: u64,
    tolerance: f64,
    per_kind: usize,
    bare: bool,
}

fn nearby(
    session: &Session,
    clubs: &[(u32, f64)],
    targets: &std::collections::HashMap<u64, usize>,
    options: &NearbyOptions,
) -> Result<()> {
    let &NearbyOptions { by_uid, window, tolerance, per_kind, bare } = options;
    note_mapped(&session.process);
    const CHUNK: u64 = 8 << 20;
    ensure!(clubs.len() >= 2, "give at least two, so that a match means something");
    let window = window / 8 * 8;
    let process = &session.process;

    // Every pointer to a target, by club.
    let started = Instant::now();
    let mut refs: Vec<Vec<u64>> = vec![Vec::new(); clubs.len()];
    for region in regions(process, 0x1_0000, 0x7FFF_FFFF_0000).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                if by_uid {
                    // A UID is a u32 on a 4-byte boundary.
                    for (i, word) in chunk.as_chunks::<4>().0.iter().enumerate() {
                        if let Some(&club) = targets.get(&u64::from(u32::from_le_bytes(*word))) {
                            refs[club].push(base + (i * 4) as u64);
                        }
                    }
                } else {
                    for (i, word) in chunk.as_chunks::<8>().0.iter().enumerate() {
                        if let Some(&club) = targets.get(&u64::from_le_bytes(*word)) {
                            refs[club].push(base + (i * 8) as u64);
                        }
                    }
                }
            }
            offset += CHUNK;
        }
    }
    let counts: Vec<String> = refs.iter().map(|r| r.len().to_string()).collect();
    println!("Pointers found in {:.1} s: {}", started.elapsed().as_secs_f64(), counts.join(", "));

    // Each pointer is told by the record that holds it: the nearest vtable before it (a word that
    // points into game_plugin.dll) and how far before. Records of one kind are compared with each
    // other only, which keeps a value that one of a thousand pointers happens to have from matching.
    let plugin = list_modules(process)?
        .into_iter()
        .find(|m| m.name.eq_ignore_ascii_case(GAME_PLUGIN))
        .with_context(|| format!("{GAME_PLUGIN} is not loaded"))?;
    let in_plugin = |value: u64| (plugin.base..plugin.base + plugin.size).contains(&value);
    type Kind = (u64, u64);
    let mut kinds: Vec<BTreeMap<Kind, Vec<Vec<u8>>>> = vec![BTreeMap::new(); clubs.len()];
    for (club, list) in refs.iter().enumerate() {
        for &at in list {
            let Ok(bytes) = process.read_bytes(at - window, (2 * window) as usize) else {
                continue;
            };
            // The words of the record on their 8-byte boundaries: a UID may sit 4 bytes off one.
            let skew = ((8 - (at - window) % 8) % 8) as usize;
            let words = bytes[skew..].as_chunks::<8>().0;
            let here = (window as usize - skew) / 8;
            let vtable = (0..=here).rev().find(|&i| in_plugin(u64::from_le_bytes(words[i])));
            // Records without a vtable are one kind, compared at the same distance from the pointer.
            let kind = match vtable {
                Some(i) => (u64::from_le_bytes(words[i]) - plugin.base, (window as usize - skew - i * 8) as u64),
                None if bare => (0, 0),
                None => continue,
            };
            kinds[club].entry(kind).or_default().push(bytes);
        }
    }

    let mut hits = 0;
    for (kind, first) in &kinds[0] {
        // A team's own record is one per club: kinds that every club has a few of at most.
        let all: Vec<&Vec<Vec<u8>>> = kinds.iter().filter_map(|k| k.get(kind)).collect();
        if all.len() != clubs.len() || all.iter().any(|records| records.len() > per_kind) || first.is_empty() {
            continue;
        }
        for &(name, size, decode) in &ENCODINGS {
            for offset in (0..(2 * window) as usize - size).step_by(size) {
                let mut seen = Vec::new();
                for (records, &(_, want)) in all.iter().zip(clubs) {
                    let found = records.iter().find_map(|bytes| {
                        if in_address(bytes, offset) {
                            return None;
                        }
                        let v = decode(&bytes[offset..offset + size]);
                        (v.is_finite() && (v - want).abs() <= tolerance).then_some(v)
                    });
                    match found {
                        Some(v) => seen.push(v),
                        None => break,
                    }
                }
                if seen.len() == clubs.len() {
                    // Where the value sits in its record, counted from the record's vtable, or from the
                    // pointer in a record without one.
                    let field = (offset as i64 - window as i64) + kind.1 as i64;
                    let shown: Vec<String> = seen.iter().map(|v| format!("{v:.2}")).collect();
                    if kind.0 == 0 {
                        println!(
                            "  record without a vtable: value at {field:+#x} from the pointer {name}: {}",
                            shown.join(" ")
                        );
                    } else {
                        println!(
                            "  record with vtable game_plugin.dll+{:#x}, pointer at +{:#x}: value at {field:+#x} {name}: {}",
                            kind.0,
                            kind.1,
                            shown.join(" ")
                        );
                    }
                    hits += 1;
                }
            }
        }
    }
    println!("{hits} places");
    Ok(())
}

/// `602=42`: a club UID and a value seen for it.
fn parse_club_value(text: &str) -> Result<(u32, f64)> {
    let (uid, value) = text.split_once('=').context("expected UID=VALUE, e.g. 602=42")?;
    Ok((uid.trim().parse().context("not a club UID")?, value.trim().parse().context("not a number")?))
}

/// Where a value sits: a root (0 the club and 1 its senior team, or 0 the player), then the offsets
/// of the pointers followed from it.
type HopPath = Vec<u64>;

/// Reads the objects reachable from `roots` within `depth` pointer hops, `span` bytes of each,
/// by the path that leads to them. Pointers into the game's modules (vtables, statics) are not
/// followed: the objects that matter live on the heap.
fn reachable(process: &Process, roots: &[u64], depth: usize, span: u64) -> BTreeMap<HopPath, Vec<u8>> {
    let mut found = BTreeMap::new();
    let mut frontier: Vec<(HopPath, u64)> = roots.iter().enumerate().map(|(i, &root)| (vec![i as u64], root)).collect();
    for level in 0..=depth {
        let mut next = Vec::new();
        for (path, address) in frontier {
            let Ok(bytes) = process.read_bytes(address, span as usize) else {
                continue;
            };
            if level < depth {
                for (i, word) in bytes.as_chunks::<8>().0.iter().enumerate() {
                    let target = u64::from_le_bytes(*word);
                    if is_user_pointer(target) && target < 0x7FF0_0000_0000 {
                        let mut child = path.clone();
                        child.push(i as u64 * 8);
                        next.push((child, target));
                    }
                }
            }
            found.insert(path, bytes);
        }
        frontier = next;
    }
    found
}

/// The objects `related` starts from, with the value seen for each: a club and its senior team, or a
/// player. The names are those of the roots, in order.
struct RelatedRoots {
    names: &'static [&'static str],
    roots: Vec<Vec<u64>>,
    seen: Vec<(u32, f64)>,
}

fn related_roots(session: &Session, clubs: &[(u32, f64)], players: &[(u32, f64)]) -> Result<RelatedRoots> {
    let process = &session.process;
    if !players.is_empty() {
        let index = PlayerIndex::new(session.players()?);
        let roots = players
            .iter()
            .map(|&(uid, _)| Ok(vec![index.get(uid).with_context(|| format!("no player with UID {uid}"))?.address]))
            .collect::<Result<_>>()?;
        return Ok(RelatedRoots { names: &["player"], roots, seen: players.to_vec() });
    }
    let index = ClubIndex::new(session.clubs()?);
    let mut roots = Vec::new();
    for &(uid, _) in clubs {
        let club = index.get(uid).with_context(|| format!("no club with UID {uid}"))?;
        let teams = process.read_u64(club.address + session.layout.club.teams)?;
        roots.push(vec![club.address, process.read_u64(teams)?]);
    }
    Ok(RelatedRoots { names: &["club", "team"], roots, seen: clubs.to_vec() })
}

/// The values as stored, for --linear: the scale is what is looked for.
const RAW_ENCODINGS: [Encoding; 6] = [
    ("u8", 1, |b| f64::from(b[0])),
    ("i8", 1, |b| f64::from(b[0] as i8)),
    ("u16", 2, |b| f64::from(u16::from_le_bytes([b[0], b[1]]))),
    ("i16", 2, |b| f64::from(i16::from_le_bytes([b[0], b[1]]))),
    ("i32", 4, |b| f64::from(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))),
    ("f32", 4, |b| f64::from(f32::from_le_bytes([b[0], b[1], b[2], b[3]]))),
];

/// The line `seen = a * stored + b` through the pairs, by least squares, when every pair lies within
/// `tolerance` of it and the stored values are not all the same.
fn line_through(stored: &[f64], seen: &[f64], tolerance: f64) -> Option<(f64, f64)> {
    let n = stored.len() as f64;
    let (mean_x, mean_y) = (stored.iter().sum::<f64>() / n, seen.iter().sum::<f64>() / n);
    let sxx: f64 = stored.iter().map(|x| (x - mean_x).powi(2)).sum();
    if !sxx.is_finite() || sxx == 0.0 {
        return None;
    }
    let a = stored.iter().zip(seen).map(|(x, y)| (x - mean_x) * (y - mean_y)).sum::<f64>() / sxx;
    let b = mean_y - a * mean_x;
    (a != 0.0 && stored.iter().zip(seen).all(|(x, y)| (a * x + b - y).abs() <= tolerance)).then_some((a, b))
}

fn related(
    session: &Session,
    roots: &RelatedRoots,
    depth: usize,
    span: u64,
    tolerance: f64,
    linear: bool,
) -> Result<()> {
    let RelatedRoots { names, roots, seen: clubs } = roots;
    note_mapped(&session.process);
    ensure!(clubs.len() >= 2, "give at least two, so that a match means something");
    ensure!(!linear || clubs.len() >= 4, "give at least four with --linear, as any two values make a line");
    let wants: Vec<f64> = clubs.iter().map(|&(_, want)| want).collect();
    let encodings: &[Encoding] = if linear { &RAW_ENCODINGS } else { &ENCODINGS };
    // The objects of the first ones are read whole and compared; the places that match there are
    // then followed, one by one, in the others, which keeps memory in bounds.
    const COMPARED: usize = 3;
    let process = &session.process;
    let (compared, followed) = clubs.split_at(clubs.len().min(COMPARED));
    let objects: Vec<_> = roots[..compared.len()].iter().map(|r| reachable(process, r, depth, span)).collect();
    let clubs = compared;
    println!(
        "Read {} objects for the first; looking for {}.",
        objects[0].len(),
        clubs.iter().map(|(uid, value)| format!("{uid}={value}")).collect::<Vec<_>>().join(", ")
    );
    let mut hits = 0;
    for (path, first) in &objects[0] {
        let all: Vec<&Vec<u8>> = objects.iter().filter_map(|found| found.get(path)).collect();
        if all.len() != objects.len() {
            continue;
        }
        let len = all.iter().map(|bytes| bytes.len()).min().unwrap_or(0).min(first.len());
        for &(name, size, decode) in encodings {
            for offset in (0..len.saturating_sub(size - 1)).step_by(size) {
                if all.iter().any(|bytes| in_address(bytes, offset)) {
                    continue;
                }
                let mut values: Vec<f64> = all.iter().map(|bytes| decode(&bytes[offset..offset + size])).collect();
                let close = |v: f64, want: f64| v.is_finite() && (linear || (v - want).abs() <= tolerance);
                if !values.iter().zip(clubs).all(|(&v, &(_, want))| close(v, want))
                    || (linear && line_through(&values, &wants[..values.len()], tolerance).is_none())
                {
                    continue;
                }
                // The other clubs: follow the same path in each and read the same bytes.
                let mut agrees = true;
                for (root, &(_, want)) in roots[compared.len()..].iter().zip(followed) {
                    let mut address = Some(root[path[0] as usize]);
                    for &hop in &path[1..] {
                        address = address.and_then(|a| process.read_u64(a + hop).ok());
                    }
                    let value = address
                        .and_then(|a| process.read_bytes(a + offset as u64, size).ok())
                        .map(|bytes| decode(&bytes));
                    match value {
                        Some(v) if close(v, want) => values.push(v),
                        _ => {
                            agrees = false;
                            break;
                        }
                    }
                }
                let line = if linear { line_through(&values, &wants, tolerance) } else { None };
                if agrees && (!linear || line.is_some()) {
                    let steps: Vec<String> = path[1..].iter().map(|o| format!("+{o:#x}")).collect();
                    let root = names[path[0] as usize];
                    let shown: Vec<String> = values.iter().map(|v| format!("{v:.2}")).collect();
                    let scale = line.map(|(a, b)| format!("  (seen = {a:.4} * stored {b:+.2})")).unwrap_or_default();
                    println!("  {root}{} -> +{offset:#x} {name}: {}{scale}", steps.join(" -> "), shown.join(" "));
                    hits += 1;
                }
            }
        }
    }
    println!("{hits} places");
    Ok(())
}

fn parse_hex(text: &str) -> Result<u64> {
    let text = text.trim();
    let digits = text.strip_prefix("0x").or_else(|| text.strip_prefix("0X")).unwrap_or(text);
    u64::from_str_radix(digits, 16).with_context(|| format!("not a hexadecimal number: {text}"))
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let text = serde_json::to_string_pretty(value)?;
    std::fs::write(path, text).with_context(|| format!("writing {}", path.display()))?;
    println!();
    println!("JSON report written to {}", path.display());
    Ok(())
}

#[cfg(test)]
mod format_tests {
    use super::*;

    #[test]
    fn amounts_have_commas_between_thousands() {
        assert_eq!(pounds(0), "0");
        assert_eq!(pounds(999), "999");
        assert_eq!(pounds(1_229), "1,229");
        assert_eq!(pounds(236_234), "236,234");
        assert_eq!(pounds(10_222_480), "10,222,480");
        assert_eq!(pounds(u32::MAX), "4,294,967,295");
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn itanium_class_names_are_read_as_in_cpp() {
        assert_eq!(demangle(b"18RETIREMENT_MANAGER\0").as_deref(), Some("RETIREMENT_MANAGER"));
        assert_eq!(demangle(b"N2db7STADIUME\0").as_deref(), Some("db::STADIUM"));
        assert_eq!(demangle(b"N7sicomps20FRIENDLY_ACTUAL_COMPE\0").as_deref(), Some("sicomps::FRIENDLY_ACTUAL_COMP"));
        // Not a class's name: a pointer's, a template's, one cut short, one too long, text.
        for bytes in [&b"P15GAME_COMP_STATS\0"[..], b"N2db4LISTIiEE\0", b"N2dbE\0", b"5ABC\0", b"2AB3CD\0", b"name\0"] {
            assert_eq!(demangle(bytes), None, "{}", String::from_utf8_lossy(bytes));
        }
    }
}

#[cfg(test)]
mod cohesion_tests {
    use super::*;

    /// Kobbie Mainoo's list of cohesion entries as read on the macOS Steam save (25 July 2026): Manchester United
    /// (index 0x198) at 91 and England (0x8B) at 71.
    const MAINOO: &str = "98010000015b00008b00000002470000";

    fn bytes(hex: &str) -> Vec<u8> {
        (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hexadecimal")).collect()
    }

    #[test]
    fn an_entry_is_an_index_a_kind_and_a_value() {
        assert_eq!(
            cohesion_entries(&bytes(MAINOO)),
            vec![
                CohesionEntry { index: 0x198, kind: COHESION_CLUB, value: 91 },
                CohesionEntry { index: 0x8B, kind: 2, value: 71 },
            ]
        );
        // The value is an `i8`.
        assert_eq!(cohesion_entries(&bytes("0100000001ff0000"))[0].value, -1);
        // Bytes short of a whole entry are left out.
        assert!(cohesion_entries(&bytes("98010000015b00")).is_empty());
    }

    #[test]
    fn a_list_is_whole_entries_within_its_capacity() {
        let begin = 0x6000_0000_1000;
        assert!(is_cohesion_list(0, 0, 0));
        assert!(is_cohesion_list(begin, begin, begin));
        assert!(is_cohesion_list(begin, begin + 16, begin + 32));
        assert!(!is_cohesion_list(begin, begin + 12, begin + 32), "not whole entries");
        assert!(!is_cohesion_list(begin, begin + 40, begin + 32), "past its capacity");
        assert!(!is_cohesion_list(begin + 3, begin + 19, begin + 35), "not a pointer");
        assert!(!is_cohesion_list(begin, begin + 8 * 501, begin + 8 * 501), "longer than any");
    }

    #[test]
    fn the_index_most_lists_name_is_the_clubs() {
        let named = BTreeMap::from([(0x8B, 3), (0x198, 24), (0x1A2, 2)]);
        assert_eq!(most_named(&named), Some((0x198, 24)));
        assert_eq!(most_named(&BTreeMap::from([(7, 2), (5, 2)])), Some((5, 2)));
        assert_eq!(most_named(&BTreeMap::new()), None);
    }
}
