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
            distinct.len(),
            distinct[0],
            distinct[distinct.len() - 1]
        );
        candidates.push(offset);
    }

    // Pointer pairs that hold a short list for some players and nothing for most.
    println!("pointer pairs that hold a list for some players:");
    for offset in (0..len - 15).step_by(8) {
        let mut holding = 0;
        let mut valid = 0;
        for (_, b) in &objects {
            let begin = u64::from_le_bytes(b[offset..offset + 8].try_into().expect("8 bytes"));
            let end = u64::from_le_bytes(b[offset + 8..offset + 16].try_into().expect("8 bytes"));
            if begin == end && (begin == 0 || is_user_pointer(begin)) {
                valid += 1;
            } else if is_user_pointer(begin) && end > begin && (end - begin).is_multiple_of(8) && end - begin <= 8 * 64
            {
                valid += 1;
                holding += 1;
            }
        }
        if valid == total && holding > 0 && holding < total / 2 {
            // The best players among them, with the list's address and length, to look at with `dump`.
            let mut holders: Vec<(u16, String)> = objects
                .iter()
                .filter_map(|(player, b)| {
                    let begin = u64::from_le_bytes(b[offset..offset + 8].try_into().expect("8 bytes"));
                    let end = u64::from_le_bytes(b[offset + 8..offset + 16].try_into().expect("8 bytes"));
                    (end > begin).then(|| {
                        let entry = format!("{} (UID {}, {begin:#x}, {})", player.name, player.uid, (end - begin) / 8);
                        (player.current_ability, entry)
                    })
                })
                .collect();
            holders.sort_by_key(|(ability, _)| std::cmp::Reverse(*ability));
            let best: Vec<String> = holders.into_iter().take(4).map(|(_, entry)| entry).collect();
            println!("  {offset:#6x}: {holding} of {total} players hold a list; {}", best.join("; "));
        }
    }

    // Single pointers that only some players have; the ones `player` has are marked.
    if let Some(uid) = player {
        let mine = objects.iter().find(|(p, _)| p.uid == uid).map(|(_, b)| b);
        println!("pointers only some players have (* = player {uid} has one):");
        for offset in (0..len - 7).step_by(8) {
            let at = |b: &Vec<u8>| u64::from_le_bytes(b[offset..offset + 8].try_into().expect("8 bytes"));
            let set = objects.iter().filter(|(_, b)| is_user_pointer(at(b))).count();
            let null = objects.iter().filter(|(_, b)| at(b) == 0).count();
            if set > 0 && set + null == total && set < total / 4 {
                let marked = mine.is_some_and(|b| is_user_pointer(at(b)));
                let value = mine.map_or(0, at);
                println!(
                    "  {} {offset:#6x}: {set} of {total} players; this player: {value:#x}",
                    if marked { "*" } else { " " }
                );
            }
        }
    }

    if let Some(club) = club {
        println!("players of club {club} at the candidate offsets:");
        for (player, b) in objects.iter().filter(|(player, _)| player.club_uid == Some(club)) {
            let values: Vec<String> =
                candidates.iter().map(|&o| format!("{o:#x}={}", u16::from_le_bytes([b[o], b[o + 1]]))).collect();
            println!("  {:<24} {}", clip(&player.name, 24), values.join(" "));
        }
    }
    Ok(())
}

/// Counts the values of the field at `offset` (in the player, or in his contract) across all
/// players, optionally only those of clubs whose name contains `club`.
fn histogram(
    session: &Session,
    offset: u64,
    kind: FieldType,
    contract: bool,
    club: Option<&str>,
    top: usize,
) -> Result<()> {
    let process = &session.process;
    let p = &session.layout.player;
    let wanted = club.map(fmlibre_core::fold);
    /// What the players holding one value have in common.
    #[derive(Default)]
    struct Tally {
        players: usize,
        ages: u64,
        aged: usize,
        /// Current ability and name of each.
        names: Vec<(u16, String)>,
    }
    let mut seen: std::collections::BTreeMap<u64, Tally> = std::collections::BTreeMap::new();
    for player in session.players()? {
        if let Some(wanted) = &wanted
            && !player.club.as_deref().is_some_and(|name| fmlibre_core::fold(name).contains(wanted.as_str()))
        {
            continue;
        }
        let address = if contract {
            let record = process.read_u64(player.address + p.at(p.contract, player.shift)).unwrap_or(0);
            if !is_user_pointer(record) {
                continue;
            }
            record + offset
        } else {
            player.address + p.at(offset, player.shift)
        };
        let Ok(bytes) = process.read_bytes(address, kind.width()) else { continue };
        let tally = seen.entry(kind.decode(&bytes)).or_default();
        tally.players += 1;
        if let Some(age) = player.age {
            tally.ages += u64::from(age);
            tally.aged += 1;
        }
        tally.names.push((player.current_ability, player.name.clone()));
    }
    let mut rows: Vec<_> = seen.into_iter().collect();
    rows.sort_by(|a, b| b.1.players.cmp(&a.1.players).then(a.0.cmp(&b.0)));
    println!("{:>10}  {:>7}  {:>5}  best by current ability", "value", "players", "age");
    for (value, mut tally) in rows.into_iter().take(top) {
        tally.names.sort_by_key(|(ability, _)| std::cmp::Reverse(*ability));
        let names: Vec<String> = tally.names.into_iter().take(3).map(|(_, name)| name).collect();
        let age = if tally.aged > 0 { format!("{:.1}", tally.ages as f64 / tally.aged as f64) } else { "-".to_owned() };
        println!("{value:>10}  {:>7}  {age:>5}  {}", tally.players, names.join(", "));
    }
    Ok(())
}

/// The two 64-bit values on either side of `at`, to tell arrays and objects apart.
fn neighbours(process: &Process, at: u64) -> String {
    let word = |addr: u64| process.read_u64(addr).map_or_else(|_| "?".to_owned(), |v| format!("{v:#x}"));
    format!("[{} {} | {} {}]", word(at - 16), word(at - 8), word(at + 8), word(at + 16))
}

/// Prints the (begin, end) pointer arrays found inside the object at `addr`, with the
/// players, staff, clubs and contracts among their elements named.
fn lists(session: &Session, modules: &[Module], addr: u64, len: u64) -> Result<()> {
    let process = &session.process;
    let names = object_names(session)?;
    let bytes =
        process.read_bytes(addr, len as usize).with_context(|| format!("reading {len:#x} bytes at {addr:#x}"))?;
    let words: Vec<u64> = bytes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
    println!("{} ({len:#x} bytes)", describe_address(addr, modules));

    for (i, pair) in words.windows(3).enumerate() {
        let (begin, end) = (pair[0], pair[1]);
        if !is_user_pointer(begin) || end <= begin || !(end - begin).is_multiple_of(8) || end - begin > 8 * 5000 {
            continue;
        }
        let count = (end - begin) / 8;
        let Ok(elements) = process.read_bytes(begin, (count * 8) as usize) else {
            continue;
        };
        let named: Vec<&str> = elements
            .as_chunks::<8>()
            .0
            .iter()
            .filter_map(|e| names.get(&u64::from_le_bytes(*e)).map(String::as_str))
            .collect();
        let capacity = pair[2];
        let capacity = if capacity >= end && (capacity - begin).is_multiple_of(8) && capacity - begin <= 8 * 10000 {
            format!(", room for {}", (capacity - begin) / 8)
        } else {
            String::new()
        };
        let sample: Vec<&str> = named.iter().take(4).copied().collect();
        println!(
            "  +{:#05x}  {count:>5} at {begin:#x}{capacity}; {} named{}{}",
            i * 8,
            named.len(),
            if sample.is_empty() { "" } else { ": " },
            sample.join(", ")
        );
    }
    Ok(())
}

/// Names for the addresses of players, staff, their person blocks and contracts, and clubs.
fn object_names(session: &Session) -> Result<std::collections::HashMap<u64, String>> {
    let process = &session.process;
    let (p, s) = (&session.layout.player, &session.layout.staff);
    let mut names = std::collections::HashMap::new();
    for player in session.players()? {
        let block = player.address + p.person_block + player.shift;
        if let Ok(contract) = process.read_u64(player.address + p.at(p.contract, player.shift)) {
            names.insert(contract, format!("contract of {}", player.name));
        }
        names.insert(block, format!("person block of {}", player.name));
        names.insert(player.address, format!("player {}", player.name));
    }
    for member in session.staff()? {
        let block = member.address + s.person_block + member.shift;
        if let Ok(contract) = process.read_u64(member.address + s.at(s.contract, member.shift)) {
            names.insert(contract, format!("contract of staff {}", member.name));
        }
        names.insert(block, format!("person block of staff {}", member.name));
        names.insert(member.address, format!("staff {}", member.name));
    }
    for club in session.clubs()? {
        names.insert(club.address, format!("club {}", club.name));
        let teams = list_entries(process, club.address + session.layout.club.teams, 8);
        for (i, team) in teams.iter().map(|t| u64::from_le_bytes(t[..8].try_into().expect("8 bytes"))).enumerate() {
            let kind = process.read_bytes(team + session.layout.team.kind, 1).map_or(255, |b| b[0]);
            let which = if i == 0 { "senior team".to_owned() } else { format!("team (kind {kind})") };
            names.insert(team, format!("{which} of {}", club.name));
        }
    }
    names.remove(&0);
    Ok(names)
}

// ---------------------------------------------------------------------------
// find

fn find(
    process: &Process,
    modules: &[Module],
    pattern: &str,
    kind: PatternKind,
    module: Option<&str>,
    max: usize,
    near: Option<(Vec<u8>, u64)>,
) -> Result<()> {
    let needles: Vec<(&str, Vec<u8>)> = match kind {
        PatternKind::Text => vec![
            ("utf-8", pattern.as_bytes().to_vec()),
            ("utf-16", pattern.encode_utf16().flat_map(u16::to_le_bytes).collect()),
        ],
        PatternKind::Hex => vec![("bytes", parse_bytes(pattern)?)],
        PatternKind::U16 => vec![("u16", u16::try_from(parse_number(pattern)?)?.to_le_bytes().to_vec())],
        PatternKind::U32 => vec![("u32", u32::try_from(parse_number(pattern)?)?.to_le_bytes().to_vec())],
    };
    ensure!(needles.iter().all(|(_, needle)| !needle.is_empty()), "the pattern is empty");
    let (start, end) = match module {
        Some(name) => {
            let m = find_module(modules, name).with_context(|| format!("module {name} is not loaded"))?;
            (m.base, m.end())
        }
        None => (0x1_0000, 0x7FFF_FFFF_0000),
    };

    const CHUNK: u64 = 8 << 20;
    // With --near, each chunk also reads far enough on for the bytes after a hit at its end.
    let reach = near.as_ref().map_or(0, |(bytes, within)| within + bytes.len() as u64);
    let overlap = needles.iter().map(|(_, needle)| needle.len() as u64).max().unwrap_or(1) - 1 + reach;
    let near = near.map(|(bytes, within)| (memchr::memmem::Finder::new(&bytes).into_owned(), within as usize));
    let finders: Vec<(&str, memchr::memmem::Finder)> =
        needles.iter().map(|(label, needle)| (*label, memchr::memmem::Finder::new(needle))).collect();
    let started = Instant::now();
    let (mut scanned, mut hits) = (0u64, 0usize);

    'regions: for region in regions(process, start, end).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK + overlap);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                for (label, finder) in &finders {
                    for pos in finder.find_iter(&chunk) {
                        // A match that starts in the overlap is reported with the next chunk.
                        if pos as u64 >= CHUNK {
                            continue;
                        }
                        let addr = base + pos as u64;
                        // Where the other bytes are, from the hit; a hit without them is not reported. A hit
                        // in a chunk's first --within bytes is not looked at before itself.
                        let mut context = if *label == "utf-16" { utf16_context(process, addr) } else { String::new() };
                        if let Some((other, within)) = &near {
                            let from = pos.saturating_sub(*within);
                            let to = (pos + *within + other.needle().len()).min(chunk.len());
                            match other.find_iter(&chunk[from..to]).next() {
                                Some(at) => context = format!("near at {:+#x}", (from + at) as i64 - pos as i64),
                                None => continue,
                            }
                        }
                        println!("{addr:#014x}  {label:<6} {:<34} {context}", describe_address(addr, modules));
                        hits += 1;
                        if hits >= max {
                            break 'regions;
                        }
                    }
                }
            }
            scanned += len.min(CHUNK);
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

/// A class's name as MSVC keeps it (`.?AVACTUAL_PLAYER@db@@`), written as in C++ (`db::ACTUAL_PLAYER`).
/// Template names are left as they are.
#[cfg(windows)]
fn demangle(name: &str) -> String {
    let inner = name.trim_start_matches(".?AV").trim_start_matches(".?AU").trim_end_matches("@@");
    if inner.starts_with("?$") {
        return inner.to_owned();
    }
    let mut parts: Vec<&str> = inner.split('@').filter(|part| !part.is_empty()).collect();
    parts.reverse();
    parts.join("::")
}

/// The type descriptors game_plugin.dll holds, by the address of each, with its class name as in C++. A descriptor
/// is a vtable pointer, a spare word and the mangled name (MSVC's `.?AV…@@`).
#[cfg(windows)]
fn type_descriptors(process: &Process, plugin: &Module) -> Vec<(u64, String)> {
    const CHUNK: u64 = 16 << 20;
    const LONGEST: usize = 512;
    let finder = memchr::memmem::Finder::new(b".?A");
    let mut found = Vec::new();
    for region in regions(process, plugin.base, plugin.end()).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK + LONGEST as u64);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                for pos in finder.find_iter(&chunk).filter(|&pos| (pos as u64) < CHUNK && pos % 8 == 0) {
                    let rest = &chunk[pos..chunk.len().min(pos + LONGEST)];
                    let Some(end) = rest.iter().position(|&b| b == 0) else { continue };
                    let Ok(name) = std::str::from_utf8(&rest[..end]) else { continue };
                    if (name.starts_with(".?AV") || name.starts_with(".?AU")) && name.ends_with("@@") {
                        found.push((base + pos as u64 - 0x10, demangle(name)));
                    }
                }
            }
            offset += CHUNK;
        }
    }
    found
}

/// The C++ name of the class whose Itanium mangled name starts `bytes` and a NUL ends: `18RETIREMENT_MANAGER` is
/// `RETIREMENT_MANAGER`, `N2db7STADIUME` is `db::STADIUM`. Templates and local classes give `None`.
#[cfg(target_os = "macos")]
fn demangle(bytes: &[u8]) -> Option<String> {
    let nested = bytes.first() == Some(&b'N');
    let mut rest = if nested { &bytes[1..] } else { bytes };
    let mut parts = Vec::new();
    loop {
        let digits = rest.iter().take_while(|b| b.is_ascii_digit()).count();
        let len: usize = std::str::from_utf8(&rest[..digits]).ok()?.parse().ok()?;
        let name = rest.get(digits..digits + len).filter(|name| name.first().is_some_and(|&b| !b.is_ascii_digit()))?;
        if !name.iter().all(|&b| b.is_ascii_alphanumeric() || b == b'_') {
            return None;
        }
        parts.push(std::str::from_utf8(name).ok()?);
        rest = &rest[digits + len..];
        if !nested || !rest.first().is_some_and(u8::is_ascii_digit) {
            break;
        }
    }
    let rest = if nested && parts.len() > 1 { rest.strip_prefix(b"E")? } else { rest };
    (rest.first() == Some(&0) && nested == (parts.len() > 1)).then(|| parts.join("::"))
}

/// The class names game_plugin's type infos hold, by the address of each name, written as in C++. The Mac build
/// follows the Itanium C++ ABI: a type info is a pointer to the C++ runtime's own vtable, then a pointer to the
/// mangled name, whose top bit an Apple silicon build may set (see `fmlibre_core::rtti`).
#[cfg(target_os = "macos")]
fn type_infos(process: &Process, plugin: &Module) -> Vec<(u64, String)> {
    const CHUNK: u64 = 16 << 20;
    const LONGEST: usize = 512;
    const NON_UNIQUE: u64 = 1 << 63;
    let chunks = |visit: &mut dyn FnMut(u64, &[u8], usize)| {
        for region in regions(process, plugin.base, plugin.end()).into_iter().filter(|r| r.is_readable()) {
            let mut offset = 0;
            while offset < region.size {
                let base = region.base + offset;
                let len = (region.size - offset).min(CHUNK + LONGEST as u64);
                if let Ok(chunk) = process.read_bytes(base, len as usize) {
                    visit(base, &chunk, (region.size - offset).min(CHUNK) as usize);
                }
                offset += CHUNK;
            }
        }
    };
    // What may be a type info: a pointer out of the plugin, into the runtime, then a pointer into the plugin.
    let mut infos: Vec<(u64, u64)> = Vec::new();
    chunks(&mut |base, chunk, limit| {
        let words: Vec<u64> = chunk[..limit].as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
        for (i, pair) in words.windows(2).enumerate() {
            let name = pair[1] & !NON_UNIQUE;
            if is_user_pointer(pair[0]) && !plugin.contains(pair[0]) && plugin.contains(name) {
                infos.push((base + (i * 8) as u64, name));
            }
        }
    });
    // The class names they point at, read where they start whatever comes before: some names follow other bytes with
    // no NUL between (`game_plugin::GAME_UI` on Steam build 26385295).
    let mut wanted: Vec<u64> = infos.iter().map(|&(_, name)| name).collect();
    wanted.sort_unstable();
    wanted.dedup();
    let mut names: std::collections::HashMap<u64, String> = std::collections::HashMap::new();
    chunks(&mut |base, chunk, limit| {
        let first = wanted.partition_point(|&name| name < base);
        for &name in wanted[first..].iter().take_while(|&&name| name < base + limit as u64) {
            if let Some(class) = demangle(&chunk[(name - base) as usize..]) {
                names.insert(name, class);
            }
        }
    });
    infos.into_iter().filter_map(|(info, name)| Some((info, names.get(&name)?.clone()))).collect()
}

fn types(process: &Process, modules: &[Module], text: &str, max: usize) -> Result<()> {
    let plugin = find_module(modules, GAME_PLUGIN).with_context(|| format!("{GAME_PLUGIN} is not loaded"))?;
    #[cfg(windows)]
    let all = type_descriptors(process, plugin);
    #[cfg(target_os = "macos")]
    let all = type_infos(process, plugin);
    let wanted = text.to_lowercase();
    let mut names: Vec<&String> =
        all.iter().map(|(_, name)| name).filter(|name| name.to_lowercase().contains(&wanted)).collect();
    names.sort();
    names.dedup();
    for name in names.iter().take(max) {
        println!("  {name}");
    }
    println!("{} of {} class names hold {text:?}", names.len(), all.len());
    Ok(())
}

/// Every 8-byte word in `[start, end)` that equals one of `values`, by address.
fn words_equal_to(process: &Process, start: u64, end: u64, values: &std::collections::HashSet<u64>) -> Vec<(u64, u64)> {
    const CHUNK: u64 = 8 << 20;
    let mut found = Vec::new();
    for region in regions(process, start, end).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                for (i, word) in chunk.as_chunks::<8>().0.iter().enumerate() {
                    let value = u64::from_le_bytes(*word);
                    if values.contains(&value) {
                        found.push((base + (i * 8) as u64, value));
                    }
                }
            }
            offset += CHUNK;
        }
    }
    found
}

#[allow(clippy::too_many_arguments)]
fn instances(
    process: &Process,
    modules: &[Module],
    class: &str,
    max: usize,
    holds: Option<&[u8]>,
    span: u64,
    fields: bool,
    names: Option<&std::collections::HashMap<u64, String>>,
) -> Result<()> {
    let plugin = find_module(modules, GAME_PLUGIN).with_context(|| format!("{GAME_PLUGIN} is not loaded"))?;
    let vtables = class_vtables(process, plugin, class)?;

    // The objects: words on the heap that are one of the vtables. A vtable pointer inside the module itself is not an
    // object of the game's data.
    let started = Instant::now();
    let mut objects: Vec<u64> = words_equal_to(process, 0x1_0000, 0x7FFF_FFFF_0000, &vtables)
        .into_iter()
        .map(|(at, _)| at)
        .filter(|&at| !(plugin.base..plugin.end()).contains(&at))
        .collect();
    let total = objects.len();
    if let Some(needle) = holds {
        let finder = memchr::memmem::Finder::new(needle);
        objects.retain(|&at| process.read_bytes(at, span as usize).is_ok_and(|bytes| finder.find(&bytes).is_some()));
    }
    println!(
        "{total} object(s) in {:.1} s{}",
        started.elapsed().as_secs_f64(),
        if holds.is_some() { format!(", {} holding the bytes", objects.len()) } else { String::new() }
    );
    if fields {
        use std::collections::HashMap;
        let in_module = |word: u64| modules.iter().any(|m| (m.base..m.end()).contains(&word));
        // At each place: zero, heap pointer, module pointer, other; and the values seen there.
        let places = (span / 8) as usize;
        let mut counts = vec![[0usize; 4]; places];
        let mut values: Vec<HashMap<u64, usize>> = vec![HashMap::new(); places];
        let mut read = 0;
        for &at in &objects {
            let Ok(bytes) = process.read_bytes(at, span as usize) else { continue };
            read += 1;
            for (i, word) in bytes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).enumerate() {
                let kind = if word == 0 {
                    0
                } else if in_module(word) {
                    2
                } else if is_user_pointer(word) {
                    1
                } else {
                    3
                };
                counts[i][kind] += 1;
                *values[i].entry(word).or_default() += 1;
            }
        }
        println!(
            "{read} objects read; at each 8-byte place: zero / heap pointer / module pointer / other, commonest values"
        );
        for i in 0..places {
            let mut top: Vec<_> = values[i].iter().collect();
            top.sort_by_key(|entry| std::cmp::Reverse(*entry.1));
            let top: Vec<String> = top.iter().take(3).map(|(v, n)| format!("{v:#x}x{n}")).collect();
            let [zero, heap, module, other] = counts[i];
            println!("  +{:#05x}  {zero:>6} {heap:>6} {module:>6} {other:>6}   {}", i * 8, top.join(" "));
        }
        return Ok(());
    }
    for &at in objects.iter().take(max) {
        let Ok(bytes) = process.read_bytes(at, span as usize) else { continue };
        let words: Vec<u64> = bytes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect();
        println!("  {at:#014x}  {}", words.iter().map(|w| format!("{w:x}")).collect::<Vec<_>>().join(" "));
        if let Some(names) = names {
            let named: Vec<String> = words
                .iter()
                .enumerate()
                .filter_map(|(i, w)| names.get(w).map(|name| format!("+{:#x} {name}", i * 8)))
                .collect();
            if !named.is_empty() {
                println!("                  {}", named.join("; "));
            }
        }
    }
    Ok(())
}

/// The vtables of the class `class` (as `types` prints it), from the name the compiler keeps for it: only those of
/// whole objects (see `fmlibre_core::rtti`).
fn class_vtables(process: &Process, plugin: &Module, class: &str) -> Result<std::collections::HashSet<u64>> {
    let vtables = fmlibre_core::rtti::vtables(process, plugin, class);
    ensure!(!vtables.is_empty(), "no class named {class} (see `types`)");
    println!(
        "{class} ({}): vtable(s) {}",
        fmlibre_core::rtti::mangled(class),
        vtables.iter().map(|v| format!("{GAME_PLUGIN}+{:#x}", v - plugin.base)).collect::<Vec<_>>().join(", ")
    );
    Ok(vtables.into_iter().collect())
}

/// The entries of the list `(begin, end)` at `at`, `size` bytes each; none when it does not look like a list.
fn list_entries(process: &Process, at: u64, size: usize) -> Vec<Vec<u8>> {
    let (Ok(begin), Ok(end)) = (process.read_u64(at), process.read_u64(at + 8)) else {
        return Vec::new();
    };
    if !is_user_pointer(begin) || end < begin || end - begin > 64 * size as u64 || (end - begin) % size as u64 != 0 {
        return Vec::new();
    }
    process
        .read_bytes(begin, (end - begin) as usize)
        .map(|bytes| bytes.chunks(size).map(<[u8]>::to_vec).collect())
        .unwrap_or_default()
}

/// What `clauses` saw of one kind: how many contracts, the lowest and highest amounts, and who (ability, name, amount).
struct KindSeen {
    contracts: usize,
    low: u32,
    high: u32,
    who: Vec<(u16, String, u32)>,
}

fn clauses(session: &Session, uid: Option<u32>) -> Result<()> {
    let process = &session.process;
    let (pl, c) = (&session.layout.player, &session.layout.contract);
    let players = session.players()?;
    let contract_of = |player: &fmlibre_core::PlayerSummary| {
        process.read_u64(player.address + pl.at(pl.contract, player.shift)).ok().filter(|&p| is_user_pointer(p))
    };
    let clause = |e: &[u8]| {
        (
            u32::from_le_bytes(e[0..4].try_into().expect("4")),
            u16::from_le_bytes([e[4], e[5]]),
            u16::from_le_bytes([e[6], e[7]]),
        )
    };
    if let Some(uid) = uid {
        let index = PlayerIndex::new(players);
        let player = index.get(uid).with_context(|| format!("no player with UID {uid}"))?;
        let contract = contract_of(player).context("he has no contract")?;
        println!("{} (UID {uid}), contract {contract:#x}", player.name);
        for e in list_entries(process, contract + c.clauses, 8) {
            let (amount, condition, kind) = clause(&e);
            println!("  clause kind {kind:>3} ({kind:#04x})  amount {amount:>12}  condition {condition:#06x}");
        }
        for e in list_entries(process, contract + c.competition_bonuses, 32) {
            let words: Vec<String> =
                e.chunks(4).map(|w| format!("{:x}", u32::from_le_bytes(w.try_into().expect("4")))).collect();
            println!("  competition bonus  {}", words.join(" "));
        }
        return Ok(());
    }
    // Every kind: how many contracts, the amounts, and the best players who have one.
    let mut kinds: BTreeMap<u16, KindSeen> = BTreeMap::new();
    let (mut bonuses, mut contracts, mut roomy) = (0, 0, 0);
    let mut release_room: Vec<(u16, String, u32)> = Vec::new();
    for player in &players {
        let Some(contract) = contract_of(player) else { continue };
        let entries = list_entries(process, contract + c.clauses, 8);
        // Room for another: the list's capacity past its end, which a release clause can be added to.
        let (end, capacity) =
            (process.read_u64(contract + c.clauses + 8)?, process.read_u64(contract + c.clauses + 16)?);
        contracts += 1;
        if capacity > end {
            roomy += 1;
            if !entries.iter().any(|e| clause(e).2 == 0) {
                release_room.push((player.current_ability, player.name.clone(), player.uid));
            }
        }
        for e in entries {
            let (amount, _, kind) = clause(&e);
            let seen = kinds.entry(kind).or_insert(KindSeen { contracts: 0, low: u32::MAX, high: 0, who: Vec::new() });
            seen.contracts += 1;
            seen.low = seen.low.min(amount);
            seen.high = seen.high.max(amount);
            seen.who.push((player.current_ability, player.name.clone(), amount));
        }
        bonuses += usize::from(!list_entries(process, contract + c.competition_bonuses, 32).is_empty());
    }
    for (kind, KindSeen { contracts: count, low, high, mut who }) in kinds {
        who.sort_by_key(|&(ability, _, _)| std::cmp::Reverse(ability));
        let best: Vec<String> = who.iter().take(3).map(|(_, name, amount)| format!("{name} {amount}")).collect();
        println!("  kind {kind:>3} ({kind:#04x}): {count:>6} contracts, {low}..{high}; {}", best.join(", "));
    }
    println!("{bonuses} contracts have competition bonuses");
    release_room.sort_by_key(|&(ability, _, _)| std::cmp::Reverse(ability));
    let best: Vec<String> = release_room.iter().take(5).map(|(_, name, uid)| format!("{name} ({uid})")).collect();
    println!(
        "{roomy} of {contracts} contracts have room for another clause; {} of them have no release clause: {}",
        release_room.len(),
        best.join(", ")
    );
    Ok(())
}

/// What `clause_change` does to a player's contract clauses.
enum ClauseAction {
    Set { index: usize, amount: Option<u32>, condition: Option<u16> },
    Remove { index: usize },
    Add { amount: u32 },
}

/// Lists a player's contract clauses, after changing them as `action` says (and putting them back with --restore).
fn clause_change(session: &Session, uid: u32, action: ClauseAction, restore: RestoreArgs) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let show = |label: &str| -> Result<Vec<String>> {
        let details = session.player_details(player)?.context("the player has moved in memory")?;
        let clauses: Vec<String> = details
            .contract
            .map(|contract| contract.clauses)
            .unwrap_or_default()
            .iter()
            .map(|c| {
                let part = |v: Option<String>| v.unwrap_or_else(|| "-".to_owned());
                format!(
                    "{}: {} {}",
                    c.kind,
                    part(c.amount.map(|a| a.to_string())),
                    part(c.condition.map(|c| c.to_string()))
                )
            })
            .collect();
        println!("{} (UID {uid}) {label}: room for {} more; {}", player.name, details.clause_room, clauses.join(", "));
        Ok(clauses)
    };
    let before = show("now")?;
    let plan = match action {
        ClauseAction::Set { index, amount, condition } => {
            session.plan_clause_change(player, index, amount, condition)?
        }
        ClauseAction::Remove { index } => session.plan_clause_removal(player, index)?,
        ClauseAction::Add { amount } => session.plan_release_clause(player, amount)?,
    };
    let done = session.apply_clause(&plan)?;
    show("changed")?;
    if restore.restore {
        if restore.hold > 0 {
            println!("  putting it back in {} s", restore.hold);
            std::thread::sleep(std::time::Duration::from_secs(restore.hold));
        }
        session.undo_clause(&done)?;
        ensure!(show("restored")? == before, "his clauses are not as they were");
        println!("  restored");
    }
    Ok(())
}

/// The record at contract +0x30 of `player`: its count, the address of its first pointer, and the 28-byte entries its
/// pointers lead to (at most 16).
fn concern_record(session: &Session, player: &fmlibre_core::PlayerSummary) -> Option<(u64, u64, Vec<Vec<u8>>)> {
    let process = &session.process;
    let pl = &session.layout.player;
    let contract =
        process.read_u64(player.address + pl.at(pl.contract, player.shift)).ok().filter(|&p| is_user_pointer(p))?;
    let record = process.read_u64(contract + 0x30).ok().filter(|&p| is_user_pointer(p))?;
    let count = process.read_u64(record).ok()?;
    let list = (0..count.min(16))
        .filter_map(|i| process.read_u64(record + 8 + 8 * i).ok())
        .filter_map(|entry| process.read_bytes(entry, 28).ok())
        .collect();
    Some((count, record + 8, list))
}

fn concerns(session: &Session, uid: Option<u32>) -> Result<()> {
    let players = session.players()?;
    let entry = |e: &[u8]| {
        let date = |at: usize| {
            fmlibre_core::FmDate::from_raw(
                u16::from_le_bytes([e[at], e[at + 1]]),
                u16::from_le_bytes([e[at + 2], e[at + 3]]),
            )
            .map_or_else(|| "-".to_owned(), |d| format!("{}-{:02}-{:02}", d.year, d.month, d.day))
        };
        let words: Vec<String> =
            e[8..].chunks(4).map(|w| format!("{:08x}", u32::from_le_bytes(w.try_into().expect("4")))).collect();
        format!("{} .. {}  {}", date(0), date(4), words.join(" "))
    };
    if let Some(uid) = uid {
        let index = PlayerIndex::new(players);
        let player = index.get(uid).with_context(|| format!("no player with UID {uid}"))?;
        match concern_record(session, player) {
            Some((count, entries, list)) => {
                println!("{} (UID {uid}): {count} entries, pointers at {entries:#x}", player.name);
                for e in list {
                    println!("  {}", entry(&e));
                }
            }
            None => println!("{} (UID {uid}): no record", player.name),
        }
        return Ok(());
    }
    let mut counts: BTreeMap<u64, Vec<String>> = BTreeMap::new();
    let mut none = 0;
    for player in &players {
        match concern_record(session, player) {
            Some((count, _, _)) => counts.entry(count).or_default().push(player.name.clone()),
            None => none += 1,
        }
    }
    println!("{none} players without a record");
    for (count, names) in counts {
        println!(
            "  first word {count:>4}: {:>6} players, e.g. {}",
            names.len(),
            names.iter().take(4).cloned().collect::<Vec<_>>().join(", ")
        );
    }
    Ok(())
}

/// The UTF-16 text around a hit, with control characters shown as dots.
fn utf16_context(process: &Process, addr: u64) -> String {
    const AROUND: u64 = 48;
    let Ok(bytes) = process.read_bytes(addr.saturating_sub(AROUND), (2 * AROUND) as usize) else {
        return String::new();
    };
    let units: Vec<u16> = bytes.as_chunks::<2>().0.iter().map(|pair| u16::from_le_bytes(*pair)).collect();
    String::from_utf16_lossy(&units).chars().map(|c| if c.is_control() { '·' } else { c }).collect()
}

/// Parses "c7 80 ea 07" (spaces optional) into bytes.
fn parse_bytes(text: &str) -> Result<Vec<u8>> {
    let digits: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    ensure!(digits.len().is_multiple_of(2), "hex bytes need an even number of digits: {text}");
    (0..digits.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&digits[i..i + 2], 16).with_context(|| format!("not hex bytes: {text}")))
        .collect()
}

/// Parses a decimal number, or hex with a 0x prefix.
fn parse_number(text: &str) -> Result<u64> {
    let text = text.trim();
    match text.strip_prefix("0x").or_else(|| text.strip_prefix("0X")) {
        Some(hex) => u64::from_str_radix(hex, 16).with_context(|| format!("not a hex number: {text}")),
        None => text.parse().with_context(|| format!("not a number: {text}")),
    }
}

fn attach(pid: Option<u32>, elevated: bool, writes: bool) -> Result<Process> {
    let pid = find_game(pid).map_err(|err| match err {
        SessionError::SeveralRunning(_) => anyhow!("{err} with --pid"),
        err => anyhow!(err),
    })?;
    let opened = if writes { Process::open_read_write(pid) } else { Process::open_read(pid) };
    opened.map_err(|err| {
        if err.is_access_denied() && !elevated {
            anyhow!("{err}. Run the probe from an administrator terminal and try again.")
        } else {
            anyhow!(err)
        }
    })
}

fn inspect(process: &Process) -> Result<(GameInfo, Vec<Module>)> {
    let game = GameInfo::inspect(process).context("inspecting the game process")?;
    let modules = list_modules(process).context("listing modules")?;
    Ok((game, modules))
}

// ---------------------------------------------------------------------------
// calibrate / players

fn health(session: &Session) -> Result<()> {
    println!("{GAME_PLUGIN} build: {}", session.fingerprint);
    match &session.profile {
        Some(profile) => println!("Build profile: {}", profile.name),
        None => println!("Build profile: none for this build: the editor does not write to it unless allowed"),
    }
    let started = Instant::now();
    let health = session.recheck();
    println!("Checks ({:.0?}):", started.elapsed());
    print_checks(&health);
    println!("In-game date: {}", date_line(session));
    Ok(())
}

fn print_checks(health: &fmlibre_core::Health) {
    for result in &health.results {
        println!("  {result}");
    }
}

fn calibrate(session: &Session) -> Result<()> {
    println!("{GAME_PLUGIN} build: {}", session.fingerprint);
    match &session.profile {
        Some(profile) => println!("Build profile: {}", profile.name),
        None => println!("Build profile: none for this build"),
    }
    println!("In-game date: {}", date_line(session));
    println!("Retirement manager: {}", retirement_line(session));
    println!("Saves loaded: {}", saves_loaded_line(session));
    print_arrays(session);
    Ok(())
}

fn print_arrays(session: &Session) {
    for line in session.arrays.describe() {
        println!("{line}");
    }
}

/// `profile`: everything looked for as for a build without a profile (the session was connected with
/// [`ArraySource::ScanOnly`]), checked, and written out as a build profile.
fn profile(session: &Session, out: Option<&Path>) -> Result<()> {
    println!("{GAME_PLUGIN} build: {}", session.fingerprint);
    println!("Game: {}", session.game.name());
    println!("Everything is looked for as for a build without a profile.");
    print_arrays(session);
    let arrays = &session.arrays;
    let (Some(players), Some(staff), Some(clubs)) = (&arrays.players, &arrays.staff, &arrays.clubs) else {
        bail!("not every entity array was found, so there is no profile to write");
    };

    let started = Instant::now();
    let health = session.recheck();
    let candidates = fmlibre_core::date_candidates(session);
    let fitting: Vec<_> = candidates.iter().filter(|place| health.evidence.fit(place.date).holds_strictly()).collect();
    println!(
        "In-game date: {} values in the plugin's writable data read as dates, {} of them fit the contracts and the \
         current injuries ({:.0?}):",
        candidates.len(),
        fitting.len(),
        started.elapsed()
    );
    // The values the contracts cannot rule out, the ones that fit among them.
    for place in candidates.iter().filter(|place| health.evidence.fit(place.date).contracts_hold()) {
        let fit = health.evidence.fit(place.date);
        let verdict = if fit.holds_strictly() { "fits" } else { "    " };
        let beside = match place.found {
            Found::BesideArrays => "  (the field beside the arrays)",
            Found::Guessed => "  (about as far from the players' array as other builds keep the date)",
            Found::Profile | Found::Searched => "",
        };
        println!(
            "  {verdict}  {GAME_PLUGIN}+{:#x}  {}  {} of {} contract dates after it, {} of {} injuries fit{beside}",
            place.rva,
            iso_date(Some(place.date)),
            fit.contracts - fit.before,
            fit.contracts,
            fit.within,
            fit.injuries
        );
    }
    println!("  -> {}", date_line(session));
    if fitting.len() > 1 {
        println!(
            "  note: {} places hold the date now. Right after a save is loaded the field beside the arrays is unset, and \
             perhaps others: run `profile` again then to see which place the game keeps the date in for good.",
            fitting.len()
        );
    }

    let started = Instant::now();
    let guesses = fmlibre_core::retirement_guesses(session);
    let guessed: Vec<u64> =
        guesses.iter().copied().filter(|&rva| fmlibre_core::holds_retirement_manager(session, rva)).collect();
    let searched = fmlibre_core::search_retirement_manager(session);
    let hex = |rvas: &[u64]| {
        if rvas.is_empty() {
            "none".to_owned()
        } else {
            rvas.iter().map(|rva| format!("{GAME_PLUGIN}+{rva:#x}")).collect::<Vec<_>>().join(", ")
        }
    };
    println!("Retirement manager ({:.1} s):", started.elapsed().as_secs_f64());
    println!(
        "  as far from the players' array as in other builds: {} of {} guesses hold it",
        guessed.len(),
        guesses.len()
    );
    println!("  pointers to it in the plugin's writable data: {}", hex(&searched));
    let agree = guessed.first().is_none_or(|rva| searched.contains(rva));
    if !agree {
        println!("  note: the guess and the search disagree");
    }
    let retirement = session.retirement_place();
    let planned = session.planned_retirements().ok().flatten().map(|planned| planned.len());
    println!(
        "  -> {}{}",
        retirement_line(session),
        planned.map_or_else(String::new, |count| format!(", {count} planned retirements"))
    );

    let game_ui = match &session.layout.game {
        Some(game) => {
            let started = Instant::now();
            let guesses = fmlibre_core::game_ui_guesses(session);
            let guessed: Vec<u64> =
                guesses.iter().copied().filter(|&rva| fmlibre_core::holds_game_ui(session, rva)).collect();
            let searched = fmlibre_core::search_game_ui(session);
            println!("The game's own object, {} ({:.1} s):", game.class, started.elapsed().as_secs_f64());
            println!(
                "  as far from the players' array as in other builds: {} of {} guesses hold it",
                guessed.len(),
                guesses.len()
            );
            // More than one static may point at it; the profile keeps the one other builds keep.
            println!("  pointers to it in the plugin's writable data: {}", hex(&searched));
            if guessed.first().is_some_and(|rva| !searched.contains(rva)) {
                println!("  note: the guess is not among the pointers the search found");
            }
            println!("  -> {}", saves_loaded_line(session));
            session.game_place()
        }
        None => {
            println!("The game's own object: not read on this system yet, so the profile leaves it out.");
            None
        }
    };

    println!("Checks with what was found:");
    print_checks(&health);

    let edition = session.layout.edition;
    let game = &session.game;
    let mut name = match (&game.package_version, &game.steam_build) {
        (Some(version), _) => format!("FM{edition} {version} (Game Pass)"),
        (None, Some(build)) => format!("FM{edition} Steam build {build}"),
        (None, None) => game.name(),
    };
    if cfg!(target_os = "macos") {
        name += " (macOS)";
    }
    let date = health.date.filter(|place| place.found != Found::BesideArrays);
    let found = BuildProfile {
        name,
        edition,
        storefront: game.storefront,
        package_version: game.package_version.clone(),
        plugin: session.fingerprint,
        player_pointer_bias: None,
        arrays: ArrayRvas { players: players.pair_rva, staff: staff.pair_rva, clubs: clubs.pair_rva },
        current_date: date.map(|place| place.rva),
        retirement_manager: retirement.map(|place| place.rva),
        game_ui: game_ui.map(|place| place.rva),
    };

    let failed = health.failed();
    let checks = if failed.is_empty() {
        format!("all {} checks passed", health.results.len())
    } else {
        let keys: Vec<&str> = failed.iter().map(|check| check.key()).collect();
        format!("checks that did not pass: {}", keys.join(", "))
    };
    let mut notes = ProfileNotes {
        header: vec![
            format!("{}, worked out by fmlibre-probe {} on a save", game.name(), env!("CARGO_PKG_VERSION")),
            format!("of {}: {checks}.", iso_date(health.date.map(|place| place.date))),
        ],
        ..ProfileNotes::default()
    };
    if let Some(place) = date {
        let fit = health.evidence.fit(place.date);
        notes.current_date = vec![
            format!(
                "The in-game date, {} on the save: {} of {} contract dates",
                iso_date(Some(place.date)),
                fit.before,
                fit.contracts
            ),
            format!("before it, and {} of {} current injuries begun by then and not over.", fit.within, fit.injuries),
        ];
    }
    if let Some(place) = retirement {
        let before = players.pair_rva.wrapping_sub(place.rva);
        notes.retirement_manager = vec![
            "The static pointer to the retirement manager (RETIREMENT_MANAGER),".to_owned(),
            format!(
                "{before:#X} before the players pair{}.",
                planned.map_or_else(String::new, |count| format!("; {count} planned retirements on the save"))
            ),
        ];
    }
    if let (Some(place), Some(game)) = (game_ui, &session.layout.game) {
        let before = players.pair_rva.wrapping_sub(place.rva);
        notes.game_ui = vec![
            format!("The static pointer to the game's own object ({}), whose count of saves loaded", game.class),
            format!(
                "tells a load from a save: {before:#X} before the players pair{}.",
                session.loads().map_or_else(String::new, |loads| format!("; {loads} loaded when it was found"))
            ),
        ];
    }
    let text = profile_text(&found, &notes);

    match &session.profile {
        Some(built_in) => {
            let mut differences = Vec::new();
            if built_in.arrays != found.arrays {
                differences.push(format!("arrays {:x?} built in, {:x?} found", built_in.arrays, found.arrays));
            }
            if built_in.current_date != found.current_date {
                differences.push(format!(
                    "current_date {} built in, {} found",
                    hex_or_none(built_in.current_date),
                    hex_or_none(found.current_date)
                ));
            }
            if built_in.retirement_manager != found.retirement_manager {
                differences.push(format!(
                    "retirement_manager {} built in, {} found",
                    hex_or_none(built_in.retirement_manager),
                    hex_or_none(found.retirement_manager)
                ));
            }
            if built_in.game_ui != found.game_ui {
                differences.push(format!(
                    "game_ui {} built in, {} found",
                    hex_or_none(built_in.game_ui),
                    hex_or_none(found.game_ui)
                ));
            }
            if differences.is_empty() {
                println!("Built-in profile \"{}\": the same places.", built_in.name);
            } else {
                println!("Built-in profile \"{}\" differs:", built_in.name);
                for difference in differences {
                    println!("  {difference}");
                }
            }
        }
        None => println!("Built-in profile: none for this build."),
    }
    if found.current_date.is_none() && health.date.is_none() {
        println!("note: no in-game date was found, so the profile leaves it out; see the gameDate check above");
    }
    println!();
    print!("{text}");
    if let Some(path) = out {
        std::fs::write(path, &text).with_context(|| format!("writing {}", path.display()))?;
        println!();
        println!("Written to {}. Add it to BUILDS in crates/fmlibre-core/src/profile.rs.", path.display());
    }
    Ok(())
}

fn hex_or_none(rva: Option<u64>) -> String {
    rva.map_or_else(|| "none".to_owned(), |rva| format!("{rva:#x}"))
}

/// The format of an export to `path`: JSON for a name ending in .json, CSV otherwise, with semicolons if asked.
fn export_format(path: &Path, semicolon: bool) -> ExportFormat {
    if path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("json")) {
        ExportFormat::Json
    } else if semicolon {
        ExportFormat::CsvSemicolon
    } else {
        ExportFormat::Csv
    }
}

/// Writes an export of `what` ("players", "staff", "clubs") to `path` with `write`, and says how it went.
fn export_to(
    session: &Session,
    path: &Path,
    what: &str,
    write: impl FnOnce(&ExportHeader, &mut std::io::BufWriter<std::fs::File>) -> std::io::Result<Exported>,
) -> Result<()> {
    let header = ExportHeader {
        writer: format!("fmlibre-probe {}", env!("CARGO_PKG_VERSION")),
        game: session.game.name(),
        game_date: session.game_date(),
    };
    let started = Instant::now();
    let file = std::fs::File::create(path).with_context(|| format!("creating {}", path.display()))?;
    let mut out = std::io::BufWriter::new(file);
    let exported = write(&header, &mut out)?;
    std::io::Write::flush(&mut out)?;
    println!(
        "Exported {} {what} to {} in {:.1} s{}.",
        exported.count,
        path.display(),
        started.elapsed().as_secs_f64(),
        if exported.skipped > 0 {
            format!("; {} changed while read, left out", exported.skipped)
        } else {
            String::new()
        }
    );
    Ok(())
}

fn players(
    session: &Session,
    text: Option<&str>,
    limit: usize,
    args: &PlayerFilterArgs,
    export: Option<(&Path, ExportFormat)>,
) -> Result<()> {
    let (filter, order) = args.parse()?;
    let started = Instant::now();
    let index = PlayerIndex::new(session.players()?);
    let elapsed = started.elapsed();
    let mut hits = index.search(text.unwrap_or(""));
    hits.retain(|p| filter.matches(p));
    if let Some(order) = order {
        sort_players(&mut hits, order);
    }
    if let Some((path, format)) = export {
        export_to(session, path, "players", |header, out| session.export_players(&hits, format, header, out))?;
    }
    println!(
        "Read {} players in {:.1} s; {} shown of {} matching.",
        index.len(),
        elapsed.as_secs_f64(),
        hits.len().min(limit),
        hits.len()
    );
    println!();
    println!(
        "{:>10}  {:<26}  {:>3}  {:<12}  {:<14}  {:<22}  {:<10}  {:>3}  {:>4}",
        "UID", "Name", "Age", "Positions", "Nation", "Club", "Expires", "CA", "PA"
    );
    for p in hits.iter().take(limit) {
        let positions: Vec<String> = p.positions.iter().map(|key| key.to_uppercase()).collect();
        println!(
            "{:>10}  {:<26}  {:>3}  {:<12}  {:<14}  {:<22}  {:<10}  {:>3}  {:>4}",
            p.uid,
            clip(&p.name, 26),
            p.age.map_or_else(String::new, |age| age.to_string()),
            clip(&positions.join(" "), 12),
            clip(p.nation.as_deref().unwrap_or("-"), 14),
            clip(p.club.as_deref().unwrap_or("-"), 22),
            iso_date(p.contract_expires),
            p.current_ability,
            p.potential_ability
        );
    }
    Ok(())
}

/// Player filters and sorting for `players`.
#[derive(clap::Args)]
struct PlayerFilterArgs {
    /// Only players rated 15 or more at this position (gk, dc, wbl, mc, aml, st, ...).
    #[arg(long)]
    position: Option<String>,
    #[arg(long)]
    min_age: Option<u16>,
    #[arg(long)]
    max_age: Option<u16>,
    #[arg(long)]
    min_ca: Option<u16>,
    #[arg(long)]
    min_pa: Option<i16>,
    /// Part of the nation's name.
    #[arg(long)]
    nation: Option<String>,
    /// Part of the club's name.
    #[arg(long)]
    club: Option<String>,
    /// Only players without a club.
    #[arg(long)]
    free_agents: bool,
    /// Only contracts ending on or before this date (YYYY-MM-DD).
    #[arg(long)]
    expires_by: Option<String>,
    /// Only players on the transfer list.
    #[arg(long)]
    transfer_listed: bool,
    /// Only players on the loan list.
    #[arg(long)]
    loan_listed: bool,
    /// Only women.
    #[arg(long, conflicts_with = "men")]
    women: bool,
    /// Only men.
    #[arg(long)]
    men: bool,
    /// A bound on an attribute as FM shows it (1-20): finishing=15.., pace=15..18 or injury_proneness=..5.
    /// Repeat it for more.
    #[arg(long = "attribute", value_name = "KEY=MIN..MAX")]
    attributes: Vec<String>,
    /// Sort by ca, pa, age, name, nation, club or expires (highest first unless --ascending).
    #[arg(long)]
    sort: Option<String>,
    #[arg(long)]
    ascending: bool,
}

/// A `KEY=MIN..MAX` attribute bound, either end of which may be left out.
fn parse_attribute_bound(text: &str) -> Result<AttributeBound> {
    let (key, range) = text.split_once('=').ok_or_else(|| anyhow!("{text}: expected KEY=MIN..MAX"))?;
    ensure!(
        ATTRIBUTE_GROUPS.iter().any(|(_, keys)| keys.contains(&key)),
        "unknown attribute {key}; see `fields player` for the keys"
    );
    let (min, max) = range.split_once("..").ok_or_else(|| anyhow!("{text}: expected KEY=MIN..MAX"))?;
    let end = |part: &str| -> Result<Option<u8>> {
        if part.is_empty() {
            return Ok(None);
        }
        let value: u8 = part.parse().with_context(|| format!("{text}: {part} is not a number"))?;
        ensure!((1..=20).contains(&value), "{text}: attributes run from 1 to 20");
        Ok(Some(value))
    };
    Ok(AttributeBound { key: key.to_owned(), min: end(min)?, max: end(max)? })
}

impl PlayerFilterArgs {
    fn parse(&self) -> Result<(PlayerFilter, Option<PlayerOrder>)> {
        if let Some(position) = &self.position {
            ensure!(
                POSITIONS.contains(&position.as_str()),
                "unknown position {position}; use one of {}",
                POSITIONS.join(", ")
            );
        }
        let contract_expires_by = self.expires_by.as_deref().map(parse_iso_date).transpose()?;
        let attributes = self.attributes.iter().map(|text| parse_attribute_bound(text)).collect::<Result<_>>()?;
        let filter = PlayerFilter {
            position: self.position.clone(),
            min_age: self.min_age,
            max_age: self.max_age,
            min_current_ability: self.min_ca,
            min_potential_ability: self.min_pa,
            nation: self.nation.clone(),
            club: self.club.clone(),
            club_uid: None,
            free_agents: self.free_agents,
            contract_expires_by,
            transfer_listed: self.transfer_listed,
            loan_listed: self.loan_listed,
            women: (self.women || self.men).then_some(self.women),
            attributes,
        };
        let by = match self.sort.as_deref() {
            None => return Ok((filter, None)),
            Some("ca") => PlayerSort::CurrentAbility,
            Some("pa") => PlayerSort::PotentialAbility,
            Some("age") => PlayerSort::Age,
            Some("name") => PlayerSort::Name,
            Some("nation") => PlayerSort::Nation,
            Some("club") => PlayerSort::Club,
            Some("expires") => PlayerSort::ContractExpires,
            Some(other) => bail!("unknown sort column {other}"),
        };
        Ok((filter, Some(PlayerOrder { by, ascending: self.ascending })))
    }
}

/// Parses "2027-06-30".
fn parse_iso_date(text: &str) -> Result<FmDate> {
    let parts: Vec<&str> = text.split('-').collect();
    ensure!(parts.len() == 3, "dates look like 2027-06-30, not {text}");
    let date = FmDate {
        year: parts[0].parse().with_context(|| format!("bad year in {text}"))?,
        month: parts[1].parse().with_context(|| format!("bad month in {text}"))?,
        day: parts[2].parse().with_context(|| format!("bad day in {text}"))?,
    };
    ensure!((1..=12).contains(&date.month) && (1..=31).contains(&date.day), "not a date: {text}");
    Ok(date)
}

fn player(session: &Session, uid: u32) -> Result<()> {
    let index = PlayerIndex::new(session.players()?);
    let summary = index.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let d = session.player_details(summary)?.context("the player's data changed while reading; try again")?;
    let date = |date: Option<FmDate>| {
        date.map_or_else(|| "-".to_owned(), |d| format!("{:04}-{:02}-{:02}", d.year, d.month, d.day))
    };

    println!("{} (UID {})", d.summary.name, d.summary.uid);
    if let Some(full) = &d.summary.full_name {
        println!("  full name      {full}");
    }
    match d.summary.age {
        Some(age) => println!("  born           {} (age {age})", date(d.summary.date_of_birth)),
        None => println!("  born           {}", date(d.summary.date_of_birth)),
    }
    println!("  nation         {}", d.summary.nation.as_deref().unwrap_or("-"));
    println!("  club           {}", d.summary.club.as_deref().unwrap_or("-"));
    println!("  CA / PA        {} / {}", d.summary.current_ability, d.summary.potential_ability);
    println!("  height         {} cm", d.height_cm);
    println!(
        "  reputation     home {}, current {}, world {}",
        d.reputation.home, d.reputation.current, d.reputation.world
    );
    let i = &d.international;
    println!("  international  {} caps, {} goals; U21 {} caps, {} goals", i.caps, i.goals, i.u21_caps, i.u21_goals);
    println!("  asking price   {}", d.asking_price.map_or_else(|| "not set".to_owned(), |p| format!("£{p}")));
    if summary.shift != 0 {
        println!("  layout         person block shifted by {:#x} (player-coach)", summary.shift);
    }
    let p = &session.layout.player;
    let pointer = |offset: u64| session.process.read_u64(summary.address + p.at(offset, summary.shift)).unwrap_or(0);
    println!(
        "  addresses      object {:#x}, person block {:#x}, team {:#x}, contract {:#x}",
        summary.address,
        summary.address + p.person_block + summary.shift,
        pointer(p.team),
        pointer(p.contract)
    );

    println!();
    for (group, keys) in ATTRIBUTE_GROUPS {
        let values: Vec<String> =
            keys.iter().filter_map(|key| d.attributes.get(*key).map(|a| format!("{key} {}", a.value))).collect();
        println!("  {group:<12} {}", values.join(", "));
    }
    let positions: Vec<String> =
        POSITIONS.iter().map(|key| format!("{} {}", key.to_uppercase(), d.position_ratings[key])).collect();
    println!("  {:<12} {}", "positions", positions.join(", "));
    let personality: Vec<String> = PERSONALITY.iter().map(|key| format!("{key} {}", d.personality[key])).collect();
    println!("  {:<12} {}", "personality", personality.join(", "));

    println!();
    match &d.contract {
        Some(c) => {
            println!("  contract       £{} per week, signed {}, expires {}", c.wage, date(c.signed), date(c.expires));
            println!(
                "                 joined {}, squad status {}, squad number {}",
                date(c.joined),
                c.squad_status,
                c.squad_number.map_or_else(|| "-".to_owned(), |n| n.to_string())
            );
            println!("                 transfer listed {}, loan listed {}", c.transfer_listed, c.loan_listed);
            if let Some(kind) = c.contract_type {
                println!("                 contract type {kind}");
            }
        }
        None => println!("  contract       none"),
    }
    Ok(())
}

fn staff(session: &Session, text: Option<&str>, limit: usize, export: Option<(&Path, ExportFormat)>) -> Result<()> {
    let started = Instant::now();
    let index = StaffIndex::new(session.staff()?);
    let elapsed = started.elapsed();
    let hits = index.search(text.unwrap_or(""));
    if let Some((path, format)) = export {
        export_to(session, path, "staff", |header, out| session.export_staff(&hits, format, header, out))?;
    }
    println!(
        "Read {} staff in {:.1} s; {} shown of {} matching.",
        index.len(),
        elapsed.as_secs_f64(),
        hits.len().min(limit),
        hits.len()
    );
    println!();
    println!("{:>10}  {:<28}  {:>3}  {:<22}  {:<24}  {:>3}  {:>4}", "ID", "Name", "Age", "Job", "Club", "CA", "PA");
    for s in hits.iter().take(limit) {
        let job =
            s.job.map_or_else(String::new, |code| job_name(code).map_or_else(|| format!("job {code}"), str::to_owned));
        let name = if s.is_human { format!("{} (you)", s.name) } else { s.name.clone() };
        println!(
            "{:>10}  {:<28}  {:>3}  {:<22}  {:<24}  {:>3}  {:>4}",
            s.uid,
            clip(&name, 28),
            s.age.map_or_else(String::new, |age| age.to_string()),
            clip(&job, 22),
            clip(s.club.as_deref().unwrap_or("-"), 24),
            s.current_ability,
            s.potential_ability
        );
    }
    Ok(())
}

/// What `staff_places` counts for one job.
#[derive(Default)]
struct JobPlaces {
    people: usize,
    /// By the department lists that hold them, "M", "C", "S" or a mix; "-" for none.
    lists: BTreeMap<String, usize>,
    /// Offsets of the club object that point at them.
    club_offsets: BTreeMap<u64, usize>,
    /// (team kind, offset) of a team that points at them.
    team_offsets: BTreeMap<(u32, u64), usize>,
    /// Neither a list nor the club nor a team holds them.
    nowhere: usize,
    samples: Vec<String>,
}

/// The 8-byte words of the `len` bytes at `addr`, those that point at a member of staff (his object, identity or
/// person block) named with his id, job and club.
fn staff_at(session: &Session, addr: u64, len: u64) -> Result<()> {
    let layout = &session.layout.staff;
    let staff = session.staff()?;
    let mut by_address = std::collections::HashMap::new();
    for member in &staff {
        by_address.insert(member.address, (member, "object"));
        by_address.insert(member.address + layout.identity() + member.shift, (member, "identity"));
    }
    let bytes = session.process.read_bytes(addr, len as usize)?;
    for (i, word) in bytes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).enumerate() {
        let at = addr + i as u64 * 8;
        match by_address.get(&word) {
            Some((member, part)) => {
                let job = member
                    .job
                    .map_or_else(|| "-".to_owned(), |j| job_name(j).map_or(format!("job {j}"), str::to_owned));
                println!(
                    "{at:#x}  {word:#x}  {part:<8}  {} {} ({job}, {})",
                    member.uid,
                    member.name,
                    member.club.as_deref().unwrap_or("-")
                );
            }
            None => println!("{at:#x}  {word:#x}"),
        }
    }
    Ok(())
}

/// Every pointer to the members of staff `ids`, their object or person block, in the game's readable memory, each
/// said what holds it (see `Command::StaffRefs`); counted for each of them, then over all of them.
fn staff_refs(session: &Session, ids: &[u32], back: u64, show: Option<&str>) -> Result<()> {
    use std::collections::{HashMap, HashSet};
    const CHUNK: u64 = 8 << 20;
    const CLUB_BYTES: u64 = 0x400;
    const TEAM_BYTES: u64 = 0x800;
    let (process, layout, plugin) = (&session.process, &session.layout, &session.plugin);
    let s = &layout.staff;
    let started = Instant::now();
    let staff = session.staff()?;
    let (mut objects, mut persons) = (HashSet::new(), HashSet::new());
    for m in &staff {
        objects.insert(m.address);
        persons.insert(m.address + s.identity() + m.shift);
    }
    let mut members = Vec::new();
    let mut targets: HashMap<u64, (usize, &str)> = HashMap::new();
    for &id in ids {
        let m = staff.iter().find(|m| m.uid == id).with_context(|| format!("no member of staff with id {id}"))?;
        targets.insert(m.address, (members.len(), "object"));
        targets.insert(m.address + s.identity() + m.shift, (members.len(), "person"));
        members.push(m);
    }
    let low = targets.keys().copied().min().unwrap_or(0);
    let high = targets.keys().copied().max().unwrap_or(0);

    // The places the editor knows, by where they start: each club's first bytes, its teams', the members' contracts.
    let mut places: Vec<(u64, u64, String, Option<u32>)> = Vec::new();
    for club in session.clubs()? {
        places.push((club.address, club.address + CLUB_BYTES, "club".to_owned(), Some(club.uid)));
        let (Ok(begin), Ok(end)) = (
            process.read_u64(club.address + layout.club.teams),
            process.read_u64(club.address + layout.club.teams + 8),
        ) else {
            continue;
        };
        if !is_user_pointer(begin) || end < begin || end - begin > 0x1000 {
            continue;
        }
        let teams = process.read_bytes(begin, (end - begin) as usize).unwrap_or_default();
        for team in teams.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).filter(|&t| is_user_pointer(t)) {
            let kind = process.read_bytes(team + layout.team.kind, 1).map_or(0, |b| b[0]);
            places.push((team, team + TEAM_BYTES, format!("team kind {kind}"), Some(club.uid)));
        }
    }
    for m in &members {
        if let Ok(contract) = process.read_u64(m.address + s.at(s.contract, m.shift))
            && is_user_pointer(contract)
        {
            places.push((contract, contract + layout.contract.size.unwrap_or(0x28), "his contract".to_owned(), None));
        }
    }
    places.sort_unstable_by_key(|p| p.0);
    #[cfg(windows)]
    let stacks = fmlibre_mem::thread_stacks(process).unwrap_or_default();
    #[cfg(not(windows))]
    let stacks: Vec<std::ops::Range<u64>> = Vec::new();
    let modules = list_modules(process).context("listing modules")?;

    let what_holds = |at: u64, member: &fmlibre_core::StaffSummary| -> String {
        if stacks.iter().any(|stack| stack.contains(&at)) {
            return "a thread's stack".to_owned();
        }
        if let Some(module) = modules.iter().find(|m| m.contains(at)) {
            return format!("{} static +{:#x}", module.name, at - module.base);
        }
        let place = places.partition_point(|p| p.0 <= at);
        if let Some((start, end, what, club)) = place.checked_sub(1).map(|i| &places[i])
            && at < *end
        {
            let whose = match club {
                Some(club) if Some(*club) == member.club_uid => " of his club",
                Some(_) => " of another club",
                None => "",
            };
            return format!("{what}{whose} +{:#x}", at - start);
        }
        let Ok(entry) = process.read_bytes(at, 16) else { return "unreadable".to_owned() };
        if entry[0x0A] == 3 && entry[0x0F] == 0xFF {
            return format!("an entry of someone's relations, relation {}", entry[0x0B]);
        }
        let beside = [at - 8, at + 8].map(|n| process.read_u64(n).unwrap_or(0));
        if beside.iter().any(|w| objects.contains(w)) {
            return "beside other staff objects".to_owned();
        }
        if beside.iter().any(|w| persons.contains(w)) {
            return "beside other staff persons".to_owned();
        }
        if let Ok(before) = process.read_bytes(at - back, back as usize) {
            for (i, word) in before.as_chunks::<8>().0.iter().enumerate().rev() {
                let word = u64::from_le_bytes(*word);
                if !plugin.contains(word) {
                    continue;
                }
                let slot = at - back + i as u64 * 8;
                if let Some(class) = fmlibre_core::rtti::class_of(process, plugin, slot) {
                    return format!("{class} +{:#x}", at - slot);
                }
            }
        }
        "no class found before it".to_owned()
    };

    let mut found: BTreeMap<(usize, String, &str), Vec<u64>> = BTreeMap::new();
    let mut scanned = 0u64;
    for region in regions(process, 0x1_0000, 0x7FFF_FFFF_0000).into_iter().filter(|r| r.is_readable()) {
        let mut offset = 0;
        while offset < region.size {
            let base = region.base + offset;
            let len = (region.size - offset).min(CHUNK);
            if let Ok(chunk) = process.read_bytes(base, len as usize) {
                for (i, word) in chunk.as_chunks::<8>().0.iter().enumerate() {
                    let value = u64::from_le_bytes(*word);
                    if value < low || value > high {
                        continue;
                    }
                    let Some(&(member, part)) = targets.get(&value) else { continue };
                    let at = base + (i * 8) as u64;
                    found.entry((member, what_holds(at, members[member]), part)).or_default().push(at);
                }
            }
            scanned += len;
            offset += CHUNK;
        }
    }

    let job = |m: &fmlibre_core::StaffSummary| {
        m.job.map_or_else(|| "-".to_owned(), |j| job_name(j).map_or(format!("job {j}"), str::to_owned))
    };
    let mut over_all: BTreeMap<(String, &str), (usize, Vec<String>)> = BTreeMap::new();
    for (k, m) in members.iter().enumerate() {
        println!("{} {} ({}, {})", m.name, m.uid, job(m), m.club.as_deref().unwrap_or("-"));
        for ((member, what, part), at) in found.range((k, String::new(), "")..) {
            if *member != k {
                break;
            }
            println!("  {:>4}  {what} ({part})", at.len());
            if show.is_some_and(|text| what.contains(text)) {
                for &at in at {
                    println!("          {at:#014x}  {}", neighbours(process, at));
                }
            }
            let entry = over_all.entry((what.clone(), part)).or_default();
            entry.0 += 1;
            entry.1.push(m.name.split_whitespace().last().unwrap_or_default().to_owned());
        }
    }
    println!();
    println!("Over all {} of them:", members.len());
    for ((what, part), (n, who)) in &over_all {
        println!("  {n:>3}  {what} ({part})  {}", if *n < members.len() { who.join(", ") } else { String::new() });
    }
    println!("Scanned {:.0} MiB in {:.1} s.", scanned as f64 / 1_048_576.0, started.elapsed().as_secs_f64());
    Ok(())
}

/// The classes of the players' and the staff's contracts, counted, with a few people of each.
fn contract_classes(session: &Session) -> Result<()> {
    let (process, layout) = (&session.process, &session.layout);
    let plugin = session.plugin.clone();
    let mut counts: BTreeMap<(&str, String), (usize, Vec<String>)> = BTreeMap::new();
    let mut count = |who: &'static str, contract: u64, name: String| {
        if !is_user_pointer(contract) {
            return;
        }
        let class = fmlibre_core::rtti::class_of(process, &plugin, contract).unwrap_or_else(|| "?".to_owned());
        let entry = counts.entry((who, class)).or_default();
        entry.0 += 1;
        if entry.1.len() < 4 {
            entry.1.push(name);
        }
    };
    let p = &layout.player;
    for player in session.players()? {
        let contract = process.read_u64(player.address + p.at(p.contract, player.shift))?;
        count(
            "players",
            contract,
            format!("{} {} ({})", player.name, player.uid, player.club.as_deref().unwrap_or("-")),
        );
    }
    let s = &layout.staff;
    for member in session.staff()? {
        let contract = process.read_u64(member.address + s.at(s.contract, member.shift))?;
        let job = member.job.map_or_else(String::new, |j| job_name(j).map_or(format!("job {j}"), str::to_owned));
        count("staff", contract, format!("{} {} ({job})", member.name, member.uid));
    }
    for ((who, class), (n, samples)) in &counts {
        println!("{who:<8} {class:<40} {n:>6}  e.g. {}", samples.join("; "));
    }
    Ok(())
}

/// What the 8 bytes at `offset` of every member of staff's contract hold, by job: zero, the contract's team, its senior
/// team, another team of the same club, or something else; with the classes of the contracts.
fn staff_contract_word(session: &Session, offset: u64, only: Option<u8>) -> Result<()> {
    let (process, layout) = (&session.process, &session.layout);
    let c = &layout.contract;
    let plugin = session.plugin.clone();
    let mut classes: BTreeMap<String, usize> = BTreeMap::new();
    let mut by_job: BTreeMap<u8, BTreeMap<&'static str, (usize, Vec<String>)>> = BTreeMap::new();
    for member in session.staff()? {
        let (Some(job), Some(_)) = (member.job, member.club_uid) else { continue };
        if only.is_some_and(|code| code != job) {
            continue;
        }
        let contract = process.read_u64(member.address + layout.staff.at(layout.staff.contract, member.shift))?;
        if !is_user_pointer(contract) {
            continue;
        }
        let class = fmlibre_core::rtti::class_of(process, &plugin, contract).unwrap_or_else(|| "?".to_owned());
        *classes.entry(class).or_default() += 1;
        let (Ok(team), Ok(senior), Ok(word)) = (
            process.read_u64(contract + c.team),
            process.read_u64(contract + c.senior_team),
            process.read_u64(contract + offset),
        ) else {
            continue;
        };
        let kind = if word == 0 {
            "zero"
        } else if word == team {
            "team"
        } else if word == senior {
            "senior team"
        } else if is_user_pointer(word)
            && process.read_u64(word + layout.team.club).ok() == process.read_u64(senior + layout.team.club).ok()
        {
            "another team of the club"
        } else {
            "other"
        };
        let entry = by_job.entry(job).or_default().entry(kind).or_default();
        entry.0 += 1;
        if entry.1.len() < 3 {
            entry.1.push(format!("{} {} {word:#x}", member.name, member.uid));
        }
    }
    let classes: Vec<String> = classes.iter().map(|(class, n)| format!("{class} {n}")).collect();
    println!("contract classes: {}", classes.join(", "));
    for (job, kinds) in &by_job {
        let name = job_name(*job).map_or_else(|| format!("job {job}"), str::to_owned);
        let counts: Vec<String> = kinds.iter().map(|(kind, (n, _))| format!("{kind} {n}")).collect();
        println!("{job:>3} {name:<26} {}", counts.join(", "));
        for (kind, (_, samples)) in kinds {
            if *kind != "zero" {
                println!("      {kind}: {}", samples.join("; "));
            }
        }
    }
    Ok(())
}

/// What one offset of every club holds: null, a member of staff (counted by job, with the clubs that have one of each
/// kind), or another value.
fn club_slot(session: &Session, offset: u64) -> Result<()> {
    let process = &session.process;
    let staff = session.staff()?;
    let layout = &session.layout.staff;
    let mut by_address = std::collections::HashMap::new();
    for member in &staff {
        by_address.insert(member.address, member);
        by_address.insert(member.address + layout.identity() + member.shift, member);
        by_address.insert(member.address + layout.person_block + member.shift, member);
    }
    let clubs = session.clubs()?;
    let (mut null, mut other) = (0usize, Vec::new());
    let mut jobs: BTreeMap<String, (usize, usize, Vec<String>)> = BTreeMap::new();
    for club in &clubs {
        let word = process.read_u64(club.address + offset)?;
        if word == 0 {
            null += 1;
            continue;
        }
        let Some(member) = by_address.get(&word) else {
            other.push(format!("{} {:#x}", club.name, word));
            continue;
        };
        let job = member
            .job
            .map_or_else(|| "no contract".to_owned(), |j| job_name(j).map_or(format!("job {j}"), str::to_owned));
        let entry = jobs.entry(job).or_default();
        entry.0 += 1;
        if member.club_uid != Some(club.uid) {
            entry.1 += 1;
        }
        if entry.2.len() < 4 {
            entry.2.push(format!("{} -> {} ({})", club.name, member.name, member.club.as_deref().unwrap_or("-")));
        }
    }
    println!("+{offset:#x} of {} clubs: null {null}, someone else {}", clubs.len(), other.len());
    for (job, (n, elsewhere, samples)) in &jobs {
        println!("  {job:<26} {n:>5} ({elsewhere} working for another club)  e.g. {}", samples.join("; "));
    }
    for line in other.iter().take(8) {
        println!("  other: {line}");
    }
    Ok(())
}

/// What one offset of every team holds, by the kind of team: null, a member of staff (by job, and where his contract
/// is), or another value; then the clubs whose senior team holds no one there although their departments have staff,
/// best known first.
fn team_slot(session: &Session, offset: u64, only: Option<u8>) -> Result<()> {
    let (process, layout) = (&session.process, &session.layout);
    let staff = session.staff()?;
    let s = &layout.staff;
    let mut by_address = std::collections::HashMap::new();
    for member in &staff {
        by_address.insert(member.address, member);
        by_address.insert(member.address + s.identity() + member.shift, member);
    }
    let list = |at: u64| -> Vec<u64> {
        let (Ok(begin), Ok(end)) = (process.read_u64(at), process.read_u64(at + 8)) else { return Vec::new() };
        if !is_user_pointer(begin) || end < begin || end - begin > 0x10000 {
            return Vec::new();
        }
        let bytes = process.read_bytes(begin, (end - begin) as usize).unwrap_or_default();
        bytes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect()
    };
    /// The people of one job in that place: how many, and by where their contract is, how many and a few of them.
    #[derive(Default)]
    struct Job {
        people: usize,
        ties: BTreeMap<&'static str, (usize, Vec<String>)>,
    }
    #[derive(Default)]
    struct Kind {
        teams: usize,
        null: usize,
        other: Vec<String>,
        jobs: BTreeMap<String, Job>,
    }
    let mut kinds: BTreeMap<u8, Kind> = BTreeMap::new();
    let mut vacant: Vec<(u16, fmlibre_core::ClubSummary)> = Vec::new();
    for club in session.clubs()? {
        let teams: Vec<u64> =
            list(club.address + layout.club.teams).into_iter().filter(|&t| is_user_pointer(t)).collect();
        let senior = teams.first().copied().unwrap_or(0);
        for (i, &team) in teams.iter().enumerate() {
            let kind = process.read_bytes(team + layout.team.kind, 1).map_or(255, |b| b[0]);
            let entry = kinds.entry(kind).or_default();
            entry.teams += 1;
            let word = process.read_u64(team + offset)?;
            if word == 0 {
                entry.null += 1;
                let c = &layout.club;
                let staffed = [c.medical_staff, c.coaching_staff, c.scouting_staff]
                    .iter()
                    .any(|&at| !list(club.address + at).is_empty());
                if i == 0 && staffed {
                    let reputation = process.read_u32(team + layout.team.reputation).map_or(0, |r| r as u16);
                    vacant.push((reputation, club.clone()));
                }
                continue;
            }
            let Some(member) = by_address.get(&word) else {
                if entry.other.len() < 4 {
                    entry.other.push(format!("{} {word:#x}", club.name));
                }
                continue;
            };
            if only.is_some_and(|job| member.job != Some(job)) {
                continue;
            }
            let contract = process.read_u64(member.address + s.at(s.contract, member.shift)).unwrap_or(0);
            let (team_of, senior_of) = if is_user_pointer(contract) {
                (
                    process.read_u64(contract + layout.contract.team).unwrap_or(0),
                    process.read_u64(contract + layout.contract.senior_team).unwrap_or(0),
                )
            } else {
                (0, 0)
            };
            let tie = if contract == 0 {
                "no contract"
            } else if team_of == team {
                "contract with this team"
            } else if senior_of == senior || team_of == senior {
                "contract with the senior team"
            } else if member.club_uid == Some(club.uid) {
                "contract with another team of the club"
            } else {
                "contract elsewhere"
            };
            let job = member
                .job
                .map_or_else(|| "no contract".to_owned(), |j| job_name(j).map_or(format!("job {j}"), str::to_owned));
            let held = entry.jobs.entry(job).or_default();
            held.people += 1;
            let (n, samples) = held.ties.entry(tie).or_default();
            *n += 1;
            if samples.len() < 3 {
                let works = member.club.as_deref().unwrap_or("-");
                samples.push(format!("{} -> {} {} ({works})", club.name, member.name, member.uid));
            }
        }
    }
    println!("+{offset:#x} of every team, by its kind:");
    for (kind, k) in &kinds {
        println!("  kind {kind:>3}: {} teams, null {}, someone else {}", k.teams, k.null, k.other.len());
        for (job, held) in &k.jobs {
            println!("      {job:<26} {:>5}", held.people);
            for (tie, (n, samples)) in &held.ties {
                println!("        {tie:<40} {n:>5}  e.g. {}", samples.join("; "));
            }
        }
        if !k.other.is_empty() {
            println!("      other: {}", k.other.join("; "));
        }
    }
    vacant.sort_by_key(|(reputation, _)| std::cmp::Reverse(*reputation));
    // The clubs of the leagues being played keep their finances; the others are not run day by day.
    let played: Vec<&(u16, fmlibre_core::ClubSummary)> = vacant
        .iter()
        .filter(|(_, club)| session.club_details(club).ok().flatten().is_some_and(|d| d.finances.is_some()))
        .collect();
    println!(
        "Senior teams holding no one there although their club's departments have staff: {}, of clubs whose finances \
         the game keeps {}",
        vacant.len(),
        played.len()
    );
    for (reputation, club) in played.iter().take(40) {
        println!("  {reputation:>5}  {} {}", club.name, club.uid);
    }
    Ok(())
}

fn staff_places(session: &Session, only: Option<u8>) -> Result<()> {
    const CLUB_BYTES: usize = 0x400;
    const TEAM_BYTES: usize = 0x800;
    let (process, layout) = (&session.process, &session.layout);
    let staff = session.staff()?;
    let clubs = ClubIndex::new(session.clubs()?);
    let words =
        |bytes: &[u8]| -> Vec<u64> { bytes.as_chunks::<8>().0.iter().map(|w| u64::from_le_bytes(*w)).collect() };
    let list = |at: u64| -> Vec<u64> {
        let (Ok(begin), Ok(end)) = (process.read_u64(at), process.read_u64(at + 8)) else { return Vec::new() };
        if !is_user_pointer(begin) || end < begin || end - begin > 0x10000 {
            return Vec::new();
        }
        process.read_bytes(begin, (end - begin) as usize).map(|b| words(&b)).unwrap_or_default()
    };
    // Each club read once: its words, its three department lists, and its teams' kinds and words.
    struct Club {
        words: Vec<u64>,
        departments: [Vec<u64>; 3],
        teams: Vec<(u32, Vec<u64>)>,
    }
    let mut read: std::collections::HashMap<u32, Option<Club>> = std::collections::HashMap::new();
    let mut by_job: BTreeMap<u8, JobPlaces> = BTreeMap::new();
    for member in &staff {
        let (Some(job), Some(club_uid)) = (member.job, member.club_uid) else { continue };
        if only.is_some_and(|code| code != job) || member.shift != 0 {
            continue;
        }
        let club = read.entry(club_uid).or_insert_with(|| {
            let summary = clubs.get(club_uid)?;
            let club_words = process.read_bytes(summary.address, CLUB_BYTES).map(|b| words(&b)).ok()?;
            let c = &layout.club;
            let departments = [
                list(summary.address + c.medical_staff),
                list(summary.address + c.coaching_staff),
                list(summary.address + c.scouting_staff),
            ];
            let teams = list(summary.address + c.teams)
                .into_iter()
                .filter(|&t| is_user_pointer(t))
                .filter_map(|t| {
                    let kind = process.read_u32(t + 0x28).ok()?;
                    Some((kind, process.read_bytes(t, TEAM_BYTES).map(|b| words(&b)).ok()?))
                })
                .collect();
            Some(Club { words: club_words, departments, teams })
        });
        let Some(club) = club else { continue };
        let object = member.address;
        let (identity, person) = (object + layout.staff.identity(), object + layout.staff.person_block);
        let held = |w: &u64| *w == object || *w == identity || *w == person;
        let places = by_job.entry(job).or_default();
        places.people += 1;
        let mut in_lists = String::new();
        for (letter, department) in ["M", "C", "S"].iter().zip(&club.departments) {
            if department.contains(&object) {
                in_lists.push_str(letter);
            }
        }
        let mut anywhere = !in_lists.is_empty();
        *places.lists.entry(if in_lists.is_empty() { "-".to_owned() } else { in_lists }).or_default() += 1;
        for (i, w) in club.words.iter().enumerate() {
            if held(w) {
                *places.club_offsets.entry(i as u64 * 8).or_default() += 1;
                anywhere = true;
            }
        }
        for (kind, team) in &club.teams {
            for (i, w) in team.iter().enumerate() {
                if held(w) {
                    *places.team_offsets.entry((*kind, i as u64 * 8)).or_default() += 1;
                    anywhere = true;
                }
            }
        }
        if !anywhere {
            places.nowhere += 1;
        }
        if places.samples.len() < if only.is_some() { 20 } else { 3 } {
            places.samples.push(format!("{} {} ({})", member.name, member.uid, member.club.as_deref().unwrap_or("-")));
        }
    }
    for (job, places) in &by_job {
        let name = job_name(*job).map_or_else(|| format!("job {job}"), str::to_owned);
        let lists: Vec<String> = places.lists.iter().map(|(k, n)| format!("{k} {n}")).collect();
        println!("{job:>3} {name:<26} {:>5}  lists: {}", places.people, lists.join(", "));
        if !places.club_offsets.is_empty() {
            let at: Vec<String> = places.club_offsets.iter().map(|(o, n)| format!("+{o:#x} {n}")).collect();
            println!("      club points at them at {}", at.join(", "));
        }
        if !places.team_offsets.is_empty() {
            let at: Vec<String> =
                places.team_offsets.iter().map(|((kind, o), n)| format!("kind {kind} +{o:#x} {n}")).collect();
            println!("      a team points at them at {}", at.join(", "));
        }
        if places.nowhere > 0 {
            println!("      held by none of them: {}", places.nowhere);
        }
        println!("      e.g. {}", places.samples.join("; "));
    }
    Ok(())
}

fn staff_member(session: &Session, uid: u32) -> Result<()> {
    let index = StaffIndex::new(session.staff()?);
    let member = index.get(uid).with_context(|| format!("no member of staff with id {uid}"))?;
    let d = session.staff_details(member)?.context("the staff member's data changed while reading; try again")?;
    let s = &d.summary;
    println!("{} (id {}){}", s.name, s.uid, if s.is_human { ", the human manager" } else { "" });
    let layout = &session.layout.staff;
    println!(
        "  addresses      object {:#x}, identity {:#x}, person block {:#x}",
        member.address,
        member.address + layout.identity() + member.shift,
        member.address + layout.person_block + member.shift
    );
    if let Some(full) = &s.full_name {
        println!("  full name      {full}");
    }
    let age = s.age.map_or_else(String::new, |age| format!(" (age {age})"));
    println!("  born           {}{age}", iso_date(s.date_of_birth));
    println!("  nation         {}", s.nation.as_deref().unwrap_or("-"));
    println!("  club           {}", s.club.as_deref().unwrap_or("-"));
    println!("  CA / PA        {} / {}", s.current_ability, s.potential_ability);
    println!(
        "  reputation     home {}, current {}, world {}",
        d.reputation.home, d.reputation.current, d.reputation.world
    );
    if member.shift != 0 {
        println!("  layout         person block shifted by {:#x}", member.shift);
    }
    println!();
    for (group, keys) in STAFF_ATTRIBUTE_GROUPS {
        let values: Vec<String> =
            keys.iter().filter_map(|key| d.attributes.get(*key).map(|a| format!("{key} {}", a.value))).collect();
        println!("  {group:<12} {}", values.join(", "));
    }
    let personality: Vec<String> = PERSONALITY.iter().map(|key| format!("{key} {}", d.personality[key])).collect();
    println!("  {:<12} {}", "personality", personality.join(", "));
    println!();
    match &d.contract {
        Some(c) => println!(
            "  contract       {}, £{} per week, signed {}, expires {}, joined {}",
            job_name(c.job).map_or_else(|| format!("job {}", c.job), str::to_owned),
            c.wage,
            iso_date(c.signed),
            iso_date(c.expires),
            iso_date(c.joined)
        ),
        None => println!("  contract       none"),
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// bridge (macOS)

#[cfg(target_os = "macos")]
fn bridge(action: Option<BridgeAction>) -> Result<()> {
    use fmlibre_core::bridge_setup::{self, Places};

    let home = std::env::var_os("HOME").context("HOME is not set")?;
    let places = Places::of(Path::new(&home));
    let status = match action {
        None => bridge_setup::status(&places),
        Some(BridgeAction::Setup { from }) => {
            let from = match from {
                Some(from) => from,
                None => std::env::current_exe()?.parent().context("the probe has no folder")?.to_owned(),
            };
            bridge_setup::set_up(&places, &from)?
        }
        Some(BridgeAction::Remove) => bridge_setup::remove(&places)?,
    };
    let yes_no = |yes: bool| if yes { "yes" } else { "no" };
    let found = |path: &Path| if path.is_file() { "installed" } else { "missing" };
    println!("Bridge library   {} ({})", places.bridge.display(), found(&places.bridge));
    println!("Launcher         {} ({})", places.launcher.display(), found(&places.launcher));
    println!("Steam running    {}", yes_no(status.steam_running));
    if status.accounts.is_empty() {
        println!("Steam accounts   none found in {}", places.steam_users.display());
    }
    for account in &status.accounts {
        let folder = account.config.ancestors().nth(2).and_then(Path::file_name).unwrap_or_default();
        println!(
            "Steam account {}  FM27 loads the bridge: {}; launch options: {}",
            folder.to_string_lossy(),
            yes_no(account.loads_bridge),
            account.launch_options.as_deref().unwrap_or("none")
        );
    }
    println!();
    if status.ready() {
        println!("Ready: start Football Manager 27 from Steam, load a save, then run the probe or the app.");
    } else {
        println!("Not set up. Quit Steam and run `fmlibre-probe bridge setup`, or set FM27's launch options");
        println!("in Steam (Properties > General > Launch Options) to:");
        println!("  {}", status.launch_option);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// graphics

fn graphics(root: Option<PathBuf>, clubs: &[u32]) -> Result<()> {
    let root = match root {
        Some(root) => root,
        None => {
            // FM keeps its user data in the documents folder on Windows, in Application Support on macOS.
            #[cfg(windows)]
            let user_data =
                PathBuf::from(std::env::var_os("USERPROFILE").context("USERPROFILE is not set; pass --root")?)
                    .join("Documents");
            #[cfg(target_os = "macos")]
            let user_data = PathBuf::from(std::env::var_os("HOME").context("HOME is not set; pass --root")?)
                .join("Library/Application Support");
            GraphicsIndex::default_root(&user_data, 27)
        }
    };
    let started = Instant::now();
    let index = GraphicsIndex::scan(&root);
    let c = index.counts();
    println!("Read {} in {:.1} s.", root.display(), started.elapsed().as_secs_f64());
    println!(
        "  club logos {}, faces {}, flags {}, competition logos {}",
        c.club_logos, c.faces, c.flags, c.competition_logos
    );
    for &uid in clubs {
        match index.file(Picture::ClubLogo, uid) {
            Some(file) => println!("  club {uid}: {}", file.display()),
            None => println!("  club {uid}: no logo"),
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// fields / get / set

/// Every player, member of staff or club, as edit targets with their names.
fn targets(session: &Session, entity: Entity) -> Result<Vec<(Target, String)>> {
    Ok(match entity {
        Entity::Player => session.players()?.into_iter().map(|p| (p.target(), p.name)).collect(),
        Entity::Staff => session.staff()?.into_iter().map(|s| (s.target(), s.name)).collect(),
        Entity::Club => session.clubs()?.into_iter().map(|c| (c.target(), c.name)).collect(),
    })
}

fn find_target(session: &Session, entity: Entity, uid: u32) -> Result<(Target, String)> {
    targets(session, entity)?
        .into_iter()
        .find(|(target, _)| target.uid == uid)
        .with_context(|| format!("no {entity} with id {uid}"))
}

/// A stored value as the probe prints it: dates as dates, attributes also as shown.
fn shown(field: &Field, stored: i64) -> String {
    if field.kind == Kind::Date {
        return FmDate::from_number(stored).map_or_else(|| "not set".to_owned(), |date| iso_date(Some(date)));
    }
    match field.scale {
        Scale::Plain => stored.to_string(),
        Scale::Attribute => format!("{stored} ({})", field.scale.shown(stored)),
        Scale::Percent => format!("{stored} ({}%)", field.scale.shown(stored)),
    }
}

fn fields(session: &Session, entity: Entity, stats: bool) -> Result<()> {
    let fields = session.fields(entity);
    if !stats {
        println!("{:<34}  {:<4}  {:<9}  {:>11}  {:>11}", "Field", "Type", "Scale", "Min", "Max");
        for f in &fields {
            let scale = format!("{:?}", f.scale).to_lowercase();
            let kind = format!("{:?}", f.kind).to_lowercase();
            println!("{:<34}  {kind:<4}  {scale:<9}  {:>11}  {:>11}", f.key, shown(f, f.min), shown(f, f.max));
        }
        return Ok(());
    }

    let started = Instant::now();
    let targets = targets(session, entity)?;
    // Lowest and highest value found, how many are implausible, and how many lack the field's record.
    let mut seen: Vec<(i64, i64, usize, usize)> = vec![(i64::MAX, i64::MIN, 0, 0); fields.len()];
    let mut read = 0;
    for (target, _) in &targets {
        let Ok(values) = session.read_fields(target, &fields) else {
            continue;
        };
        read += 1;
        for ((low, high, odd, missing), (field, value)) in seen.iter_mut().zip(fields.iter().zip(values)) {
            match value {
                Some(value) => {
                    *low = (*low).min(value);
                    *high = (*high).max(value);
                    *odd += usize::from(!field.is_plausible(value));
                }
                None => *missing += 1,
            }
        }
    }
    println!("Read {read} of {} {entity} objects in {:.1} s.", targets.len(), started.elapsed().as_secs_f64());
    if entity == Entity::Club {
        match session.finance_class() {
            Some(class) => println!("Full finance record class: {class:#x}"),
            None => println!("Full finance record class: not found; finances are not writable"),
        }
    }
    println!();
    println!("{:<30}  {:>25}  {:>25}  {:>11}  {:>9}", "Field", "Writes", "Found", "Implausible", "No record");
    for (f, (low, high, odd, missing)) in fields.iter().zip(seen) {
        let found = if low > high { "-".to_owned() } else { format!("{}..{}", shown(f, low), shown(f, high)) };
        let writes = format!("{}..{}", shown(f, f.min), shown(f, f.max));
        println!("{:<30}  {writes:>25}  {found:>25}  {odd:>11}  {missing:>9}", f.key);
    }
    Ok(())
}

fn get(session: &Session, entity: Entity, uid: u32, keys: &[String]) -> Result<()> {
    let (target, name) = find_target(session, entity, uid)?;
    let fields: Vec<Field> = if keys.is_empty() {
        session.fields(entity)
    } else {
        keys.iter().map(|key| session.field(entity, key)).collect::<Result<_, _>>()?
    };
    let values = session.read_fields(&target, &fields)?;
    println!("{name} ({entity} {uid})");
    for (field, value) in fields.iter().zip(values) {
        match value {
            Some(value) => {
                let note = if field.is_plausible(value) { "" } else { "  (implausible: not writable)" };
                println!("  {:<34} {}{note}", field.key, shown(field, value));
            }
            None => println!("  {:<34} -  (no record: not writable)", field.key),
        }
    }
    Ok(())
}

fn set(
    session: &Session,
    entity: Entity,
    uid: u32,
    key: &str,
    value: &str,
    as_shown: bool,
    restore_after: Option<u64>,
) -> Result<()> {
    let (target, name) = find_target(session, entity, uid)?;
    let field = session.field(entity, key)?;
    let stored = if field.kind == Kind::Date {
        parse_iso_date(value)?.to_number()
    } else {
        let value: i64 = value.trim().parse().with_context(|| format!("not a number: {value}"))?;
        if as_shown { field.scale.stored(value) } else { value }
    };
    let change = session.write_field(&target, &field, stored)?;
    let read = session.read_field(&target, &field)?;
    println!("{name} ({entity} {uid})");
    println!(
        "  {key}: {} -> {}, reads back {}",
        shown(&field, change.old),
        shown(&field, change.new),
        shown(&field, read)
    );
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  restoring in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        let back = session.revert(&target, &change)?;
        let read = session.read_field(&target, &field)?;
        ensure!(read == change.old, "{key} reads {read} after restoring {}", change.old);
        println!(
            "  restored: {} -> {}, reads back {}",
            shown(&field, back.old),
            shown(&field, back.new),
            shown(&field, read)
        );
    }
    Ok(())
}

fn move_player(
    session: &Session,
    uid: u32,
    club: u32,
    terms: MoveTerms,
    fee: Option<i64>,
    release: Option<u32>,
    restore_after: Option<u64>,
) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let to = clubs.get(club).with_context(|| format!("no club with UID {club}"))?;
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let leaver = release.map(|leaver| players.get(leaver).with_context(|| format!("no player with UID {leaver}")));
    let leaver = leaver.transpose()?;
    let plan = match leaver {
        Some(leaver) => session.plan_club_move_releasing(player, to, terms, leaver, &human)?,
        None => session.plan_club_move(player, to, terms, &human)?,
    };
    // A free agent has no club, and is signed under a contract the editor makes.
    let from_club = match plan.from_club {
        0 => None,
        uid => Some(clubs.get(uid).context("his club is not in the list")?),
    };
    let from = from_club.map_or("no club (a free agent)", |club| club.name.as_str());
    let grown = if plan.grows() > 0 { format!(", {} squad list(s) grown", plan.grows()) } else { String::new() };
    println!("{} (UID {uid}): {from} -> {}, {} writes{grown}", player.name, to.name, plan.writes());
    if let Some(leaver) = leaver {
        println!("  making room: {} (UID {}) is released by {}", leaver.name, leaver.uid, to.name);
    }
    let fee_plan = match from_club {
        Some(from_club) => fee.filter(|&fee| fee > 0).map(|fee| session.plan_fee(to, from_club, fee)).transpose()?,
        None => None,
    };
    if let Some(fee_plan) = fee_plan {
        let money = |money: Option<fmlibre_core::ClubMoney>, name: &str| match money {
            Some(money) => {
                let budget = money
                    .transfer_budget
                    .map_or(String::new(), |b| format!(", transfer budget £{} -> £{}", b.before, b.after));
                println!("  {name}: balance £{} -> £{}{budget}", money.balance.before, money.balance.after);
            }
            None => println!("  {name}: no finances in memory, left alone"),
        };
        println!("  fee £{}", fee_plan.fee);
        money(fee_plan.buyer, &to.name);
        money(fee_plan.seller, from);
    }

    let done = session.apply_club_move(&plan)?;
    if plan.leaves_a_human_club() {
        println!("  out of {} of the human club's selections", done.selections());
    }
    let paid = match (fee_plan, from_club) {
        (Some(fee_plan), Some(from_club)) => match session.pay_fee(&fee_plan, to, from_club) {
            Ok(paid) => paid,
            Err(err) => {
                session.undo_club_move(&done)?;
                return Err(err.into());
            }
        },
        _ => Vec::new(),
    };
    // Read him again as the lists would, from the team he now plays for, with his contract, and the player released
    // to make room.
    let contract_fields = ["contract.wage", "contract.expires", "contract.squad_number", "contract.squad_status"];
    let fields: Vec<_> =
        contract_fields.iter().map(|key| session.field(Entity::Player, key)).collect::<Result<_, _>>()?;
    let clubs_now = |label: &str| -> Result<(Option<u32>, Option<u32>)> {
        let now = session.players()?;
        let find = |uid: u32| now.iter().find(|p| p.uid == uid).context("the player is gone");
        let moved = find(uid)?;
        let values = session.read_fields(&moved.target(), &fields)?;
        let contract: Vec<String> = contract_fields
            .iter()
            .zip(values)
            .map(|(key, value)| format!("{key} {}", value.map_or("-".to_owned(), |v| v.to_string())))
            .collect();
        println!("  {label} {}; {}", moved.club.as_deref().unwrap_or("no club"), contract.join(", "));
        let released = match leaver {
            Some(leaver) => {
                let released = find(leaver.uid)?;
                println!("  {}: {}", released.name, released.club.as_deref().unwrap_or("no club"));
                released.club_uid
            }
            None => None,
        };
        Ok((moved.club_uid, released))
    };
    let (moved, released) = clubs_now("now at")?;
    ensure!(moved == Some(club), "the player does not read as being at {}", to.name);
    ensure!(released.is_none(), "the player released still reads as being at a club");
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  moving him back in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.refund_fee(&paid)?;
        session.undo_club_move(&done)?;
        let (moved, released) = clubs_now("moved back to")?;
        ensure!(moved == from_club.map(|club| club.uid), "the player is not back at {from}");
        ensure!(leaver.is_none() || released == Some(club), "the player released is not back at {}", to.name);
        if !paid.is_empty() {
            println!("  fee taken back");
        }
    }
    Ok(())
}

/// Makes the loan of the player `uid` permanent, shows where he is and what his contract says before and after, and
/// with `restore_after` puts it all back and checks it.
fn make_permanent(session: &Session, uid: u32, terms: MoveTerms, restore_after: Option<u64>) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let human: Vec<u32> = session.staff()?.iter().filter(|s| s.is_human).filter_map(|s| s.club_uid).collect();
    let contract_fields = ["contract.wage", "contract.expires", "contract.squad_number", "contract.squad_status"];
    let show = |label: &str| -> Result<()> {
        let now = session.players()?;
        let player = now.iter().find(|p| p.uid == uid).context("the player is gone")?;
        let loan = session.loan(player)?;
        let target = player.target();
        let fields: Vec<_> =
            contract_fields.iter().map(|key| session.field(Entity::Player, key)).collect::<Result<_, _>>()?;
        let values = session.read_fields(&target, &fields)?;
        let values: Vec<String> = contract_fields
            .iter()
            .zip(values)
            .map(|(key, value)| format!("{key} {}", value.map_or("-".to_owned(), |v| v.to_string())))
            .collect();
        let loan = loan.map_or("not on loan".to_owned(), |loan| {
            format!("on loan from {} to {}", loan.parent.unwrap_or_default(), loan.club.unwrap_or_default())
        });
        println!("  {label}: plays for {}, {loan}; {}", player.club.as_deref().unwrap_or("-"), values.join(", "));
        Ok(())
    };
    show("before")?;
    let plan = session.plan_loan_permanent(player, terms, &human)?;
    println!("{} (UID {uid}): club {} -> club {}, {} writes", player.name, plan.from_club, plan.to_club, plan.writes());
    let done = session.apply_club_move(&plan)?;
    show("after")?;
    if let Some(hold) = restore_after {
        if hold > 0 {
            println!("  putting it back in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_club_move(&done)?;
        show("restored")?;
    }
    Ok(())
}

/// `stadium-name`: one club's stadium name and the names it can take, renamed with `name`; or, without a club, how
/// many stadiums' names the editor reads, how many the stadium alone holds (renamed in place when the new name keeps
/// the size of the block) and how many are shared (renamed by pointing the stadium at a new string).
fn stadium_name(session: &Session, club: Option<u32>, name: Option<&str>, restore: Option<u64>) -> Result<()> {
    let clubs = ClubIndex::new(session.clubs()?);
    let Some(uid) = club else {
        let (mut sizes, mut shared, mut renamable, mut unread) = (BTreeMap::<usize, usize>::new(), Vec::new(), 0, 0);
        for club in clubs.iter() {
            match session.stadium_name(club) {
                Ok(found) => {
                    renamable += usize::from(found.renamable);
                    if found.holders == 1 {
                        *sizes.entry(found.name.len().div_ceil(16)).or_default() += 1;
                    } else {
                        shared.push(format!("{} ({}, {} holders)", found.name, club.name, found.holders));
                    }
                }
                Err(_) => unread += 1,
            }
        }
        println!(
            "Stadium names read: {}; the editor can rename {renamable}",
            sizes.values().sum::<usize>() + shared.len()
        );
        println!("Held by the stadium alone, by their length:");
        for (sixteenths, count) in &sizes {
            println!("  {:>3} to {:>3} bytes  {count:>6}", sixteenths * 16 - 15, sixteenths * 16);
        }
        println!(
            "Shared, renamed by pointing the stadium at a new name: {}{}",
            shared.len(),
            if shared.is_empty() { "" } else { ", e.g." }
        );
        for example in shared.iter().take(8) {
            println!("  {example}");
        }
        println!("No stadium the editor can read: {unread} clubs");
        return Ok(());
    };
    let club = clubs.get(uid).with_context(|| format!("no club with UID {uid}"))?;
    let show = |label: &str| -> Result<()> {
        let found = session.stadium_name(club)?;
        println!(
            "{label}: {:?} ({} bytes; {} holder(s); a new name may take {} to {} bytes)",
            found.name,
            found.name.len(),
            found.holders,
            found.min_bytes,
            found.max_bytes
        );
        Ok(())
    };
    println!("{} (club {}):", club.name, club.uid);
    show("stadium")?;
    let Some(name) = name else {
        return Ok(());
    };
    let plan = session.plan_stadium_rename(club, name)?;
    let done = session.apply_stadium_rename(&plan)?;
    show(if done.in_place { "renamed in place" } else { "renamed, in a string of the editor's own" })?;
    if let Some(hold) = restore {
        if hold > 0 {
            println!("  putting it back in {hold} s");
            std::thread::sleep(std::time::Duration::from_secs(hold));
        }
        session.undo_stadium_rename(&done)?;
        show("restored")?;
    }
    Ok(())
}

/// Lists the prize money the competitions matching `text` (or the settings at `settings`) pay, and changes `amounts` in
/// each settings of the one competition they name.
fn prizes(
    session: &Session,
    text: Option<&str>,
    settings: Option<u64>,
    amounts: &[(PrizeAmount, u32)],
    all: bool,
    restore: Option<u64>,
) -> Result<()> {
    let started = Instant::now();
    let found = session.prize_money()?;
    let count = |stage: PrizeStage| found.iter().filter(|prize| prize.stage == stage).count();
    println!(
        "{} league settings: {} of a stage being played or played, {} of one not started yet, {} held by no stage; {} \
         pay something (read in {:.1} s)",
        found.len(),
        count(PrizeStage::Started),
        count(PrizeStage::Future),
        count(PrizeStage::Unheld),
        found.iter().filter(|prize| prize.pays()).count(),
        started.elapsed().as_secs_f64()
    );
    let uid = text.and_then(|text| text.trim().parse::<u32>().ok());
    let words: Vec<String> =
        text.map(fmlibre_core::fold).unwrap_or_default().split_whitespace().map(str::to_owned).collect();
    let wanted = |prize: &PrizeMoney| match (settings, &prize.competition) {
        (Some(address), _) => prize.settings == address,
        (None, Some(competition)) => match uid {
            Some(uid) => competition.uid == uid,
            None => {
                let short = competition.short_name.as_deref().unwrap_or_default();
                let names = fmlibre_core::fold(&format!("{} {short}", competition.name));
                words.iter().all(|word| names.contains(word.as_str()))
            }
        },
        (None, None) => text.is_none(),
    };
    let held = |prize: &PrizeMoney| prize.stage != PrizeStage::Unheld;
    let rank = |stage: PrizeStage| match stage {
        PrizeStage::Started => 0,
        PrizeStage::Future => 1,
        PrizeStage::Unheld => 2,
    };
    let mut shown: Vec<&PrizeMoney> =
        found.iter().filter(|prize| wanted(prize) && (all || (prize.pays() && held(prize)))).collect();
    shown.sort_by_cached_key(|prize| {
        (prize.competition.as_ref().map(|c| fmlibre_core::fold(&c.name)), rank(prize.stage), prize.settings)
    });
    // A competition's groups often pay alike: one entry for them all.
    let mut groups: Vec<(&PrizeMoney, Vec<u64>)> = Vec::new();
    for prize in shown {
        let alike = |other: &PrizeMoney| {
            other.competition == prize.competition
                && other.stage == prize.stage
                && other.by_position == prize.by_position
                && (other.win, other.win_again, other.draw, other.loss)
                    == (prize.win, prize.win_again, prize.draw, prize.loss)
        };
        match groups.iter_mut().find(|(first, _)| alike(first)) {
            Some((_, addresses)) => addresses.push(prize.settings),
            None => groups.push((prize, vec![prize.settings])),
        }
    }
    for (prize, addresses) in &groups {
        print_prize_money(prize, addresses);
    }
    if groups.is_empty() {
        let hint = if all { "" } else { " (--all also lists those that pay nothing, or that no stage holds)" };
        println!("No settings match{hint}");
    }
    if amounts.is_empty() {
        return Ok(());
    }

    ensure!(text.is_some() || settings.is_some(), "name the competition to change, or its settings (--settings)");
    let targets: Vec<&PrizeMoney> = found.iter().filter(|prize| wanted(prize) && held(prize)).collect();
    ensure!(!targets.is_empty(), "no settings that a stage holds match, so nothing was changed");
    let mut names: Vec<String> = targets
        .iter()
        .map(|prize| {
            prize
                .competition
                .as_ref()
                .map_or_else(|| "no competition".to_owned(), |c| format!("{} (UID {})", c.name, c.uid))
        })
        .collect();
    names.sort();
    names.dedup();
    ensure!(
        names.len() == 1,
        "{} competitions match ({}): name one by its UID, or its settings with --settings",
        names.len(),
        names.join("; ")
    );
    let plan = session.plan_prize_change(&targets, amounts)?;
    let done = session.apply_prize_change(&plan)?;
    println!();
    println!("Changed in the running game, {}:", names[0]);
    for edit in &done.edits {
        println!("  settings {:#x}, {}: {} -> {}", edit.settings, edit.amount, pounds(edit.from), pounds(edit.to));
    }
    match restore {
        Some(hold) => {
            if hold > 0 {
                println!("  putting them back in {hold} s");
                std::thread::sleep(std::time::Duration::from_secs(hold));
            }
            session.undo_prize_change(&done)?;
            println!("Put back, and read back.");
        }
        None => {
            let mut by_settings: BTreeMap<u64, Vec<String>> = BTreeMap::new();
            for edit in &done.edits {
                let arg = match edit.amount {
                    PrizeAmount::Place(place) => format!("--place {place} {}", edit.from),
                    PrizeAmount::Win => format!("--win {}", edit.from),
                    PrizeAmount::Draw => format!("--draw {}", edit.from),
                    PrizeAmount::Loss => format!("--loss {}", edit.from),
                };
                by_settings.entry(edit.settings).or_default().push(arg);
            }
            println!("To put it back while the game still holds these settings:");
            for (address, args) in by_settings {
                println!("  fmlibre-probe prizes --settings {address:#x} {}", args.join(" "));
            }
        }
    }
    Ok(())
}

/// One entry of `prizes`: the competition, the stage, the settings that pay alike and what they pay.
fn print_prize_money(prize: &PrizeMoney, addresses: &[u64]) {
    let competition = match &prize.competition {
        Some(c) => {
            let short = c.short_name.as_deref().filter(|short| *short != c.name).map(|short| format!(", {short}"));
            format!("{} (UID {}{})", c.name, c.uid, short.unwrap_or_default())
        }
        None => "No competition".to_owned(),
    };
    let stage = match prize.stage {
        PrizeStage::Started => "a stage being played or played",
        PrizeStage::Future => "a stage not started yet",
        PrizeStage::Unheld => "held by no stage",
    };
    let at: Vec<String> = addresses.iter().map(|address| format!("{address:#x}")).collect();
    let settings = match at.as_slice() {
        [one] => format!("settings {one}"),
        _ => format!("{} settings alike: {}", at.len(), at.join(" ")),
    };
    println!("{competition} · {stage} · {settings}");
    if !prize.by_position.is_empty() {
        println!("  by position, {} places:", prize.by_position.len());
        for (row, amounts) in prize.by_position.chunks(6).enumerate() {
            let cells: Vec<String> = amounts
                .iter()
                .enumerate()
                .map(|(i, &amount)| format!("{:>3}. {:>11}", row * 6 + i + 1, pounds(amount)))
                .collect();
            println!("   {}", cells.join("  "));
        }
    }
    let win = match prize.win_again == prize.win {
        true => pounds(prize.win),
        false => format!("{} and {}", pounds(prize.win), pounds(prize.win_again)),
    };
    println!("  per match: win {win}, draw {}, loss {}", pounds(prize.draw), pounds(prize.loss));
}

/// An amount with commas between thousands: 10,222,480.
fn pounds(amount: u32) -> String {
    let digits = amount.to_string();
    let mut text = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, digit) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            text.push(',');
        }
        text.push(digit);
    }
    text
}

fn plan_move(session: &Session, uid: u32, club: u32, release: Option<u32>) -> Result<()> {
    let players = PlayerIndex::new(session.players()?);
    let clubs = ClubIndex::new(session.clubs()?);
    let player = players.get(uid).with_context(|| format!("no player with UID {uid}"))?;
    let to = clubs.get(club).with_context(|| format!("no club with UID {club}"))?;
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
