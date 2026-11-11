// The English text of the UI, and the shape every language has: `tr.ts`, `es.ts` and `id.ts` are typed `Strings`,
// which is `typeof en`, so a key that one dictionary has and another lacks fails the build. A new language is a new
// file like them, which `index.ts` then offers and `SettingsMenu.tsx` gives a flag.
//
// Keys of the game data map to the names FM uses; every other string of the panels is in `profile` (those only the
// club panel has, in `clubProfile`), and those of the player, staff and club lists in `playerList`, `staffList` and
// `clubList` (the saved player filters are in `playerList.filters.saved`). Editing has `edit` (and `fields` for the
// names of the fields), the Changes view `changes`, mass editing `massEdit`, comparing players `comparison`, moving a
// player to another club or swapping him with one `move`, a club's squad `squad`, the sidebar and the connect panel
// `app`, and the graphics packs the pictures come from `graphics`. The components read them through `labels.ts`.
//
// The text functions (counts, summaries, "was …") are written per language: plurals and word order differ, so a
// language builds its sentences itself.

import type {
  CheckKey,
  Entity,
  ExportEntity,
  ExportFormat,
  GraphicsCounts,
  MassOperationKind,
  MassPreview,
  PlayerSort,
  SquadSort,
  StaffSort,
  Storefront,
} from "../types";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("en-GB");
const percents = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12,345". */
const format = (value: number) => numbers.format(value);

/** "No changes", "1 change", "3 changes", "12,345 changes". */
const changeCount = (count: number) =>
  count === 0 ? "No changes" : count === 1 ? "1 change" : `${format(count)} changes`;

/** "1 player", "12 players". */
const playerCount = (count: number) => (count === 1 ? "1 player" : `${format(count)} players`);

/** "1 value left alone", "12 values left alone". */
const valuesLeftAlone = (count: number) =>
  count === 1 ? "1 value left alone" : `${format(count)} values left alone`;

/** "237 players", "1 player", "237 staff", "1 member of staff", "12 clubs", "1 club". */
const entityCount: Record<Entity, (count: number) => string> = {
  player: (count) => (count === 1 ? "1 player" : `${format(count)} players`),
  staff: (count) => (count === 1 ? "1 member of staff" : `${format(count)} staff`),
  club: (count) => (count === 1 ? "1 club" : `${format(count)} clubs`),
};

/** What each list holds, in the plural. */
const entityNouns: Record<Entity, string> = { player: "players", staff: "staff", club: "clubs" };

/**
 * Squad statuses, by the codes contracts hold them as; named as the game's English contract screen names them. 15, 16,
 * 17, 20 and 21 are goalkeepers' (21 is the game's "Emergency Backup" too).
 */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Star player",
  2: "Important player",
  3: "Regular starter",
  4: "Squad player",
  5: "Impact sub",
  7: "Fringe player",
  9: "Emergency backup",
  10: "Breakthrough prospect",
  11: "Future prospect",
  13: "Youngster",
  14: "B team regular",
  15: "First-choice goalkeeper",
  16: "Cup goalkeeper",
  17: "Domestic cup goalkeeper",
  20: "Backup",
  21: "Emergency backup (goalkeeper)",
  22: "Surplus to requirements",
};

/** The kinds of contract, by the codes contracts hold them as; 10 and 11 are the MLS's. */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Part-time contract",
  1: "Full-time contract",
  2: "Amateur contract",
  3: "Youth contract",
  4: "Non-contract",
  10: "Senior minimum salary contract",
  11: "Senior contract",
};

/**
 * Sentences for the failures of the Rust commands, by code (see `describeError` in format.ts). Each gets the values
 * the failure names, its amounts and dates already written out; fields come as keys, which `fieldName` names. A code
 * a dictionary leaves out shows the English message the command sent.
 */
export type ErrorTexts = Partial<Record<string, (params: Readonly<Record<string, string>>) => string>>;

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(en, key ?? "");

/** What a check is about, from the key a failure gives, with a capital: "Contracts". */
const checkName = (key: string | undefined) => {
  const name = (en.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The commands' own English is kept where it names no field. */
const errors: ErrorTexts = {
  "edit.unknownField": (p) => `There is no editable field “${p.field}” here.`,
  "edit.outOfRange": (p) => `${p.value} is not a valid ${field(p.field)}: it takes ${p.min} to ${p.max}.`,
  "edit.notADate": (p) => `${p.value} is not a date for ${field(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} is not one of the values ${field(p.field)} takes.`,
  "edit.taken": (p) => `Squad number ${p.value} is taken: ${p.name ?? `the player with UID ${p.uid}`} wears it.`,
  "edit.unsupported": (p) => `${field(p.field)} cannot be changed that way: ${p.reason}.`,
  "edit.noRecord": (p) => `${field(p.field)} cannot be changed here: its record is missing or does not check out.`,
  "edit.unset": (p) => `${field(p.field)} is not set in the game, so it was left alone.`,
  "edit.implausible": (p) => `${field(p.field)} reads ${p.value}, which it cannot hold; it was left alone to be safe.`,
  "edit.notApplied": (p) => `${field(p.field)}: wrote ${p.wrote} but read back ${p.read}.`,
  "edit.conflict": (p) => `${field(p.field)} is now ${p.found}, not ${p.expected}: the game has changed it since.`,
  "move.outOfRange": (p) => `${p.value} is not a valid ${field(p.field)}: it takes ${p.min} to ${p.max}.`,
  "export.failed": (p) => `Could not write the file: ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor may not write to ${p.folder}. If macOS asked whether it may use your Documents folder, allow it ` +
    "in System Settings › Privacy & Security › Files & Folders, then export again.",
  "export.openFailed": (p) => `Could not open it: ${p.reason}`,
  "guard.unknownBuild": () =>
    "FMLibreEditor has not been checked with this version of the game, so it does not write to it. Edit anyway, in " +
    "the notice at the top, turns editing on.",
  "guard.failed": (p) =>
    `${checkName(p.check)} did not check out in this version of the game, so FMLibreEditor leaves them unchanged.`,
  "guard.saveChanged": () =>
    "The game has loaded a save, or gone back to its main menu, since FMLibreEditor read it, so it changes nothing " +
    "until you reload the data.",
  "memory.noBridge": () =>
    "macOS does not let FMLibreEditor into the game: the game was started without the FMLibreEditor bridge. Set " +
    "the bridge up, then start the game again from Steam.",
  "staff.directorTaken": (p) =>
    `${p.name ?? "Someone else"} is the club's director of football already. Give this member of staff another job ` +
    `there, or move ${p.name ?? "that one"} first.`,
  "staff.managerTaken": (p) =>
    `${p.name ?? "Someone else"} is the club's manager already. Give this member of staff another job there, or ` +
    `move ${p.name ?? "that one"} first.`,
  "staff.yourClub": () =>
    "You manage this club. Give this member of staff another job there: FMLibreEditor never takes your place.",
  "staff.noJob": () => "Choose the job they take at the club.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "This club has no staff at all: the game keeps none at clubs of leagues that are not playable in this save."
      : "None of this club's staff has a full contract of their own to model a new one on.",
  "scout.noClub": () => "You do not manage a club in this save, so there is nobody to scout for.",
  "scout.noTactic": (p) => `Could not read the tactic of ${p.club} from the game.`,
  "scout.notPlaced": () => "The player is not in a slot of the tactic.",
  "scout.unknownRole": (p) => `The editor does not know the role ${p.role}.`,
  "setup.steamRunning": () =>
    "Steam is running, so FM27's launch options were left alone; the bridge itself is installed. Quit Steam and " +
    "try again, or enter the launch option in Steam yourself.",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as; named as the game's English contract
 * screen names them (6, which only the German one was seen in, after what it does). The game shows no 54, 58 or 63.
 */
const CLAUSE_NAMES_EN: Partial<Record<number, string>> = {
  0: "Minimum fee release clause",
  1: "Relegation release clause",
  2: "Non promotion release clause",
  3: "Yearly wage rise",
  4: "Promotion wage rise",
  5: "Relegation wage drop",
  6: "Release clause for a staff role",
  8: "Sell on fee percentage",
  9: "Sell on fee profit percentage",
  10: "Seasonal landmark goal bonus",
  11: "One-year extension after league games (final season)",
  12: "Match highest earner clause",
  13: "Wage after reaching club league games",
  14: "Top division promotion wage rise",
  15: "Top division relegation wage drop",
  16: "Minimum fee release clause (foreign clubs)",
  17: "Minimum fee release clause (domestic clubs in higher division)",
  18: "Minimum fee release clause (domestic clubs)",
  19: "Wage after reaching international appearances",
  20: "Percentage of wages paid by sponsor",
  21: "Percentage of gate receipts paid to player",
  22: "Optional contract extension by club",
  23: "Waive club compensation for managerial role",
  25: "One-year extension after league games (promoted final season)",
  26: "One-year extension after league games (avoid relegation final season)",
  27: "Minimum fee release clause (clubs in UEFA Champions League)",
  28: "MLS guaranteed contract clause",
  29: "Contract extension after promotion",
  30: "Injury release clause",
  31: "Minimum fee release clause (clubs in a continental competition)",
  32: "Appearance fee",
  33: "Goal bonus",
  34: "Clean sheet bonus",
  37: "International cap bonus",
  38: "Unused substitute fee",
  39: "Assist bonus",
  40: "Seasonal landmark assist bonus",
  41: "Seasonal landmark combined goal and assist bonus",
  54: "Not shown in the game (54)",
  55: "Active relegation release clause",
  56: "Active non promotion release clause",
  58: "Not shown in the game (58)",
  63: "Not shown in the game (63)",
};

/** Reasons to be unhappy, by the codes the game keeps them as; named as FMRTE names them. */
const CONCERN_MOTIVES_EN: Partial<Record<number, string>> = {
  596: "Left out of a competition squad",
  808: "Thinks a teammate has been treated unfairly",
  926: "Doesn't believe a teammate deserves the playing time he wants",
};

/** Players' traits (preferred moves), by their bit in the game's mask; named as FMRTE names them. */
const TRAIT_NAMES_EN: readonly string[] = [
  "Runs with ball down left",
  "Runs with ball down right",
  "Runs with ball through centre",
  "Gets into opposition area",
  "Moves into channels",
  "Gets forward whenever possible",
  "Plays short simple passes",
  "Tries killer balls often",
  "Shoots from distance",
  "Shoots with power",
  "Places shots",
  "Curls ball",
  "Likes to round keeper",
  "Likes to try to beat offside trap",
  "Uses outside of foot",
  "Marks opponent tightly",
  "Winds up opponents",
  "Argues with officials",
  "Plays with back to goal",
  "Comes deep to get ball",
  "Plays one-twos",
  "Likes to lob keeper",
  "Dictates tempo",
  "Attempts overhead kicks",
  "Looks for pass rather than attempting to score",
  "Plays no through balls",
  "Stops play",
  "Knocks ball past opponent",
  "Moves ball to right foot before dribble attempt",
  "Moves ball to left foot before dribble attempt",
  "Dwells on ball",
  "Arrives late in opponents' area",
  "Tries to play way out of trouble",
  "Stays back at all times",
  "Avoids using weaker foot",
  "Tries tricks",
  "Tries long range free kicks",
  "Dives into tackles",
  "Does not dive into tackles",
  "Cuts inside",
  "Hugs line",
  "Gets crowd going",
  "Tries first time shots",
  "Tries long range passes",
  "Likes ball played into feet",
  "Hits free kicks with power",
  "Likes to beat man repeatedly",
  "Likes to switch ball to other flank",
  "Will retire at top",
  "Will play football as long as possible",
  "Possesses long flat throw",
  "Runs with ball often",
  "Runs with ball rarely",
  "Attempts to develop weaker foot",
  "Static target man",
  "Uses long throw to start counter attacks",
  "Refrains from taking long shots",
  "Cuts inside from left wing",
  "Cuts inside from right wing",
  "Crosses early",
  "Brings ball out of defence",
  "Plays ball with feet"
];

export const en = {
  attributes: {
    // Technical
    corners: "Corners",
    crossing: "Crossing",
    dribbling: "Dribbling",
    finishing: "Finishing",
    first_touch: "First Touch",
    free_kicks: "Free Kick Taking",
    heading: "Heading",
    long_shots: "Long Shots",
    long_throws: "Long Throws",
    marking: "Marking",
    passing: "Passing",
    penalty_taking: "Penalty Taking",
    tackling: "Tackling",
    technique: "Technique",
    // Mental
    aggression: "Aggression",
    anticipation: "Anticipation",
    bravery: "Bravery",
    composure: "Composure",
    concentration: "Concentration",
    decisions: "Decisions",
    determination: "Determination",
    flair: "Flair",
    leadership: "Leadership",
    off_the_ball: "Off the Ball",
    positioning: "Positioning",
    teamwork: "Teamwork",
    vision: "Vision",
    work_rate: "Work Rate",
    // Physical
    acceleration: "Acceleration",
    agility: "Agility",
    balance: "Balance",
    jumping_reach: "Jumping Reach",
    natural_fitness: "Natural Fitness",
    pace: "Pace",
    stamina: "Stamina",
    strength: "Strength",
    // Goalkeeping (first touch and passing are shared with Technical)
    aerial_reach: "Aerial Reach",
    command_of_area: "Command of Area",
    communication: "Communication",
    eccentricity: "Eccentricity",
    handling: "Handling",
    kicking: "Kicking",
    one_on_ones: "One on Ones",
    punching: "Punching (Tendency)",
    reflexes: "Reflexes",
    rushing_out: "Rushing Out (Tendency)",
    throwing: "Throwing",
    // Hidden
    consistency: "Consistency",
    dirtiness: "Dirtiness",
    important_matches: "Important Matches",
    injury_proneness: "Injury Proneness",
    versatility: "Versatility",
    // Feet
    left_foot: "Left Foot",
    right_foot: "Right Foot",
  },

  staffAttributes: {
    // Coaching
    attacking: "Attacking",
    defending: "Defending",
    fitness: "Fitness",
    goalkeeping: "Goalkeeping",
    possession: "Possession",
    set_pieces: "Set Pieces",
    tactical: "Tactical",
    technical: "Technical",
    working_with_youngsters: "Working with Youngsters",
    // Mental
    authority: "Authority",
    determination: "Determination",
    motivating: "Motivating",
    people_management: "People Management",
    // Knowledge
    data_analysis: "Data Analysis",
    judging_ability: "Judging Player Ability",
    judging_potential: "Judging Player Potential",
    judging_staff: "Judging Staff Ability",
    negotiating: "Negotiating",
    tactical_knowledge: "Tactical Knowledge",
    // Medical
    physiotherapy: "Physiotherapy",
    sports_science: "Sports Science",
  },

  personality: {
    adaptability: "Adaptability",
    ambition: "Ambition",
    loyalty: "Loyalty",
    pressure: "Pressure",
    professionalism: "Professionalism",
    sportsmanship: "Sportsmanship",
    temperament: "Temperament",
    controversy: "Controversy",
  },

  /** The abbreviations of the positions: the same in every language. */
  positions: {
    gk: "GK",
    sw: "SW",
    dl: "DL",
    dc: "DC",
    dr: "DR",
    dm: "DM",
    ml: "ML",
    mc: "MC",
    mr: "MR",
    aml: "AML",
    amc: "AMC",
    amr: "AMR",
    st: "ST",
    wbl: "WBL",
    wbr: "WBR",
  },

  clubFacilities: {
    training: "Training",
    youth_facilities: "Youth Facilities",
    youth_coaching: "Youth Coaching",
    youth_recruitment: "Youth Recruitment",
    /** Only a club with finances has it. */
    corporate: "Corporate",
  },

  supporterTraits: {
    loyalty: "Loyalty",
    passion: "Passion",
    patience: "Patience",
    affluence: "Affluence",
    temperament: "Temperament",
    expectations: "Expectations",
  },

  /** The kinds of supporters, in the order of the supporter-mix bar. */
  supporterMix: {
    hardcore: "Hardcore",
    core: "Core",
    family: "Family",
    fair_weather: "Fair-weather",
    corporate: "Corporate",
    casual: "Casual",
  },

  /** FM's job codes as stored in contracts. */
  jobs: {
    1: "Player",
    2: "Coach",
    4: "Chairperson",
    6: "Director",
    10: "Director of Football",
    12: "Physio",
    14: "Scout",
    16: "Manager",
    20: "Assistant Coach",
    22: "Set Piece Coach",
    26: "Fitness Coach",
    34: "Goalkeeping Coach",
    38: "Chief Doctor",
    40: "Head of Sports Science",
    44: "Chief Scout",
    46: "Doctor",
    48: "Sports Scientist",
    50: "Head Physio",
    58: "Recruitment Analyst",
    60: "Performance Analyst",
    62: "Head Performance Analyst",
    64: "Head of Youth Development",
    66: "Owner",
    70: "President",
    86: "Loan Manager",
    88: "Technical Director",
  },

  /** The names of the fields that are not attributes, personality or positions, by key. */
  fields: {
    current_ability: "Current ability",
    potential_ability: "Potential ability",
    height: "Height (cm)",
    date_of_birth: "Date of birth",
    asking_price: "Asking price",
    nation: "Nationality",
    "reputation.home": "Home reputation",
    "reputation.current": "Current reputation",
    "reputation.world": "World reputation",
    "international.caps": "Caps",
    "international.goals": "International goals",
    "international.u21_caps": "U21 caps",
    "international.u21_goals": "U21 goals",
    // What the game changes every day.
    condition: "Energy",
    match_sharpness: "Match sharpness",
    jadedness: "Jadedness",
    morale: "Morale",
    "contract.wage": "Wage per week",
    "contract.loyalty_bonus": "Loyalty bonus per week",
    "contract.happiness": "Happiness",
    "contract.playing_time_happiness": "Playing time happiness",
    "contract.unhappiness": "Reasons to be unhappy",
    "contract.expires": "Contract end",
    "contract.squad_number": "Squad number",
    "contract.squad_status": "Squad status",
    "contract.transfer_listed": "Transfer listed",
    "contract.loan_listed": "Loan listed",
    "loan.expires": "Loan end",
    "loan.option_fee": "Option to buy",
    // A member of staff's job, which the change log keeps as a change of its code.
    "contract.job": "Job",
    // A player's ties, which the change log keeps as changes of the nation or club (see `ties`).
    "tie.nationality": "Secondary nationality",
    "tie.trainedInNation": "Trained in nation",
    "tie.trainedAtClub": "Trained at club",
    "tie.workPermit": "No work permit needed in",
    // A move to another club, which the change log keeps as a change of the player's club.
    club: "Club",
    // Healing a player, which the change log keeps as a change of his injuries.
    injuries: "Injuries",
    // Setting a player's cohesion with his club, which the change log keeps as a change of it.
    cohesion: "Cohesion",
    // Lifting a player's bans, which the change log keeps as a change of his bans.
    bans: "Bans",
    // Keeping a player from retiring, which the change log keeps as a change of the date he was to retire on.
    retirement: "Retirement",
    // A change to a player's contract clauses, which the change log keeps as a change of the clause's amount.
    clause: "Contract clause",
    "clause.amount": "Clause amount",
    "clause.condition": "Clause condition",
    // Making a player the captain or vice-captain of one of a club's teams, which the change log keeps as a change of
    // the club's captain or vice-captain.
    captain: "Captain",
    vice_captain: "Vice-captain",
    // A club's own reputation, which has no home, current or world.
    reputation: "Reputation",
    "facilities.training": "Training facilities",
    "facilities.youth_facilities": "Youth facilities",
    "facilities.youth_coaching": "Youth coaching",
    "facilities.youth_recruitment": "Youth recruitment",
    "facilities.corporate": "Corporate facilities",
    "finance.balance": "Balance",
    "finance.transfer_budget": "Transfer budget",
    "finance.wage_budget": "Wage budget",
    "finance.total_wage_budget": "Total wage budget",
    "stadium.capacity": "Stadium capacity",
    "stadium.name": "Stadium name",
    "stadium.seating": "Seated capacity",
    "stadium.used": "Capacity in use",
    "stadium.expansion": "Expansion capacity",
  },

  profile: {
    close: "Close profile",
    loading: "Loading profile…",
    /** The handle on the left edge of the panel. */
    resize: "Resize the profile panel",
    resizeHint: "Drag to make the panel wider or narrower; double-click to reset it",
    /** Shown where a value is missing. */
    none: "—",

    // Header
    freeAgent: "Free agent",
    born: "Born",
    height: (cm: number) => `${cm} cm`,
    /** After the input of the height, while the player is edited. */
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Current ability",
    currentAbilityShort: "CA",
    potentialAbility: "Potential ability",
    potentialAbilityShort: "PA",
    /** Hover text of a potential ability that is set as a range (the game stores it as a negative number). */
    potentialRange: "Potential set as a range",

    // Attributes
    technical: "Technical",
    goalkeeping: "Goalkeeping",
    mental: "Mental",
    physical: "Physical",
    hidden: "Hidden",
    feet: "Feet",
    personality: "Personality",
    /** Hover text of an attribute: the value as stored, 0–100 unless the game stores it on another scale. */
    raw: (raw: number, scale = 100) => `raw ${raw} / ${scale}`,
    lowerIsBetter: "lower is better",
    age: (age: number) => `age ${age}`,

    // Positions
    positions: "Positions",
    positionsSummary: (best: string) => `Position ratings: ${best}`,
    /** The group of every position's rating, under the pitch. */
    positionRatings: "Position ratings",
    positionTiers: {
      natural: "Natural",
      accomplished: "Accomplished",
      competent: "Competent",
      unconvincing: "Unconvincing",
      ineffective: "Ineffective",
    },
    positionTooltip: (position: string, rating: number, tier: string) => `${position} · ${rating} · ${tier}`,

    // Contract
    contract: "Contract",
    wage: "Wage per week",
    /** Under the wage: the game keeps money in pounds; `converted` when the app shows another currency. */
    wageNote: (converted: boolean): string =>
      converted
        ? "the game keeps pounds; shown at FM's own exchange rate"
        : "the game keeps pounds; another currency can be chosen in the settings",
    signed: "Signed",
    expires: "Expires",
    joined: "Joined",
    squadStatus: "Squad status",
    squadStatusName: (status: number) => SQUAD_STATUSES[status] ?? `Status ${status}`,
    contractType: "Contract type",
    contractTypeName: (code: number) => CONTRACT_TYPES[code] ?? `Type ${code}`,
    squadNumber: "Squad number",
    transferListed: "Transfer listed",
    loanListed: "Loan listed",

    // Career
    career: "Career",
    internationalCaps: "International caps",
    internationalGoals: "International goals",
    u21Caps: "U21 caps",
    u21Goals: "U21 goals",
    askingPrice: "Asking price",
    notSet: "Not set",
    reputation: "Reputation",
    reputationHome: "Home",
    reputationCurrent: "Current",
    reputationWorld: "World",
    /** The retirement the game has planned for a player, and the button that keeps him playing. */
    retirement: "Retirement",
    retires: "Plans to retire",
    noRetirement: "The game has not planned his retirement",
    keepPlaying: "Prevent retirement",
    keepingPlaying: "Preventing…",
    keepPlayingTitle:
      "Take his retirement out of the game's plans and give him the trait “Will play football as long as possible” in place of “Will retire at top”; Changes can undo it",

    // Medical (the group's heading is `medical`, below; the names of its values are in `fields`)
    /** A player's morale, 1–20. */
    morale: (value: number) => `${value} / 20`,
    /** Hover text of his morale: the game shows it as his overall happiness. */
    /** A player's traits (preferred moves): the heading, none, and each one's name by its bit. */
    traits: "Traits",
    noTraits: "No traits",
    traitName: (bit: number) => TRAIT_NAMES_EN[bit] ?? `Trait ${bit}`,
    /** A player's reasons to be unhappy, as FMRTE lists them, and the button that removes them all. */
    unhappiness: "Unhappiness",
    noUnhappiness: "Nothing makes him unhappy",
    removeUnhappiness: "Remove all",
    removingUnhappiness: "Removing…",
    removeUnhappinessTitle: "Take every reason to be unhappy off his list, as FMRTE's Remove all does; Changes can undo it",
    concernSince: (date: string) => `since ${date}`,
    concernKind: (kind: number) => (kind === 1 ? "Concerned" : kind === 2 ? "Internal" : `Type ${kind}`),
    concernMotive: (motive: number) => CONCERN_MOTIVES_EN[motive] ?? `Reason ${motive}`,
    /** A contract's clauses and bonuses: the heading, and what each kind the game has is called. */
    clauses: "Bonuses and clauses",
    noClauses: "No bonuses or clauses",
    loyaltyBonus: "Loyalty bonus",
    happiness: "Happiness",
    playingTimeHappiness: "Playing time happiness",
    moodTitle: "As FMRTE shows it, from -100 to 100; the game shows it in words",
    /** The name of a clause or bonus by its kind; a kind the app does not know yet by its number. */
    clauseName: (kind: number) => CLAUSE_NAMES_EN[kind] ?? `Clause ${kind}`,
    /** A player's loan: where he is on loan, and the button that brings him back. */
    loan: "Loan",
    loanAt: "On loan at",
    loanParent: "Belongs to",
    loanFrom: "From",
    loanUntil: "Until",
    loanNumber: "Number there",
    recall: "Recall from loan",
    recallTitle: "Bring him back to his club: the loan ends today. Asks before anything changes",
    recallAgain: "Recall again",
    makePermanent: "Make permanent",
    makePermanentTitle: "Keep him at the club he is on loan to, under contract with it. Asks before anything changes",
    /** Where the Recall button was, once the loan ends today: recalled by the editor, or ending today anyway. */
    recalledWaiting: "Recalled · return pending",
    endsTodayWaiting: "Ends today · return pending",
    pendingTitle: (parent: string) =>
      `Today is the last day of the loan: continue one day in the game and he is back at ${parent}.`,
    endPassed: (date: string) =>
      `The loan was to end on ${date}, but the game has not brought him back. Recall him again, then continue one day.`,
    /** The loan's terms, as the game's Loan Club tab shows them. */
    loanCanRecall: "Can be recalled",
    loanCanRecallTitle: "Whether his club may recall him in the game. Recall from loan here works either way",
    loanCanTerminate: "Can be ended early",
    loanCupMatches: "Plays in cup matches",
    loanAgainstClub: "Plays against his club",
    loanOptionFee: "Option to buy",
    loanOptionFeeTitle: "The fee for which the club he is on loan at may sign him for good",
    loanMonthlyFee: "Monthly fee",
    loanMonthlyFeeTitle: "What the club he is on loan at pays his club for each month he plays",
    loanUnusedFee: "Monthly fee if unused",
    loanUnusedFeeTitle: "What the club he is on loan at pays his club for each month he is not used",
    /** What a clause depends on, by kind: goals, assists, league games, matches, years or a percentage. */
    clauseCondition: (kind: number, value: number) => {
      switch (kind) {
        case 10:
          return value === 1 ? "1 goal" : `${value} goals`;
        case 40:
          return value === 1 ? "1 assist" : `${value} assists`;
        case 41:
          return `${value} goals and assists`;
        case 19:
          return value === 1 ? "1 international appearance" : `${value} international appearances`;
        case 11:
        case 13:
        case 25:
        case 26:
          return value === 1 ? "1 league game" : `${value} league games`;
        case 22:
        case 29:
          return value === 1 ? "1 year" : `${value} years`;
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value}%`;
        default:
          return String(value);
      }
    },
    /** When a release clause expires: on `date`, or, with the contract's start not known, `days` after it. */
    clauseExpires: (date: string) => `expires ${date}`,
    clauseExpiresAfter: (days: number) =>
      days === 1 ? "expires 1 day after signing" : `expires ${format(days)} days after signing`,
    /** A sell-on clause on the profit: its percentage of what the selling club makes over the amount. */
    clauseProfitShare: (percent: string, amount: string) => `${percent} of the profit over ${amount}`,
    /** The wage a clause gives from then on. */
    clauseWage: (amount: string) => `${amount} a week`,
    moraleTitle: "The game shows morale as the player's overall happiness: content at 10, slightly happy at 11, extremely happy at 15 and 20",
    /** Hover text of jadedness, which the profile shows as stored. */
    jadednessTitle: "How worn out the player is by playing, which rest takes away: -500 is fully rested, and the higher it is, the more he needs a rest",
    noInjuries: "No injuries",
    /** The name of an injury the game gave none for. */
    unknownInjury: "Unknown injury",
    /** Under the name of an injury: when it began, and when he is expected back (`dates`: one date, or a range). */
    injuryStarted: (date: string) => `Started ${date}`,
    injuryBack: (dates: string) => `Expected back ${dates}`,
    /** Heals every injury of the player at once. */
    heal: "Heal",
    healTitle: "Heal every injury of this player in the game",
    noBans: "No bans",
    /** A ban: how many matches the player still has to miss, and under it when it began. */
    banMatches: (matches: number) => (matches === 1 ? "1 match" : `${format(matches)} matches`),
    banStarted: (date: string) => `From ${date}`,
    /** Lifts every ban of the player at once. */
    liftBans: "Lift",
    liftBansTitle: "Lift every ban of this player in the game",

    // Above the attributes, while the profile is read
    /** Sets every attribute of the player to its best at once. */
    maxAttributes: "Max attributes",
    maxAttributesTitle: "Set every attribute of this player to its best: 20, and 1 for injury proneness and dirtiness",
    /** What Max attributes wrote, beside the button that takes it back; then what that undid. */
    maxAttributesDone: (count: number) =>
      count === 0 ? "Every attribute is at its best already" : `${changeCount(count)} written`,
    maxAttributesUndone: (count: number) => (count === 0 ? "Nothing was undone" : `Undid ${changeCount(count)}`),
    undoMax: "Undo",
    undoMaxTitle: "Write his old attributes back to the game",
    /** Freezing his attributes, while the game can be written to, and what that does. */
    freezeAttributes: "Freeze attributes",
    freezeAttributesNote:
      "While the app is open and connected, his attributes do not get worse: what the game takes is put back, and " +
      "improvements still count. The app remembers this for this save, and freezes them again when it connects to it.",
    /** The same for a member of staff, who has no injury proneness or dirtiness. */
    maxStaffAttributesTitle: "Set every attribute of this member of staff to its best: 20",
    undoMaxStaffTitle: "Write the old attributes back to the game",
    freezeStaffAttributesNote:
      "While the app is open and connected, their attributes do not get worse: what the game takes is put back, and " +
      "improvements still count. The app remembers this for this save, and freezes them again when it connects to it.",
    /** Freezing his energy and match sharpness, under them in the Medical group, and what that does. */
    freezeFitness: "Freeze energy and sharpness",
    freezeFitnessNote:
      "While the app is open and connected, his energy and match sharpness do not go down: what the game takes is put " +
      "back, and gains still count, so at 100% he stays there. The app remembers this for this save.",
    /** Freezing his position ratings: the box under the pitch, and the (i) after it, which says what that does. */
    freezePositions: "Freeze",
    freezePositionsInfo: "What does freezing positions do?",
    freezePositionsNote:
      "While the app is open and connected, his position ratings stay as they are: he does not learn a new position, " +
      "and his ratings neither rise nor drop. The app remembers this for this save.",

    // Staff
    /** Badge on the manager the user controls. */
    you: "You",
    youTitle: "The manager you control in this save",
    id: "ID",
    job: "Job",
    /** Giving a member of staff another job at their club, under the job in the contract. */
    changeJob: "Change job",
    changeJobTitle: "Give this member of staff another job at their club in the game",
    newJob: "New job",
    applyJob: "Apply",
    cancelJob: "Cancel",
    unemployed: "Unemployed",
    coaching: "Coaching",
    knowledge: "Knowledge",
    medical: "Medical",
    /** A coaching job held by someone who still plays. */
    playerCoach: (job: string) => `${job} (player-coach)`,
    unknownJob: (code: number) => `Job ${code}`,
  },

  /** The player list: search, filter bar and columns. */
  playerList: {
    /** The entry in the sidebar. */
    nav: "Players",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} players`,
    search: "Search players by name or UID",
    /**
     * The line beside the search box. `sorted` is the order a column header was clicked for, or null while the
     * list is in its default order (best current ability first); its `by` is a name from `sortNames`.
     */
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} players`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · showing the top ${shown} by current ability`
        : `${count} · showing the first ${shown} by ${sorted.by}, ${sorted.ascending ? "ascending" : "descending"}`;
    },
    /** The message under an empty table; `filtered` is whether any filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "No players match these filters." : "No players found.";
      }
      return filtered ? `No players match “${query}” with these filters.` : `No players match “${query}”.`;
    },
    columns: {
      name: "Name",
      age: "Age",
      positions: "Positions",
      nation: "Nation",
      club: "Club",
      contractExpires: "Contract",
      born: "Born",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    } satisfies Record<PlayerSort | "positions" | "born" | "uid", string>,
    /** Hover text of a column header that sorts the list; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `Sort by ${by}`,
    /** The name of each sortable column, as the summary line and the hover text of a header say it. */
    sortNames: {
      currentAbility: "current ability",
      potentialAbility: "potential ability",
      age: "age",
      name: "name",
      nation: "nation",
      club: "club",
      contractExpires: "contract end",
    } satisfies Record<PlayerSort, string>,
    /** The filters; the staff list has those that are not about players too (see FilterBar.tsx). */
    filters: {
      /** The button that shows or hides the filters. */
      toggle: "Filters",
      /** Its name for assistive technology while `count` of the filters are in effect. */
      toggleActive: (count: number) => `Filters, ${count} active`,
      clear: "Clear",
      /** The entry of the position select that is no filter. */
      any: "Any",
      position: "Position",
      /** Whom the list shows: the select's name, and its choices after `any`. */
      gender: "Gender",
      men: "Men",
      women: "Women",
      age: "Age",
      minAge: "Minimum age",
      maxAge: "Maximum age",
      /** The hint in an empty age input. */
      minPlaceholder: "Min",
      maxPlaceholder: "Max",
      minCurrentAbility: "Min CA",
      minCurrentAbilityTitle: "Minimum current ability",
      minPotentialAbility: "Min PA",
      minPotentialAbilityTitle: "Minimum potential ability",
      /** The hint in an empty ability input: what it accepts. */
      abilityPlaceholder: "1–200",
      nation: "Nation",
      club: "Club",
      freeAgentsOnly: "Free agents only",
      contractEndsBy: "Contract ends by",
      transferListedOnly: "Transfer listed only",
      loanListedOnly: "Loan listed only",
      /** Bounds on attributes, a row each, under the other filters; the staff list has them too. */
      attributes: {
        heading: "Attributes",
        /** The select of a row, for assistive technology, and its entry before an attribute is picked. */
        attribute: "Attribute",
        pick: "Pick an attribute",
        /** The two inputs of a row, for assistive technology; `name` is the attribute, "" before one is picked. */
        min: (name: string) => (name ? `Least ${name}` : "Least"),
        max: (name: string) => (name ? `Most ${name}` : "Most"),
        add: "Add attribute",
        /** The button that takes a row away, for assistive technology and as its hover text. */
        remove: (name: string) => (name ? `Remove ${name}` : "Remove this row"),
      },
      /** Saving the filters in effect, and the sort, under a name of the user's own; the names stay as typed. */
      saved: {
        /** The button that starts saving, and its hover text. */
        save: "Save",
        saveTitle: "Save the filters and the sort in effect under a name",
        /** The name input, for assistive technology, and the hint in it while it is empty. */
        name: "Name of the saved filter",
        namePlaceholder: "Filter name",
        ok: "OK",
        cancel: "Cancel",
        /** The select of the saved filters: its name, and what it shows while none is the one in effect. */
        select: "Saved filters",
        delete: "Delete",
        /** The name and hover text of Delete; `name` is the saved filter's. */
        deleteTitle: (name: string) => `Delete the saved filter: ${name}`,
        /** The question when the name is taken; `name` is the one typed. */
        replaceQuestion: (name: string) => `A saved filter named “${name}” already exists. Replace it?`,
        replace: "Replace",
        /** When the name is a new one and `max` filters are saved already. */
        full: (max: number) =>
          `Up to ${max} filters can be saved. Delete one first, or use the name of a saved filter to replace it.`,
      },
    },
  },

  /** The staff list. */
  staffList: {
    /** The entry in the sidebar. */
    nav: "Staff",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} staff`,
    search: "Search staff by name or ID",
    /**
     * The line beside the search box. `sorted` is the order a column header was clicked for, or null while the
     * list is in its default order (the human manager first, then the best current ability); its `by` is a name from
     * `sortNames`.
     */
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} staff`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · showing the top ${shown} by current ability`
        : `${count} · showing the first ${shown} by ${sorted.by}, ${sorted.ascending ? "ascending" : "descending"}`;
    },
    /** The message under an empty table; `filtered` is whether any filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "No staff match these filters." : "No staff found.";
      }
      return filtered ? `No staff match “${query}” with these filters.` : `No staff match “${query}”.`;
    },
    columns: {
      name: "Name",
      age: "Age",
      job: "Job",
      club: "Club",
      nation: "Nation",
      born: "Born",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    } satisfies Record<StaffSort | "job" | "born" | "id", string>,
    /** Hover text of a column header that sorts the list; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `Sort by ${by}`,
    /** The name of each sortable column, as the summary line and the hover text of a header say it. */
    sortNames: {
      currentAbility: "current ability",
      potentialAbility: "potential ability",
      age: "age",
      name: "name",
      nation: "nation",
      club: "club",
    } satisfies Record<StaffSort, string>,
    /** The filters only the staff list has; the others are the player list's (`playerList.filters`). */
    filters: {
      job: "Job",
      /** The entry of the job select that is no filter. */
      anyJob: "Any",
      unemployedOnly: "Unemployed only",
    },
  },

  /** The club profile: what the player and staff panels do not have. */
  clubProfile: {
    // Header
    womensClub: "Women's club",
    /** "Founded 1882", in the line under the name. */
    founded: (year: number) => `Founded ${year}`,
    reputationShort: "REP",
    reputationTitle: "Reputation",

    // The tabs under the header: what the club has, and its squad (see `squad`).
    /** The name of the tabs for assistive technology. */
    tabsLabel: "Club sections",
    tabs: { overview: "Overview", squad: "Squad", stadium: "Stadium" },
    /** Hover text of the Squad tab while the club is edited: its values are on the Overview. */
    squadLocked: "Finish editing to open the squad",

    facilities: "Facilities",

    // Supporters
    supporters: "Supporters",
    supporterMix: "Supporter mix",
    /** A share of the supporters; `value` is already a percentage (35 for 35%). */
    percent: (value: number) => `${percents.format(value)}%`,
    /** Hover text of a segment of the supporter-mix bar. */
    mixTooltip: (kind: string, percent: string) => `${kind} · ${percent}`,

    // Finances
    finances: "Finances",
    balance: "Balance",
    transferBudget: "Transfer budget",
    wageBudget: "Wage budget (spending)",
    totalWageBudget: "Total wage budget",
    ticketPrice: "Average ticket price",
    /** Under the labels of the two wage budgets, which are amounts per week. */
    perWeek: "per week",
    /** Clubs outside the leagues being played have no finance record in memory. */
    noFinances: "FM keeps finances only for clubs in the leagues being played.",
    /** Freezing the club's money, while the game can be written to, and what that does. */
    freeze: "Freeze money",
    freezeNote:
      "While the app is open and connected, the balance does not go down: what the game takes is put back, and " +
      "income still counts. The app remembers this for this save, and freezes it again when it connects to it.",

    // Stadium
    stadium: "Stadium",
    capacity: "Capacity",
    seating: "Seated",
    used: "In use",
    /** The capacity in use when the game does not limit it (stored as 0). */
    usedAll: "All of it",
    usedTitle: "The part of the capacity the game lets in, when it limits it (for example while seats are closed); 0 means all of it",
    expansion: "Can grow to",
    /** When the layout of this build does not know where the stadium is, or the club's stadium did not check out. */
    noStadium: "The stadium could not be read for this club.",
    /** Its name, which can be changed in place: in the block the game gave the old one. */
    stadiumName: "Name",
    rename: "Rename",
    renameTitle: "Give the stadium another name; it is written at once, and Changes can undo it",
    /** The (i) beside the name: how a new name lasts, and that the app has to stay open for it. */
    renameInfoLabel: "How does renaming work?",
    renameInfo:
      "The game keeps no stadium names in its saves: it takes them from its database each time it loads a save. So " +
      "FMLibreEditor remembers the new name for this save, and gives it back within seconds each time the game loads " +
      "it, as long as the app is open and connected. If the game loads the save while the app is closed, it shows its " +
      "own name until the app connects again. To go back to the old name, undo the rename in Changes, or rename the " +
      "stadium back.",
    saveName: "Save",
    renaming: "Saving…",
    cancelRename: "Cancel",
    /** How long the name being typed is, in bytes of UTF-8, and how long it may be. */
    nameLength: (bytes: number, min: number, max: number) =>
      min <= 1
        ? `${bytes} of at most ${max} characters (an accented letter counts as two)`
        : `${bytes} characters: from ${min} to ${max}, to fit where the game keeps the name (an accented letter counts as two)`,
    /** Instead of Rename, when other things in the game hold the same name. */
    nameShared: (holders: number) =>
      `${holders} things in the game share this name, so it cannot be changed for the stadium alone`,

    // Club info
    info: "Club info",
    seasonTickets: "Season tickets",
    socialMedia: "Social media followers",
  },

  /** The club list, with the sidebar entry and the status-line count that go with it. */
  clubList: {
    /** The entry in the sidebar. */
    nav: "Clubs",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} clubs`,
    search: "Search clubs by name or UID",
    summary: (total: number, shown: number) =>
      total > shown
        ? `${format(total)} clubs · showing the top ${shown} by reputation`
        : `${format(total)} clubs`,
    /** The message under an empty table; `filtered` is whether a filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "No clubs match this filter." : "No clubs found.";
      }
      return filtered ? `No clubs match “${query}” with this filter.` : `No clubs match “${query}”.`;
    },
    /** The small tag on a women's club. */
    women: "Women",
    columns: {
      name: "Name",
      reputation: "Reputation",
      founded: "Founded",
      uid: "UID",
    },
    filters: {
      /** The name of the select, which has no label of its own. */
      kind: "Clubs to show",
      all: "All clubs",
      men: "Men's clubs",
      women: "Women's clubs",
    },
  },

  /** The app around the lists: the sidebar, the status line and the connect panel. */
  app: {
    /** The small line under the name in the sidebar. */
    stage: "beta",
    /** The settings menu at the right of the masthead: its name, and the headings of its two lists. */
    settingsLabel: "Settings",
    languageLabel: "Language",
    currencyLabel: "Currency",

    // The note at the foot of the sidebar; which one shows depends on the connection (see `ConnectionInfo.editable`).
    /** Connected, and the game was opened for writing. */
    noteEditable: "Edits reach the game only when you apply them. Back up your save first.",
    /** Connected, but Windows did not allow writing. */
    noteReadOnly: "Read-only: Windows did not let FMLibreEditor write to the game.",
    /** Read-only because the game is a version FMLibreEditor was not checked with (see `compatibility`). */
    noteUnknownBuild: "Read-only: this version of the game is new to FMLibreEditor.",
    noteNotConnected: "Nothing in the game changes until you edit and apply.",

    // The status line and the busy texts beside it
    notConnected: "Not connected",
    /** Beside the status line in a plain browser, where fixtures stand in for the game. */
    previewTag: "browser preview · sample data",
    /** In place of the game's date when it could not be read, and the note it shows on hover. */
    noDate: "No in-game date",
    noDateTitle:
      "FMLibreEditor could not read the in-game date in this version of the game, so ages are not shown and age " +
      "filters find no one. Check for updates.",
    /** The button that reads the game again, once connected. */
    reload: "Reload data",
    /** The button that looks for the game again, while not connected. */
    refresh: "Refresh",
    detecting: "Looking for Football Manager…",
    connecting: "Reading players, staff and clubs…",
    reloading: "Reloading players, staff and clubs…",

    /**
     * The notice under the masthead once the game has loaded a save, or gone back to its main menu, since the data was
     * read (`SaveChangedNotice`), beside a Reload data button.
     */
    saveChanged: {
      title: "The game's save has changed",
      text:
        "The game has loaded a save, or gone back to its main menu, since FMLibreEditor read it. Until you reload the " +
        "data, it changes nothing in the game and holds nothing frozen: what it shows may belong to another save.",
    },

    /** The notice after connecting to a save in which something was frozen before (`FrozenNotice`). */
    refrozen: {
      title: "Frozen again from last time",
      /** When nothing could be frozen again. */
      waitingTitle: "What was frozen waits for now",
      /** `names` are the players' names, set apart by commas. */
      players: (names: string) => `Attributes: ${names}`,
      staff: (names: string) => `Staff attributes: ${names}`,
      clubs: (names: string) => `Money: ${names}`,
      fitness: (names: string) => `Energy and sharpness: ${names}`,
      positions: (names: string) => `Positions: ${names}`,
      /** `names` are the stadiums' new names, given again. */
      stadiums: (names: string) => `Stadium names: ${names}`,
      /** After the first few names. */
      more: (count: number) => `and ${format(count)} more`,
      /** What was left for later: an update of the game, say. */
      waiting: (count: number) =>
        `${count === 1 ? "1 is" : `${format(count)} are`} remembered but not frozen now: FMLibreEditor cannot write ` +
        "to this version of the game yet.",
      dismiss: "Dismiss",
    },

    /** The (i) beside every box that freezes something: how freezing works, and that the app has to stay open. */
    freezeInfo: {
      label: "How does freezing work?",
      note:
        "Freezing does not change the game for good: every 2 seconds, FMLibreEditor puts back what the game took. So it " +
        "works only while the app is open and connected; close it, and the game changes them again. The app remembers " +
        "what is frozen in this save, and freezes it again the next time it connects to it.",
    },

    /** The panel shown while not connected. */
    connect: {
      title: "Connect to Football Manager 27",
      intro: "FMLibreEditor reads the game's memory while it runs. Start the game and load a save, then connect.",
      notRunning: "Football Manager 27 is not running.",
      /** `error` is the answer of the Rust side, which stays in English. */
      openFailed: (error: string) => `Could not open the game: ${error}`,
      game: "Game",
      gameData: "Game data",
      loaded: "Loaded",
      stillLoading: "Still loading; wait for the main menu",
      process: "Process",
      pid: (pid: number) => `pid ${pid}`,
      several: "Several copies of the game are running; the first one is used.",
      button: "Connect and read players, staff and clubs",

      /** macOS: the bridge FM27 has to load before the app can reach it, and setting it up. */
      bridge: {
        title: "The bridge (macOS)",
        intro:
          "macOS lets no app into another app's memory, so FM27 has to hand its memory over itself. It does once it " +
          "loads FMLibreEditor's bridge: a small library that hooks and changes nothing in the game and gives its " +
          "memory to this app only. A launch option in Steam has FM27 load it.",
        library: "Bridge",
        installed: "Installed",
        missing: "Not installed",
        launchOption: "Launch option",
        set: "Set in Steam",
        notSet: "Not set",
        ready: "Set up. Start FM27 from Steam (quit it and start it again if it is running), load a save, then connect.",
        steamRunning:
          "Steam is running, and keeps the launch options while it does. Quit Steam to have the launch option set " +
          "for you, or enter it in Steam yourself.",
        setUp: "Set up the bridge",
        remove: "Remove the bridge",
        manual: "Or, in Steam, right-click Football Manager 27 › Properties › General › Launch Options, and enter:",
        copy: "Copy",
        copied: "Copied",
      },
    },
  },

  /** The graphics packs the pictures (club logos, faces, flags) come from: their status at the foot of the sidebar. */
  graphics: {
    /** While the app is still reading the packs, which takes a moment after it starts. */
    reading: "Reading graphics packs…",
    /** What the packs hold: "Graphics: 68,131 club logos · 250 flags · 0 faces". */
    summary: ({ clubLogos, flags, faces }: Pick<GraphicsCounts, "clubLogos" | "flags" | "faces">) =>
      `Graphics: ${format(clubLogos)} club ${clubLogos === 1 ? "logo" : "logos"} · ` +
      `${format(flags)} ${flags === 1 ? "flag" : "flags"} · ${format(faces)} ${faces === 1 ? "face" : "faces"}`,
    /** When the app found no pack, and under it where packs go. The folder itself is the hover text of both lines. */
    none: "No graphics packs found",
    noneHint: "Logo and face packs go in the FM27 graphics folder.",
  },

  /**
   * The notice under the masthead when the game is a version FMLibreEditor has no profile for, or some of the checks
   * it makes before writing did not pass (`CompatibilityNotice`).
   */
  compatibility: {
    /** The headline for a version without a profile; `game` as the status line names it. */
    unknownBuild: (game: string) => `FMLibreEditor has not been checked with ${game} yet`,
    unknownBuildText:
      "The game has probably been updated. FMLibreEditor found the game's data and checked it, but it does not " +
      "write to a version it was not tested with until you allow it. A new FMLibreEditor usually follows within days.",
    /** Once Edit anyway was pressed. */
    allowedText: "Editing is on for this session, as far as the checks allow. Keep a backup of your save.",
    /** The headline when checks did not pass on a version the editor knows, and what may help. */
    failedTitle: "Some of the game's data did not check out",
    reloadHint: "If a save was still loading, Reload data checks again.",
    /** The in-game date did not check out: shown apart, as it leaves nothing read-only. */
    noDate: "The in-game date did not check out, so no ages are shown.",
    /** The other checks that did not pass, joined (see `join`), each as `failedCheck` words it. */
    failed: (names: string) => `Left read-only: ${names}.`,
    /** A check that did not pass: its name (see `checks`), and how many of the people or clubs it sampled fit. */
    failedCheck: (name: string, fit: number, sampled: number) => `${name} (${format(fit)} of ${format(sampled)} fit)`,
    /** Joins the names of the checks that did not pass. */
    join: (names: string[]) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`,
    allow: "Edit anyway",
    allowTitle: "Turn editing on until FMLibreEditor is closed or connects again. Back up your save first.",
  },

  /**
   * Copy diagnostics, at the foot of the window and in the notice under the masthead: copies a report of what the app
   * found in the game, in English whatever the language, to paste into a bug report (`CopyDiagnostics`).
   */
  diagnostics: {
    copy: "Copy diagnostics",
    copyTitle: "Copy what FMLibreEditor found in the game, to paste into a bug report. It holds no names or paths.",
    /** Said by the button for a moment once the report is on the clipboard. */
    copied: "Copied",
    failed: (reason: string) => `Could not copy the diagnostics: ${reason}`,
  },

  /** What each check is about (`CheckKey`), as the notice lists the ones that did not pass and the errors name them. */
  checks: {
    gameDate: "the in-game date",
    players: "players' details",
    abilities: "current and potential ability",
    positions: "positions",
    attributes: "attributes",
    personality: "personality",
    liveValues: "energy, match sharpness, jadedness and morale",
    contracts: "contracts",
    teams: "teams",
    staff: "staff",
    clubs: "clubs",
    cohesion: "cohesion with clubs",
  } satisfies Record<CheckKey, string>,

  /** New versions: the notice under the masthead, and the version and Check for updates at the foot of the window. */
  update: {
    /** The notice's headline, and what a check by hand found. */
    available: (version: string) => `FMLibreEditor ${version} is available`,
    youHave: (version: string) => `You have ${version}.`,
    /** Opens the release's page in the browser. */
    download: "Download",
    /** Downloads the new version's installer and runs it, where the app can update itself (see `can_self_update`). */
    install: "Update",
    installTitle: "Download and install the new version; FMLibreEditor closes and opens again with it",
    preparing: "Preparing…",
    /** `percent` is null while the size of the download is not known. */
    downloading: (percent: number | null) => (percent === null ? "Downloading…" : `Downloading… ${percent}%`),
    installing: "Installing: FMLibreEditor closes and opens again with the new version.",
    installFailed: (reason: string) => `Could not update: ${reason}. Download it from its page instead.`,
    notInstallable: "This version cannot be installed from here. Download it from its page instead.",
    /** Hides the notice until the app starts again. */
    later: "Later",
    check: "Check for updates",
    checking: "Checking for updates…",
    upToDate: "You have the latest version.",
    failed: "Could not check for updates.",
  },

  /** Editing a person or a club: the Edit button, the inputs, and the footer under the profile. */
  edit: {
    /** A nation field's value whose name the app has not read: one no one in the lists belongs to. */
    unknownNation: "Unknown nation",
    /** The button in the header of a profile that can be edited. */
    edit: "Edit",
    editTitle: "Change this profile's values in the game",
    /** Why editing did not start: the field table or the values could not be read. */
    startFailed: (reason: string) => `Could not start editing: ${reason}`,
    /** The name of a position's field, e.g. "ST rating"; `position` is its entry in `positions`. */
    positionRating: (position: string) => `${position} rating`,
    /** Hover text of a changed input: the value it started from, as shown. */
    was: (value: string) => `was ${value}`,
    /** Hover text of an input that cannot be applied; `min` and `max` are the values it takes, as shown. */
    invalid: (min: number, max: number) => `Enter a whole number from ${min} to ${max}`,
    /** The same for a date input; `from` and `to` are the earliest and the latest date it takes, as dates are shown. */
    invalidDate: (from: string, to: string) => `Enter a date from ${from} to ${to}`,
    /**
     * The same for an amount of money, in whole units of the chosen currency; `from` and `to` are the least and the
     * most it takes, as amounts are shown.
     */
    invalidMoney: (from: string, to: string) => `Enter a whole amount from ${from} to ${to}`,
    /** The same for a percentage, in whole percent; `from` and `to` are the least and the most it takes, as shown. */
    invalidPercentage: (from: string, to: string) => `Enter a whole percentage from ${from} to ${to}`,
    /** After the input of a percentage: the game shows energy and match sharpness as 0–100%. */
    percent: "%",
    /** The two values of a yes-or-no field, as the lists of changes and the hover text of its checkbox say them. */
    yes: "Yes",
    no: "No",
    /**
     * What an input that may be left empty reads as then, in its hint, the hover text and the lists of changes:
     * "Squad number 20 → none". The profile itself shows a dash for it (`profile.none`).
     */
    none: "none",

    // The footer
    footer: "Editing",
    changes: changeCount,
    /** After the number of changes, while some inputs hold values that cannot be applied. */
    invalidCount: (count: number) => `${count} invalid`,
    /** Opens the list of the changes Apply would write. */
    review: "Review",
    reviewList: "Changes to apply",
    /** Puts the inputs back to the values the game has. */
    discard: "Discard",
    apply: "Apply",
    applying: "Applying…",
    /** Hover text of Apply while an input holds a value that cannot be written. */
    applyBlocked: "Fix the invalid values first",
    /** Leaves edit mode. */
    done: "Done",
    /** Takes the place of the buttons when leaving (Done, close, another row) would lose `count` changes. */
    confirmDiscard: (count: number) => `Discard ${changeCount(count)}?`,
    keepEditing: "Keep editing",

    // After Apply
    applied: (count: number) => `Applied ${changeCount(count)}`,
    /** Every value asked for was the game's already. */
    nothingToChange: "Nothing to change: the game already has these values.",
    /** A change the game refused; `label` is the field's name (see `fieldLabel`) and `reason` the game's answer. */
    refused: (label: string, reason: string) => `${label}: ${reason}`,
    rereadFailed: (reason: string) => `Could not read the values back: ${reason}`,
    dismiss: "Dismiss",
  },

  /** The Changes view: what was written to the game this session. */
  changes: {
    /** The entry in the sidebar. */
    nav: "Changes",
    title: "Changes this session",
    hint: "Newest first. A change can be undone only while the game still holds the value it wrote.",
    /** Under the hint: a change shows in the game only after it has moved on once. */
    continueHint: "The game shows a change once it moves on: press Continue in the game.",
    /** Under a move to another club that was a swap: the player who went the other way. */
    swappedWith: (name: string) => `Swapped with ${name}`,
    /** Under a move that released a player of the new club to make room: that player. */
    released: (name: string) => `${name} released`,
    /** Under a transfer that had a fee: the amount, written out. */
    fee: (amount: string) => `Fee ${amount}`,
    /** Under a recall from loan that took the loan's option to buy away, which its undo writes back. */
    optionRemoved: (amount: string) => `Option to buy (${amount}) taken away`,
    /** What a heal changed, in the place of its values: `count` is how many injuries the player had. */
    healed: (count: number) => (count === 1 ? "Healed 1 injury" : `Healed ${format(count)} injuries`),
    /** The same for lifting bans: `count` is how many bans the player had. */
    lifted: (count: number) => (count === 1 ? "Lifted 1 ban" : `Lifted ${format(count)} bans`),
    /** What keeping a player from retiring changed: the date he was to retire on, or none when only his traits changed. */
    keptPlaying: (date: string | null) => (date === null ? "Will play on" : `Retirement on ${date} prevented`),
    /** The line beside the title; `undone` of the `total` changes were undone. */
    count: (total: number, undone: number) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${undone} undone`;
    },
    empty: "No changes yet. Open a player, a member of staff or a club and choose Edit, or use Mass edit in a list.",
    columns: {
      time: "Time",
      /** The player, member of staff or club the change was made to. */
      name: "Name",
      field: "Field",
      change: "Change",
      status: "Status",
    },
    /** The small tag after a name. */
    kinds: { player: "Player", staff: "Staff", club: "Club" } satisfies Record<Entity, string>,
    /** Hover text of a change of an attribute: the values as stored; `change` is from `valueChange`. */
    stored: (change: string) => `stored ${change}`,
    undone: (time: string) => `Undone at ${time}`,
    undo: "Undo",
    /** Hover text of Undo; `label` is the field's name. */
    undoTitle: (label: string) => `Write the old value of ${label} back to the game`,
    /** The small tag after the fields a mass edit changed: a mass edit is one row of the list. */
    batch: "Mass edit",
    /** Under those fields: how many changes the mass edit made, and how many of them are not undone. */
    batchCount: (total: number, remaining: number) =>
      remaining === 0
        ? `${changeCount(total)} · all undone`
        : `${changeCount(total)} · ${format(remaining)} not undone`,
    /** Opens the list of the changes of a mass edit under its row, and closes it again. */
    showChanges: "Show changes",
    hideChanges: "Hide changes",
    /** Undoes the whole mass edit. */
    undoBatch: "Undo mass edit",
    /** Hover text of Undo mass edit; `remaining` is how many of its changes are not undone yet. */
    undoBatchTitle: (remaining: number) =>
      `Write the old values of this mass edit back to the game (${format(remaining)} still in place)`,

    // Pages: the list, and the changes of a mass edit that is open, are shown a page at a time.
    /** The names of the two groups of buttons for assistive technology. */
    pages: "Pages of the list",
    batchPages: "Pages of the changes of this mass edit",
    previous: "Previous",
    next: "Next",
    /** Between the buttons: the rows on show and how many there are, e.g. "101–200 of 450". */
    range: (first: number, last: number, total: number) => `${format(first)}–${format(last)} of ${format(total)}`,
  },

  /** Exporting players or clubs to a file: the button in the toolbar of the player and club lists and its dialog. */
  export: {
    button: "Export",
    buttonTitle: {
      player: "Write the players the list shows to a CSV or JSON file, for a spreadsheet or a script",
      staff: "Write the staff the list shows to a CSV or JSON file, for a spreadsheet or a script",
      club: "Write the clubs the list shows to a CSV or JSON file, for a spreadsheet or a script",
    } satisfies Record<ExportEntity, string>,
    title: { player: "Export players", staff: "Export staff", club: "Export clubs" } satisfies Record<
      ExportEntity,
      string
    >,
    /** What the export covers: everything the list's search and filters select, in its order. */
    scope: (entity: ExportEntity, count: number) =>
      count === 0
        ? `No ${entity === "staff" ? "member of staff" : entity} matches the search and the filters.`
        : `${entityCount[entity](count)}: what the list's search and filters select, in its order.`,
    formatLabel: "Format",
    formats: {
      csv: "CSV, comma-separated",
      csvSemicolon: "CSV, semicolon-separated",
      json: "JSON",
    } satisfies Record<ExportFormat, string>,
    formatHints: {
      csv: "For most spreadsheets and scripts",
      csvSemicolon: "For Excel where decimals are written with a comma: in Turkish, Spanish or German, say",
      json: {
        player: "For scripts: the positions, attributes and personality as objects of their own",
        staff: "For scripts: the attributes, personality and contract as objects of their own",
        club: "For scripts: the supporters, facilities, stadium and finances as objects of their own",
      } satisfies Record<ExportEntity, string>,
    },
    contents: {
      player:
        "Each player's abilities, positions and position ratings, attributes on the 1–20 scale (the hidden ones " +
        "too), personality, reputation, caps, and contract with its clauses, with the in-game date. Money is in " +
        "pounds, as the game keeps it. Nothing in the game changes.",
      staff:
        "Each member of staff's job and employer, abilities, attributes on the 1–20 scale, personality, reputation, " +
        "and contract (wage and dates), with the in-game date. Money is in pounds, as the game keeps it. Nothing in " +
        "the game changes.",
      club:
        "Each club's reputation, founding year, season tickets, social media followers, supporter mix and traits, " +
        "facilities, stadium, and finances: balance, transfer budget, weekly wage spend and wage budget, and ticket " +
        "price, with the in-game date. FM keeps finances only for clubs in the leagues being played. Money is in " +
        "pounds, as the game keeps it. Nothing in the game changes.",
    } satisfies Record<ExportEntity, string>,
    export: "Export",
    exporting: "Exporting…",
    /** After the export: what was written, and where. */
    done: (entity: ExportEntity, count: number, file: string) => `Exported ${entityCount[entity](count)} to ${file}`,
    folder: (folder: string) => `in ${folder}`,
    skipped: (entity: ExportEntity, count: number) => {
      const pronoun = count !== 1 || entity === "staff" ? "they were" : entity === "player" ? "he was" : "it was";
      return (
        `${entityCount[entity](count)} changed in the game while ${pronoun} read, and ` +
        `${count === 1 ? "was" : "were"} left out.`
      );
    },
    open: "Open",
    openTitle: "Open the file in the app your system opens it with",
    show: "Show in folder",
    showTitle: "Show the file in its folder",
    close: "Close",
  },

  /** Mass editing: the button in the toolbar of a list and the dialog it opens. */
  massEdit: {
    /** The button in the toolbar of the player, staff and club lists. */
    button: "Mass edit",
    buttonTitle: "Change values of everything the list shows, with a preview first",
    title: {
      player: "Mass edit players",
      staff: "Mass edit staff",
      club: "Mass edit clubs",
    } satisfies Record<Entity, string>,

    // What it applies to
    /** `total` is the list's: the search and the filters of the list select them. */
    scope: (entity: Entity, total: number) =>
      `The ${entityCount[entity](total)} the list shows now (search and filters)`,
    /** After the scope, when the list shows only the first `shown` rows of its `total`. */
    scopeAll: (shown: number) => `That is every match, not only the first ${format(shown)} rows on screen.`,
    scopeNone: (entity: Entity) =>
      `No ${entityNouns[entity]} match the search and filters, so there is nothing to change.`,
    /** `limit` is the most one mass edit takes. */
    scopeTooMany: (entity: Entity, total: number, limit: number) =>
      `The ${entityCount[entity](total)} the list shows are more than one mass edit takes (${format(limit)}). ` +
      "Narrow the search or the filters first.",
    loadingFields: "Reading the fields…",
    fieldsFailed: (reason: string) => `Could not read the fields: ${reason}`,

    // The fields to change
    /** The groups of the field select, in the order the dialog lists them. */
    groups: {
      ability: "Ability",
      technical: "Technical attributes",
      mental: "Mental attributes",
      physical: "Physical attributes",
      goalkeeping: "Goalkeeping attributes",
      hidden: "Hidden attributes",
      feet: "Feet",
      coaching: "Coaching attributes",
      knowledge: "Knowledge attributes",
      medical: "Medical attributes",
      positions: "Positions",
      personality: "Personality",
      reputation: "Reputation",
      international: "International",
      contract: "Contract",
      facilities: "Facilities",
      finances: "Finances",
      stadium: "Stadium",
      traits: "Traits",
      /** A player's energy, match sharpness and morale: the Medical group of his profile. */
      health: "Medical",
      /** Whatever the other groups do not have, e.g. a player's height. */
      other: "Other",
    },
    fieldsLabel: "Fields to change",
    /** The name of a row of the dialog for assistive technology; `position` counts from 1. */
    row: (position: number) => `Change ${position}`,
    field: "Field",
    operation: "Operation",
    operations: { set: "Set to", add: "Add", scale: "Scale to %" } satisfies Record<MassOperationKind["op"], string>,
    /** The name of the value input, by operation. */
    values: { set: "Value", add: "Amount", scale: "Percent" } satisfies Record<MassOperationKind["op"], string>,
    /** Hover text of the amount of an Add. */
    addTitle: "Added to every value as shown; a negative number takes away",
    /** The same for a percentage: the amount is in percentage points, not a percent of the value (that is Scale). */
    addPointsTitle: "Percentage points added to every value (70% plus 10 is 80%); a negative number takes away",
    /** The hint in an empty value input: what it takes. */
    rangeHint: (min: number, max: number) => `${format(min)}–${format(max)}`,
    /** The same for an amount, which may be negative: up to `max` either way. */
    amountHint: (max: number) => `±${format(max)}`,
    /** After the input of a Scale: the number is a percent of the value the game has now. */
    ofCurrent: "% of current",
    percentTitle: "A percent of the current value: 100 keeps it, 110 raises it by a tenth, 50 halves it",
    /** Hover text of an amount that cannot be applied; `min` and `max` are what it takes. */
    invalidAdd: (min: number, max: number) => `Enter a whole number from ${format(min)} to ${format(max)}`,
    invalidPercent: (min: number, max: number) => `Enter a whole percent from ${min} to ${max}`,
    /** A date cannot be added to or scaled. */
    dateSetOnly: "A date can only be set",
    addField: "Add a field",
    /** Hover text of Add a field when the rows are full; `max` is how many fields one mass edit changes. */
    addFieldFull: (max: number) => `A mass edit changes up to ${max} fields`,
    remove: "Remove this field",
    /** Hover text of Remove on the only row. */
    removeLast: "A mass edit needs at least one field",

    // The preview
    preview: "Preview",
    previewing: "Previewing…",
    /** Beside Preview while it cannot be pressed. */
    previewBlocked: "Fill in every field with a valid value to preview",
    /** "312 changes for 140 of 237 players · 97 already have these values · 12 values left alone". */
    summary: (entity: Entity, preview: MassPreview) =>
      [
        preview.changes === 0
          ? "No changes"
          : `${changeCount(preview.changes)} for ${format(preview.targets - preview.unchanged)} of ` +
            entityCount[entity](preview.targets),
        preview.unchanged > 0 &&
          (preview.unchanged === 1
            ? "1 already has these values"
            : `${format(preview.unchanged)} already have these values`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Changes the mass edit would make",
    columns: { name: "Name", field: "Field", change: "Change", reason: "Reason" },
    /** Under a table or a list that shows only the first rows; `count` is how many more there are. */
    more: (count: number) => `and ${format(count)} more`,
    /** The line that opens the list of the values left alone. */
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Values the mass edit leaves alone",

    // Apply and undo
    apply: "Apply",
    applying: "Applying…",
    /** Hover text of Apply; `changes` is how many values it writes. */
    applyTitle: (changes: number) => `Write ${changeCount(changes)} to the game`,
    applyFirst: "Preview the mass edit first",
    applyNothing: "The preview has no changes to write",
    /** Nothing changes in the game until Apply. */
    hint: "Nothing changes in the game until you apply.",
    applied: (count: number) => (count === 0 ? "No changes were written" : `Applied ${changeCount(count)}`),
    /** A change the game refused: who, which field (see `fieldLabel`) and the game's answer. */
    failure: (name: string, label: string, reason: string) => `${name} · ${label}: ${reason}`,
    undo: "Undo this mass edit",
    undoing: "Undoing…",
    undoTitle: "Write the old values of this mass edit back to the game",
    undone: (count: number) => (count === 0 ? "Nothing was undone" : `Undid ${changeCount(count)}`),
    /** A change an undo could not take back: `who` names the person and the field, or the change by its number. */
    undoFailure: (who: string, reason: string) => `${who}: ${reason}`,
    changeNumber: (id: number) => `Change ${id}`,
    close: "Close",
  },

  /** Comparing players: the button in a player's profile, the tray under the player list and the dialog. */
  comparison: {
    /** The button in the header of a player's profile. */
    compare: "Compare",
    /** Hover text of that button while the player is not in the comparison, and while they are. */
    add: "Add to comparison",
    remove: "Remove from comparison",
    /** Hover text of the button while the comparison is full and cannot take this player; `max` is its size. */
    full: (max: number) => `A comparison holds up to ${max} players. Remove one to add this player.`,

    // The tray under the player list
    trayLabel: "Players to compare",
    /** The name and hover text of the × on a player's chip. */
    removePlayer: (name: string) => `Remove from comparison: ${name}`,
    clear: "Clear",
    /** The button that opens the dialog; `count` is how many players are picked. */
    open: (count: number) => `Compare (${count})`,

    // The dialog
    title: "Comparison",
    /** Under the title: what the highlight in the table means. */
    hint: "The best value in each row is highlighted: the highest, or the lowest where lower is better.",
    /** What the dialog says when fewer than two players are picked. */
    tooFew: "Add at least two players to compare them.",
    loading: "Loading the players…",
    tableLabel: "Values of the compared players",
    /** Said after the highlighted value of a row, for assistive technology. */
    highest: "highest",
    lowest: "lowest",
    /** The heading of the rows with the positions, height, reputation and contract. */
    profile: "Profile",
    close: "Close",
  },

  /**
   * Moving a player to another club, or swapping him with a player of another club: the button in his profile and the
   * dialog it opens.
   */
  move: {
    /** The button in the header of a player's profile. */
    button: "Transfer",
    buttonTitle: "Transfer this player to another club in the game, for a fee if you like",

    // The dialog
    title: "Transfer",
    /** The club the player is at, and the club he moves to (or, in a swap, goes to). */
    from: "From",
    to: "To",

    // The switch at the top of the dialog: a move to a club, or a swap with one of its players.
    /** Its name for assistive technology. */
    modeLabel: "Transfer or swap",
    modeMove: "Transfer to a club",
    modeSwap: "Swap with a player",

    // Choosing the club
    /** The name of the search box, and of the list of clubs under it, for assistive technology. */
    searchLabel: "Search for the club to transfer to",
    resultsLabel: "Clubs found",
    searching: "Searching clubs…",
    searchFailed: (reason: string) => `Could not search the clubs: ${reason}`,
    /** Under the list when the search found more clubs than it lists; `count` is how many more. */
    more: (count: number) => `and ${format(count)} more; type to narrow the search`,
    /** Takes the place of the search once a club is picked: the button that brings it back. */
    change: "Choose another club",

    // The fee
    feeHeading: "Fee",
    fee: "Transfer fee",
    /** Under the fee input while it can be sent, and while it cannot. */
    feeHint: "Leave it empty for a free transfer",
    /** `max` is the most a fee can be, as amounts are shown. */
    feeInvalid: (max: string) => `Enter a whole amount, from 0 to ${max}`,
    /**
     * What the fee does to the clubs' money, a line each in the plan. `fee` is the amount, `balance` and `budget` a
     * change written out ("£9,492,232 → £10,726,799"); `budget` is null when the club has no transfer budget set.
     */
    pays: (club: string, fee: string, balance: string, budget: string | null) =>
      `${club} pays ${fee}: balance ${balance}${budget === null ? "" : `, transfer budget ${budget}`}`,
    receives: (club: string, fee: string, balance: string) => `${club} receives ${fee}: balance ${balance}`,
    /** For a club outside the leagues being played, which the game keeps no finances for. */
    noFinances: (club: string) => `${club} has no finances in the game: its money stays as it is`,

    // The contract
    /** Under an input that cannot be sent. */
    wageInvalid: "Enter a whole amount, 0 or more",
    expiresInvalid: "Enter a date",

    // What the dialog says about the move itself
    chooseClub: "Choose the club to transfer the player to.",
    fixTerms: "Fix the fee or the contract values first.",
    checking: "Checking the transfer…",
    /** The move can be made; `from` and `to` are the names of the clubs. */
    route: (from: string, to: string) => `${from} → ${to}`,
    doesHeading: "What the transfer does",
    /** What the game does to the player, one line each. */
    does: [
      "Joins the senior team of the new club",
      "Contract dated from the game's date; squad number cleared",
      "Comes off the transfer and loan lists",
      "Wage and contract end change only if you set new ones",
      "The fee comes out of the buying club's balance and transfer budget, and goes into the selling club's balance",
      "Any captaincy at the old club is left empty",
      "The game's transfer history does not list it yet",
      "Listed under Changes, where one undo takes back the transfer and the fee",
    ],

    // A club whose squad list is full: the box that takes the place of the refusal and offers to make room, by
    // releasing one of its players in the same transfer, or by making it a swap with that player.
    /** The first line; `club` is the club picked. */
    noRoom: (club: string) => `${club} has no room in its squad.`,
    /** The name of the (i) button after the first line, for assistive technology, and the note it shows. */
    noRoomInfoLabel: "Why?",
    noRoomInfo:
      "The editor makes a full squad list bigger where it can, but it cannot make this one bigger: a player has to " +
      "leave to make room.",
    /** The second line, which also names the choices under it; `player` is the player transferred. */
    noRoomNeed: (player: string, club: string) => `For ${player} to join, a player has to leave ${club}.`,
    /** The first choice: a player of the club picked from a list, who becomes a free agent. */
    releaseChoice: "Release:",
    releasePickLabel: "Player to release",
    releaseOutcome: "→ becomes a free agent",
    /** After a player's name in that list: what makes him a worse choice. */
    injuredTag: "injured",
    captainTag: "captain",
    /** The second choice, which turns the dialog into a swap with the player picked; `club` is the player's club. */
    swapChoice: "Make it a swap:",
    swapChoiceOutcome: (club: string) => `this player goes to ${club}`,
    /** The button of the foot while a player is released; `name` is that player. */
    moveAndRelease: (name: string) => `Transfer and release ${name}`,
    /** What a transfer that makes room does, one line each, in the place of `does`. */
    makeRoomDoes: [
      "Joins the senior team of the new club, in the place of the player released",
      "The player released leaves every team of that club, and their contract ends: a free agent",
      "Contract dated from the game's date; squad number cleared",
      "Comes off the transfer and loan lists",
      "Wage and contract end change only if you set new ones",
      "The fee comes out of the buying club's balance and transfer budget, and goes into the selling club's balance",
      "Any captaincy either of them held at the club they leave is left empty",
      "The game's transfer history does not list it yet",
      "Listed under Changes as one change, where one undo takes back the transfer, the release and the fee",
    ],

    // Swapping with a player of the club instead: the title, and the section that picks the player (the club is
    // chosen as for a move).
    swapTitle: "Swap with a player",
    /** The player who goes the other way. */
    swapWith: "Swap with",
    /** The name of the search box of the club's players, its hint, and the name of the list under it. */
    playerSearchLabel: "Search for the player to swap with",
    playerSearch: "Search this club's players by name",
    playersLabel: "Players found",
    playersSearching: "Searching players…",
    playersSearchFailed: (reason: string) => `Could not search the players: ${reason}`,
    /** Under the list when it is empty: `query` is what was typed. */
    playersEmpty: (query: string) =>
      query === "" ? "This club has no players." : `No player of this club matches “${query}”.`,
    /** Takes the place of the list once a player is picked: the button that brings it back. */
    changePlayer: "Choose another player",

    // What the dialog says about the swap
    /** A swap has no contract terms to set. */
    swapContract: "Each player keeps their own contract; wages and contract ends do not change.",
    // Moving a member of staff, who has neither a fee nor terms to set, and no swap.
    staffButtonTitle: "Move this member of staff to another club in the game",
    staffChooseClub: "Choose the club to move this member of staff to.",
    staffContract: "Keeps the job, the wage and the contract end; the contract is dated from the game's date.",
    /** The select of the job they take at the club, and its first choice for one who has no job yet. */
    staffJob: "Job",
    staffJobChoose: "Choose a job…",
    /** After the name of their own job in that select. */
    staffJobKept: (job: string) => `${job} (keeps it)`,
    /** In the place of `staffContract` when another job is chosen. */
    staffNewJob: "Takes the new job, and keeps the wage and the contract end; the contract is dated from the game's date.",
    staffDoes: [
      "Joins the new club where the job is: its medical, coaching or scouting department, or as its director of " +
        "football or manager, which a club with one already does not take",
      "Same wage and contract end; the contract is dated from the game's date",
      "A manager who leaves a team leaves its place empty, for the club to fill; the board is left to the game",
      "Listed under Changes, where it can be undone",
    ],
    // Signing a member of staff who has no club: the same dialog with a job to choose and a contract the editor makes.
    staffSignButtonTitle: "Sign this member of staff, who has no club, for a club in the game",
    staffSignTitle: "Sign a member of staff",
    staffSignChooseClub: "Choose the club to sign them for.",
    staffSignChooseJob: "Choose the job they take at the club.",
    /** Under the contract's inputs. */
    staffSignTerms:
      "Leave them empty for the wage of the club's member of staff whose job is most like theirs, and a contract to " +
      "the end of next season.",
    /** The signing can be made: `to` is the club. */
    staffSignRoute: (to: string) => `No club → ${to}`,
    /** The contract the editor makes: `wage` and `expires` written out. */
    staffSignContract: (wage: string, expires: string) => `New contract: ${wage} a week until ${expires}`,
    staffSignDoes: [
      "Joins the club where the job is: its department, made bigger when full, or as its director of football or " +
        "manager, when it has none",
      "A new contract from the game's date, in one of the game's own free contract slots, as the game makes one",
      "Modelled on the contract of the club's member of staff with the same job (else in the same department, else " +
        "any) nearest their ability",
      "Your wage and contract end, or that contract's wage and the end of next season; no clauses or bonuses",
      "Listed under Changes, where one undo takes it all back",
    ],
    swapChooseClub: "Choose the club of the player to swap with.",
    swapChoosePlayer: "Choose the player to swap with.",
    swapChecking: "Checking the swap…",
    /** The swap can be made: who goes where, a line each. `from` is the club of the player, `to` that of the other. */
    swapRoute: (player: string, from: string, to: string, other: string) =>
      `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "What the swap does",
    swapDoes: [
      "Each joins the senior team of the other's club",
      "Contracts dated from the game's date; squad numbers cleared",
      "Both come off the transfer and loan lists",
      "Any captaincy at their old clubs is left empty",
      "No fees are paid; career history is not updated",
      "Listed under Changes as one change, which undoes both moves",
    ],

    // Signing a free agent, who has no club: the same dialog with no fee and no swap, and a contract the editor makes.
    signButtonTitle: "Sign this free agent for a club in the game",
    signTitle: "Sign a free agent",
    signChooseClub: "Choose the club to sign the player for.",
    signChecking: "Checking the signing…",
    /** Under the contract's inputs. */
    signTerms:
      "Leave them empty for the wage of the club's player nearest his ability, and a contract to the end of next " +
      "season.",
    /** The signing can be made: `to` is the club. */
    signRoute: (to: string) => `Free agent → ${to}`,
    /** The contract the editor makes: `wage` and `expires` written out, `status` the squad status's name. */
    signContract: (wage: string, expires: string, status: string) =>
      `New contract: ${wage} a week until ${expires}, ${status}`,
    signDoesHeading: "What the signing does",
    signDoes: [
      "Joins the senior team of the club; a full squad list is made bigger",
      "A new contract from the game's date, in one of the game's own free contract slots, as the game makes one",
      "Modelled on the contract of the club's player nearest his ability: the same kind of contract and squad status",
      "Your wage and contract end, or that player's wage and the end of next season",
      "No squad number, loyalty bonus, clauses or bonuses",
      "The game's transfer history does not list it yet",
      "Listed under Changes, where one undo takes it all back",
    ],
    signHint: "Nothing changes in the game until you press Sign.",
    sign: "Sign",
    signing: "Signing…",

    // The foot
    /** Nothing changes in the game until Transfer, or Swap. */
    hint: "Nothing changes in the game until you press Transfer.",
    move: "Transfer",
    moving: "Transferring…",
    cancel: "Cancel",
    swapHint: "Nothing changes in the game until you press Swap.",
    swap: "Swap",
    swapping: "Swapping…",
  },

  /**
   * A player's ties to nations and clubs: their secondary nationalities, and the nations and clubs they were trained
   * in, which decide whether they count as homegrown under a competition's rules. The group in the profile and its
   * dialog.
   */
  ties: {
    heading: "Nationality and homegrown",
    nationalities: "Secondary nationalities",
    trainedInNation: "Trained in nation",
    trainedAtClub: "Trained at club",
    /** A nation he needs no work permit in, as the game lets players of the EU who were in the UK before Brexit. */
    workPermit: "No work permit needed in",
    none: "None",
    /** The game's names of its homegrown rules, by code; `rule` names one it has no name for here. */
    rules: {
      1: "Homegrown 15-21",
      2: "Homegrown 0-21",
      5: "Homegrown 15-21 (excluding loans)",
      10: "Homegrown 0-19 (1 year)",
    } as Readonly<Record<number, string>>,
    rule: (code: number) => `Homegrown rule ${format(code)}`,

    // The button under the group, and the dialog it opens
    change: "Change",
    changeTitle: "Change this player's secondary nationalities and homegrown status in the game",
    title: "Nationality and homegrown",
    hint: "Each change is written to the game at once, and listed under Changes, where it can be undone.",
    /** When the player's list has no room for another tie. */
    full:
      "The game made this player's list just big enough for what it holds: a nationality or a training can be " +
      "changed or removed, but not added.",
    /** The control of a row, for assistive technology: `name` is the nation's or club's. */
    nationOf: (name: string) => `Nation instead of ${name}`,
    ruleOf: (name: string) => `Homegrown rule for ${name}`,
    remove: "Remove",
    removeTitle: (name: string) => `Remove ${name}`,
    /** The rows that add a tie, where the list has room. */
    addNationality: "Add a nationality…",
    addNation: "Add a nation…",
    addPermit: "Add a country with no permit needed…",
    /** After a nation he needs no work permit in. */
    daysLeft: (days: number) => `${format(days)} days left`,
    permitInfoLabel: "What does this do?",
    permitInfo:
      "The game lets players of the European Union who were in England or Scotland before Brexit play there without " +
      "a work permit, for a number of days. A player given this needs no work permit to play in that country either, " +
      "for as many days as theirs have left (ten years where no one in the save has it).",
    newRule: "Homegrown rule of the new nation",
    add: "Add",
    /** A club he was trained at: the button that points it at another club, and the search it opens. */
    changeClub: "Change club",
    changeClubTitle: (name: string) => `Make him trained at another club instead of ${name}`,
    clubInsteadOf: (name: string) => `Club instead of ${name}`,
    /** The button that adds a club he was trained at, and what it opens. */
    addClub: "Add a club…",
    addClubTitle: "Make him trained at one more club",
    newClub: "New club",
    pickAnother: "Pick another",
    newClubRule: "Homegrown rule of the new club",
    cancel: "Cancel",
    working: "Writing to the game…",
    close: "Close",
  },

  /** Changing a contract's bonuses and clauses: the button under them in the profile, and the dialog it opens. */
  clauses: {
    change: "Change",
    changeTitle: "Change this player's bonuses and clauses in the game",
    title: "Bonuses and clauses",
    hint: "Each change is written to the game at once, and listed under Changes, where it can be undone.",
    /** When the contract has no release clause and its list has no room for one. */
    full:
      "The game made this contract's list just big enough for what it holds: a bonus or clause can be changed or " +
      "removed, but a release clause cannot be added.",
    /** The inputs of a row, for assistive technology: `name` is the clause's. */
    amountOf: (name: string) => `Amount of ${name}`,
    conditionOf: (name: string) => `Condition of ${name}`,
    save: "Save",
    remove: "Remove",
    removeTitle: (name: string) => `Remove ${name}`,
    /** The row that adds a release clause, where the list has room and the contract has none. */
    addRelease: "Add a release clause",
    releaseAmount: "Amount of the new release clause",
    add: "Add",
    /** When an amount or condition typed is not a whole number in range: `max` is the most it may be. */
    /** `max` is written out already: an amount as amounts are shown, or a number. */
    outOfRange: (max: string) => `Enter a whole number from 0 to ${max}.`,
    working: "Writing to the game…",
    close: "Close",
  },

  /** Releasing a player from their club, which leaves them a free agent: the button beside Transfer and its dialog. */
  release: {
    /** The button in the header of a player's profile, beside Transfer. */
    button: "Release",
    buttonTitle: "Release this player from their club in the game: they become a free agent",

    // The dialog
    title: "Release",
    /** The club the player leaves. */
    from: "Leaves",
    checking: "Checking the release…",
    /** The player can be released; `club` is the name of their club. */
    ready: (club: string) => `${club} → free agent`,
    doesHeading: "What the release does",
    /** What the game does to the player, one line each. */
    does: [
      "Leaves every team of the club, and the contract ends: a free agent any club can sign",
      "No one is paid anything",
      "Any captaincy at the club is left empty",
      "The game's transfer history does not list it",
      "Listed under Changes, where one undo brings the player back on the same contract",
    ],

    // The foot
    /** Nothing changes in the game until Release. */
    hint: "Nothing changes in the game until you press Release.",
    release: "Release",
    releasing: "Releasing…",
    cancel: "Cancel",
  },

  /** Making a player's loan permanent: the dialog the Make permanent button of the Loan part of his profile opens. */
  permanent: {
    title: "Make the loan permanent",
    /** The club he stays at, and his own club, which he leaves. */
    stays: "Stays at",
    leaves: "Leaves",
    checking: "Checking…",
    doesHeading: "What it does",
    /** One line each. */
    does: [
      "He stays where he plays, now under contract with that club from today, on the terms above",
      "He keeps the squad number and squad status he has there",
      "He leaves every team of his own club, and the loan ends",
      "The game's transfer history does not list it",
      "Listed under Changes as a transfer, where one undo puts the loan back",
    ],
    /** The fee, filled in from the loan's option to buy. */
    optionFee: (money: string) => `Filled in from the loan's option to buy: ${money}`,
    /** Nothing changes in the game until Make permanent. */
    hint: "Nothing changes in the game until you press Make permanent.",
    confirm: "Make permanent",
    confirming: "Making it permanent…",
    cancel: "Cancel",
  },

  /** Recalling a player from his loan: the dialog the Recall button of the Loan part of his profile opens. */
  recall: {
    title: "Recall from loan",
    /** The club he is on loan at, and the one he goes back to. */
    from: "On loan at",
    to: "Goes back to",
    doesHeading: "What the recall does",
    /** One line each; `parent` is the club he goes back to. */
    does: (parent: string) => [
      "Today becomes the last day of the loan: when the day is over, the game ends the loan itself",
      `Continue one day in the game and he is back at ${parent}`,
      "Until then it is listed under Changes, where an undo puts the loan's old end back",
    ],
    /**
     * What the loan's terms would not allow in the game, when it would not let his club recall him or end the loan
     * early; `parent` is his club. The recall here moves the loan's last day all the same.
     */
    termsHeading: "In the game",
    notRecallable: (parent: string) => `The loan does not let ${parent} recall him`,
    notTerminable: "The loan cannot be ended early",
    worksAnyway: "The recall here works all the same: it does not go through the game's recall, it moves the loan's last day",
    /**
     * A line of what the recall does, for a loan with an option to buy: `club` is the club he is on loan at. When a loan
     * with one ends, the game may let that club sign him for it.
     */
    dropsOption: (club: string, amount: string) =>
      `${club}'s option to buy him for ${amount} is taken away: else, when the loan ends, the game may sell him to ${club}`,
    /** Nothing changes in the game until Recall. */
    hint: "Nothing changes in the game until you press Recall.",
    confirm: "Recall",
    confirming: "Recalling…",
    cancel: "Cancel",
  },

  /**
   * A club's squad: the tab of the club profile that lists the players of each of its teams, with the actions on a
   * whole team and the captains.
   */
  squad: {
    // The switch between the club's teams
    /** The name of the switch for assistive technology. */
    teamsLabel: "Team",
    /**
     * The names of the teams (see `teamLabel` in labels.ts): the first team, a B team, a team with an age limit, and
     * any other, which is named by its place in the club's list (`place` counts from 1, the first team being the
     * first).
     */
    teams: {
      first: "First team",
      b: "B team",
      age: (limit: number) => `U${limit}`,
      other: (place: number) => `Team ${place}`,
    },
    /** When the game lists no team for the club. */
    noTeams: "This club has no teams.",
    loading: "Reading the squad…",
    /** The message under an empty table. */
    empty: "No players in this team.",

    // Above the table
    players: (count: number) => (count === 1 ? "1 player" : `${format(count)} players`),
    /** `age` is written out already, with one decimal. */
    averageAge: (age: string) => `average age ${age}`,
    /** `captain` and `viceCaptain` are names, or `profile.none` for nobody. */
    captains: (captain: string, viceCaptain: string) => `Captain: ${captain} · Vice-captain: ${viceCaptain}`,

    // The actions on the whole team
    /** The name of the group of buttons for assistive technology. */
    actionsLabel: "Actions on the whole team",
    /** `injured` is how many of the team's players have an injury. */
    healAll: (injured: number) => (injured === 0 ? "Heal all" : `Heal all (${format(injured)} injured)`),
    healAllTitle: "Heal every injury of every player in this team",
    /** Hover text of Heal all while nobody in the team is injured. */
    healNone: "Nobody in this team is injured",
    /** `banned` is how many of the team's players have a ban. */
    liftAll: (banned: number) => (banned === 0 ? "Lift bans" : `Lift bans (${format(banned)} banned)`),
    liftAllTitle: "Lift every ban of every player in this team",
    /** Hover text of Lift bans while nobody in the team is banned. */
    liftNone: "Nobody in this team is banned",
    inspireAll: "Inspire all",
    inspireAllTitle: "Set the morale of every player in this team to 20, the highest, and remove their reasons to be unhappy",
    maxCohesion: "Max cohesion",
    maxCohesionTitle:
      "Set the cohesion with the club of every player in this team to 100, the highest. The game shows the team's cohesion on its Dynamics page once it moves on: press Continue in the game",
    /** Hover text of Max cohesion while no player's cohesion with the club can be read. */
    cohesionNone:
      "The editor cannot read this team's cohesion: this version of the game has not been checked for it, or none of its players has an entry for the club",
    /** After Max cohesion: how many players of the team have no entry for the club yet, and were left out. */
    cohesionWithout: (count: number) =>
      count === 1
        ? "1 player has no cohesion with the club yet"
        : `${format(count)} players have no cohesion with the club yet`,
    refreshAll: "Refresh all",
    refreshAllTitle: "Set the energy and match sharpness of every player in this team to 100%, and rest them fully (jadedness -500)",
    maxAll: "Max attributes",
    maxAllTitle:
      "Set every attribute of every player in this team to its best: 20, and 1 for injury proneness and dirtiness",
    /** Beside the buttons: whom they cover, and where undoing is. */
    hint: "The actions cover every player in the list, those out on loan too. Undo is in the Changes view as well.",

    // Freezing the whole team, under the actions
    /** The name of the group of boxes for assistive technology. */
    freezeLabel: "Freeze the whole team",
    freezeAttributes: "Freeze attributes",
    freezeAttributesTitle:
      "While the app is open and connected, the attributes of every player in this team do not get worse: what the " +
      "game takes is put back, and improvements still count",
    freezeFitness: "Freeze energy and sharpness",
    freezeFitnessTitle:
      "While the app is open and connected, the energy and match sharpness of every player in this team do not go " +
      "down: what the game takes is put back. Refresh all first to keep them at 100%",
    freezePositions: "Freeze positions",
    freezePositionsTitle:
      "While the app is open and connected, the position ratings of every player in this team stay as they are: " +
      "a rating the game raises or lowers is put back",
    /** After a box: how many of the team's `total` players are frozen that way, while some are and some are not. */
    frozenCount: (frozen: number, total: number) => `${format(frozen)} of ${format(total)}`,
    /** Beside the boxes: whom freezing covers, and for how long. */
    freezeHint:
      "Freezing covers every player in the list and stays with each one wherever he goes. The app remembers it for " +
      "this save.",
    /** What a box did, in the line under the buttons; `count` is how many players it froze or unfroze now. */
    frozeAttributes: (count: number) =>
      count === 0 ? "Their attributes were frozen already" : `Froze the attributes of ${playerCount(count)}`,
    unfrozeAttributes: (count: number) => `Unfroze the attributes of ${playerCount(count)}`,
    frozeFitness: (count: number) =>
      count === 0
        ? "Their energy and sharpness were frozen already"
        : `Froze the energy and sharpness of ${playerCount(count)}`,
    unfrozeFitness: (count: number) => `Unfroze the energy and sharpness of ${playerCount(count)}`,
    frozePositions: (count: number) =>
      count === 0 ? "Their positions were frozen already" : `Froze the positions of ${playerCount(count)}`,
    unfrozePositions: (count: number) => `Unfroze the positions of ${playerCount(count)}`,

    // What an action did, under the buttons
    /** `count` is how many values were written. */
    written: (count: number) => `${changeCount(count)} written`,
    /** A change the game refused: `name` is the player's, `reason` the game's answer (it names the value). */
    refused: (name: string, reason: string) => `${name}: ${reason}`,
    /** Takes back what the line beside it says was written. */
    undo: "Undo",
    undoTitle: "Write the old values of these changes back to the game",

    // Captains
    /** The badges after the name of the captain and of the vice-captain; their hover texts are the roles' names. */
    captainShort: "C",
    viceCaptainShort: "VC",
    /** The menu button at the end of a row: its name for assistive technology (`name` is the player's), hover text. */
    menuLabel: (name: string) => `Captaincy of ${name}`,
    menuTitle: "Captaincy",
    makeCaptain: "Make captain",
    makeViceCaptain: "Make vice-captain",
    /** Who holds a role now: said after a change, and in the Changes view under a captaincy that moved the other. */
    nowCaptain: (name: string) => `${name} is now captain`,
    nowViceCaptain: (name: string) => `${name} is now vice-captain`,
    /** The same when there was nobody to take the role the new holder left, so that it stands empty. */
    noCaptain: "Nobody is captain now",
    noViceCaptain: "Nobody is vice-captain now",

    // The table
    /** The table's name for assistive technology; `team` is the name of the team. */
    tableLabel: (team: string) => `Players of ${team}`,
    /** Hover text of a player's name, which opens his profile in the player list. */
    openProfile: "Open the player's profile",
    columns: {
      name: "Name",
      position: "Pos",
      age: "Age",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "Energy",
      matchSharpness: "Sharpness",
      jadedness: "Jaded.",
      morale: "Morale",
      cohesion: "Cohesion",
      /** The last column has no heading but this one, for assistive technology: it holds the captaincy menus. */
      actions: "Captaincy",
    } satisfies Record<SquadSort | "actions", string>,
    /** Hover text of a column header that sorts the table; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `Sort by ${by}`,
    sortNames: {
      name: "name",
      position: "position",
      age: "age",
      currentAbility: "current ability",
      potentialAbility: "potential ability",
      condition: "energy",
      matchSharpness: "match sharpness",
      jadedness: "jadedness",
      morale: "morale",
      cohesion: "cohesion",
    } satisfies Record<SquadSort, string>,

    // The tags after a name, with what each means as hover text
    injured: "Injured",
    /** `count` is how many injuries he has. */
    injuredTitle: (count: number) => (count === 1 ? "1 injury" : `${format(count)} injuries`),
    banned: "Banned",
    /** `count` is how many bans he has. */
    bannedTitle: (count: number) => (count === 1 ? "1 ban" : `${format(count)} bans`),
    onLoan: "On loan",
    onLoanTitle: "Out on loan to another club",
    loanee: "Loanee",
    loaneeTitle: "Here on loan from another club",
    elsewhere: "Elsewhere",
    elsewhereTitle: "Plays for another team of the club",
    frozen: "Frozen",
    /** Hover text of Frozen: what is frozen, one of them at least. */
    frozenTitle: (attributes: boolean, fitness: boolean, positions: boolean): string => {
      const frozen = [
        ...(attributes ? ["attributes"] : []),
        ...(fitness ? ["energy", "match sharpness"] : []),
        ...(positions ? ["positions"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} and ${last}` : last;
      return `His ${listed} are frozen`;
    },
  },

  /** The game, as `describeGame` in `format.ts` names it. */
  game: {
    /** The game's name when its edition is not known: "FM27" otherwise. */
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Unknown store",
    } satisfies Record<Storefront, string>,
    /** Steam's build id of the install, e.g. `"build 26227640`". */
    steamBuild: (id: string) => `build ${id}`,
  },

  /** The Scouting tab: an assistant scout who advises on signings, the squad's depth and who could go. */
  scouting: {
    nav: "Scouting",
    reading: "Reading your club…",
    refresh: "Refresh",
    refreshTitle: "Read the club from the game again",
    searching: "Searching…",
    none: "—",
    perWeek: "/wk",
    openProfile: "Open the profile",
    freeAgent: "Free agent",
    loan: "Loan",
    header: {
      transferBudget: "Transfer budget",
      wageRoom: "Wage room",
      wageBudget: "Wage budget",
      squad: "Squad",
      averageAge: "Average age",
      players: (count: number) => (count === 1 ? "1 player" : `${format(count)} players`),
    },
    tabs: {
      label: "Scouting sections",
      recommend: "Transfer advice",
      depth: "Squad depth",
      departures: "Players to let go",
    },
    /** The depth statuses: the dots on the pitch and the badges of the cards. */
    status: {
      missing: "Missing",
      thin: "Thin",
      fine: "Fine",
      crowded: "Crowded",
    },
    /** The lines of the formation that roles belong to: the groups of the role selects. */
    lines: {
      goalkeeper: "Goalkeeper",
      centreBack: "Centre-back",
      fullBack: "Full-back",
      wingBack: "Wing-back",
      defensiveMidfield: "Defensive midfield",
      centralMidfield: "Central midfield",
      attackingMidfield: "Attacking midfield",
      wide: "Wide",
      striker: "Striker",
    },
    /** The squad lines, by key. */
    depthLines: {
      gk: "Goalkeepers",
      dc: "Centre-backs",
      rightBack: "Right-backs",
      leftBack: "Left-backs",
      dm: "Defensive midfielders",
      mc: "Central midfielders",
      rightWing: "Right wingers",
      leftWing: "Left wingers",
      amc: "Attacking midfielders",
      st: "Strikers",
    } as Record<string, string>,
    /** The hover of a position on the pitch: "Right-backs: 2 in the squad (usually 2) — Fine". */
    positionTip: (line: string, count: number, target: number, status: string) =>
      `${line}: ${format(count)} in the squad (usually ${format(target)}) — ${status}`,
    brief: {
      heading: "What are you looking for?",
      pitch: "Position",
      legend: "The dots show how the squad stands in each line.",
      inPossession: "In possession",
      outOfPossession: "Out of possession",
      anyRole: "Any — best role for each player",
      purpose: "For",
      filters: "Filters",
      minAge: "Min age",
      maxAge: "Max age",
      maxFee: "Max fee",
      minProbability: "Probability",
      anyProbability: "Any",
      noFreeAgents: "No free agents",
    },
    purposes: {
      firstTeam: "First team",
      rotation: "Rotation",
      future: "Future",
      any: "All",
    },
    purposeTips: {
      firstTeam: "Better than your best player in this position",
      rotation: "As good as your second choice, at a sensible price",
      future: "21 or younger, with room to grow",
      any: "Everyone who fits",
    },
    /** The sentence above the advice: before the position, and after it; `roles` and `purpose` follow a dot. */
    ask: {
      before: "Advice for ",
      after: "",
      anyRole: "best role per player",
    },
    own: {
      heading: "In your squad",
      empty: "Nobody in your squad plays here.",
      position: "Position",
    },
    summary: (candidates: number, eligible: number, shown: number, purpose: string) =>
      `${format(candidates)} players can play here · ${format(eligible)} match ${purpose} · ${format(shown)} recommended`,
    how: {
      label: "How is this list made?",
      note: (rule: string, count: string) =>
        `The scout looks at every player who can play this position (rated 10 or more there), leaving out your own club's players and those of other human managers. Of those he keeps the ones who ${rule}. For the 400 who fit best he works out how likely each is to join you, then recommends the best ${count} by fit and probability together. Recommended order: 70% fit and 30% probability, a little less for players past 30; Rotation weighs the two alike and Future counts potential too. Click a column title to sort the list; # is the scout's own order.`,
    },
    purposeRules: {
      firstTeam: "fit the position better than your best player there",
      rotation: "fit at least as well as your second choice",
      future: "are 21 or younger with room to grow (potential at least 15 above ability)",
      any: "fit at all",
    },
    sortBy: (by: string) => `Sort by ${by}`,
    sortNames: {
      rank: "the scout's order",
      name: "name",
      age: "age",
      ca: "current ability",
      pa: "potential ability",
      fit: "fit",
      probability: "probability",
      fee: "fee",
    },
    backToScoutOrder: "Back to the scout's order",
    showMore: (count: number) => `Show ${format(count)} more`,
    /** Under a player whose contract is with another club: the club he plays for, on loan or in its second team. */
    playsFor: (club: string) => `plays for ${club}`,
    empty: "No advice for this position with these settings. Try the purpose All or looser filters.",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "Player",
      age: "Age",
      fit: "Fit",
      role: "Role",
      probability: "Probability",
      fee: "Est. fee",
      wage: "Wage",
      note: "Scout's note",
      money: "Fee",
      value: "Value",
    },
    probabilityInfo:
      "How likely the player is to join your club — an estimate from his value, contract, club and reputation.",
    probabilityInfoLabel: "What is probability?",
    /** The hover of a fit: his attributes for each role (1–20) and how well he plays the position. */
    fitTitle: (inPossession: string | null, outOfPossession: string | null, position: string) =>
      [
        inPossession !== null && `In possession: ${inPossession}`,
        outOfPossession !== null && `Out of possession: ${outOfPossession}`,
        `Position: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note: "Fit uses the editor's own attribute weights for each role; fees, wages and probabilities are estimates.",
    depth: {
      summary: (size: number, age: string | null, level: string) =>
        `${format(size)} players${age === null ? "" : ` · average age ${age}`} · best eleven average ability ${level}`,
      weak: "Below squad level",
      ageing: "Ageing",
      cover: (names: string) => `Can also play here: ${names}`,
      advice: "Get advice",
      adviceTitle: "Transfer advice for this line",
      empty: "Nobody",
      ability: "Current ability",
      more: (count: number) => `+${format(count)} more`,
      columns: {
        line: "Line",
        status: "Status",
        count: "Players",
        players: "Best first (ability)",
        cover: "Can also play here",
        age: "Avg age",
      },
      countTitle: (count: number, target: number) =>
        `${format(count)} players whose best position is in this line; a squad usually carries ${format(target)}`,
      statusHelp: {
        missing: "Nobody plays here.",
        thin: "Fewer than a squad usually carries; players who can cover count as half.",
        fine: "About what a squad usually carries.",
        crowded: "Two or more players beyond what a squad usually carries.",
      },
      attention: "Needs a look:",
      allFine: "Every line looks balanced.",
    },
    departures: {
      intro: "Players your scout would let go, most pressing first.",
      filter: "Advice",
      all: "All",
      empty: "Your scout would not let anyone go right now.",
      sortNames: {
        rank: "the scout's order",
        name: "name",
        age: "age",
        ca: "current ability",
        pa: "potential ability",
        value: "value",
        wage: "wage",
        contract: "contract end",
      },
      columns: {
        player: "Player",
        age: "Age",
        ability: "Ability",
        value: "Value",
        wage: "Wage",
        contract: "Contract until",
        advice: "Advice",
        reasons: "Reasons",
      },
      actions: { sell: "Sell", loan: "Loan out", release: "Release" },
      /** "3rd" in a line. */
      rank: (line: string, rank: number) => {
        const tens = rank % 100;
        const suffix = (tens >= 11 && tens <= 13) || rank % 10 > 3 ? "th" : ["th", "st", "nd", "rd"][rank % 10];
        return `${line} · ${rank}${suffix}`;
      },
    },
    roles: {
      bgk: "Ball-Playing Goalkeeper",
      ngk: "No-Nonsense Goalkeeper",
      sk: "Sweeper Keeper",
      lhk: "Line-Holding Keeper",
      cb: "Centre-Back",
      bcb: "Ball-Playing Centre-Back",
      ncb: "No-Nonsense Centre-Back",
      acb: "Advanced Centre-Back",
      ocb: "Overlapping Centre-Back",
      scb: "Stopping Centre-Back",
      ccb: "Covering Centre-Back",
      wcb: "Wide Centre-Back",
      fb: "Full-Back",
      ifb: "Inverted Full-Back",
      pfb: "Pressing Full-Back",
      hfb: "Holding Full-Back",
      wb: "Wing-Back",
      iwb: "Inverted Wing-Back",
      pwb: "Playmaking Wing-Back",
      awb: "Advanced Wing-Back",
      hwb: "Holding Wing-Back",
      dm: "Defensive Midfielder",
      hb: "Half-Back",
      ddm: "Dropping Defensive Midfielder",
      pdm: "Pressing Defensive Midfielder",
      bbm: "Box-to-Box Midfielder",
      bbp: "Box-to-Box Playmaker",
      cm: "Central Midfielder",
      pcm: "Pressing Central Midfielder",
      scm: "Screening Central Midfielder",
      chm: "Channel Midfielder",
      wcm: "Wide Central Midfielder",
      ap: "Attacking Playmaker",
      am: "Attacking Midfielder",
      oam: "Outlet Attacking Midfielder",
      w: "Winger",
      if: "Inside Forward",
      pw: "Playmaking Winger",
      wfd: "Wide Forward",
      tw: "Tracking Winger",
      iow: "Inside Outlet Winger",
      cfd: "Centre Forward",
      dlf: "Deep-Lying Forward",
      p: "Poacher",
      tcf: "Tracking Centre Forward",
      ocf: "Outlet Centre Forward",
    } as Record<string, string>,
    reasons: {
      listed: () => "Transfer listed",
      freeAgent: () => "Free agent",
      expiring: (value: string) => `Contract ends in ${value} days`,
      releaseClause: (value: string) => `Release clause ${value}`,
      fringe: () => "Not a regular at his club",
      keyPlayer: () => "Key player at his club",
      unwanted: () => "Surplus to requirements at his club",
      overBudget: (value: string) => `${value} over your budget`,
      stretch: (value: string) => `Just over budget (+${value})`,
      wageHigh: (value: string) => `Wage ${value}/wk above your room`,
      biggerClub: () => "Plays for a bigger club",
      smallerClub: () => "Plays for a smaller club",
      reputationGap: () => "Too big a name for your club",
      ambitious: () => "Ambitious: would welcome the step up",
      notForSale: () => "Not for sale",
    } as Record<string, (value: string) => string>,
    /** Why a player could go, by code; `value` is the reason's value as text. */
    departureReasons: {
      surplus: (value: string) => `Crowded line (${value} players)`,
      belowLevel: () => "Below the squad's level",
      ageing: (value: string) => `Getting old (${value})`,
      expiring: (value: string) => `Contract ends in ${value} days`,
      highWage: (value: string) => `High wage for his role (${value}/wk)`,
      unhappy: () => "Unhappy",
      lowMorale: () => "Low morale",
      blocked: () => "Needs games to grow",
      unwanted: () => "Squad status: surplus to requirements",
      listed: () => "Already transfer listed",
    } as Record<string, (value: string) => string>,
  },

  errors,
};

/** What a dictionary has to provide. */
export type Strings = typeof en;
