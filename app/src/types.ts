// Shapes returned by the Rust commands in src-tauri/src/lib.rs.

export type Storefront = "gamePass" | "steam" | "epic" | "unknown";

export interface GameInfo {
  pid: number;
  exePath: string;
  storefront: Storefront;
  edition: number | null;
  packageFullName: string | null;
  /** Package version of a Game Pass install, e.g. "0.9.2355.0". */
  packageVersion: string | null;
  /** Steam's build id of a Steam install, e.g. "26227640". */
  steamBuild: string | null;
}

/**
 * How a Rust command fails: a code such as "edit.outOfRange", the values its message names, and the message in
 * English. `describeError` (format.ts) words it in the language of the window.
 */
export interface Failure {
  code: string;
  params: Record<string, string>;
  message: string;
}

export interface DetectedGame {
  pid: number;
  info: GameInfo | null;
  pluginLoaded: boolean;
  error: Failure | null;
}

export interface Detection {
  elevated: boolean;
  games: DetectedGame[];
  /** macOS: whether the game loads the bridge, without which the app cannot reach it; null elsewhere. */
  bridge: BridgeInfo | null;
}

/** How far the bridge is set up on macOS: the library FM27 loads so that the app can reach its memory. */
export interface BridgeInfo {
  /** Whether starting the game from Steam loads the bridge. */
  ready: boolean;
  installed: boolean;
  /** The launch option that loads the bridge, to set in Steam by hand. */
  launchOption: string;
  steamRunning: boolean;
  /** FM27's launch options in each Steam account on this Mac. */
  accounts: { id: string; launchOptions: string | null; loadsBridge: boolean }[];
}

export interface ArrayRef {
  pairRva: number;
  count: number;
  /** Share of the sampled elements that decoded as the expected entity: by a name, or in the profile's place by their other fields. */
  confidence: number;
  /** Share of the sampled elements with a name that reads as one. */
  named: number;
  /** Whether the build profile gave the place; otherwise a scan found it. */
  fromProfile: boolean;
}

export interface EntityArrays {
  players: ArrayRef | null;
  staff: ArrayRef | null;
  clubs: ArrayRef | null;
  fromProfile: boolean;
}

export interface ConnectionInfo {
  game: GameInfo;
  profile: string | null;
  arrays: EntityArrays;
  players: number;
  staff: number;
  clubs: number;
  /** Current in-game date, when it could be read. */
  gameDate: FmDate | null;
  loadMs: number;
  /**
   * Whether edits can be written: the system let the app open the game for writing (`writable`), and the game is a
   * build the editor knows or editing it was allowed (`allow_editing`).
   */
  editable: boolean;
  /** Whether the system let the app open the game for writing; without it nothing can be edited. */
  writable: boolean;
  /** Whether the editor has a profile for this build of the game: one it was checked with. */
  knownBuild: boolean;
  /** Whether the game's layout tells women from men, players and staff alike: the lists offer that filter only then. */
  genderKnown: boolean;
  /** What the checks the editor makes before it writes found on this game. */
  health: Health;
  /** Only from `connect`: what it froze again of what was frozen in this save before, when there was any. */
  refrozen?: Refrozen;
}

export interface ReloadInfo {
  players: number;
  staff: number;
  clubs: number;
  gameDate: FmDate | null;
  /** The checks, run again with the game as it is now. */
  health: Health;
  /**
   * Only when the game has loaded another save since: what was frozen in that one before and is frozen again, when
   * there was any. What was frozen in the save before is not held in this one.
   */
  refrozen?: Refrozen;
}

/**
 * How an export writes the players, staff or clubs (`ExportFormat` in export.rs): CSV with commas or with semicolons (what
 * Excel takes where decimals are written with a comma), or JSON.
 */
export type ExportFormat = "csv" | "csvSemicolon" | "json";

/** What can be exported: the player, staff and club lists. */
export type ExportEntity = Entity;

/** What an export wrote, and where: the file, its name and its folder. */
export interface ExportReport {
  path: string;
  file: string;
  folder: string;
  /** The players, staff or clubs written. */
  count: number;
  /** Players, staff or clubs whose objects changed while they were read: left out. */
  skipped: number;
}

/**
 * What connecting froze again of what the app remembers as frozen in this save: the players' attributes, their energy
 * and match sharpness (`fitness`), the attributes of staff, and the clubs' money, by name, the stadiums given the names
 * the editor gave them again, by those names, and how many it left for later, still remembered (FMLibreEditor cannot
 * write to this version of the game yet, or a check did not pass).
 */
export interface Refrozen {
  players: string[];
  staff: string[];
  clubs: string[];
  fitness: string[];
  positions: string[];
  stadiums: string[];
  waiting: number;
}

/** What freezing a player holds: his attributes, his energy and match sharpness ("fitness"), or his position ratings. */
export type FreezeKind = "attributes" | "fitness" | "positions";

/** From `freeze_team`: what freezing or unfreezing a team came to. */
export interface TeamFreeze {
  /** How many of its players were frozen, or unfrozen, now: not those that already were. */
  changed: number;
  /** Its players who could not be frozen, and why (`field` is the `FreezeKind`). */
  failed: { uid: number; name: string; field: string; error: Failure }[];
}

/**
 * What a check the editor makes before it writes looks at (`Check` in health.rs). One that does not pass leaves
 * what it covers read-only; without the in-game date, no ages are shown.
 */
export type CheckKey =
  | "gameDate"
  | "players"
  | "abilities"
  | "positions"
  | "attributes"
  | "personality"
  | "liveValues"
  | "contracts"
  | "teams"
  | "staff"
  | "clubs"
  | "cohesion";

/** What one check found: how many of the players, staff or clubs it looked at fit. */
export interface CheckResult {
  check: CheckKey;
  passed: boolean;
  fit: number;
  sampled: number;
}

/** What the checks found on the running game, every check in a fixed order. */
export interface Health {
  results: CheckResult[];
}

export interface ClubSummary {
  uid: number;
  /** Full name, e.g. "Tottenham Hotspur". */
  name: string;
  shortName: string | null;
  /** A women's club. */
  women: boolean;
  /** 0–10000. */
  reputation: number | null;
  founded: number | null;
}

export interface ClubPage {
  total: number;
  rows: ClubSummary[];
}

export interface Finances {
  /** Pounds. */
  balance: number;
  /** Pounds. */
  transferBudget: number;
  /** Pounds per week. */
  wageBudget: number;
  /** Pounds per week. */
  totalWageBudget: number;
  /** Average match ticket, pounds. */
  ticketPrice: number;
}

export interface ClubDetails extends ClubSummary {
  seasonTickets: number | null;
  socialMedia: number | null;
  /** hardcore, core, family, fair_weather, corporate, casual → percent; empty when unknown. */
  supporterMix: Record<string, number>;
  /** loyalty, passion, patience, affluence, temperament, expectations → 1–20; empty when unknown. */
  supporterTraits: Record<string, number>;
  /** training, youth_facilities, youth_coaching, youth_recruitment and (with finances) corporate → 1–20. */
  facilities: Record<string, number>;
  /** Only clubs in the leagues being played have finances. */
  finances: Finances | null;
  /** The stadium the senior team plays at; null when it could not be read. */
  stadium: Stadium | null;
}

/** A stadium's name and capacities, as stored. */
export interface Stadium {
  name: string | null;
  capacity: number;
  seating: number;
  /** The capacity in use when the game limits it; 0 when it does not. */
  used: number;
  /** The most it can be expanded to. */
  expansion: number;
}

/**
 * A stadium's name as `stadium_name` reads it, with the names it can take: `minBytes` to `maxBytes` bytes of UTF-8.
 * Any name up to 80 bytes, written over the old one when it fits its block or given a string of its own; where the
 * editor could not take memory in the game, only one that keeps the size of the old one's block, and only for a name
 * the stadium alone holds (`holders` 1).
 */
export interface StadiumName {
  name: string;
  holders: number;
  renamable: boolean;
  minBytes: number;
  maxBytes: number;
}

/** A manager, coach, scout, director or other non-playing person. */
export interface StaffSummary {
  uid: number;
  name: string;
  fullName: string | null;
  dateOfBirth: FmDate | null;
  age: number | null;
  nation: string | null;
  /** The nation's UID, for its flag (see pictures.ts). */
  nationUid: number | null;
  /** The employer. */
  club: string | null;
  /** The employer's UID, for its logo (see pictures.ts). */
  clubUid: number | null;
  /** FM job code from the contract; see `jobLabel` in labels.ts. */
  job: number | null;
  currentAbility: number;
  potentialAbility: number;
  /** The manager the user controls in this save. */
  isHuman: boolean;
}

export interface StaffPage {
  total: number;
  rows: StaffSummary[];
}

export interface StaffContract {
  /** Pounds per week. */
  wage: number;
  signed: FmDate | null;
  expires: FmDate | null;
  joined: FmDate | null;
  job: number;
}

export interface StaffDetails extends StaffSummary {
  reputation: Reputation;
  /** Same keys as a player's personality. */
  personality: Record<string, number>;
  /**
   * attacking, defending, fitness, goalkeeping, possession, set_pieces, tactical, technical,
   * working_with_youngsters, authority, determination, motivating, people_management,
   * data_analysis, judging_ability, judging_potential, judging_staff, negotiating,
   * tactical_knowledge, physiotherapy, sports_science → raw and shown value (1–20).
   */
  attributes: Record<string, Attribute>;
  contract: StaffContract | null;
}

export interface FmDate {
  year: number;
  month: number;
  day: number;
}

export interface PlayerSummary {
  uid: number;
  name: string;
  fullName: string | null;
  dateOfBirth: FmDate | null;
  /** Age on the in-game date. */
  age: number | null;
  nation: string | null;
  /** The nation's UID, for its flag (see pictures.ts). */
  nationUid: number | null;
  club: string | null;
  /** The club's UID, for its logo (see pictures.ts). */
  clubUid: number | null;
  /** Position keys rated 15 or more, best first. */
  positions: string[];
  contractExpires: FmDate | null;
  currentAbility: number;
  potentialAbility: number;
}

export interface PlayerPage {
  total: number;
  rows: PlayerSummary[];
}

/** A nation the nation field of a player or member of staff can be set to. */
export interface Nation {
  /** Where the game keeps it: the value of a nation field. */
  address: number;
  uid: number | null;
  name: string;
}

/** A bound on one attribute as FM shows it (1–20); either end may be left open. */
export interface AttributeBound {
  /** An attribute key of the list's entity: "finishing" for players, "tactical" for staff. */
  key: string;
  min?: number;
  max?: number;
}

/** The filters `search_players` and `search_staff` both take; omitted fields match everyone. */
export interface PersonFilter {
  /** true: women only; false: men only. Whom the game's layout cannot tell apart matches neither. */
  women?: boolean;
  minAge?: number;
  maxAge?: number;
  minCurrentAbility?: number;
  minPotentialAbility?: number;
  /** Part of the nation's name; accents and case ignored. */
  nation?: string;
  /** Part of the club's name (the employer's, for staff); accents and case ignored. */
  club?: string;
  /** Only contracts ending on or before this date. */
  contractExpiresBy?: FmDate;
  /** Bounds on attributes, every one of which must hold. */
  attributes?: AttributeBound[];
}

/** Filters for `search_players`; omitted fields match everyone. */
export interface PlayerFilter extends PersonFilter {
  /** A position key (gk, sw, dl, dc, dr, dm, ml, mc, mr, aml, amc, amr, st, wbl, wbr); rated 15+ there. */
  position?: string;
  /** Only players of the club with this UID, e.g. those a player can swap with. */
  clubUid?: number;
  /** Only players without a club. */
  freeAgents?: boolean;
  /** Only players their club has put on the transfer list, and on the loan list. */
  transferListed?: boolean;
  loanListed?: boolean;
}

export type PlayerSort =
  | "currentAbility"
  | "potentialAbility"
  | "age"
  | "name"
  | "nation"
  | "club"
  | "contractExpires";

/** Sort order for `search_players`; without one, results are by current ability, highest first. */
export interface PlayerOrder {
  by: PlayerSort;
  ascending: boolean;
}

/** Filters for `search_staff`; omitted fields match everyone. */
export interface StaffFilter extends PersonFilter {
  /** Job code (see `jobLabel`); its player-coach variant matches too. */
  job?: number;
  /** Only staff without a contract. */
  unemployed?: boolean;
}

export type StaffSort = "currentAbility" | "potentialAbility" | "age" | "name" | "nation" | "club";

/** Sort order for `search_staff`; without one, the human manager comes first, then the highest current ability. */
export interface StaffOrder {
  by: StaffSort;
  ascending: boolean;
}

/** Filters for `search_clubs`. */
export interface ClubFilter {
  /** true: women's clubs only; false: men's clubs only. */
  women?: boolean;
}

/** An attribute as stored (`raw`, 0–100) and as FM shows it (`value`, 1–20). */
export interface Attribute {
  raw: number;
  value: number;
}

export interface Reputation {
  home: number;
  current: number;
  world: number;
}

export interface International {
  caps: number;
  goals: number;
  u21Caps: number;
  u21Goals: number;
}

export interface Contract {
  /** Pounds per week. */
  wage: number;
  signed: FmDate | null;
  expires: FmDate | null;
  joined: FmDate | null;
  squadStatus: number;
  /**
   * The kind of contract (0 part-time, 1 full-time, 2 amateur, 3 youth, 4 non-contract, 10 and 11 the MLS's); null where
   * the game's layout does not know where it is.
   */
  contractType: number | null;
  squadNumber: number | null;
  transferListed: boolean;
  loanListed: boolean;
  /** Pounds per week. */
  loyaltyBonus: number;
  /** How happy he is, and how happy with his playing time, as FMRTE shows them (-100..100). */
  happiness: number;
  playingTimeHappiness: number;
  /** His clauses and bonuses, in the contract's order. */
  clauses: Clause[];
  /** His reasons to be unhappy, over ones too (`ended` set), in the order the game keeps them. */
  concerns: Concern[];
}

/** One of a player's reasons to be unhappy. */
export interface Concern {
  started: FmDate | null;
  /** When it was over; null while it lasts. */
  ended: FmDate | null;
  /** The game's code for what it is about; `concernMotive` names the known ones. */
  motive: number;
  /** 1 concerned, 2 internal. */
  kind: number;
}

/** One of a contract's clauses or bonuses: a release clause, an appearance fee, a yearly wage rise... */
export interface Clause {
  /** Its place in the contract's list. */
  index: number;
  /** The game's code for what it is; `clauseText` names the known ones. */
  kind: number;
  /** Pounds; null for a clause without an amount. */
  amount: number | null;
  /** Goals, assists, matches, years or a percentage, by kind; null for most. */
  condition: number | null;
}

/** A row of the list and more. */
export interface PlayerDetails extends PlayerSummary {
  heightCm: number;
  /** Pounds; null when the club has not set one. */
  askingPrice: number | null;
  reputation: Reputation;
  international: International;
  /** gk, sw, dl, dc, dr, dm, ml, mc, mr, aml, amc, amr, st, wbl, wbr → 1–20 */
  positionRatings: Record<string, number>;
  /** adaptability, ambition, loyalty, pressure, professionalism, sportsmanship, temperament, controversy → 1–20 */
  personality: Record<string, number>;
  /** Attribute key (e.g. "first_touch") → raw and shown value. */
  attributes: Record<string, Attribute>;
  contract: Contract | null;
  /** Energy ("condition") and match sharpness, 0–10000 for 0–100%: what the game changes every day. */
  condition: number;
  matchSharpness: number;
  /** How worn out he is by playing, as stored: -500 when fully rested, higher the more he needs a rest. */
  jadedness: number;
  /** His traits (preferred moves), by their bit: `trait.n` edits bit n; `traitName` names them. */
  traits: number[];
  /**
   * 1–20: his morale, which the game shows as his overall happiness ("Memnun" at 10, "Biraz Mutlu" at 11, "Aşırı
   * Mutlu" at 15 and 20 in the Turkish game) and FM Live Editor as morale ("Okay" at 10, "Very Good" at 15).
   */
  morale: number;
  /** His current injuries; empty when he has none. */
  injuries: Injury[];
  /** His current bans; empty when he has none. */
  bans: Ban[];
  /** His secondary nationalities, and the nations and clubs he was trained in (his homegrown status). */
  ties: Tie[];
  /** How many more ties his list has room for: the game sizes it to what it holds, and the editor allocates nothing. */
  tieRoom: number;
  /** Whether a tie can be added though his list has no room: the editor grows it. */
  tiesGrow: boolean;
  /** Whether the editor can read the retirements the game has planned in this version of the game. */
  retirementKnown: boolean;
  /** The date the game plans him to retire on; null when it has planned none (or `retirementKnown` is false). */
  retires: FmDate | null;
  /**
   * How many more clauses the list of his contract has room for: the game sizes it to what it holds, and the editor
   * allocates nothing, so a release clause can be added to few contracts.
   */
  clauseRoom: number;
  /** Where he is on loan, from his loan contract; null when he is not on loan (or the editor cannot tell). */
  loan: LoanDetails | null;
}

/**
 * A player's loan, as his loan contract says: the club he is on loan to, the club he belongs to, and the days it runs
 * from and to. `loan.expires` edits the day it ends; `recall_loan` makes it end on the game's date.
 */
export interface LoanDetails {
  /** The club he is on loan to. */
  clubUid: number | null;
  club: string | null;
  /** The club his own contract is with. */
  parentUid: number | null;
  parent: string | null;
  from: FmDate | null;
  /** The day the loan ends: the game brings him back then. */
  until: FmDate | null;
  /** His squad number at the club he is on loan to. */
  squadNumber: number | null;
  /** Pounds per week, as the loan contract holds it. */
  wage: number;
  /**
   * Where its end stands against the game's date: `today` is its last day, after which the game brings him back (one
   * day on); `passed` means the game has not done so when that day was over.
   */
  ends: LoanEnd;
  /** Whether the editor brought its end forward this session (Recall from loan, not undone). */
  recalled: boolean;
  /** What the clubs agreed, as the game's Loan Club tab shows it; null where the editor cannot read it. */
  terms: LoanTerms | null;
}

/** The terms of a loan, as the game's Loan Club tab shows them. */
export interface LoanTerms {
  /** His own club may recall him in the game ("Can be recalled"); the editor's recall works either way. */
  canBeRecalled: boolean;
  /** The loan may be ended early: false where the game says "Loan cannot be terminated". */
  canBeTerminated: boolean;
  /** He may play in cup matches, and against his own club. */
  cupMatches: boolean;
  againstOwnClub: boolean;
  /** Pounds: the fee for which the club he is on loan to may sign him for good; null for none. */
  optionFee: number | null;
  /** Pounds a month that club pays his own while he plays, and while he is not used; null for none. */
  monthlyFee: number | null;
  unusedFee: number | null;
  /** The flags as the game keeps them. */
  flags: number;
}

/** Where a loan's end stands against the game's date. */
export type LoanEnd = "later" | "today" | "passed" | "unknown";

/** What ties a player to a nation or club: a secondary nationality, or a nation or club he was trained in. */
/** "workPermit" is a nation he needs no work permit in (England, Scotland), for the days it has left. */
export type TieKind = "nationality" | "trainedInNation" | "trainedAtClub" | "workPermit";

/** One of a player's ties. */
export interface Tie {
  /** Where it is in his list: what changing or removing it names. */
  index: number;
  tie: TieKind;
  /** The UID of the nation or club, for its flag or logo. */
  targetUid: number;
  name: string | null;
  /** For a training, the homegrown rule it meets, by the game's code (see `homegrownRules`). */
  rule: number | null;
  /** For a nation he needs no work permit in, the days that has left. */
  days: number | null;
}

/** One current injury of a player. */
export interface Injury {
  /** The game's name for it, in the game's language; null when it could not be read. */
  name: string | null;
  started: FmDate | null;
  /** When he is expected back, at the soonest and at the latest. */
  backSoonest: FmDate | null;
  backLatest: FmDate | null;
}

/** One current ban of a player. */
export interface Ban {
  started: FmDate | null;
  /** How many matches he still has to miss. */
  matches: number;
}

/** What an edit is for. */
export type Entity = "player" | "staff" | "club";

/** A value of a player, member of staff or club that the editor can change, from `edit_fields`. */
export interface EditField {
  /**
   * People: "current_ability", "potential_ability", "height", "reputation.home", "international.caps",
   * "attribute.finishing", "position.st", "personality.ambition", "contract.wage", "contract.expires".
   * Players only: "contract.squad_number", "contract.squad_status", "contract.transfer_listed",
   * "contract.loan_listed".
   * Clubs: "reputation", "facilities.training", "facilities.youth_facilities", "facilities.youth_coaching",
   * "facilities.youth_recruitment", "facilities.corporate", "finance.balance", "finance.transfer_budget",
   * "finance.wage_budget", "finance.total_wage_budget".
   */
  key: string;
  entity: Entity;
  /**
   * "date": values are numbers like 20290630 (see `dateFromNumber` in editing.ts); "i32": money in pounds; "u32": a
   * count, such as a stadium's capacity; "flag": 0 or 1, a yes-or-no such as being on the transfer list; "pointer":
   * the address of another of the game's objects, such as a person's nation, picked from the ones the game has (see
   * `Nation`).
   */
  kind: "u8" | "i8" | "u16" | "i16" | "i32" | "u32" | "date" | "flag" | "pointer";
  /**
   * "attribute": stored 0–100, shown 1–20 (see `shownValue` in editing.ts); "percent": stored 0–10000, shown as a
   * percentage 0–100; "plain": shown as stored.
   */
  scale: "plain" | "attribute" | "percent";
  /** Smallest stored value the editor writes. */
  min: number;
  /** Largest stored value the editor writes. */
  max: number;
  /** A stored value meaning "none" that the field may also be set to, such as 255 for no squad number. */
  blank: number | null;
  /**
   * The only values the field takes, in the order to offer them, when it holds a code from a list (a squad status,
   * named by `squadStatusName`); null for any value of its range.
   */
  choices: number[] | null;
  /** Whether a mass edit may change the field; some are changed one person at a time. */
  mass: boolean;
}

/**
 * Field key → value as stored, from `read_values`. Only fields that can be edited now are there: no contract
 * fields without a contract, no contract end the game has not set, no finances for a club without full finances.
 */
export type FieldValues = Record<string, number>;

/** One value to write, as stored. */
export interface FieldEdit {
  field: string;
  value: number;
}

/** A change written to the game this session, from `apply_edits` and `change_log`. */
export interface LoggedChange {
  id: number;
  /** When it was written, in milliseconds since 1970. */
  at: number;
  /** The person's name when it was written. */
  name: string;
  entity: Entity;
  uid: number;
  /** The field's key. */
  field: string;
  /** The value before, as stored. */
  old: number;
  /** The value written, as stored. */
  new: number;
  /** When it was undone, if it was. */
  undoneAt: number | null;
  /** The mass edit it was part of (see `undo_batch`); null for an edit made in a profile. */
  batch: number | null;
  // Healing (`heal_player`) is logged as a change of the player's field "injuries" from how many he had to 0, and
  // lifting his bans (`lift_bans`) as a change of his field "bans", and keeping him from retiring (`keep_playing`) as
  // a change of his field "retirement" from the date he was to retire on (a number like 20270630; 0 for none) to 0.
  /**
   * Set for a move to another club, which is logged as a change of the player's field `club` whose old and new
   * values are the clubs' UIDs: the clubs' names. A release (`release_player`) is logged the same way, with 0 for
   * its new value.
   */
  moved?: {
    /** Absent for a free agent signed, who had no club. */
    from?: string;
    /** Absent for a release, after which the player has no club. */
    to?: string;
    /** For a swap of two players, logged as one change, the player who went the other way. */
    with?: string;
    /**
     * For a move that released a player of the new club to make room, logged as one change and undone as one: the
     * player released.
     */
    released?: string;
    /** The fee the buying club paid the selling one, in pounds, if any. */
    fee?: number;
  };
  /**
   * Set for a change to a player's ties, which is logged as a change of his field `tie.nationality`,
   * `tie.trainedInNation`, `tie.trainedAtClub` or `tie.workPermit` from one nation's or club's UID to the other's (0 for none): the
   * names and homegrown rules on either side.
   */
  tie?: {
    from: { name: string; rule: number | null } | null;
    to: { name: string; rule: number | null } | null;
  };
  /**
   * Set for a change to a player's contract clauses (`change_clause`, `remove_clause`, `add_release_clause`), which is
   * logged as a change of his field `clause` from one amount to the other (0 for none): the clause before and after,
   * null before for one added and after for one taken out.
   */
  clause?: {
    from: Clause | null;
    to: Clause | null;
  };
  /**
   * Set for a stadium renamed (`rename_stadium`), logged as a change of the club's field `stadium.name` from one length
   * in bytes to the other: the names.
   */
  stadium?: {
    from: string;
    to: string;
  };
  /**
   * Set for a recall from loan (`recall_loan`, logged as a change of `loan.expires`) that took the loan's option to buy
   * away too, so that the game would not sell him to the club he was on loan at: the option, in pounds. Undo writes it
   * back with the loan's end.
   */
  recall?: {
    optionFee: number;
  };
  /**
   * Set for a captaincy (`set_captain`), which is logged as a change of the club's field `captain` or
   * `vice_captain` whose old and new values are the players' UIDs (0 for nobody); `name` is the club's.
   */
  captaincy?: {
    /** Where the team is in the club's list of teams (see `ClubTeam.index`). */
    team: number;
    /** The team's kind and age limit, to name it by like a `ClubTeam`. */
    kind: number;
    ageLimit: number | null;
    /** Who held the role (null for nobody), and who took it. */
    from: string | null;
    to: string;
    /** Whether the player who took the role held the other one, which `from` now holds. */
    swapped: boolean;
  };
}

/** One of a club's teams as its squad screen shows it, from `club_squads`; the senior team comes first. */
export interface ClubTeam {
  /** Where it is in the club's list of teams; 0 is the senior team. */
  index: number;
  /**
   * The game's code for the kind of team. Seen on the test save: 0 the first team, 3 a B team (Juventus Next Gen),
   * 10 under-21s, 18 under-20s, 12 under-18s. Name a team by its `ageLimit` where it has one.
   */
  kind: number;
  /** The oldest its players may be, e.g. 21; null for a team without a limit. */
  ageLimit: number | null;
  /** UIDs of the captain and the vice-captain; null when the team has none. */
  captain: number | null;
  viceCaptain: number | null;
  players: SquadPlayer[];
}

/** A player in a team's list: his list row and the live values a squad screen shows. */
export interface SquadPlayer extends PlayerSummary {
  /** Whether he plays for this team; one under contract with it may play for another team of the club, or on loan. */
  playsHere: boolean;
  /** "in": here on loan from another club; "out": on loan to another club; null when he is not on loan. */
  loan: "in" | "out" | null;
  /** As stored, like `PlayerDetails`: energy and match sharpness 0–10000, jadedness from -500, morale 1–20. */
  condition: number;
  matchSharpness: number;
  jadedness: number;
  morale: number;
  /**
   * His cohesion with the club, 1–100; null where this version of the game has not been checked for it, or he has no
   * entry for the club: the game gives one when it signs a player, and some moved by an editor have none.
   */
  cohesion: number | null;
  /** How many current injuries he has. */
  injuries: number;
  /** How many current bans he has. */
  bans: number;
  /** Whether his attributes are frozen, his energy and match sharpness, or his positions (see `freeze_team`). */
  attributesFrozen: boolean;
  fitnessFrozen: boolean;
  positionsFrozen: boolean;
}

/** A team's two captaincies. */
export type CaptainRole = "captain" | "viceCaptain";

/**
 * What a team-wide action does to every player of the team, those out on loan too: "heal" heals every injury,
 * "liftBans" lifts every ban, "inspire" sets morale to 20, "refresh" sets energy and match sharpness to 100%,
 * "maxCohesion" sets cohesion with the club to 100 for those who have one.
 */
export type TeamAction = "heal" | "liftBans" | "inspire" | "refresh" | "maxAttributes" | "maxCohesion";

/** The columns that sort a squad table. */
export type SquadSort =
  | "name"
  | "position"
  | "age"
  | "currentAbility"
  | "potentialAbility"
  | "condition"
  | "matchSharpness"
  | "jadedness"
  | "morale"
  | "cohesion";

/** The contract a move to another club gives the player, as stored; what is left out stays as it is. */
export interface MoveTerms {
  /** Pounds per week. */
  wage?: number;
  /** A date as a number like 20290630; it must come after the game's date. */
  expires?: number;
}

/**
 * From `room_makers`: a player of a club's senior team that a move to the club can release to make room in its full
 * squad list, with what makes him a worse choice.
 */
export interface RoomMaker extends PlayerSummary {
  injured: boolean;
  /** He captains one of the club's teams, or is its vice-captain. */
  captain: boolean;
}

/** From `plan_club_move`: the move can be made, between these clubs. */
/** A club by its UID and name, as a plan names it. */
export interface ClubName {
  uid: number;
  name: string;
}

export interface MovePreview {
  /** Absent for a free agent, who has no club. */
  from?: ClubName;
  to: ClubName;
  /** What the fee does to the two clubs' money, when one is to be paid. */
  fee?: FeePlan;
  /** For a free agent, the contract the editor makes for him. */
  contract?: NewContract;
  /** For a member of staff who has no club, the contract the editor makes for him. */
  staffContract?: NewStaffContract;
}

/** The contract the editor makes for a member of staff who has no club, as the plan has it. */
export interface NewStaffContract {
  /** Pounds per week. */
  wage: number;
  /** The end date, as a number like 20290630. */
  expires: number;
}

/** The contract the editor makes for a free agent it signs, as the plan has it. */
export interface NewContract {
  /** Pounds per week. */
  wage: number;
  /** The end date, as a number like 20290630. */
  expires: number;
  /** The squad status's code. */
  squadStatus: number;
}

/** An amount of money before and after a fee is paid, in pounds. */
export interface Amounts {
  before: number;
  after: number;
}

/** What a fee does to one club's money. */
export interface ClubMoney {
  club: number;
  balance: Amounts;
  /** The buying club's transfer budget, which the fee comes out of too, down to nothing; null when none is set. */
  transferBudget: Amounts | null;
}

/**
 * What paying a transfer fee does: the buying club pays it out of its balance and transfer budget, and the selling
 * club's balance takes it. A club the game keeps no full finances for is null: its money stays as it is.
 */
export interface FeePlan {
  fee: number;
  buyer: ClubMoney | null;
  seller: ClubMoney | null;
}

/** An edit `apply_edits` refused; it changed nothing. */
export interface FailedEdit {
  field: string;
  value: number;
  /** Why, e.g. that 250 is not a current ability, which takes 1 to 200. */
  error: Failure;
}

export interface ApplyReport {
  applied: LoggedChange[];
  failed: FailedEdit[];
}

/** What a mass edit does to a field. Values are as stored, like every edit's. */
export type MassOperationKind =
  | { op: "set"; value: number }
  /** May be negative; the result stays within the field's range. */
  | { op: "add"; amount: number }
  /** Multiplies by percent / 100, rounded; the result stays within the field's range. */
  | { op: "scale"; percent: number };

/** One field of a mass edit and what to do with it. Dates can only be set. */
export interface MassOperation {
  field: string;
  operation: MassOperationKind;
}

/** The filter of the list a mass edit applies to; only the one for its entity is used. */
export interface MassFilters {
  playerFilter?: PlayerFilter;
  staffFilter?: StaffFilter;
  clubFilter?: ClubFilter;
}

/** A change a mass edit would write: as stored. */
export interface PlannedChange {
  uid: number;
  name: string;
  field: string;
  old: number;
  new: number;
}

/** A value a mass edit leaves alone, and why (no contract, not set, not plausible, ...). */
export interface SkippedField {
  uid: number;
  name: string;
  field: string;
  /** Why, in English; `code` and `params` say it in the window's language, as a `Failure` would. */
  reason: string;
  code: string;
  params: Record<string, string>;
}

/** From `plan_mass_edit`: what applying would change. Nothing is written yet. */
export interface MassPreview {
  /** Pass to `apply_mass_edit` to write exactly these changes. */
  id: number;
  /** How many players, staff or clubs the search and filter selected. */
  targets: number;
  /** How many of them already have the values the edit would give them. */
  unchanged: number;
  /** How many values would change, in all. */
  changes: number;
  /** The first 500 changes. */
  rows: PlannedChange[];
  /** How many values are left alone, in all. */
  skippedCount: number;
  /** The first 500 of them. */
  skipped: SkippedField[];
}

/** From `apply_mass_edit`. */
export interface MassReport {
  /** The batch the changes are logged under; `undo_batch` undoes them together. */
  batch: number;
  applied: number;
  /** Changes not written, e.g. because the game changed the value after the preview. */
  failed: { uid: number; name: string; field: string; error: Failure }[];
}

/** From `undo_batch`. */
export interface BatchUndo {
  undone: number;
  /** Changes the game has changed since, left as they are. */
  failed: { id: number; error: Failure }[];
}

/** How many pictures of each kind the graphics packs hold. */
export interface GraphicsCounts {
  clubLogos: number;
  faces: number;
  flags: number;
  competitionLogos: number;
}

/** From `graphics_info`: the user's graphics packs, read once in the background when the app starts. */
export interface GraphicsInfo {
  /** The folder they are read from, e.g. Documents\Sports Interactive\Football Manager 27\graphics. */
  root: string | null;
  /** False while the packs are still being read. */
  ready: boolean;
  counts: GraphicsCounts;
}

/** When the team has the ball, or when it has not. */
export type Phase = "inPossession" | "outOfPossession";

/** The line of the formation a role plays in. */
export type Line =
  | "goalkeeper"
  | "centreBack"
  | "fullBack"
  | "wingBack"
  | "defensiveMidfield"
  | "centralMidfield"
  | "attackingMidfield"
  | "wide"
  | "striker";

/** A role of the tactics screen whose mask the editor knows. */
export interface Role {
  /** The game's abbreviation in lower case, e.g. "ifb"; the same key in both phases names the same kind of role. */
  key: string;
  phase: Phase;
  line: Line;
  /** The attributes it leans on most (weighed three times), and those that help. */
  keyAttributes: string[];
  otherAttributes: string[];
}

/** A position a recommendation can be asked for, and the lines whose roles are played there, its own first. */
export interface ScoutPosition {
  /** A position key, e.g. "dr" (see positionLabel). */
  key: string;
  lines: Line[];
}

export type DepthStatus = "missing" | "thin" | "fine" | "crowded";

export interface DepthPlayer {
  player: PlayerSummary;
  /** His best rating (1–20) among the line's positions. */
  rating: number;
  /** Here on loan from another club. */
  onLoan: boolean;
}

/** One line of the senior squad. */
export interface DepthLine {
  /** "gk", "dc", "rightBack", "leftBack", "dm", "mc", "rightWing", "leftWing", "amc" or "st". */
  key: string;
  /** Its positions (position keys), the one to ask recommendations for first. */
  positions: string[];
  /** How many players a squad usually carries there. */
  target: number;
  /** The players whose best position is here, best first. */
  players: DepthPlayer[];
  /** Players who play here well (rated 15 or more) but best elsewhere. */
  cover: DepthPlayer[];
  status: DepthStatus;
  /** Its best player is well below the squad's level. */
  weak: boolean;
  /** All its players are 31 or older. */
  ageing: boolean;
}

export type DepartureAction = "sell" | "loan" | "release";

/**
 * Why a player could go: `surplus` (value: the players of his line), `belowLevel` (his ability), `ageing` (his age),
 * `expiring` (days left), `highWage` (pounds a week), `unhappy` (his reasons to be), `lowMorale` (1–20), `blocked`
 * (his potential ability), `unwanted` (squad status surplus to requirements), `listed`.
 */
export interface DepartureReason {
  code: string;
  value: number | null;
}

export interface Departure {
  player: PlayerSummary;
  action: DepartureAction;
  reasons: DepartureReason[];
  /** The more reasons and the stronger, the higher. */
  priority: number;
  /** Pounds; a week for the wage. The value is null where the game keeps none or he is not for sale. */
  value: number | null;
  notForSale: boolean;
  wage: number | null;
  /** His line (a DepthLine key) and where he stands in it, 1 being its best. */
  line: string;
  rank: number;
}

export interface SquadReport {
  lines: DepthLine[];
  departures: Departure[];
  /** The average current ability of the squad's best eleven. */
  level: number;
  size: number;
  averageAge: number | null;
}

/** What `scouting_overview` returns. */
export interface ScoutingOverview {
  club: ClubSummary;
  /** Pounds; a week for the wages. */
  transferBudget: number | null;
  wageBudget: number | null;
  /** What the club can still add to its wage bill a week. */
  wageRoom: number | null;
  report: SquadReport;
  positions: ScoutPosition[];
  roles: Role[];
}

/** What a recommendation is for: better than the best at the position now, depth, a prospect, or anyone. */
export type Purpose = "firstTeam" | "rotation" | "future" | "any";

export type ScoutOrder = "score" | "fit" | "probability" | "fee";

/** What `scouting_suggest` looks for; omitted fields are open. */
export interface ScoutRequest {
  /** A position key from `ScoutingOverview.positions`. */
  position: string;
  /** Role keys; null or omitted for the role of the position that suits each player best. */
  inPossession?: string | null;
  outOfPossession?: string | null;
  purpose?: Purpose;
  minAge?: number | null;
  maxAge?: number | null;
  /** Pounds. */
  maxFee?: number | null;
  /** 0–100. */
  minProbability?: number | null;
  noFreeAgents?: boolean;
  order?: ScoutOrder;
  limit?: number;
}

/**
 * Why a move looks more or less likely: `listed`, `freeAgent`, `expiring` (value: days left), `releaseClause` (pounds),
 * `fringe` / `keyPlayer` / `unwanted` (value: squad status code), `overBudget` / `stretch` (pounds over), `wageHigh`
 * (pounds a week over), `biggerClub` / `smallerClub` (his club's reputation), `reputationGap` (his reputation),
 * `ambitious` (ambition), `notForSale`.
 */
export interface Reason {
  code: string;
  /** Its effect on the probability, in points. */
  points: number;
  value: number | null;
}

/** How a player measures up to a position and its roles. */
export interface Fitting {
  player: PlayerSummary;
  /** 0–100. */
  fit: number;
  /** His attributes for each role, 1–20, and the roles measured: those asked for, or the best of the position's. */
  inPossession: number | null;
  outOfPossession: number | null;
  inPossessionRole: string | null;
  outOfPossessionRole: string | null;
  /** His rating (1–20) in the position. */
  positionRating: number;
}

export interface Suggestion extends Fitting {
  /** How likely he is to join the club, 0–100: an estimate. 50 and above counts as likely. */
  probability: number;
  reasons: Reason[];
  /** Pounds; a week for the wage. */
  fee: number | null;
  wage: number | null;
  value: number | null;
  /** Fit and probability together, as the purpose weighs them: the default order. */
  score: number;
  /** The club his contract is with, when it is not the one he plays for (he is on loan, or in its second team). */
  ownerClub: string | null;
  ownerClubUid: number | null;
}

/** What `scouting_suggest` returns. */
export interface Scouted {
  suggestions: Suggestion[];
  /** The club's own players for the position, best first (at most five). */
  squad: Fitting[];
  transferBudget: number | null;
  /** Pounds a week the club can still add to its wage bill. */
  wageRoom: number | null;
  /** Players looked at, those who can play the position, and those of them who meet the purpose. */
  examined: number;
  candidates: number;
  eligible: number;
}
