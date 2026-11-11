// Stand-ins for the Rust commands so the UI can be developed in a plain browser
// (`npm run dev`) without the game or Tauri. Every player here is made up.

import { dateFromNumber, numberFromDate } from "../editing";
import { fold } from "../format";
import { scoutingOverview, scoutingSuggest } from "./mockScouting";
import type {
  ApplyReport,
  ArrayRef,
  AttributeBound,
  ClubMoney,
  FeePlan,
  Nation,
  BridgeInfo,
  CaptainRole,
  ClubTeam,
  ScoutRequest,
  SquadPlayer,
  TeamAction,
  TeamFreeze,
  FreezeKind,
  ClubDetails,
  ClubFilter,
  ClubPage,
  ClubSummary,
  CheckKey,
  ConnectionInfo,
  Detection,
  Failure,
  FmDate,
  GameInfo,
  Health,
  Ban,
  Injury,
  LoanDetails,
  Tie,
  Clause,
  TieKind,
  PlayerDetails,
  PlayerFilter,
  PlayerOrder,
  PlayerPage,
  PlayerSummary,
  Refrozen,
  ReloadInfo,
  StaffDetails,
  StaffFilter,
  StaffOrder,
  StaffPage,
  StaffSummary,
  EditField,
  Entity,
  ExportReport,
  FieldEdit,
  FieldValues,
  LoggedChange,
  BatchUndo,
  MassFilters,
  MassOperation,
  MassOperationKind,
  MassPreview,
  MassReport,
  ClubName,
  MovePreview,
  MoveTerms,
  PlannedChange,
  RoomMaker,
  StadiumName,
  SkippedField,
} from "../types";

const GAME_DATE: FmDate = { year: 2026, month: 7, day: 18 };

/** The age on `today` of someone born on `born`. */
const ageOn = (born: FmDate, today: FmDate) =>
  today.year - born.year - (today.month * 100 + today.day < born.month * 100 + born.day ? 1 : 0);

const game: GameInfo = {
  pid: 4242,
  exePath: "D:\\Games\\Football Manager 27\\Content\\fm.exe",
  storefront: "gamePass",
  edition: 27,
  packageFullName: "SportsInteractive.FootballManager27_0.9.2409.0_x64__5w3tn6tb6stnm",
  packageVersion: "0.9.2409.0",
  steamBuild: null,
};

const FIRST = ["Arda", "Mateo", "Lukas", "Kerem", "Jonas", "Rafael", "Emre", "Noah", "Tiago", "Søren", "Ilkay", "Bruno"];
/** The first names of the fixture women; the other names are shared. */
const FIRST_WOMEN = ["Aitana", "Elif", "Lena", "Ebru", "Sofia", "Marta", "Ingrid", "Chloé", "Zehra", "Pernille"];
const LAST = ["Yılmaz", "Fernández", "Hoffmann", "Aydın", "Lindqvist", "Moreau", "Çelik", "Kowalski", "Silva", "Novák"];
const NATIONS = ["Türkiye", "Spain", "Germany", "Brazil", "Denmark", "France", "Poland", "Portugal", "Czechia"];
/** Every fixture nation: those of the players, and two that work permits are about. */
const ALL_NATIONS = [...NATIONS, "England", "Scotland"];
const CLUBS = ["Northbridge FC", "Atlético Riverside", "Sporting Harbour", "FC Lindenau", "Kuzey Spor", "Old Mill United"];

/** Where the game would keep each fixture nation: what a nation field holds. */
const nationAddress = (nation: string) => 0x7f00_0000 + ALL_NATIONS.indexOf(nation) * 0x400;

/** The fixture nation a nation field's value stands for. */
const nationAt = (address: number) => ALL_NATIONS.find((nation) => nationAddress(nation) === address);

/**
 * A fixture person's nation and club with their UIDs, as the real rows have them: the men's club of that name (see
 * `clubs` below), or for a woman the women's club.
 */
function withUids(nation: string, club: string | null, woman = false) {
  const at = club === null ? -1 : CLUBS.indexOf(club);
  return {
    nation,
    nationUid: 1000 + NATIONS.indexOf(nation),
    club,
    clubUid: club === null ? null : woman ? 2_000_100_000 + at : 500 + at * 7,
  };
}

/** Small deterministic generator so the fixtures look the same on every reload. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** The 15 positions, in the order the game stores their ratings. */
const POSITIONS = ["gk", "sw", "dl", "dc", "dr", "dm", "ml", "mc", "mr", "aml", "amc", "amr", "st", "wbl", "wbr"];

/** From this rating FM counts a position as one a player can play: the list's positions and its filter use it. */
const PLAYABLE_RATING = 15;

/** Every eleventh fixture player is a goalkeeper. */
const isKeeper = (uid: number) => uid % 11 === 0;

/**
 * The squad status of a fixture contract: `drawn` (1 to 5), but the first-choice goalkeeper (15) for a few keepers,
 * surplus to requirements (22) or a fringe player (7) for a few others.
 */
const squadStatusOf = (uid: number, drawn: number) =>
  isKeeper(uid) && uid % 2 === 0 ? 15 : uid % 19 === 0 ? 22 : uid % 23 === 0 ? 7 : drawn;

/** How well a fixture player plays each position (1–20): one natural position, a few that come close, the rest low. */
function positionRatings(next: () => number, keeper: boolean): Record<string, number> {
  const natural = keeper ? "gk" : POSITIONS[1 + Math.floor(next() * (POSITIONS.length - 1))];
  return Object.fromEntries(
    POSITIONS.map((key) => [key, key === natural ? 20 : keeper || key === "gk" ? 1 : Math.round(1 + next() ** 2 * 16)]),
  );
}

/** The positions rated PLAYABLE_RATING or more, best first (equals in the order of POSITIONS), as the real list has them. */
function playablePositions(ratings: Record<string, number>): string[] {
  return POSITIONS.filter((key) => ratings[key] >= PLAYABLE_RATING).sort((a, b) => ratings[b] - ratings[a]);
}

/** When a fixture contract ends: mostly on 30 June, some at the turn of the year, a few this year (after the game date). */
function contractEnd(next: () => number): FmDate {
  const roll = next();
  if (roll < 0.12) {
    return { year: GAME_DATE.year, month: 12, day: 31 };
  }
  const year = GAME_DATE.year + 1 + Math.floor(next() * 5);
  return roll < 0.8 ? { year, month: 6, day: 30 } : { year, month: 12, day: 31 };
}

/**
 * The fixture players, and how well each plays every position (by UID): the list and the profile both read the ratings.
 * The men come first; the women after them, who play for the women's clubs or none, are in `women` too.
 */
const { players, ratings, women } = (() => {
  const next = random(27);
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];
  const ratings: Record<number, Record<string, number>> = {};
  const players = Array.from({ length: 400 }, (_, i): PlayerSummary => {
    const uid = 1_000_000 + i * 37;
    const ca = Math.round(40 + next() * 150);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const born: FmDate = { year: 1988 + Math.floor(next() * 20), month: 1 + Math.floor(next() * 12), day: 1 + Math.floor(next() * 28) };
    const fullName = next() < 0.3 ? `${name} ${pick(LAST)}` : null;
    const nation = pick(NATIONS);
    const club = next() < 0.9 ? pick(CLUBS) : null;
    const potentialAbility = Math.min(200, ca + Math.round(next() * 40));
    // Positions and contract are drawn from a generator of their own, so the other fields of each player come out as before.
    const own = random(uid ^ 0x5a5a5a);
    ratings[uid] = positionRatings(own, isKeeper(uid));
    return {
      uid,
      name,
      fullName,
      dateOfBirth: born,
      age: ageOn(born, GAME_DATE),
      ...withUids(nation, club),
      positions: playablePositions(ratings[uid]),
      contractExpires: club === null ? null : contractEnd(own),
      currentAbility: ca,
      potentialAbility,
    };
  });
  // The women are drawn from a generator of their own, so the men come out as before.
  const nextWoman = random(1971);
  const pickWoman = <T,>(items: T[]) => items[Math.floor(nextWoman() * items.length)];
  const womenPlayers = Array.from({ length: 120 }, (_, i): PlayerSummary => {
    const uid = 3_000_000 + i * 41;
    const ca = Math.round(40 + nextWoman() * 140);
    const born: FmDate = {
      year: 1990 + Math.floor(nextWoman() * 18),
      month: 1 + Math.floor(nextWoman() * 12),
      day: 1 + Math.floor(nextWoman() * 28),
    };
    const club = nextWoman() < 0.85 ? pickWoman(CLUBS) : null;
    const own = random(uid ^ 0x5a5a5a);
    ratings[uid] = positionRatings(own, isKeeper(uid));
    return {
      uid,
      name: `${pickWoman(FIRST_WOMEN)} ${pickWoman(LAST)}`,
      fullName: null,
      dateOfBirth: born,
      age: ageOn(born, GAME_DATE),
      ...withUids(pickWoman(NATIONS), club, true),
      positions: playablePositions(ratings[uid]),
      contractExpires: club === null ? null : contractEnd(own),
      currentAbility: ca,
      potentialAbility: Math.min(200, ca + Math.round(nextWoman() * 40)),
    };
  });
  const women = new Set(womenPlayers.map((p) => p.uid));
  return { players: [...players, ...womenPlayers], ratings, women };
})();

const ATTRIBUTES = [
  "corners", "crossing", "dribbling", "finishing", "first_touch", "free_kicks", "heading", "long_shots",
  "long_throws", "marking", "passing", "penalty_taking", "tackling", "technique", "aggression", "anticipation",
  "bravery", "composure", "concentration", "decisions", "determination", "flair", "leadership", "off_the_ball",
  "positioning", "teamwork", "vision", "work_rate", "acceleration", "agility", "balance", "jumping_reach",
  "natural_fitness", "pace", "stamina", "strength", "aerial_reach", "command_of_area", "communication",
  "eccentricity", "handling", "kicking", "one_on_ones", "punching", "reflexes", "rushing_out", "throwing",
  "consistency", "dirtiness", "important_matches", "injury_proneness", "versatility", "left_foot", "right_foot",
];
const GK_ONLY = new Set([
  "aerial_reach", "command_of_area", "communication", "eccentricity", "handling", "kicking", "one_on_ones",
  "punching", "reflexes", "rushing_out", "throwing",
]);
const PERSONALITY = [
  "adaptability", "ambition", "loyalty", "pressure", "professionalism", "sportsmanship", "temperament", "controversy",
];

/** Made-up but self-consistent profile for a fixture player. */
function details(player: PlayerSummary): PlayerDetails {
  const next = random(player.uid);
  const keeper = isKeeper(player.uid);
  const level = generatedAbility.get(player.uid)! / 2; // raw attribute centre, 0–100
  const attributes = Object.fromEntries(
    ATTRIBUTES.map((key) => {
      const centre = GK_ONLY.has(key) !== keeper ? 12 : level;
      const raw = Math.max(1, Math.min(100, Math.round(centre + (next() - 0.5) * 40)));
      return [key, { raw, value: Math.max(1, Math.min(20, Math.floor((raw + 2) / 5))) }];
    }),
  );
  const personality = Object.fromEntries(PERSONALITY.map((key) => [key, Math.round(1 + next() * 19)]));
  return withWritten("player", {
    ...player,
    heightCm: Math.round(168 + next() * 26),
    askingPrice: next() < 0.2 ? Math.round(next() * 40) * 1_000_000 : null,
    reputation: { home: Math.round(next() * 10000), current: Math.round(next() * 10000), world: Math.round(next() * 10000) },
    international: { caps: Math.round(next() * 90), goals: Math.round(next() * 30), u21Caps: Math.round(next() * 20), u21Goals: Math.round(next() * 8) },
    // The ratings behind the positions of the list row: the profile and the row agree.
    positionRatings: { ...ratings[player.uid] },
    personality,
    attributes,
    contract: player.club
      ? {
          wage: Math.round(generatedAbility.get(player.uid)! * 900 + next() * 20000),
          signed: { year: 2024, month: 7, day: 1 },
          expires: player.contractExpires,
          joined: { year: 2022, month: 8, day: 15 },
          squadStatus: squadStatusOf(player.uid, 1 + Math.floor(next() * 5)),
          contractType: player.uid % 13 === 0 ? 3 : player.uid % 17 === 0 ? 0 : 1,
          squadNumber: 1 + Math.floor(next() * 40),
          transferListed: next() < 0.1,
          loanListed: false,
          loyaltyBonus: Math.round(next() * 30000),
          happiness: Math.round(-20 + next() * 100),
          playingTimeHappiness: Math.round(next() * 40),
          clauses: clausesOf(player.uid, [
            { index: 0, kind: 32, amount: Math.round(10000 + next() * 60000), condition: null },
            { index: 1, kind: 33, amount: Math.round(5000 + next() * 40000), condition: null },
            { index: 2, kind: 38, amount: Math.round(2000 + next() * 15000), condition: null },
            ...(next() < 0.5 ? [{ index: 3, kind: 0, amount: Math.round(50 + next() * 500) * 1_000_000, condition: null }] : []),
            ...(next() < 0.5 ? [{ index: 4, kind: 22, amount: null, condition: 1 }] : []),
            // A few kinds more, as the game holds them: a release clause that expires 791 days after the contract's
            // start, a sell-on clause on the profit over an amount, a new wage after a number of league games.
            ...(player.uid % 4 === 0 ? [{ index: 5, kind: 17, amount: 30_000_000, condition: 791 }] : []),
            ...(player.uid % 6 === 0 ? [{ index: 6, kind: 9, amount: 2_147_579, condition: 7 }] : []),
            ...(player.uid % 10 === 0 ? [{ index: 7, kind: 13, amount: 118_462, condition: 30 }] : []),
          ]),
          // A few players have reasons to be unhappy: one over, and one or two that last.
          concerns:
            next() < 0.3
              ? [
                  { started: { year: 2026, month: 7, day: 2 }, ended: { year: 2026, month: 7, day: 9 }, motive: 1202, kind: 1 },
                  { started: { year: 2026, month: 7, day: 12 }, ended: null, motive: 926, kind: 1 },
                  ...(next() < 0.5 ? [{ started: { year: 2026, month: 7, day: 15 }, ended: null, motive: 596, kind: 2 }] : []),
                ]
              : [],
          // A player moved to another club signed today, without a squad number, off the transfer list.
          ...(movedPlayers.has(player.uid) && {
            signed: GAME_DATE,
            joined: GAME_DATE,
            squadNumber: null,
            transferListed: false,
          }),
        }
      : null,
    // As stored: energy and match sharpness 0–10000 (sharpness mostly 35% or more), and jadedness
    // from -500, fully rested, to a little above 0 early in a season.
    condition: Math.round(7000 + next() * 3000),
    matchSharpness: Math.round(3500 + next() * 6500),
    jadedness: Math.round(-500 + next() * 600),
    traits: [7, 10, 19, 20, 35, 43, 51].filter(() => next() < 0.4),
    injuries: injuriesOf(player.uid),
    bans: bansOf(player.uid),
    ties: tiesOf(player),
    tieRoom: tieRoomOf(player),
    tiesGrow: true,
    clauseRoom: player.club ? clauseRoomOf(player.uid) : 0,
    retirementKnown: true,
    retires: retiresOf(player.uid),
    loan: loanOf(player),
    // Drawn last, so that the values above come out as before.
    morale: Math.round(7 + next() * 10),
  });
}

/**
 * Where a fixture player is on loan: every thirteenth player with a club plays there on loan from the next fixture
 * club, from the end of June to the end of the season, number 1 + his UID modulo 40 there.
 */
function loanOf(player: PlayerSummary): LoanDetails | null {
  if (player.club === null || player.clubUid === null || player.uid % 13 !== 6 || movedPlayers.has(player.uid)) {
    return null;
  }
  const at = (CLUBS.indexOf(player.club) + 1) % CLUBS.length;
  const parentUid = player.clubUid >= 2_000_100_000 ? 2_000_100_000 + at : 500 + at * 7;
  return {
    clubUid: player.clubUid,
    club: player.club,
    parentUid,
    parent: CLUBS[at],
    from: { year: 2026, month: 6, day: 29 },
    until: { year: 2027, month: 6, day: 30 },
    squadNumber: 1 + (player.uid % 40),
    wage: 2_000 + (player.uid % 50) * 900,
    ends: "later",
    recalled: false,
    terms: loanTermsOf(player.uid),
  };
}

/**
 * Terms for a fixture loan, as the Steam save shows them: about one loan in three cannot be recalled in the game, and
 * those mostly cannot be terminated either and carry an option to buy and monthly fees (Anton Kade's: flags 0x1002).
 */
function loanTermsOf(uid: number): LoanDetails["terms"] {
  const strict = uid % 3 === 0;
  const flags = strict ? 0x1002 : 0x106;
  return {
    canBeRecalled: (flags & 0x4) !== 0,
    canBeTerminated: (flags & 0x1000) === 0,
    cupMatches: (flags & 0x2) !== 0,
    againstOwnClub: (flags & 0x1) !== 0,
    optionFee: strict ? 5_000_000 + (uid % 20) * 1_000_000 : null,
    monthlyFee: strict ? 150_000 : null,
    unusedFee: strict ? 200_000 : null,
    flags,
  };
}

/** Where the end `until` of a fixture loan stands against the game's date, as the real details say. */
function loanEnd(until: FmDate | null): LoanDetails["ends"] {
  if (until === null) {
    return "unknown";
  }
  const [end, today] = [numberFromDate(until), numberFromDate(GAME_DATE)];
  return end > today ? "later" : end === today ? "today" : "passed";
}

/** The fixture players healed through the editor, by UID, while the healing is not undone. */
const healedPlayers = new Set<number>();

/** `date` moved on by `days`. */
function addDays(date: FmDate, days: number): FmDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

/** The current injuries of a fixture player: every seventh one is injured, some of them twice over, until healed. */
function injuriesOf(uid: number): Injury[] {
  if (uid % 7 !== 3 || healedPlayers.has(uid)) {
    return [];
  }
  const injury = (name: string, daysAgo: number, soonest: number, latest: number): Injury => {
    const started = addDays(GAME_DATE, -daysAgo);
    return { name, started, backSoonest: addDays(started, soonest), backLatest: addDays(started, latest) };
  };
  const injuries = [injury("Hamstring strain", 4, 21, 35)];
  if (uid % 2 === 0) {
    injuries.push(injury("Twisted ankle", 1, 7, 12));
  }
  return injuries;
}

// Ties: secondary nationalities and homegrown status --------------------------------------------------------------

/** The homegrown rules the real `change_tie` and `add_tie` write. */
const HOMEGROWN_RULES = [1, 2, 5, 10];

/** The ties of the fixture players changed through the editor, by UID; the others have the ones `fixtureTies` gives. */
const tiesSet = new Map<number, Tie[]>();

/** What each change to a player's ties (by the id of its logged change) found, for its undo. */
const tieUndo = new Map<number, Tie[]>();

/**
 * A fixture player's ties as the game would hold them: every fifth player has a secondary nationality, and each was
 * trained in his nation and at his club under the 15–21 rule.
 */
function fixtureTies(player: PlayerSummary): Tie[] {
  const ties: Tie[] = [];
  if (player.uid % 5 === 0) {
    const other = NATIONS[(NATIONS.indexOf(player.nation ?? NATIONS[0]) + 1) % NATIONS.length];
    ties.push({ index: 0, tie: "nationality", targetUid: 1000 + NATIONS.indexOf(other), name: other, rule: null, days: null });
  }
  if (player.nation) {
    ties.push({ index: 0, tie: "trainedInNation", targetUid: player.nationUid ?? 0, name: player.nation, rule: 1, days: null });
  }
  if (player.club && player.clubUid !== null) {
    ties.push({ index: 0, tie: "trainedAtClub", targetUid: player.clubUid, name: player.club, rule: 1, days: null });
  }
  // One in seven needs no work permit in England, as players of the EU who were there before Brexit.
  if (player.uid % 7 === 1) {
    const england = ALL_NATIONS.indexOf("England");
    ties.push({ index: 0, tie: "workPermit", targetUid: 1000 + england, name: "England", rule: null, days: 515 });
  }
  // A list holds other relations too: the ties are spread through it.
  return ties.map((tie, i) => ({ ...tie, index: i * 2 + 1 }));
}

const tiesOf = (player: PlayerSummary) => tiesSet.get(player.uid) ?? fixtureTies(player);

/** Room for one or two more ties in every third list, less what was added to it. */
const tieRoomOf = (player: PlayerSummary) =>
  Math.max(0, (player.uid % 3) - (tiesOf(player).length - fixtureTies(player).length));

/** The fixture club with the UID `uid`, or the real commands' failure. */
function mockClub(uid: number): ClubSummary {
  const club = clubs.find((c) => c.uid === uid);
  if (!club) {
    throw notFound("club", uid);
  }
  return club;
}

/** The name of the nation or club with the UID `target`, as a tie of `kind` points at one or the other. */
const targetName = (kind: TieKind, target: number) =>
  kind === "trainedAtClub" ? mockClub(target).name : mockNation(target);

/** The fixture nation with the UID `uid`, or the real commands' failure. */
function mockNation(uid: number): string {
  const name = ALL_NATIONS[uid - 1000];
  if (name === undefined) {
    throw failure("app.notFound", `No nation with UID ${uid}`, { uid });
  }
  return name;
}

/** Logs a change to a player's ties as the real commands do, keeping his ties as they were for undoing it. */
function logTie(player: PlayerSummary, before: Tie | null, after: Tie | null, ties: Tie[]): LoggedChange {
  const id = changes.length + 1;
  tieUndo.set(id, tiesOf(player));
  tiesSet.set(player.uid, ties);
  const kind = (before ?? after)!.tie;
  const end = (tie: Tie | null) => tie && { name: tie.name ?? String(tie.targetUid), rule: tie.rule };
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid: player.uid,
    field: `tie.${kind}`,
    old: before?.targetUid ?? 0,
    new: after?.targetUid ?? 0,
    undoneAt: null,
    batch: null,
    tie: { from: end(before), to: end(after) },
  };
  changes.push(logged);
  return { ...logged };
}

/** The fixture player `uid`, and his tie at `index`, or the real commands' failures. */
function tieAt(uid: number, index: number): [PlayerSummary, Tie] {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const tie = tiesOf(player).find((t) => t.index === index);
  if (!tie) {
    throw failure("relation.missing", `the player has no nationality or homegrown tie number ${index}`, { index });
  }
  return [player, tie];
}

/** `change_tie`: points a fixture player's tie at another nation or club, or gives a training another rule. */
function changeTie(uid: number, index: number, nation?: number, club?: number, rule?: number): LoggedChange {
  const [player, tie] = tieAt(uid, index);
  if (rule !== undefined && (tie.rule === null || !HOMEGROWN_RULES.includes(rule))) {
    throw failure("relation.rule", `homegrown rule ${rule} is not one the editor writes`, { rule });
  }
  const target = nation ?? club;
  if (target !== undefined && (club !== undefined) !== (tie.tie === "trainedAtClub")) {
    throw failure("relation.target", "that is not a nation or club of the game, of the kind this tie takes");
  }
  const after: Tie = {
    ...tie,
    ...(target !== undefined && { targetUid: target, name: targetName(tie.tie, target) }),
    ...(rule !== undefined && { rule }),
  };
  const ties = tiesOf(player);
  if (ties.some((t) => t.tie === after.tie && t.targetUid === after.targetUid && t.rule === after.rule)) {
    throw failure("relation.same", "the player has that already");
  }
  return logTie(player, tie, after, ties.map((t) => (t.index === index ? after : t)));
}

/** `remove_tie`: takes a fixture player's tie out of his list. */
function removeTie(uid: number, index: number): LoggedChange {
  const [player, tie] = tieAt(uid, index);
  return logTie(player, tie, null, tiesOf(player).filter((t) => t.index !== index));
}

/**
 * A new tie of `kind` to `target` for a fixture player at `index`, checked as the real commands check it: a training
 * takes a rule the editor writes, and he may not have it already.
 */
function newTie(player: PlayerSummary, index: number, kind: TieKind, target: number, rule?: number): Tie {
  const training = kind === "trainedInNation" || kind === "trainedAtClub";
  if (training !== (rule !== undefined) || (rule !== undefined && !HOMEGROWN_RULES.includes(rule))) {
    throw failure("relation.rule", `homegrown rule ${rule ?? 0} is not one the editor writes`, { rule: rule ?? 0 });
  }
  const days = kind === "workPermit" ? 515 : null;
  const tie: Tie = { index, tie: kind, targetUid: target, name: targetName(kind, target), rule: rule ?? null, days };
  if (tiesOf(player).some((t) => t.tie === kind && t.targetUid === target && t.rule === tie.rule)) {
    throw failure("relation.same", "the player has that already");
  }
  return tie;
}

/** `add_tie`: gives a fixture player a nationality, or a nation or club he was trained in. */
function addTie(uid: number, kind: TieKind, target: number, rule?: number): LoggedChange {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const ties = tiesOf(player);
  // As on Windows: a list without room is grown.
  const after = newTie(player, Math.max(0, ...ties.map((t) => t.index)) + 1, kind, target, rule);
  return logTie(player, null, after, [...ties, after]);
}

/** The fixture players whose bans were lifted through the editor, by UID, while the lifting is not undone. */
const liftedPlayers = new Set<number>();

/**
 * Cohesion with the club as Max cohesion set it, by UID. The rest have the made-up one `cohesionOf` gives, and one player
 * in seven none, as a player who has only just joined has no entry for his club yet.
 */
const cohesionSet = new Map<number, number>();

function cohesionOf(uid: number): number | null {
  if (cohesionSet.has(uid)) {
    return cohesionSet.get(uid)!;
  }
  return uid % 7 === 0 ? null : 1 + ((uid * 37) % 99);
}

/** The current bans of a fixture player: every eleventh one is banned, for one to three matches, until lifted. */
function bansOf(uid: number): Ban[] {
  if (uid % 11 !== 5 || liftedPlayers.has(uid)) {
    return [];
  }
  return [{ started: addDays(GAME_DATE, -3), matches: 1 + (uid % 3) }];
}

/** The fixture players' contract clauses as changed through the editor, by UID, and as they were before each change. */
const clausesSet = new Map<number, Clause[]>();
const clauseUndo = new Map<number, Clause[]>();
/** How many clauses each fixture contract's list holds: every third one has room for one more. */
const clauseCapacity = new Map<number, number>();

/** The clauses of a fixture contract: as changed through the editor, or as `generated`, numbered in order. */
function clausesOf(uid: number, generated: Clause[]): Clause[] {
  const listed = generated.map((clause, index) => ({ ...clause, index }));
  if (!clauseCapacity.has(uid)) {
    clauseCapacity.set(uid, listed.length + (uid % 3 === 0 ? 1 : 0));
  }
  return clausesSet.get(uid) ?? listed;
}

/** How many more clauses the fixture contract of `uid` has room for. */
function clauseRoomOf(uid: number): number {
  const capacity = clauseCapacity.get(uid) ?? 0;
  const listed = clausesSet.get(uid)?.length ?? capacity - (uid % 3 === 0 ? 1 : 0);
  return capacity - listed;
}

/** The fixture player `uid` and his contract's clauses, or the real commands' failures. */
function clausesAt(uid: number): [PlayerSummary, Clause[]] {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const clauses = details(player).contract?.clauses;
  if (!clauses) {
    throw failure("clause.noContract", "the player has no contract");
  }
  return [player, clauses];
}

/** Logs a change to a fixture contract's clauses, which then are `clauses`. */
function logClause(player: PlayerSummary, before: Clause | null, after: Clause | null, clauses: Clause[]): LoggedChange {
  const id = changes.length + 1;
  clauseUndo.set(id, clausesAt(player.uid)[1]);
  clausesSet.set(player.uid, clauses.map((clause, index) => ({ ...clause, index })));
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid: player.uid,
    field: "clause",
    old: before?.amount ?? 0,
    new: after?.amount ?? 0,
    undoneAt: null,
    batch: null,
    clause: { from: before, to: after },
  };
  changes.push(logged);
  return { ...logged };
}

// Stadium names ---------------------------------------------------------------------------------------------------

/** The stadiums renamed through the editor, by club UID, while the rename is not undone. */
const stadiumNames = new Map<number, string>();

/** The name of a fixture club's stadium, as renamed. */
function stadiumNameOf(club: ClubSummary): string {
  return stadiumNames.get(club.uid) ?? `${club.shortName} Park`;
}

/** Bytes of UTF-8, as the real app counts a name. */
const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/**
 * `stadium_name`: as the real command on Windows, any name up to 80 bytes; one club in eleven has a name other things
 * share, which the real command renames all the same, by giving the stadium a string of its own.
 */
function stadiumNameRoom(uid: number): StadiumName {
  const club = clubs.find((c) => c.uid === uid);
  if (!club) {
    throw notFound("club", uid);
  }
  return { name: stadiumNameOf(club), holders: uid % 11 === 3 ? 3 : 1, renamable: true, minBytes: 1, maxBytes: 80 };
}

/** `rename_stadium`: checked as the real command, and logged with the names; its undo puts the old one back. */
function renameStadium(uid: number, name: string): LoggedChange {
  const room = stadiumNameRoom(uid);
  // eslint-disable-next-line no-control-regex
  if (name === "" || name.trim() !== name || /[\u0000-\u001f\u007f]/.test(name)) {
    throw failure("stadium.badName", "a stadium's name cannot be empty, start or end with a space, or hold control characters");
  }
  const bytes = utf8Bytes(name);
  if (bytes < room.minBytes || bytes > room.maxBytes) {
    throw failure("stadium.nameLength", "a new name for this stadium must take 1 to 80 bytes", {
      min: String(room.minBytes),
      max: String(room.maxBytes),
      bytes: String(bytes),
    });
  }
  const club = clubs.find((c) => c.uid === uid)!;
  stadiumNames.set(uid, name);
  const logged: LoggedChange = {
    id: changes.length + 1,
    at: Date.now(),
    name: club.name,
    entity: "club",
    uid,
    field: "stadium.name",
    old: utf8Bytes(room.name),
    new: bytes,
    undoneAt: null,
    batch: null,
    stadium: { from: room.name, to: name },
  };
  changes.push(logged);
  return { ...logged };
}

/** `change_clause`: a new amount or condition for one of a fixture contract's clauses. */
function changeClause(uid: number, index: number, amount?: number, condition?: number): LoggedChange {
  const [player, clauses] = clausesAt(uid);
  const clause = clauses[index];
  if (!clause) {
    throw failure("clause.missing", `the contract has no clause number ${index}`, { index });
  }
  if ((amount !== undefined && clause.amount === null) || (condition !== undefined && clause.condition === null)) {
    const field = amount !== undefined && clause.amount === null ? "clause.amount" : "clause.condition";
    throw failure("clause.notInClause", "this clause has nothing of that kind to change", { field });
  }
  const after: Clause = { ...clause, ...(amount !== undefined && { amount }), ...(condition !== undefined && { condition }) };
  if (after.amount === clause.amount && after.condition === clause.condition) {
    throw failure("clause.same", "the contract has that already");
  }
  return logClause(player, clause, after, clauses.map((c) => (c.index === index ? after : c)));
}

/** `remove_clause`: takes one of a fixture contract's clauses out. */
function removeClause(uid: number, index: number): LoggedChange {
  const [player, clauses] = clausesAt(uid);
  const clause = clauses[index];
  if (!clause) {
    throw failure("clause.missing", `the contract has no clause number ${index}`, { index });
  }
  return logClause(player, clause, null, clauses.filter((c) => c.index !== index));
}

/** `add_release_clause`: gives a fixture contract without one a release clause, where its list has room. */
function addReleaseClause(uid: number, amount: number): LoggedChange {
  const [player, clauses] = clausesAt(uid);
  if (clauses.some((c) => c.kind === 0)) {
    throw failure("clause.same", "the contract has that already");
  }
  if (clauseRoomOf(uid) === 0) {
    throw failure("clause.noRoom", "the contract's list of clauses has no room for another, and the editor cannot make it bigger");
  }
  const after: Clause = { index: clauses.length, kind: 0, amount, condition: null };
  return logClause(player, null, after, [...clauses, after]);
}

/** The fixture players kept from retiring through the editor, by UID, while it is not undone. */
const keptPlayers = new Set<number>();

/** The retirement the game plans for a fixture player: every seventh one retires on 30 June next year, until kept. */
function retiresOf(uid: number): FmDate | null {
  if (uid % 7 !== 3 || keptPlayers.has(uid)) {
    return null;
  }
  return { year: GAME_DATE.year + 1, month: 6, day: 30 };
}

/** `keep_playing`: the fixture player's retirement is taken out of the plans, logged as a change of his `retirement`. */
function keepPlaying(uid: number): LoggedChange {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const retires = retiresOf(uid);
  if (retires === null) {
    throw failure("retirement.none", "the game has not planned the player's retirement, and he already means to play on");
  }
  keptPlayers.add(uid);
  const logged: LoggedChange = {
    id: changes.length + 1,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "retirement",
    old: retires.year * 10000 + retires.month * 100 + retires.day,
    new: 0,
    undoneAt: null,
    batch: null,
  };
  changes.push(logged);
  return { ...logged };
}

/** Job codes as stored in contracts (see labels.ts). */
const JOBS = [16, 20, 2, 2, 2, 34, 26, 14, 14, 44, 12, 60, 64, 88, 10, 38, 46, 62];
const STAFF_ATTRIBUTES = [
  "attacking", "defending", "fitness", "goalkeeping", "possession", "set_pieces", "tactical", "technical",
  "determination", "motivating", "people_management", "data_analysis", "judging_ability", "judging_potential",
  "judging_staff", "negotiating", "tactical_knowledge", "physiotherapy", "sports_science",
];
const STAFF_RATINGS = ["working_with_youngsters", "authority"];

/** Every sixth member of the fixture staff is a woman, who works for a women's club if she has a job. */
const isStaffWoman = (index: number) => index % 6 === 3;

const staff: StaffSummary[] = (() => {
  const next = random(1984);
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];
  return Array.from({ length: 120 }, (_, i) => {
    const born: FmDate = { year: 1955 + Math.floor(next() * 40), month: 1 + Math.floor(next() * 12), day: 1 + Math.floor(next() * 28) };
    const ca = Math.round(40 + next() * 140);
    const employed = i === 0 || next() < 0.85;
    // A woman's first name takes the place of the one drawn, so the other fields come out as before.
    const first = pick(FIRST);
    return {
      uid: 2_000_000 + i * 53,
      name: `${isStaffWoman(i) ? FIRST_WOMEN[i % FIRST_WOMEN.length] : first} ${pick(LAST)}`,
      fullName: null,
      dateOfBirth: born,
      age: ageOn(born, GAME_DATE),
      ...withUids(pick(NATIONS), employed ? pick(CLUBS) : null, isStaffWoman(i)),
      job: i === 0 ? 16 : employed ? pick(JOBS) : null,
      currentAbility: ca,
      potentialAbility: Math.min(200, ca + Math.round(next() * 30)),
      isHuman: i === 0,
    };
  });
})();

/** Whether the fixture player or member of staff is a woman, as the real rows know it from the game's gender flags. */
const womenStaff = new Set(staff.filter((_, i) => isStaffWoman(i)).map((s) => s.uid));
const isWoman = (uid: number) => women.has(uid) || womenStaff.has(uid);

/** Made-up but self-consistent profile for a fixture member of staff. */
function staffDetails(member: StaffSummary): StaffDetails {
  const next = random(member.uid);
  const level = generatedAbility.get(member.uid)! / 2;
  const attributes = Object.fromEntries([
    ...STAFF_ATTRIBUTES.map((key) => {
      const raw = Math.max(1, Math.min(100, Math.round(level + (next() - 0.5) * 50)));
      return [key, { raw, value: Math.max(1, Math.min(20, Math.floor((raw + 2) / 5))) }];
    }),
    ...STAFF_RATINGS.map((key) => {
      const value = Math.round(1 + next() * 19);
      return [key, { raw: value, value }];
    }),
  ]);
  const personality = Object.fromEntries(PERSONALITY.map((key) => [key, Math.round(1 + next() * 19)]));
  return withWritten("staff", {
    ...member,
    reputation: { home: Math.round(next() * 10000), current: Math.round(next() * 10000), world: Math.round(next() * 10000) },
    personality,
    attributes,
    contract:
      member.job === null
        ? null
        : {
            wage: Math.round(generatedAbility.get(member.uid)! * 400 + next() * 20000),
            signed: { year: 2026, month: 6, day: 29 },
            expires: { year: 2027 + Math.floor(next() * 4), month: 6, day: 30 },
            joined: { year: 2021 + Math.floor(next() * 5), month: 7, day: 1 },
            job: member.job,
          },
  });
}

/** Each fixture person's current ability as generated: their made-up profile is built around it, edited or not. */
const generatedAbility = new Map<number, number>([...players, ...staff].map((p) => [p.uid, p.currentAbility]));

// Editing ---------------------------------------------------------------------------------------------------------

/** The staff attributes in the order the real field table has them (coaching, mental, knowledge, medical). */
const STAFF_ATTRIBUTE_ORDER = [
  "attacking", "defending", "fitness", "goalkeeping", "possession", "set_pieces", "tactical", "technical",
  "working_with_youngsters", "authority", "determination", "motivating", "people_management", "data_analysis",
  "judging_ability", "judging_potential", "judging_staff", "negotiating", "tactical_knowledge", "physiotherapy",
  "sports_science",
];

/** The international fields' keys and the profile's names for them. */
const INTERNATIONAL = { caps: "caps", goals: "goals", u21_caps: "u21Caps", u21_goals: "u21Goals" } as const;

/** The editable fields, as the real `edit_fields` lists them. */
function fieldTable(entity: Entity): EditField[] {
  const field = (
    key: string,
    kind: EditField["kind"],
    min: number,
    max: number,
    scale: EditField["scale"] = "plain",
  ): EditField => ({ key, entity, kind, scale, min, max, blank: null, choices: null, mass: true });
  // A player's squad number (255: none), squad status and listing are changed one player at a time.
  const playerContract: EditField[] = [
    { ...field("contract.squad_number", "u8", 1, 99), blank: 255, mass: false },
    { ...field("contract.squad_status", "u8", 1, 40), choices: [1, 2, 3, 4, 5], mass: false },
    { ...field("contract.transfer_listed", "flag", 0, 1), mass: false },
    { ...field("contract.loan_listed", "flag", 0, 1), mass: false },
    field("contract.loyalty_bonus", "i32", 0, 10_000_000),
    field("contract.happiness", "i8", -100, 100),
    field("contract.playing_time_happiness", "i8", -100, 100),
    field("contract.unhappiness", "u32", 0, 0),
    ...Array.from({ length: 64 }, (_, bit) => field(`trait.${bit}`, "flag", 0, 1)),
  ];
  const common = [
    field("current_ability", "u16", 1, 200),
    field("potential_ability", "i16", 1, 200),
  ];
  const reputation = ["home", "current", "world"].map((key) => field(`reputation.${key}`, "u16", 0, 10_000));
  const personality = PERSONALITY.map((key) => field(`personality.${key}`, "u8", 1, 20));
  const contract = [field("contract.wage", "i32", 0, 10_000_000), field("contract.expires", "date", 20000101, 21001231)];
  if (entity === "club") {
    return [
      field("reputation", "u16", 0, 10_000),
      ...CLUB_FACILITIES.map((key) => field(`facilities.${key}`, "u8", 1, 20)),
      field("finance.balance", "i32", -2_000_000_000, 2_000_000_000),
      field("finance.transfer_budget", "i32", 0, 2_000_000_000),
      field("finance.wage_budget", "i32", 0, 100_000_000),
      field("finance.total_wage_budget", "i32", 0, 100_000_000),
      ...["capacity", "seating", "used", "expansion"].map((key) => field(`stadium.${key}`, "u32", 0, 250_000)),
    ];
  }
  if (entity === "player") {
    return [
      ...common,
      field("height", "u16", 140, 220),
      { ...field("nation", "pointer", 0x1_0000, 0x7fff_ffff_ffff), mass: false },
      field("date_of_birth", "date", 19400101, 20201231),
      { ...field("asking_price", "i32", 0, 2_000_000_000), blank: -1 },
      ...reputation,
      field("international.caps", "u16", 0, 1000),
      field("international.goals", "u16", 0, 1000),
      field("international.u21_caps", "u8", 0, 255),
      field("international.u21_goals", "u8", 0, 255),
      field("condition", "u16", 0, 10_000, "percent"),
      field("match_sharpness", "u16", 3_500, 10_000, "percent"),
      field("jadedness", "i16", -500, 1000),
      field("morale", "u8", 1, 20),
      ...ATTRIBUTES.map((key) => field(`attribute.${key}`, "u8", 1, 100, "attribute")),
      // The game no longer plays a sweeper, so the real table leaves it out.
      ...POSITIONS.filter((key) => key !== "sw").map((key) => field(`position.${key}`, "u8", 1, 20)),
      ...personality,
      ...contract,
      ...playerContract,
      // One player at a time, and only to a day after the game's date.
      { ...field("loan.expires", "date", 20000101, 21001231), mass: false },
      // Pounds; -1 is none, which a recall writes.
      { ...field("loan.option_fee", "i32", 0, 2_000_000_000), mass: false, blank: -1 },
    ];
  }
  return [
    ...common,
    ...reputation,
    { ...field("nation", "pointer", 0x1_0000, 0x7fff_ffff_ffff), mass: false },
    ...STAFF_ATTRIBUTE_ORDER.map((key) =>
      STAFF_RATINGS.includes(key)
        ? field(`attribute.${key}`, "u8", 1, 20)
        : field(`attribute.${key}`, "u8", 0, 100, "attribute"),
    ),
    ...personality,
    ...contract,
  ];
}

/** The club facilities the editor changes, in the order of the real field table. */
const CLUB_FACILITIES = ["training", "youth_facilities", "youth_coaching", "youth_recruitment", "corporate"];

/** The finance fields' keys and the profile's names for them. */
const FINANCE = {
  balance: "balance",
  transfer_budget: "transferBudget",
  wage_budget: "wageBudget",
  total_wage_budget: "totalWageBudget",
} as const;

/**
 * Values written through the editor that the generated profiles would not show, by `entity:uid` and field key.
 * Ability and position ratings go straight into the list rows instead, which the profiles are built from.
 */
const written = new Map<string, FieldValues>();

/** Every change written in this browser session, oldest first. */
const changes: LoggedChange[] = [];

/** A generated profile with the values written through the editor on top. */
function withWritten<D extends PlayerDetails | StaffDetails>(entity: Entity, d: D): D {
  for (const [key, value] of Object.entries(written.get(`${entity}:${d.uid}`) ?? {})) {
    const [group, name = ""] = key.split(".");
    switch (group) {
      case "attribute":
        d.attributes[name] = STAFF_RATINGS.includes(name)
          ? { raw: value, value }
          : { raw: value, value: Math.max(1, Math.min(20, Math.floor((value + 2) / 5))) };
        break;
      case "personality":
        d.personality[name] = value;
        break;
      case "reputation":
        d.reputation[name as "home" | "current" | "world"] = value;
        break;
      case "height":
        (d as PlayerDetails).heightCm = value;
        break;
      case "asking_price":
        (d as PlayerDetails).askingPrice = value === -1 ? null : value;
        break;
      case "condition":
        (d as PlayerDetails).condition = value;
        break;
      case "match_sharpness":
        (d as PlayerDetails).matchSharpness = value;
        break;
      case "jadedness":
        (d as PlayerDetails).jadedness = value;
        break;
      case "morale":
        (d as PlayerDetails).morale = value;
        break;
      case "trait": {
        const traits = new Set((d as PlayerDetails).traits);
        if (value === 1) traits.add(Number(name));
        else traits.delete(Number(name));
        (d as PlayerDetails).traits = [...traits].sort((a, b) => a - b);
        break;
      }
      case "international":
        (d as PlayerDetails).international[INTERNATIONAL[name as keyof typeof INTERNATIONAL]] = value;
        break;
      case "loan": {
        const loan = (d as PlayerDetails).loan;
        if (name === "option_fee" && loan?.terms) {
          loan.terms.optionFee = value < 0 ? null : value;
        }
        if (name === "expires" && loan) {
          loan.until = dateFromNumber(value);
          loan.ends = loanEnd(loan.until);
          // As the real app tells: the end this session's recall wrote, not undone.
          loan.recalled = changes.some(
            (c) => c.uid === d.uid && c.field === "loan.expires" && c.undoneAt === null && c.new === value,
          );
        }
        break;
      }
      case "contract":
        if (d.contract && name === "wage") {
          d.contract.wage = value;
        } else if (d.contract && name === "expires") {
          d.contract.expires = dateFromNumber(value);
        } else if (entity === "player" && (d as PlayerDetails).contract) {
          // What only a player's contract has.
          const contract = (d as PlayerDetails).contract!;
          if (name === "squad_number") {
            contract.squadNumber = value === 255 ? null : value;
          } else if (name === "squad_status") {
            contract.squadStatus = value;
          } else if (name === "transfer_listed") {
            contract.transferListed = value === 1;
          } else if (name === "loan_listed") {
            contract.loanListed = value === 1;
          } else if (name === "loyalty_bonus") {
            contract.loyaltyBonus = value;
          } else if (name === "happiness") {
            contract.happiness = value;
          } else if (name === "playing_time_happiness") {
            contract.playingTimeHappiness = value;
          } else if (name === "unhappiness") {
            // Only ever set to none; an undo puts the count back, which the made-up list cannot follow.
            contract.concerns = value === 0 ? [] : contract.concerns;
          }
        }
        break;
    }
  }
  return d;
}

/** A generated club profile with the values written through the editor on top. */
function withWrittenClub(d: ClubDetails): ClubDetails {
  for (const [key, value] of Object.entries(written.get(`club:${d.uid}`) ?? {})) {
    const [group, name = ""] = key.split(".");
    if (group === "facilities") {
      d.facilities[name] = value;
    } else if (group === "finance" && d.finances) {
      d.finances[FINANCE[name as keyof typeof FINANCE]] = value;
    } else if (group === "stadium" && d.stadium) {
      d.stadium[name as "capacity" | "seating" | "used" | "expansion"] = value;
    }
  }
  return d;
}

/** A failure the way the real commands report one (see `Failure`): its code, the values it names, and the English. */
function failure(code: string, message: string, params: Record<string, string | number> = {}): Failure {
  return { code, message, params: Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) };
}

/** The real commands' failure for a player, member of staff or club the lists do not have. */
const notFound = (entity: Entity, uid: number) => failure("app.notFound", `No ${entity} with id ${uid}`, { entity, uid });

/** The profile of the person or club, or an error like the real commands give. */
function profileOf(entity: Entity, uid: number): PlayerDetails | StaffDetails | ClubDetails {
  const found =
    entity === "player"
      ? players.find((p) => p.uid === uid)
      : entity === "staff"
        ? staff.find((s) => s.uid === uid)
        : clubs.find((c) => c.uid === uid);
  if (!found) {
    throw notFound(entity, uid);
  }
  return entity === "player"
    ? details(found as PlayerSummary)
    : entity === "staff"
      ? staffDetails(found as StaffSummary)
      : clubDetails(found as ClubSummary);
}

/**
 * The stored value of every field that can be edited now, as `read_values` returns it: like the real command it
 * leaves out contract fields without a contract, a contract end that is not set, and a club's missing finances.
 */
function currentValues(entity: Entity, uid: number): FieldValues {
  const d = profileOf(entity, uid);
  const person = d as PlayerDetails & StaffDetails;
  const club = d as ClubDetails;
  const value = (key: string): number | null | undefined => {
    const [group, name = ""] = key.split(".");
    switch (group) {
      case "current_ability":
        return person.currentAbility;
      case "potential_ability":
        return person.potentialAbility;
      case "height":
        return person.heightCm;
      case "date_of_birth":
        return person.dateOfBirth && numberFromDate(person.dateOfBirth);
      case "nation":
        return person.nation === null ? undefined : nationAddress(person.nation);
      case "asking_price":
        return (person as PlayerDetails).askingPrice ?? -1;
      case "condition":
        return person.condition;
      case "match_sharpness":
        return person.matchSharpness;
      case "jadedness":
        return (person as PlayerDetails).jadedness;
      case "morale":
        return person.morale;
      case "trait":
        return Number((person as PlayerDetails).traits.includes(Number(name)));
      case "reputation":
        return entity === "club" ? club.reputation : person.reputation[name as "home" | "current" | "world"];
      case "international":
        return person.international[INTERNATIONAL[name as keyof typeof INTERNATIONAL]];
      case "attribute":
        return person.attributes[name].raw;
      case "position":
        return person.positionRatings[name];
      case "personality":
        return person.personality[name];
      case "contract": {
        const contract = (person as PlayerDetails).contract;
        switch (name) {
          case "wage":
            return person.contract?.wage;
          case "expires":
            return person.contract?.expires && numberFromDate(person.contract.expires);
          // Only a player's contract has these; the real table offers them for players only.
          case "squad_number":
            return contract && (contract.squadNumber ?? 255);
          case "squad_status":
            return contract?.squadStatus;
          case "transfer_listed":
            return contract && Number(contract.transferListed);
          case "loan_listed":
            return contract && Number(contract.loanListed);
          case "loyalty_bonus":
            return contract?.loyaltyBonus;
          case "happiness":
            return contract?.happiness;
          case "playing_time_happiness":
            return contract?.playingTimeHappiness;
          case "unhappiness":
            return contract && contract.concerns.length > 0 ? contract.concerns.length : undefined;
        }
        return undefined;
      }
      case "loan": {
        const loan = (person as PlayerDetails).loan;
        if (name === "option_fee") {
          return loan?.terms ? (loan.terms.optionFee ?? -1) : undefined;
        }
        return name === "expires" ? loan?.until && numberFromDate(loan.until!) : undefined;
      }
      case "facilities":
        return club.facilities[name];
      case "finance":
        return club.finances?.[FINANCE[name as keyof typeof FINANCE]];
      case "stadium":
        return club.stadium?.[name as "capacity" | "seating" | "used" | "expansion"];
    }
    throw new Error(`No fixture value for ${key}`);
  };
  return Object.fromEntries(
    fieldTable(entity).flatMap((f) => {
      const v = value(f.key);
      return v === null || v === undefined ? [] : [[f.key, v]];
    }),
  );
}

/** Stores `value` as the game would: what the list rows show in them, the rest on top of the profiles. */
function writeValue(entity: Entity, uid: number, key: string, value: number): void {
  const [group, name = ""] = key.split(".");
  if (entity === "club") {
    const club = clubs.find((c) => c.uid === uid);
    if (club && key === "reputation") {
      club.reputation = value;
      return;
    }
  } else {
    const row = entity === "player" ? players.find((p) => p.uid === uid) : staff.find((s) => s.uid === uid);
    if (row && group === "current_ability") {
      row.currentAbility = value;
      return;
    }
    if (row && group === "potential_ability") {
      row.potentialAbility = value;
      return;
    }
    if (entity === "player" && group === "position") {
      ratings[uid][name] = value;
      (row as PlayerSummary).positions = playablePositions(ratings[uid]);
      return;
    }
    const nation = key === "nation" ? nationAt(value) : undefined;
    if (row && nation !== undefined) {
      // The list row has the nation, and the profile is built from the row.
      Object.assign(row, { nation, nationUid: 1000 + NATIONS.indexOf(nation) });
      return;
    }
    if (entity === "player" && key === "date_of_birth") {
      // The list row has the birth date and the age, and the profile is built from the row.
      const player = row as PlayerSummary;
      player.dateOfBirth = dateFromNumber(value);
      player.age = player.dateOfBirth && ageOn(player.dateOfBirth, GAME_DATE);
      return;
    }
    if (entity === "player" && key === "contract.expires") {
      // The list row has the contract end, and the profile builds its contract from the row.
      (row as PlayerSummary).contractExpires = dateFromNumber(value);
      return;
    }
  }
  const slot = `${entity}:${uid}`;
  written.set(slot, { ...written.get(slot), [key]: value });
}

/** `apply_edits`: every edit is checked and written on its own, like the real command, with the same messages. */
function applyEdits(entity: Entity, uid: number, edits: FieldEdit[]): ApplyReport {
  const name = profileOf(entity, uid).name;
  const report: ApplyReport = { applied: [], failed: [] };
  for (const edit of edits) {
    const field = fieldTable(entity).find((f) => f.key === edit.field);
    if (!field) {
      const message = `${entity} has no editable field ${edit.field}`;
      report.failed.push({ ...edit, error: failure("edit.unknownField", message, { entity, field: edit.field }) });
      continue;
    }
    // Like the real command, a field also takes its blank (a squad number of 255 is none).
    const takes = edit.value === field.blank || (edit.value >= field.min && edit.value <= field.max);
    if (!Number.isInteger(edit.value) || !takes) {
      const message = `${edit.value} is not a valid ${field.key}; it takes ${field.min} to ${field.max}`;
      const params = { field: field.key, value: edit.value, min: field.min, max: field.max };
      report.failed.push({ ...edit, error: failure("edit.outOfRange", message, params) });
      continue;
    }
    if (field.kind === "date" && dateFromNumber(edit.value) === null) {
      const message = `${edit.value} is not a date for ${field.key}`;
      report.failed.push({ ...edit, error: failure("edit.notADate", message, { field: field.key, value: edit.value }) });
      continue;
    }
    // Like the real command, a loan ends on a day the game is yet to finish: today or later.
    const today = numberFromDate(GAME_DATE);
    if (field.key === "loan.expires" && edit.value < today) {
      const message = `${edit.value} is not a valid ${field.key}; it takes ${today} to ${field.max}`;
      const params = { field: field.key, value: edit.value, min: today, max: field.max };
      report.failed.push({ ...edit, error: failure("edit.outOfRange", message, params) });
      continue;
    }
    const old: number | undefined = currentValues(entity, uid)[field.key];
    if (old === undefined) {
      // No contract, no contract end, or a club without full finances.
      const message = `${field.key} cannot be changed here: its record is missing or does not check out`;
      report.failed.push({ ...edit, error: failure("edit.noRecord", message, { field: field.key }) });
      continue;
    }
    if (old === edit.value) {
      continue;
    }
    writeValue(entity, uid, field.key, edit.value);
    const logged: LoggedChange = {
      id: changes.length + 1,
      at: Date.now(),
      name,
      entity,
      uid,
      field: field.key,
      old,
      new: edit.value,
      undoneAt: null,
      batch: null,
    };
    changes.push(logged);
    report.applied.push({ ...logged });
  }
  return report;
}

/**
 * `recall_loan`: the loan now ends on the game's date, its last day, written and logged like an edit of
 * `loan.expires`; null when it ends then already.
 */
function recallLoan(uid: number): LoggedChange | null {
  const option = currentValues("player", uid)["loan.option_fee"];
  const report = applyEdits("player", uid, [{ field: "loan.expires", value: numberFromDate(GAME_DATE) }]);
  if (report.failed.length > 0) {
    throw report.failed[0].error;
  }
  const logged = report.applied[0] ?? null;
  // As the real command: the loan's option to buy goes too, noted on the recall, whose undo writes it back.
  if (logged && option !== undefined && option >= 0) {
    writeValue("player", uid, "loan.option_fee", -1);
    const entry = changes.find((c) => c.id === logged.id)!;
    entry.recall = { optionFee: option };
    return { ...entry };
  }
  return logged;
}

/** `undo_change`: writes the old value back unless the value has changed since. */
// Staff: moves and jobs ---------------------------------------------------------------------------------------------

/** The jobs the real `change_staff_job` gives, by contract code: the last two a director of football's and a manager's. */
const STAFF_JOBS = [2, 20, 22, 26, 34, 60, 62, 64, 12, 38, 40, 46, 48, 50, 14, 44, 58, 86, 88, 10, 16];

/** The job code of a director of football, whom a club has one of at most. */
const DIRECTOR_OF_FOOTBALL = 10;

/** The job code of a manager, whom a club's senior team has one of at most. */
const MANAGER = 16;

/** What a member of staff's move, new job or signing changed, by the change's id: his list row as it was. */
const staffUndo = new Map<number, Pick<StaffSummary, "club" | "clubUid" | "job">>();

/** The member of staff `uid`, checked as the real commands check him before a move, a new job or a signing. */
function movableStaff(uid: number, signing = false): StaffSummary {
  const member = staff.find((s) => s.uid === uid);
  if (!member) {
    throw notFound("staff", uid);
  }
  if (member.isHuman) {
    throw failure("staff.you", "this is you, the human manager");
  }
  if (member.clubUid === null && !signing) {
    throw failure("staff.unemployed", "the member of staff has no club");
  }
  return member;
}

/** A plan from one club to another: every one but a signing. */
type ClubToClub = MovePreview & { from: ClubName };

/** A job the real commands give: refused otherwise, with their message. */
function givenJob(code: number | null): number {
  if (code === null || !STAFF_JOBS.includes(code)) {
    throw failure("staff.job", `job ${code} is not one the editor gives or takes away`, { job: code ?? 0 });
  }
  return code;
}

/**
 * Refuses a director of football or a manager for a club that has one, other than `member`, as the real commands do:
 * never the human manager's place.
 */
function checkDirector(clubUid: number, job: number, member: StaffSummary) {
  const director = staff.find((s) => s.clubUid === clubUid && s.job === DIRECTOR_OF_FOOTBALL && s.uid !== member.uid);
  if (job === DIRECTOR_OF_FOOTBALL && director) {
    const message = `the club has a director of football already (the member of staff with id ${director.uid})`;
    throw failure("staff.directorTaken", message, { uid: director.uid, name: director.name });
  }
  const manager = staff.find((s) => s.clubUid === clubUid && s.job === MANAGER && s.uid !== member.uid);
  if (job === MANAGER && manager?.isHuman) {
    throw failure("staff.yourClub", "you manage this club; give this member of staff another job there");
  }
  if (job === MANAGER && manager) {
    const message = `the club has a manager already (the member of staff with id ${manager.uid})`;
    throw failure("staff.managerTaken", message, { uid: manager.uid, name: manager.name });
  }
}

/**
 * `plan_staff_move`: the checks of the real command that the fixtures can have, with its messages. One with no club is
 * signed as `job`, on a contract made on `terms`.
 */
function planStaffMove(uid: number, clubUid: number, job?: number, terms: MoveTerms = {}): MovePreview {
  const member = movableStaff(uid, true);
  const to = clubs.find((c) => c.uid === clubUid);
  if (!to) {
    throw notFound("club", clubUid);
  }
  if (member.clubUid === null) {
    if (job === undefined) {
      throw failure("staff.noJob", "choose the job the member of staff takes at the club");
    }
    if (to.women !== isWoman(member.uid)) {
      throw failure("move.menAndWomen", "one club is a men's club and the other a women's club");
    }
    checkDirector(clubUid, givenJob(job), member);
    const staffContract = { wage: terms.wage ?? 2_500, expires: terms.expires ?? 20290630 };
    return { to: { uid: to.uid, name: to.name }, staffContract };
  }
  if (member.clubUid === clubUid) {
    throw failure("move.sameClub", "the player is at this club already");
  }
  const from = clubs.find((c) => c.uid === member.clubUid)!;
  if (to.women !== from.women) {
    throw failure("move.menAndWomen", "one club is a men's club and the other a women's club");
  }
  if (job !== undefined) {
    givenJob(member.job);
    givenJob(job);
  }
  checkDirector(clubUid, job ?? member.job ?? 0, member);
  return { from: { uid: from.uid, name: from.name }, to: { uid: to.uid, name: to.name } };
}

/** Logs a member of staff's move or new job, as the real commands do, keeping his row as it was for undoing it. */
function logStaff(member: StaffSummary, field: string, old: number, value: number, moved?: LoggedChange["moved"]) {
  const id = changes.length + 1;
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: member.name,
    entity: "staff",
    uid: member.uid,
    field,
    old,
    new: value,
    undoneAt: null,
    batch: null,
    ...(moved && { moved }),
  };
  changes.push(logged);
  return { ...logged };
}

function moveStaff(uid: number, clubUid: number, job?: number, terms: MoveTerms = {}): LoggedChange {
  const preview = planStaffMove(uid, clubUid, job, terms);
  const member = staff.find((s) => s.uid === uid)!;
  const was = { club: member.club, clubUid: member.clubUid, job: member.job };
  staffUndo.set(changes.length + 1, was);
  member.club = preview.to.name;
  member.clubUid = preview.to.uid;
  member.job = job ?? member.job;
  const moved = { ...(preview.from && { from: preview.from.name }), to: preview.to.name };
  return logStaff(member, "club", preview.from?.uid ?? 0, preview.to.uid, moved);
}

function changeStaffJob(uid: number, job: number): LoggedChange {
  const member = movableStaff(uid);
  givenJob(member.job);
  givenJob(job);
  checkDirector(member.clubUid!, job, member);
  const was = { club: member.club, clubUid: member.clubUid, job: member.job };
  staffUndo.set(changes.length + 1, was);
  const old = member.job!;
  member.job = job;
  return logStaff(member, "contract.job", old, job);
}

function undoChange(id: number): LoggedChange {
  const entry = changes.find((c) => c.id === id);
  if (!entry) {
    throw failure("app.noChange", `No change ${id}`, { id });
  }
  if (entry.undoneAt !== null) {
    throw failure("app.alreadyUndone", "This change has already been undone.");
  }
  const staffRow = entry.entity === "staff" ? staffUndo.get(entry.id) : undefined;
  if (staffRow) {
    Object.assign(staff.find((s) => s.uid === entry.uid)!, staffRow);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.moved) {
    undoMove(entry);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.field === "injuries") {
    unhealed(entry.uid);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.field === "bans") {
    liftedPlayers.delete(entry.uid);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.field === "cohesion") {
    cohesionSet.set(entry.uid, entry.old);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.field === "retirement") {
    keptPlayers.delete(entry.uid);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.clause) {
    clausesSet.set(entry.uid, clauseUndo.get(entry.id)!);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.stadium) {
    stadiumNames.set(entry.uid, entry.stadium.from);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.tie) {
    tiesSet.set(entry.uid, tieUndo.get(entry.id)!);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  if (entry.captaincy) {
    undoCaptain(entry);
    entry.undoneAt = Date.now();
    return { ...entry };
  }
  const found = currentValues(entry.entity, entry.uid)[entry.field];
  if (found !== entry.new) {
    const message = `${entry.field} is now ${found}, not ${entry.new}; the game has changed it since`;
    throw failure("edit.conflict", message, { field: entry.field, expected: entry.new, found: found ?? 0 });
  }
  writeValue(entry.entity, entry.uid, entry.field, entry.old);
  // A recall that took the loan's option to buy away writes it back too, as the real undo does.
  if (entry.recall) {
    writeValue(entry.entity, entry.uid, "loan.option_fee", entry.recall.optionFee);
  }
  entry.undoneAt = Date.now();
  return { ...entry };
}

// Moves to other clubs ----------------------------------------------------------------------------------------------

/** The players moved to another club, with how many of their moves are not undone. */
const movedPlayers = new Map<number, number>();

/** What a list row says about the player's club and contract end. */
type ClubRow = Pick<PlayerSummary, "club" | "clubUid" | "contractExpires">;

/**
 * What each move (by the id of its logged change) found in the list row and on top of the profile, for its undo; a
 * swap also keeps the row of the player who went the other way, and a move that made room the row of the player it
 * released.
 */
const moveUndo = new Map<
  number,
  {
    row: ClubRow;
    written?: FieldValues;
    other?: { uid: number; row: ClubRow };
    released?: { uid: number; row: ClubRow };
    paid?: [number, string, number][];
  }
>();

/** The most a transfer fee can be, as in the real commands. */
const MAX_FEE = 2_000_000_000;

/**
 * What paying `fee` does to the money of the clubs `to` (which pays it out of its balance and transfer budget) and
 * `from` (whose balance takes it), as the real command works it out; a club without finances is left alone.
 */
function feePlan(from: number, to: number, fee: number): FeePlan {
  if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE) {
    throw failure("edit.outOfRange", `${fee} is not a valid fee; it takes 0 to ${MAX_FEE}`, {
      field: "fee",
      value: fee,
      min: 0,
      max: MAX_FEE,
    });
  }
  const money = (club: number, buying: boolean): ClubMoney | null => {
    const now = currentValues("club", club);
    const balance = now["finance.balance"];
    if (balance === undefined) {
      return null;
    }
    const budget = now["finance.transfer_budget"];
    return {
      club,
      balance: { before: balance, after: buying ? balance - fee : balance + fee },
      transferBudget:
        buying && budget !== undefined && budget >= 0 ? { before: budget, after: Math.max(0, budget - fee) } : null,
    };
  };
  return { fee, buyer: money(to, true), seller: money(from, false) };
}

/** The men's fixture club whose squad list is full, so that the move dialog's offer to make room can be seen. */
const FULL_CLUB = 500 + (CLUBS.length - 1) * 7;

/**
 * `room_makers`: the senior players of the fixture club that are not out on loan, in the real command's order: those
 * neither injured nor a captain first, the weakest first among each.
 */
function roomMakers(clubUid: number): RoomMaker[] {
  const teams = clubSquads(clubUid);
  const captains = new Set(teams.flatMap((team) => [team.captain, team.viceCaptain]));
  const makers = teams[0].players
    .filter((member) => member.loan === null)
    .map((member): RoomMaker => {
      const row = players.find((p) => p.uid === member.uid)!;
      return { ...row, injured: member.injuries > 0, captain: captains.has(member.uid) };
    });
  const worse = (maker: RoomMaker) => (maker.injured || maker.captain ? 1 : 0);
  return makers.sort((a, b) => worse(a) - worse(b) || a.currentAbility - b.currentAbility);
}

/**
 * `plan_club_move`: the checks of the real command that the fixtures can have, with its messages. With `release`,
 * that player of the club makes room: he must be one `room_makers` lists.
 */
function planMove(uid: number, clubUid: number, terms: MoveTerms, fee?: number, release?: number): MovePreview {
  const player = players.find((p) => p.uid === uid);
  const to = clubs.find((c) => c.uid === clubUid);
  if (!player) {
    throw notFound("player", uid);
  }
  if (!to) {
    throw notFound("club", clubUid);
  }
  const outOfRange = (field: string, value: number, min: number, max: number) =>
    failure("move.outOfRange", `${value} is not a valid ${field}; it takes ${min} to ${max}`, { field, value, min, max });
  if (terms.wage !== undefined && (!Number.isInteger(terms.wage) || terms.wage < 0 || terms.wage > 10_000_000)) {
    throw outOfRange("contract.wage", terms.wage, 0, 10_000_000);
  }
  const tomorrow = numberFromDate(GAME_DATE) + 1;
  if (terms.expires !== undefined && (dateFromNumber(terms.expires) === null || terms.expires < tomorrow || terms.expires > 21001231)) {
    throw outOfRange("contract.expires", terms.expires, tomorrow, 21001231);
  }
  if (player.clubUid === null) {
    // A free agent is signed under a contract made for him, as the real command does: the wage given or one like the
    // club's, and the end date given or 30 June at the end of next season.
    if (to.women !== isWoman(uid)) {
      throw failure("move.menAndWomen", "one club is a men's club and the other a women's club");
    }
    const seasonEnds = GAME_DATE.month <= 6 ? GAME_DATE.year : GAME_DATE.year + 1;
    return {
      to: { uid: to.uid, name: to.name },
      contract: {
        wage: terms.wage ?? 25_000,
        expires: terms.expires ?? (seasonEnds + 1) * 10_000 + 630,
        squadStatus: player.positions.includes("gk") ? 20 : 4,
      },
    };
  }
  if (player.clubUid === clubUid) {
    throw failure("move.sameClub", "the player is at this club already");
  }
  if (to.women !== clubs.find((c) => c.uid === player.clubUid)?.women) {
    throw failure("move.menAndWomen", "one club is a men's club and the other a women's club");
  }
  if (release !== undefined) {
    if (!players.some((p) => p.uid === release)) {
      throw notFound("player", release);
    }
    if (!roomMakers(clubUid).some((maker) => maker.uid === release)) {
      throw failure("move.notListed", "the squad lists do not hold the player where they should");
    }
  } else if (clubUid === FULL_CLUB) {
    const message = "the club's squad list has no room for another player (36 now), and the editor cannot make it bigger";
    throw failure("move.noRoom", message, { players: 36 });
  }
  const from = clubs.find((c) => c.uid === player.clubUid)!;
  return {
    from: { uid: from.uid, name: from.name },
    to: { uid: to.uid, name: to.name },
    ...(fee !== undefined && fee > 0 && { fee: feePlan(from.uid, to.uid, fee) }),
  };
}

/**
 * `move_player`: moves the fixture player and logs it as a change of his `club`; with `release`, that player of the
 * club becomes a free agent in the same change.
 */
/**
 * Pays the fee of `preview`, as the real commands pay one: each amount by what it changes, so that undoing takes back
 * just that. What was paid, for the undo.
 */
function payFee(preview: MovePreview): [number, string, number][] {
  const paid: [number, string, number][] = [];
  for (const money of [preview.fee?.buyer, preview.fee?.seller]) {
    if (money) {
      paid.push([money.club, "finance.balance", money.balance.after - money.balance.before]);
      writeValue("club", money.club, "finance.balance", money.balance.after);
      if (money.transferBudget) {
        paid.push([money.club, "finance.transfer_budget", money.transferBudget.after - money.transferBudget.before]);
        writeValue("club", money.club, "finance.transfer_budget", money.transferBudget.after);
      }
    }
  }
  return paid;
}

/**
 * `plan_loan_permanent`: a fixture player on loan can stay at the club he is on loan to, on the terms, that club paying
 * his own one the fee; the same checks of the terms as a move.
 */
function planLoanPermanent(uid: number, terms: MoveTerms, fee?: number): ClubToClub {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const loan = loanOf(player);
  const from = loan && clubs.find((c) => c.uid === loan.parentUid);
  const to = loan && clubs.find((c) => c.uid === loan.clubUid);
  if (!from || !to) {
    throw failure("move.notOnLoan", "the player is not on loan");
  }
  const outOfRange = (field: string, value: number, min: number, max: number) =>
    failure("move.outOfRange", `${value} is not a valid ${field}; it takes ${min} to ${max}`, { field, value, min, max });
  if (terms.wage !== undefined && (!Number.isInteger(terms.wage) || terms.wage < 0 || terms.wage > 10_000_000)) {
    throw outOfRange("contract.wage", terms.wage, 0, 10_000_000);
  }
  const tomorrow = numberFromDate(addDays(GAME_DATE, 1));
  if (terms.expires !== undefined && (dateFromNumber(terms.expires) === null || terms.expires < tomorrow || terms.expires > 21001231)) {
    throw outOfRange("contract.expires", terms.expires, tomorrow, 21001231);
  }
  return {
    from: { uid: from.uid, name: from.name },
    to: { uid: to.uid, name: to.name },
    ...(fee !== undefined && fee > 0 && { fee: feePlan(from.uid, to.uid, fee) }),
  };
}

/**
 * `make_loan_permanent`: the fixture player stays where he plays, his loan gone (as for a moved player, `loanOf` has
 * none for him), logged as a move between the two clubs that `undoMove` takes back.
 */
function makeLoanPermanent(uid: number, terms: MoveTerms, fee?: number): LoggedChange {
  const preview = planLoanPermanent(uid, terms, fee);
  const player = players.find((p) => p.uid === uid)!;
  const id = changes.length + 1;
  const paid = payFee(preview);
  moveUndo.set(id, {
    row: { club: player.club, clubUid: player.clubUid, contractExpires: player.contractExpires },
    written: written.get(`player:${uid}`),
    paid,
  });
  if (terms.expires !== undefined) {
    player.contractExpires = dateFromNumber(terms.expires);
  }
  if (terms.wage !== undefined) {
    writeValue("player", uid, "contract.wage", terms.wage);
  }
  movedPlayers.set(uid, (movedPlayers.get(uid) ?? 0) + 1);
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "club",
    old: preview.from.uid,
    new: preview.to.uid,
    undoneAt: null,
    batch: null,
    moved: { from: preview.from.name, to: preview.to.name, ...(preview.fee && { fee: preview.fee.fee }) },
  };
  changes.push(logged);
  return { ...logged };
}

function movePlayer(uid: number, clubUid: number, terms: MoveTerms, fee?: number, release?: number): LoggedChange {
  const preview = planMove(uid, clubUid, terms, fee, release);
  const player = players.find((p) => p.uid === uid)!;
  const leaver = players.find((p) => p.uid === release);
  const id = changes.length + 1;
  const paid = payFee(preview);
  const rowOf = (p: PlayerSummary) => ({ club: p.club, clubUid: p.clubUid, contractExpires: p.contractExpires });
  moveUndo.set(id, {
    row: rowOf(player),
    written: written.get(`player:${uid}`),
    ...(leaver && { released: { uid: leaver.uid, row: rowOf(leaver) } }),
    paid,
  });
  player.club = preview.to.name;
  player.clubUid = preview.to.uid;
  // A free agent's new contract ends on the day it says, given or not.
  const expires = terms.expires ?? preview.contract?.expires;
  if (expires !== undefined) {
    player.contractExpires = dateFromNumber(expires);
  }
  if (terms.wage !== undefined) {
    writeValue("player", uid, "contract.wage", terms.wage);
  }
  if (leaver) {
    Object.assign(leaver, { club: null, clubUid: null, contractExpires: null });
  }
  movedPlayers.set(uid, (movedPlayers.get(uid) ?? 0) + 1);
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "club",
    old: preview.from?.uid ?? 0,
    new: preview.to.uid,
    undoneAt: null,
    batch: null,
    moved: {
      ...(preview.from && { from: preview.from.name }),
      to: preview.to.name,
      ...(leaver && { released: leaver.name }),
      ...(preview.fee && { fee: preview.fee.fee }),
    },
  };
  changes.push(logged);
  return { ...logged };
}

/** `plan_release`: the checks of the real command that the fixtures can have, with its messages; names his club. */
function planRelease(uid: number): ClubName {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  if (player.clubUid === null) {
    throw failure("move.freeAgent", "the player is a free agent, with no club to leave or swap");
  }
  const from = clubs.find((c) => c.uid === player.clubUid)!;
  return { uid: from.uid, name: from.name };
}

/** `release_player`: the fixture player leaves his club as a free agent, logged as a change of his `club` to 0. */
function releasePlayer(uid: number): LoggedChange {
  const from = planRelease(uid);
  const player = players.find((p) => p.uid === uid)!;
  const id = changes.length + 1;
  moveUndo.set(id, {
    row: { club: player.club, clubUid: player.clubUid, contractExpires: player.contractExpires },
    written: written.get(`player:${uid}`),
  });
  Object.assign(player, { club: null, clubUid: null, contractExpires: null });
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "club",
    old: from.uid,
    new: 0,
    undoneAt: null,
    batch: null,
    moved: { from: from.name },
  };
  changes.push(logged);
  return { ...logged };
}

/** `plan_club_swap`: the checks of the real command that the fixtures can have, with its messages. */
function planSwap(uid: number, otherUid: number): ClubToClub {
  const player = players.find((p) => p.uid === uid);
  const other = players.find((p) => p.uid === otherUid);
  if (!player) {
    throw notFound("player", uid);
  }
  if (!other) {
    throw notFound("player", otherUid);
  }
  for (const p of [player, other]) {
    if (p.clubUid === null) {
      throw failure("move.freeAgent", "the player is a free agent, with no club to leave or swap");
    }
  }
  if (player.clubUid === other.clubUid) {
    throw failure("move.sameClub", "the player is at this club already");
  }
  const from = clubs.find((c) => c.uid === player.clubUid)!;
  const to = clubs.find((c) => c.uid === other.clubUid)!;
  return { from: { uid: from.uid, name: from.name }, to: { uid: to.uid, name: to.name } };
}

/** `swap_players`: the two fixture players change clubs, logged as one change of the first one's club. */
function swapPlayers(uid: number, otherUid: number): LoggedChange {
  const preview = planSwap(uid, otherUid);
  const player = players.find((p) => p.uid === uid)!;
  const other = players.find((p) => p.uid === otherUid)!;
  const id = changes.length + 1;
  const rowOf = (p: PlayerSummary) => ({ club: p.club, clubUid: p.clubUid, contractExpires: p.contractExpires });
  moveUndo.set(id, { row: rowOf(player), written: written.get(`player:${uid}`), other: { uid: otherUid, row: rowOf(other) } });
  Object.assign(player, { club: preview.to.name, clubUid: preview.to.uid });
  Object.assign(other, { club: preview.from.name, clubUid: preview.from.uid });
  for (const moved of [uid, otherUid]) {
    movedPlayers.set(moved, (movedPlayers.get(moved) ?? 0) + 1);
  }
  const logged: LoggedChange = {
    id,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "club",
    old: preview.from.uid,
    new: preview.to.uid,
    undoneAt: null,
    batch: null,
    moved: { from: preview.from.name, to: preview.to.name, with: other.name },
  };
  changes.push(logged);
  return { ...logged };
}

/** One fewer move of the player `uid` stands. */
function unmoved(uid: number): void {
  const live = (movedPlayers.get(uid) ?? 1) - 1;
  if (live > 0) {
    movedPlayers.set(uid, live);
  } else {
    movedPlayers.delete(uid);
  }
}

/**
 * Puts back what the move (or swap, or release) logged as `entry` changed, unless a player has moved again since. A
 * release logged 0 as his new club: he has none. A move that made room brings the player it released back too.
 */
function undoMove(entry: LoggedChange): void {
  const player = players.find((p) => p.uid === entry.uid);
  const before = moveUndo.get(entry.id);
  const other = before?.other && players.find((p) => p.uid === before.other!.uid);
  const leaver = before?.released && players.find((p) => p.uid === before.released!.uid);
  if (
    !player ||
    !before ||
    (player.clubUid ?? 0) !== entry.new ||
    (before.other && other?.clubUid !== entry.old) ||
    (before.released && (!leaver || leaver.clubUid !== null))
  ) {
    throw failure("move.changed", "the game has changed the player's club since; reload and try again");
  }
  if (before.other && other) {
    Object.assign(other, before.other.row);
    unmoved(other.uid);
  }
  if (before.released && leaver) {
    Object.assign(leaver, before.released.row);
  }
  // The fee goes back by what it changed.
  for (const [club, key, change] of before.paid ?? []) {
    writeValue("club", club, key, currentValues("club", club)[key]! - change);
  }
  Object.assign(player, before.row);
  if (before.written) {
    written.set(`player:${entry.uid}`, before.written);
  } else {
    written.delete(`player:${entry.uid}`);
  }
  unmoved(entry.uid);
}

// Healing -----------------------------------------------------------------------------------------------------------

/**
 * `heal_player`: the fixture player gets over his injuries, logged as a change of his `injuries` to none; `batch`
 * groups the healings of a team-wide action.
 */
function healPlayer(uid: number, batch: number | null = null): LoggedChange {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const injuries = injuriesOf(uid).length;
  if (injuries === 0) {
    throw failure("heal.notInjured", "the player has no injury to heal");
  }
  healedPlayers.add(uid);
  const logged: LoggedChange = {
    id: changes.length + 1,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "injuries",
    old: injuries,
    new: 0,
    undoneAt: null,
    batch,
  };
  changes.push(logged);
  return { ...logged };
}

/** Lists the injuries of the player `uid` again. */
function unhealed(uid: number): void {
  healedPlayers.delete(uid);
}

/** `lift_bans`: the fixture player's bans are lifted, logged as a change of his `bans` to none. */
function liftBans(uid: number, batch: number | null = null): LoggedChange {
  const player = players.find((p) => p.uid === uid);
  if (!player) {
    throw notFound("player", uid);
  }
  const bans = bansOf(uid).length;
  if (bans === 0) {
    throw failure("ban.notBanned", "the player has no ban to lift");
  }
  liftedPlayers.add(uid);
  const logged: LoggedChange = {
    id: changes.length + 1,
    at: Date.now(),
    name: player.name,
    entity: "player",
    uid,
    field: "bans",
    old: bans,
    new: 0,
    undoneAt: null,
    batch,
  };
  changes.push(logged);
  return { ...logged };
}

// Squads and captains -----------------------------------------------------------------------------------------------

/** The captains changed through the editor, by `club:team`. */
const captainsSet = new Map<string, { captain: number | null; viceCaptain: number | null }>();

/** What each captaincy (by the id of its logged change) found and left, for its undo. */
const captainUndo = new Map<number, { key: string; before: CaptainPair; after: CaptainPair }>();

type CaptainPair = { captain: number | null; viceCaptain: number | null };

/**
 * The teams of a fixture club, as UIDs: the senior team holds the players over 21 and the best youngsters, the
 * under-21s and under-18s the other youngsters. The weakest senior player is out on loan.
 */
function fixtureTeams(clubUid: number): { kind: number; ageLimit: number | null; uids: number[]; out: number | null }[] {
  const own = players.filter((p) => p.clubUid === clubUid).sort((a, b) => b.currentAbility - a.currentAbility);
  const young = (p: PlayerSummary, limit: number) => p.age !== null && p.age <= limit;
  const senior = own.filter((p, i) => !young(p, 21) || i < 4);
  const rest = own.filter((p) => !senior.includes(p));
  const teams = [
    { kind: 0, ageLimit: null, uids: senior.map((p) => p.uid), out: senior[senior.length - 1]?.uid ?? null },
    { kind: 10, ageLimit: 21, uids: rest.filter((p) => !young(p, 18)).map((p) => p.uid), out: null },
    { kind: 12, ageLimit: 18, uids: rest.filter((p) => young(p, 18)).map((p) => p.uid), out: null },
  ];
  return own.length === 0 ? teams.slice(0, 1) : teams;
}

/** The captains of a fixture team: the senior team's two best players until the editor changes them. */
function captainsOf(clubUid: number, index: number, uids: number[]): CaptainPair {
  const set = captainsSet.get(`${clubUid}:${index}`);
  if (set) {
    return set;
  }
  return index === 0 ? { captain: uids[0] ?? null, viceCaptain: uids[1] ?? null } : { captain: null, viceCaptain: null };
}

/** `club_squads`: the fixture club's teams with their players' list rows and live values. */
function clubSquads(clubUid: number): ClubTeam[] {
  if (!clubs.some((c) => c.uid === clubUid)) {
    throw notFound("club", clubUid);
  }
  return fixtureTeams(clubUid).map((team, index) => ({
    index,
    kind: team.kind,
    ageLimit: team.ageLimit,
    ...captainsOf(clubUid, index, team.uids),
    players: team.uids.map((uid): SquadPlayer => {
      const row = players.find((p) => p.uid === uid)!;
      const d = details(row);
      return {
        ...row,
        playsHere: uid !== team.out,
        loan: uid === team.out ? "out" : null,
        condition: d.condition,
        matchSharpness: d.matchSharpness,
        jadedness: d.jadedness,
        morale: d.morale,
        cohesion: cohesionOf(uid),
        injuries: d.injuries.length,
        bans: d.bans.length,
        attributesFrozen: frozenAttributes.has(uid),
        fitnessFrozen: frozenFitness.has(uid),
        positionsFrozen: frozenPositions.has(uid),
      };
    }),
  }));
}

/**
 * `freeze_team`: what `kind` names frozen, or unfrozen, for every player of the fixture team. Under `?failedchecks`
 * the attributes do not check out, so freezing them is refused at once, as the real command refuses it.
 */
function freezeTeam(clubUid: number, index: number, kind: FreezeKind, frozen: boolean): TeamFreeze {
  const team = fixtureTeam(clubUid, index);
  if (frozen && kind === "attributes" && failedChecks) {
    throw failure(
      "guard.failed",
      "attribute.corners is left unchanged: attributes did not check out in this version of the game",
      { field: "attribute.corners", check: "attributes" },
    );
  }
  const held = kind === "attributes" ? frozenAttributes : kind === "fitness" ? frozenFitness : frozenPositions;
  let changed = 0;
  for (const player of team.players) {
    if (held.has(player.uid) !== frozen) {
      if (frozen) {
        held.add(player.uid);
      } else {
        held.delete(player.uid);
      }
      changed += 1;
    }
  }
  return { changed, failed: [] };
}

/** The team at `index` of the fixture club, or the real command's failure. */
function fixtureTeam(clubUid: number, index: number): ClubTeam {
  const team = clubSquads(clubUid).find((t) => t.index === index);
  if (!team) {
    throw failure("squad.noTeam", `the club has no team number ${index} that checks out`, { index });
  }
  return team;
}

/** `set_captain`: the checks of the real command, a swap when he held the other role, and the log entry. */
function setCaptain(clubUid: number, index: number, role: CaptainRole, uid: number): LoggedChange {
  const team = fixtureTeam(clubUid, index);
  if (!team.players.some((p) => p.uid === uid && p.playsHere)) {
    throw failure("captain.notInTeam", "the player does not play for this team");
  }
  const [key, otherKey] = role === "captain" ? (["captain", "viceCaptain"] as const) : (["viceCaptain", "captain"] as const);
  const old = team[key];
  if (old === uid) {
    throw failure("captain.unchanged", "The player holds that role already.");
  }
  const swapped = team[otherKey] === uid;
  const before: CaptainPair = { captain: team.captain, viceCaptain: team.viceCaptain };
  const after: CaptainPair = { ...before, [key]: uid, ...(swapped && { [otherKey]: old }) };
  const keyOf = `${clubUid}:${index}`;
  captainsSet.set(keyOf, after);
  const nameOf = (u: number) => players.find((p) => p.uid === u)?.name ?? String(u);
  const logged: LoggedChange = {
    id: changes.length + 1,
    at: Date.now(),
    name: clubs.find((c) => c.uid === clubUid)!.name,
    entity: "club",
    uid: clubUid,
    field: role === "captain" ? "captain" : "vice_captain",
    old: old ?? 0,
    new: uid,
    undoneAt: null,
    batch: null,
    captaincy: {
      team: index,
      kind: team.kind,
      ageLimit: team.ageLimit,
      from: old === null ? null : nameOf(old),
      to: nameOf(uid),
      swapped,
    },
  };
  captainUndo.set(logged.id, { key: keyOf, before, after });
  changes.push(logged);
  return { ...logged };
}

/** Gives back the captaincies the change `entry` took, unless they have changed again since. */
function undoCaptain(entry: LoggedChange): void {
  const undo = captainUndo.get(entry.id);
  const [clubUid, index] = undo ? undo.key.split(":").map(Number) : [0, 0];
  const now = undo && captainsOf(clubUid, index, []);
  if (!undo || now?.captain !== undo.after.captain || now?.viceCaptain !== undo.after.viceCaptain) {
    throw failure("move.changed", "the game has changed the memory at 0x0 since; reload and try again", { address: "0x0" });
  }
  captainsSet.set(undo.key, undo.before);
}

/** `team_action`: the action on every player of the fixture team, logged as one batch like a mass edit. */
function teamAction(clubUid: number, index: number, action: TeamAction): MassReport {
  const team = fixtureTeam(clubUid, index);
  const batch = nextMassId++;
  const report: MassReport = { batch, applied: 0, failed: [] };
  if (action === "heal") {
    for (const player of team.players.filter((p) => p.injuries > 0)) {
      healPlayer(player.uid, batch);
      report.applied++;
    }
    return report;
  }
  if (action === "liftBans") {
    for (const player of team.players.filter((p) => p.bans > 0)) {
      liftBans(player.uid, batch);
      report.applied++;
    }
    return report;
  }
  if (action === "maxCohesion") {
    // Those with an entry for the club, and not at the top already.
    for (const player of team.players) {
      const old = cohesionOf(player.uid);
      if (old === null || old === 100) {
        continue;
      }
      cohesionSet.set(player.uid, 100);
      changes.push({
        id: changes.length + 1,
        at: Date.now(),
        name: player.name,
        entity: "player",
        uid: player.uid,
        field: "cohesion",
        old,
        new: 100,
        undoneAt: null,
        batch,
      });
      report.applied++;
    }
    return report;
  }
  const values: [string, number][] =
    action === "inspire"
      ? [["morale", 20]]
      : action === "refresh"
        ? [["condition", 10_000], ["match_sharpness", 10_000], ["jadedness", -500]]
        : ATTRIBUTES.map(bestAttribute);
  for (const player of team.players) {
    setValues(player, values, report);
  }
  return report;
}

/** An attribute at its best, as Max attributes writes it: 20, stored as 100, and 1 (stored as 5) where lower is better. */
const bestAttribute = (key: string): [string, number] => [
  `attribute.${key}`,
  key === "injury_proneness" || key === "dirtiness" ? 5 : 100,
];

/** A staff attribute at its best as Max attributes writes it: 20 for the two stored as shown, else 20 stored as 100. */
const bestStaffAttribute = (key: string): [string, number] => [
  `attribute.${key}`,
  STAFF_RATINGS.includes(key) ? 20 : 100,
];

/** Writes `values` (field, value as stored) to the person, each logged in the batch of `report`, which counts them. */
function setValues(
  player: { uid: number; name: string },
  values: [string, number][],
  report: MassReport,
  entity: Entity = "player",
): void {
  const now = currentValues(entity, player.uid);
  for (const [field, value] of values) {
    if (now[field] === value) {
      continue;
    }
    writeValue(entity, player.uid, field, value);
    const logged: LoggedChange = {
      id: changes.length + 1,
      at: Date.now(),
      name: player.name,
      entity,
      uid: player.uid,
      field,
      old: now[field],
      new: value,
      undoneAt: null,
      batch: report.batch,
    };
    changes.push(logged);
    report.applied++;
  }
}

// Mass edits --------------------------------------------------------------------------------------------------------

/** Most targets one mass edit may change, and most rows a preview lists, as with the real commands. */
const MASS_LIMIT = 10_000;
const PREVIEW_ROWS = 500;

/** Whether `name` (with the other names it is found by) and `uid` match `query`, as the real search does. */
function matchesQuery(query: string, uid: number, names: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return String(uid) === query.trim() || words.every((w) => fold(names).includes(w));
}

/** The players, staff or clubs a search and the entity's filter select, as the real `plan_mass_edit` does. */
function selectTargets(entity: Entity, query: string, filters: MassFilters): { uid: number; name: string }[] {
  if (entity === "player") {
    const filter = filters.playerFilter ?? {};
    return players.filter((p) => matchesQuery(query, p.uid, `${p.name} ${p.fullName ?? ""}`) && matchesPlayerFilter(p, filter));
  }
  if (entity === "staff") {
    const filter = filters.staffFilter ?? {};
    return staff.filter((s) => matchesQuery(query, s.uid, `${s.name} ${s.fullName ?? ""}`) && matchesStaffFilter(s, filter));
  }
  const women = filters.clubFilter?.women;
  return clubs.filter((c) => matchesQuery(query, c.uid, `${c.name} ${c.shortName ?? ""}`) && (women === undefined || c.women === women));
}

/** The mass edit last previewed, until it is applied or replaced. */
let pendingMass: { id: number; entity: Entity; planned: PlannedChange[] } | null = null;
let nextMassId = 1;

/** What an operation turns `old` into, as the real one does: added and scaled values stay within the field's range. */
function operate(field: EditField, operation: MassOperationKind, old: number): number {
  const clamp = (value: number) => Math.min(field.max, Math.max(field.min, value));
  switch (operation.op) {
    case "set":
      return operation.value;
    case "add":
      return clamp(old + operation.amount);
    case "scale":
      return clamp(Math.round((old * operation.percent) / 100));
  }
}

/** `plan_mass_edit`, with the real command's checks and messages. */
function planMass(entity: Entity, query: string, filters: MassFilters, operations: MassOperation[]): MassPreview {
  if (operations.length === 0) {
    throw failure("mass.noOperations", "Choose at least one field to change.");
  }
  const targets = selectTargets(entity, query, filters);
  if (targets.length > MASS_LIMIT) {
    const message = `${targets.length} match. Narrow the search or the filters to ${MASS_LIMIT} or fewer for a mass edit.`;
    throw failure("mass.tooMany", message, { count: targets.length, limit: MASS_LIMIT });
  }
  const table = fieldTable(entity);
  const ops = operations.map(({ field: key, operation }) => {
    const field = table.find((f) => f.key === key);
    if (!field) {
      throw failure("edit.unknownField", `${entity} has no editable field ${key}`, { entity, field: key });
    }
    if (operation.op === "set" && (operation.value < field.min || operation.value > field.max)) {
      const message = `${operation.value} is not a valid ${key}; it takes ${field.min} to ${field.max}`;
      throw failure("edit.outOfRange", message, { field: key, value: operation.value, min: field.min, max: field.max });
    }
    if (operation.op !== "set" && field.kind === "date") {
      throw failure("edit.unsupported", `${key}: a date can only be set`, { field: key, reason: "a date can only be set" });
    }
    return { field, operation };
  });
  const planned: PlannedChange[] = [];
  const skipped: SkippedField[] = [];
  let unchanged = 0;
  for (const { uid, name } of targets) {
    const values = currentValues(entity, uid);
    let changed = false;
    for (const { field, operation } of ops) {
      const old: number | undefined = values[field.key];
      if (old === undefined) {
        const reason = `${field.key} cannot be changed here: its record is missing or does not check out`;
        skipped.push({ uid, name, field: field.key, reason, code: "edit.noRecord", params: { field: field.key } });
        continue;
      }
      const value = operate(field, operation, old);
      if (value !== old) {
        changed = true;
        planned.push({ uid, name, field: field.key, old, new: value });
      }
    }
    unchanged += changed ? 0 : 1;
  }
  const id = nextMassId++;
  pendingMass = { id, entity, planned };
  return {
    id,
    targets: targets.length,
    unchanged,
    changes: planned.length,
    rows: planned.slice(0, PREVIEW_ROWS),
    skippedCount: skipped.length,
    skipped: skipped.slice(0, PREVIEW_ROWS),
  };
}

/** `apply_mass_edit`: the previewed changes, each only while the value is still the one previewed. */
function applyMass(id: number): MassReport {
  if (!pendingMass || pendingMass.id !== id) {
    throw failure("mass.outOfDate", "This preview is out of date. Preview the mass edit again.");
  }
  const { entity, planned } = pendingMass;
  pendingMass = null;
  const batch = nextMassId++;
  const report: MassReport = { batch, applied: 0, failed: [] };
  for (const change of planned) {
    const found = currentValues(entity, change.uid)[change.field];
    if (found !== change.old) {
      const message = `${change.field} is now ${found}, not ${change.old}; the game has changed it since`;
      const params = { field: change.field, expected: change.old, found: found ?? 0 };
      report.failed.push({ ...change, error: failure("edit.conflict", message, params) });
      continue;
    }
    writeValue(entity, change.uid, change.field, change.new);
    changes.push({ ...change, id: changes.length + 1, at: Date.now(), entity, undoneAt: null, batch });
    report.applied++;
  }
  return report;
}

/** `undo_batch`: every change of the batch not undone yet, newest first. */
function undoMassBatch(batch: number): BatchUndo {
  const report: BatchUndo = { undone: 0, failed: [] };
  for (const entry of [...changes].reverse()) {
    if (entry.batch !== batch || entry.undoneAt !== null) {
      continue;
    }
    try {
      undoChange(entry.id);
      report.undone++;
    } catch (e) {
      // `undoChange` fails the way the real command does, with a failure.
      report.failed.push({ id: entry.id, error: e as Failure });
    }
  }
  return report;
}

const clubs: ClubSummary[] = CLUBS.flatMap((name, i) => [
  { uid: 500 + i * 7, name, shortName: name.split(" ")[0], women: false, reputation: 8200 - i * 900, founded: 1880 + i * 11 },
  { uid: 2_000_100_000 + i, name, shortName: name.split(" ")[0], women: true, reputation: 6100 - i * 700, founded: 1985 + i * 4 },
]);

/** Made-up but self-consistent profile for a fixture club; women's clubs have no finances. */
function clubDetails(club: ClubSummary): ClubDetails {
  const next = random(club.uid);
  const rating = () => Math.round(5 + next() * 15);
  const mix = [10, 35, 15, 20, 6, 14];
  return withWrittenClub({
    ...club,
    seasonTickets: Math.round(5000 + next() * 45000),
    socialMedia: Math.round(next() * 9_000_000),
    supporterMix: Object.fromEntries(["hardcore", "core", "family", "fair_weather", "corporate", "casual"].map((k, n) => [k, mix[n]])),
    supporterTraits: Object.fromEntries(
      ["loyalty", "passion", "patience", "affluence", "temperament", "expectations"].map((k) => [k, rating()]),
    ),
    facilities: Object.fromEntries(
      ["training", "youth_facilities", "youth_coaching", "youth_recruitment", ...(club.women ? [] : ["corporate"])].map((k) => [k, rating()]),
    ),
    finances: club.women
      ? null
      : {
          balance: Math.round((next() - 0.2) * 200_000_000),
          transferBudget: Math.round(next() * 60_000_000),
          wageBudget: Math.round(1_000_000 + next() * 3_000_000),
          totalWageBudget: Math.round(1_200_000 + next() * 3_200_000),
          ticketPrice: Math.round(20 + next() * 60),
        },
    stadium: stadiumOf(club, next),
  });
}

/** A made-up stadium for `club`: all seated, as in the top leagues, with room to grow. */
function stadiumOf(club: ClubSummary, next: () => number): ClubDetails["stadium"] {
  const capacity = Math.round(8000 + next() * 60000);
  return { name: stadiumNameOf(club), capacity, seating: capacity, used: 0, expansion: Math.round(capacity * 1.25) };
}

/** A date as a number that orders like the date. */
const dayNumber = (date: FmDate) => (date.year * 100 + date.month) * 100 + date.day;

/** Whether `text` contains `needle`, ignoring accents and case; an empty needle matches anything. */
function contains(text: string | null, needle: string | undefined): boolean {
  const wanted = fold(needle?.trim() ?? "");
  return wanted === "" || (text !== null && fold(text).includes(wanted));
}

/**
 * Whether an attribute as FM shows it keeps to `bound`; as in the real filter, one the person does not have keeps to
 * none.
 */
function holds(bound: AttributeBound, value: number | undefined): boolean {
  return (
    value !== undefined &&
    value > 0 &&
    (bound.min === undefined || value >= bound.min) &&
    (bound.max === undefined || value <= bound.max)
  );
}

/** The player filter of the real command: fields that are not set match everyone. */
function matchesPlayerFilter(p: PlayerSummary, f: PlayerFilter): boolean {
  // The listings and the attributes are in the profile, made only when a filter asks for them.
  const needsDetails = f.transferListed || f.loanListed || (f.attributes?.length ?? 0) > 0;
  const d = needsDetails ? details(p) : null;
  return (
    (f.position === undefined || p.positions.includes(f.position)) &&
    (f.minAge === undefined || (p.age !== null && p.age >= f.minAge)) &&
    (f.maxAge === undefined || (p.age !== null && p.age <= f.maxAge)) &&
    (f.minCurrentAbility === undefined || p.currentAbility >= f.minCurrentAbility) &&
    (f.minPotentialAbility === undefined || p.potentialAbility >= f.minPotentialAbility) &&
    contains(p.nation, f.nation) &&
    contains(p.club, f.club) &&
    (f.clubUid === undefined || p.clubUid === f.clubUid) &&
    (!f.freeAgents || p.club === null) &&
    (f.contractExpiresBy === undefined ||
      (p.contractExpires !== null && dayNumber(p.contractExpires) <= dayNumber(f.contractExpiresBy))) &&
    (!f.transferListed || d?.contract?.transferListed === true) &&
    (!f.loanListed || d?.contract?.loanListed === true) &&
    (f.women === undefined || isWoman(p.uid) === f.women) &&
    (f.attributes ?? []).every((bound) => holds(bound, d?.attributes[bound.key]?.value))
  );
}

/** The search's own order, as the real index has it: best current ability first, then by name without accents or case. */
function bySearchRank(a: PlayerSummary, b: PlayerSummary): number {
  const x = fold(a.name);
  const y = fold(b.name);
  return b.currentAbility - a.currentAbility || (x < y ? -1 : x > y ? 1 : 0);
}

/**
 * The sort of the real command: unknown values (no age, no club, no contract) go last either way and text
 * compares without accents or case. Like the real one it is stable, so equals keep the search's order.
 */
function playerComparator({ by, ascending }: PlayerOrder): (a: PlayerSummary, b: PlayerSummary) => number {
  const value = (p: PlayerSummary): string | number | null => {
    switch (by) {
      case "currentAbility":
        return p.currentAbility;
      case "potentialAbility":
        return p.potentialAbility;
      case "age":
        return p.age;
      case "name":
        return fold(p.name);
      case "nation":
        return p.nation && fold(p.nation);
      case "club":
        return p.club && fold(p.club);
      case "contractExpires":
        return p.contractExpires && dayNumber(p.contractExpires);
    }
  };
  return (a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) {
      return x === y ? 0 : x === null ? 1 : -1;
    }
    return x === y ? 0 : (x < y ? -1 : 1) * (ascending ? 1 : -1);
  };
}

/** The sort of the real staff command, like `playerComparator`: unknowns last, text without accents or case. */
function staffComparator({ by, ascending }: StaffOrder): (a: StaffSummary, b: StaffSummary) => number {
  const value = (s: StaffSummary): string | number | null => {
    switch (by) {
      case "currentAbility":
        return s.currentAbility;
      case "potentialAbility":
        return s.potentialAbility;
      case "age":
        return s.age;
      case "name":
        return fold(s.name);
      case "nation":
        return s.nation && fold(s.nation);
      case "club":
        return s.club && fold(s.club);
    }
  };
  return (a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) {
      return x === y ? 0 : x === null ? 1 : -1;
    }
    return x === y ? 0 : (x < y ? -1 : 1) * (ascending ? 1 : -1);
  };
}

/** The staff filter of the real command: a player-coach has the code of the coaching job plus one, and matches it too. */
function matchesStaffFilter(s: StaffSummary, f: StaffFilter): boolean {
  // The contract and the attributes are in the profile, made only when a filter asks for them.
  const d = f.contractExpiresBy !== undefined || (f.attributes?.length ?? 0) > 0 ? staffDetails(s) : null;
  const expires = d?.contract?.expires ?? null;
  return (
    (f.job === undefined || (s.job !== null && (s.job === f.job || s.job === f.job + 1))) &&
    (f.minAge === undefined || (s.age !== null && s.age >= f.minAge)) &&
    (f.maxAge === undefined || (s.age !== null && s.age <= f.maxAge)) &&
    (f.minCurrentAbility === undefined || s.currentAbility >= f.minCurrentAbility) &&
    (f.minPotentialAbility === undefined || s.potentialAbility >= f.minPotentialAbility) &&
    contains(s.nation, f.nation) &&
    contains(s.club, f.club) &&
    (!f.unemployed || s.job === null) &&
    (f.contractExpiresBy === undefined || (expires !== null && dayNumber(expires) <= dayNumber(f.contractExpiresBy))) &&
    (f.women === undefined || isWoman(s.uid) === f.women) &&
    (f.attributes ?? []).every((bound) => holds(bound, d?.attributes[bound.key]?.value))
  );
}

/** The clubs whose money is frozen in this page; the fixtures have no game days for it to hold through. */
const frozenMoney = new Set<number>();

/** The players whose attributes are frozen in this page, likewise. */
const frozenAttributes = new Set<number>();

/** The members of staff whose attributes are frozen in this page, likewise. */
const frozenStaff = new Set<number>();

/** The players whose energy and match sharpness are frozen in this page, likewise. */
const frozenFitness = new Set<number>();

/** The players whose positions are frozen in this page, likewise. */
const frozenPositions = new Set<number>();

/** The fixture connection, once `connect` has been called in this page. */
let mockConnection: ConnectionInfo | null = null;

/**
 * `?unknownbuild` in the address previews a version of the game the editor has no profile for: read-only until Edit
 * anyway. `?failedchecks` previews checks that did not pass: the attributes, the contracts and the in-game date.
 */
const unknownBuild = new URLSearchParams(window.location.search).has("unknownbuild");
const failedChecks = new URLSearchParams(window.location.search).has("failedchecks");
/** `?refrozen` previews connecting to a save in which players and a club were frozen the last time. */
const refrozen = new URLSearchParams(window.location.search).has("refrozen");
/**
 * `?savechanged` previews the game having loaded a save since the data was read: `save_changed` says so until the data
 * is read again.
 */
let saveChanged = new URLSearchParams(window.location.search).has("savechanged");
const CHECKS: CheckKey[] = [
  "gameDate",
  "players",
  "abilities",
  "positions",
  "attributes",
  "personality",
  "liveValues",
  "contracts",
  "teams",
  "staff",
  "clubs",
  "cohesion",
];
const FAILING: CheckKey[] = ["gameDate", "attributes", "contracts"];

/**
 * What the checks find in the fixtures: every one passes, but for the failing ones of `?failedchecks`, and the in-game
 * date under `?nodate`, as a date that cannot be read never passes.
 */
function mockHealth(): Health {
  return {
    results: CHECKS.map((check) => {
      const passed = !(failedChecks && FAILING.includes(check)) && !(check === "gameDate" && gameDate === null);
      return { check, passed, fit: passed ? 2000 : 640, sampled: 2000 };
    }),
  };
}

/** The report Copy diagnostics copies, worded as the Rust side words it (`diagnostics_report`), for the fixtures. */
function mockReport(connection: ConnectionInfo): string {
  const share = (value: number) => `${Math.round(value * 100)}`.padStart(3);
  const array = (label: string, found: ArrayRef | null) =>
    found
      ? `  ${label.padEnd(8)} game_plugin.dll+0x${found.pairRva.toString(16)}  ${String(found.count).padStart(7)} ` +
        `elements  ${share(found.confidence)}% of samples decoded, ${share(found.named)}% by a name`
      : `  ${label.padEnd(8)} not found`;
  const allowed = connection.knownBuild
    ? ""
    : `; editing this build ${connection.editable ? "was allowed" : "is not allowed yet"} (Edit anyway)`;
  const { arrays, health } = connection;
  return [
    "FMLibreEditor (browser preview, sample data)",
    `Game: FM27 Game Pass ${game.packageVersion}`,
    "game_plugin.dll build: size of image 0x175da000, link timestamp 0x6ae563a1",
    `Build profile: ${connection.profile ?? "none for this build"}`,
    `Writing: the system lets the app write to the game${allowed}`,
    `In-game date: ${connection.gameDate ? "2026-09-09 (game_plugin.dll+0x56257c8, from the build profile)" : "none"}`,
    "Retirement manager: game_plugin.dll+0x5675060 (from the build profile)",
    arrays.fromProfile ? "Entity arrays (from the build profile, checked):" : "Entity arrays:",
    array("players", arrays.players),
    array("staff", arrays.staff),
    array("clubs", arrays.clubs),
    "Checks:",
    ...health.results.map(
      (result) =>
        `  ${result.passed ? "pass" : "FAIL"}  ${result.check.padEnd(12)} ${String(result.fit).padStart(5)} of ` +
        `${String(result.sampled).padStart(5)} fit`,
    ),
    "",
  ].join("\n");
}

/**
 * `?macos` in the address previews the connect panel on macOS: the bridge is not set up, Steam is running, and the game
 * was started without the bridge. The first set-up meets a running Steam, as the real one would; the next one works.
 */
const macPreview = new URLSearchParams(window.location.search).has("macos");
/** `?nodate` previews a version of the game whose in-game date the editor cannot read. */
const gameDate = new URLSearchParams(window.location.search).has("nodate") ? null : GAME_DATE;
const notSetUp = (): BridgeInfo => ({
  ready: false,
  installed: false,
  launchOption:
    'DYLD_INSERT_LIBRARIES="/Users/me/Library/Application Support/FMLibreEditor/libfmlibre_bridge.dylib" %command%',
  steamRunning: true,
  accounts: [{ id: "123456789", launchOptions: null, loadsBridge: false }],
});
let mockBridge = notSetUp();

export async function mockInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  switch (command) {
    case "detect_game": {
      const noBridge: Failure = {
        code: "memory.noBridge",
        params: { pid: String(game.pid) },
        message: `macOS does not let FMLibreEditor into the game (pid ${game.pid}): it was started without the bridge`,
      };
      const reachable = !macPreview || mockBridge.ready;
      const detection: Detection = {
        elevated: false,
        games: [
          reachable
            ? { pid: game.pid, info: game, pluginLoaded: true, error: null }
            : { pid: game.pid, info: null, pluginLoaded: false, error: noBridge },
        ],
        bridge: macPreview ? mockBridge : null,
      };
      return detection as T;
    }
    case "set_up_bridge": {
      const wasRunning = mockBridge.steamRunning;
      mockBridge = { ...mockBridge, installed: true, steamRunning: false };
      if (wasRunning) {
        const failure: Failure = { code: "setup.steamRunning", params: {}, message: "Steam is running" };
        throw failure;
      }
      const launchOptions = mockBridge.launchOption;
      mockBridge = { ...mockBridge, ready: true, accounts: [{ id: "123456789", launchOptions, loadsBridge: true }] };
      return mockBridge as T;
    }
    case "remove_bridge":
      mockBridge = { ...notSetUp(), steamRunning: false };
      return mockBridge as T;
    case "bridge_status":
      return (macPreview ? mockBridge : null) as T;
    case "connect": {
      const info: ConnectionInfo = {
        game,
        profile: unknownBuild ? null : "FM27 0.9.2409.0 (Game Pass)",
        arrays: {
          players: { pairRva: 0x5681dc0, count: players.length, confidence: 1, named: 1, fromProfile: !unknownBuild },
          staff: { pairRva: 0x5681e08, count: 120, confidence: 1, named: 1, fromProfile: !unknownBuild },
          clubs: { pairRva: 0x5681f78, count: CLUBS.length, confidence: 1, named: 1, fromProfile: !unknownBuild },
          fromProfile: !unknownBuild,
        },
        players: players.length,
        staff: staff.length,
        clubs: clubs.length,
        gameDate: failedChecks ? null : gameDate,
        loadMs: 480,
        editable: !unknownBuild,
        writable: true,
        knownBuild: !unknownBuild,
        // The fixtures know who is a woman, as a layout that places the gender flags does.
        genderKnown: true,
        health: mockHealth(),
      };
      mockConnection = info;
      if (!refrozen) {
        return info as T;
      }
      // What a restart of the app finds frozen in this save: the attributes of the first two players, the energy and
      // sharpness of the first seven, and the first club, whose stadium was renamed too, with one more that waits.
      for (const player of players.slice(0, 2)) {
        frozenAttributes.add(player.uid);
      }
      for (const player of players.slice(0, 7)) {
        frozenFitness.add(player.uid);
      }
      frozenMoney.add(clubs[0].uid);
      for (const member of staff.slice(0, 2)) {
        frozenStaff.add(member.uid);
      }
      stadiumNames.set(clubs[0].uid, `${clubs[0].shortName} Arena`);
      const again: Refrozen = {
        players: players.slice(0, 2).map((p) => p.name),
        staff: staff.slice(0, 2).map((s) => s.name),
        clubs: [clubs[0].name],
        fitness: players.slice(0, 7).map((p) => p.name),
        positions: [],
        stadiums: [stadiumNameOf(clubs[0])],
        waiting: 1,
      };
      return { ...info, refrozen: again } as T;
    }
    case "graphics_info":
      // A plain browser has no graphics packs: every picture falls back.
      return { root: null, ready: true, counts: { clubLogos: 0, faces: 0, flags: 0, competitionLogos: 0 } } as T;
    case "allow_editing": {
      if (!mockConnection) {
        throw failure("app.notConnected", "Not connected to the game");
      }
      mockConnection = { ...mockConnection, editable: mockConnection.writable };
      return mockConnection as T;
    }
    case "diagnostics":
      if (!mockConnection) {
        throw failure("app.notConnected", "Not connected to the game");
      }
      return mockReport(mockConnection) as T;
    case "current_connection":
      // Like the real command after a window reload; here a reload starts the fixtures afresh, so it is null then.
      return (mockConnection && { ...mockConnection, loadMs: 0 }) as T;
    case "save_changed":
      return (mockConnection !== null && saveChanged) as T;
    case "reload": {
      saveChanged = false;
      const reloaded: ReloadInfo = {
        players: players.length,
        staff: staff.length,
        clubs: clubs.length,
        gameDate: failedChecks ? null : gameDate,
        health: mockHealth(),
      };
      return reloaded as T;
    }
    case "search_players": {
      const query = String(args?.query ?? "");
      const limit = Number(args?.limit ?? 200);
      const filter = (args?.filter ?? {}) as PlayerFilter;
      // Without an order the best current ability comes first, as with the real command.
      const order = (args?.order ?? { by: "currentAbility", ascending: false }) as PlayerOrder;
      const words = fold(query).split(/\s+/).filter(Boolean);
      const hits = players
        .filter((p) => String(p.uid) === query.trim() || words.every((w) => fold(`${p.name} ${p.fullName ?? ""}`).includes(w)))
        .filter((p) => matchesPlayerFilter(p, filter))
        .sort(bySearchRank)
        .sort(playerComparator(order));
      const page: PlayerPage = { total: hits.length, rows: hits.slice(0, limit) };
      return page as T;
    }
    case "search_clubs": {
      const query = String(args?.query ?? "");
      const limit = Number(args?.limit ?? 200);
      const filter = (args?.filter ?? {}) as ClubFilter;
      const kindOf = clubs.find((c) => c.uid === args?.kindOf);
      // A free agent's kind is his own, and so is that of a member of staff with no club.
      const kindOfPlayer = typeof args?.kindOfPlayer === "number" ? isWoman(args.kindOfPlayer) : undefined;
      const kindOfStaff = typeof args?.kindOfStaff === "number" ? isWoman(args.kindOfStaff) : undefined;
      const women = kindOf ? kindOf.women : (kindOfPlayer ?? kindOfStaff ?? filter.women);
      const words = fold(query).split(/\s+/).filter(Boolean);
      const hits = clubs
        .filter((c) => String(c.uid) === query.trim() || words.every((w) => fold(`${c.name} ${c.shortName ?? ""}`).includes(w)))
        .filter((c) => women === undefined || c.women === women)
        .sort((a, b) => (b.reputation ?? -1) - (a.reputation ?? -1) || a.name.localeCompare(b.name));
      const page: ClubPage = { total: hits.length, rows: hits.slice(0, limit) };
      return page as T;
    }
    case "club_details": {
      const uid = Number(args?.uid);
      const club = clubs.find((c) => c.uid === uid);
      if (!club) {
        throw notFound("club", uid);
      }
      return clubDetails(club) as T;
    }
    case "search_staff": {
      const query = String(args?.query ?? "");
      const limit = Number(args?.limit ?? 200);
      const filter = (args?.filter ?? {}) as StaffFilter;
      // Without an order the human manager comes first, then the best current ability, as with the real command.
      const order = args?.order as StaffOrder | undefined;
      const words = fold(query).split(/\s+/).filter(Boolean);
      const hits = staff
        .filter((s) => String(s.uid) === query.trim() || words.every((w) => fold(`${s.name} ${s.fullName ?? ""}`).includes(w)))
        .filter((s) => matchesStaffFilter(s, filter))
        .sort((a, b) => Number(b.isHuman) - Number(a.isHuman) || b.currentAbility - a.currentAbility || a.name.localeCompare(b.name));
      if (order) {
        hits.sort(staffComparator(order));
      }
      const page: StaffPage = { total: hits.length, rows: hits.slice(0, limit) };
      return page as T;
    }
    case "staff_details": {
      const uid = Number(args?.uid);
      const member = staff.find((s) => s.uid === uid);
      if (!member) {
        throw notFound("staff", uid);
      }
      return staffDetails(member) as T;
    }
    case "player_details": {
      const uid = Number(args?.uid);
      const player = players.find((p) => p.uid === uid);
      if (!player) {
        throw notFound("player", uid);
      }
      return details(player) as T;
    }
    case "edit_fields":
      return fieldTable(args?.entity as Entity) as T;
    case "freeze_money": {
      const club = Number(args?.club);
      if (args?.frozen) {
        frozenMoney.add(club);
      } else {
        frozenMoney.delete(club);
      }
      return [...frozenMoney] as T;
    }
    case "frozen_clubs":
      return [...frozenMoney] as T;
    case "freeze_attributes": {
      const uid = Number(args?.uid);
      if (args?.frozen) {
        frozenAttributes.add(uid);
      } else {
        frozenAttributes.delete(uid);
      }
      return [...frozenAttributes] as T;
    }
    case "frozen_players":
      return [...frozenAttributes] as T;
    case "freeze_staff_attributes": {
      const id = Number(args?.id);
      if (args?.frozen) {
        frozenStaff.add(id);
      } else {
        frozenStaff.delete(id);
      }
      return [...frozenStaff] as T;
    }
    case "frozen_staff":
      return [...frozenStaff] as T;
    case "freeze_fitness": {
      const uid = Number(args?.uid);
      if (args?.frozen) {
        frozenFitness.add(uid);
      } else {
        frozenFitness.delete(uid);
      }
      return [...frozenFitness] as T;
    }
    case "frozen_fitness":
      return [...frozenFitness] as T;
    case "freeze_positions": {
      const uid = Number(args?.uid);
      if (args?.frozen) {
        frozenPositions.add(uid);
      } else {
        frozenPositions.delete(uid);
      }
      return [...frozenPositions] as T;
    }
    case "frozen_positions":
      return [...frozenPositions] as T;
    case "freeze_team":
      return freezeTeam(Number(args?.club), Number(args?.team), args?.kind as FreezeKind, Boolean(args?.frozen)) as T;
    case "export_players":
    case "export_staff":
    case "export_clubs": {
      // Nothing is written in a browser: the report names the file a real export would have.
      const query = String(args?.query ?? "");
      const filter = args?.filter ?? {};
      const selected =
        command === "export_clubs"
          ? selectTargets("club", query, { clubFilter: filter as ClubFilter })
          : command === "export_staff"
            ? selectTargets("staff", query, { staffFilter: filter as StaffFilter })
            : selectTargets("player", query, { playerFilter: filter as PlayerFilter });
      const what = command === "export_clubs" ? "clubs" : command === "export_staff" ? "staff" : "players";
      const folder = "C:\\Users\\you\\Documents\\FMLibreEditor\\Exports";
      const two = (n: number) => String(n).padStart(2, "0");
      const stem = gameDate ? `${what}-${gameDate.year}-${two(gameDate.month)}-${two(gameDate.day)}` : what;
      const file = `${stem}.${args?.format === "json" ? "json" : "csv"}`;
      const report: ExportReport = { path: `${folder}\\${file}`, file, folder, count: selected.length, skipped: 0 };
      return report as T;
    }
    case "open_export":
    case "show_export":
      return null as T;
    case "max_attributes": {
      const uid = Number(args?.uid);
      const player = players.find((p) => p.uid === uid);
      if (!player) {
        throw notFound("player", uid);
      }
      const report: MassReport = { batch: nextMassId++, applied: 0, failed: [] };
      setValues(player, ATTRIBUTES.map(bestAttribute), report);
      return report as T;
    }
    case "max_staff_attributes": {
      const id = Number(args?.id);
      const member = staff.find((s) => s.uid === id);
      if (!member) {
        throw notFound("staff", id);
      }
      const report: MassReport = { batch: nextMassId++, applied: 0, failed: [] };
      setValues(member, STAFF_ATTRIBUTE_ORDER.map(bestStaffAttribute), report, "staff");
      return report as T;
    }
    case "list_nations": {
      const nations: Nation[] = ALL_NATIONS.map((name) => ({ address: nationAddress(name), uid: 1000 + ALL_NATIONS.indexOf(name), name }));
      return nations.sort((a, b) => a.name.localeCompare(b.name)) as T;
    }
    case "read_values":
      return currentValues(args?.entity as Entity, Number(args?.uid)) as T;
    case "apply_edits":
      return applyEdits(args?.entity as Entity, Number(args?.uid), (args?.edits ?? []) as FieldEdit[]) as T;
    case "recall_loan":
      return recallLoan(Number(args?.uid)) as T;
    case "change_log":
      return changes.map((c) => ({ ...c })).reverse() as T;
    case "undo_change":
      return undoChange(Number(args?.id)) as T;
    case "plan_mass_edit":
      return planMass(
        args?.entity as Entity,
        String(args?.query ?? ""),
        (args?.filters ?? {}) as MassFilters,
        (args?.operations ?? []) as MassOperation[],
      ) as T;
    case "apply_mass_edit":
      return applyMass(Number(args?.id)) as T;
    case "undo_batch":
      return undoMassBatch(Number(args?.batch)) as T;
    case "plan_club_move": {
      const terms = (args?.terms ?? {}) as MoveTerms;
      return planMove(Number(args?.uid), Number(args?.club), terms, args?.fee as number, args?.release as number) as T;
    }
    case "move_player": {
      const terms = (args?.terms ?? {}) as MoveTerms;
      return movePlayer(Number(args?.uid), Number(args?.club), terms, args?.fee as number, args?.release as number) as T;
    }
    case "plan_loan_permanent":
      return planLoanPermanent(Number(args?.uid), (args?.terms ?? {}) as MoveTerms, args?.fee as number) as T;
    case "make_loan_permanent":
      return makeLoanPermanent(Number(args?.uid), (args?.terms ?? {}) as MoveTerms, args?.fee as number) as T;
    case "room_makers":
      return roomMakers(Number(args?.club)) as T;
    case "staff_jobs":
      return [...STAFF_JOBS] as T;
    case "plan_staff_move":
      return planStaffMove(
        Number(args?.uid),
        Number(args?.club),
        args?.job as number | undefined,
        (args?.terms ?? {}) as MoveTerms,
      ) as T;
    case "move_staff":
      return moveStaff(
        Number(args?.uid),
        Number(args?.club),
        args?.job as number | undefined,
        (args?.terms ?? {}) as MoveTerms,
      ) as T;
    case "change_staff_job":
      return changeStaffJob(Number(args?.uid), Number(args?.job)) as T;
    case "plan_club_swap":
      return planSwap(Number(args?.uid), Number(args?.other)) as T;
    case "plan_release":
      return planRelease(Number(args?.uid)) as T;
    case "release_player":
      return releasePlayer(Number(args?.uid)) as T;
    case "heal_player":
      return healPlayer(Number(args?.uid)) as T;
    case "lift_bans":
      return liftBans(Number(args?.uid)) as T;
    case "stadium_name":
      return stadiumNameRoom(Number(args?.club)) as T;
    case "rename_stadium":
      return renameStadium(Number(args?.club), String(args?.name ?? "")) as T;
    case "change_clause":
      return changeClause(
        Number(args?.uid),
        Number(args?.index),
        args?.amount as number | undefined,
        args?.condition as number | undefined,
      ) as T;
    case "remove_clause":
      return removeClause(Number(args?.uid), Number(args?.index)) as T;
    case "add_release_clause":
      return addReleaseClause(Number(args?.uid), Number(args?.amount)) as T;
    case "keep_playing":
      return keepPlaying(Number(args?.uid)) as T;
    case "change_tie":
      return changeTie(
        Number(args?.uid),
        Number(args?.index),
        args?.nation as number | undefined,
        args?.club as number | undefined,
        args?.rule as number | undefined,
      ) as T;
    case "remove_tie":
      return removeTie(Number(args?.uid), Number(args?.index)) as T;
    case "add_tie":
      return addTie(Number(args?.uid), args?.tie as TieKind, Number(args?.target), args?.rule as number | undefined) as T;
    case "homegrown_rules":
      return [...HOMEGROWN_RULES] as T;
    case "scouting_overview":
      return scoutingOverview({ players, clubs, ratings, women }) as T;
    case "scouting_suggest":
      return scoutingSuggest({ players, clubs, ratings, women }, (args?.request ?? {}) as ScoutRequest) as T;
    case "club_squads":
      return clubSquads(Number(args?.uid)) as T;
    case "set_captain":
      return setCaptain(Number(args?.club), Number(args?.team), args?.role as CaptainRole, Number(args?.uid)) as T;
    case "team_action":
      return teamAction(Number(args?.club), Number(args?.team), args?.action as TeamAction) as T;
    case "swap_players":
      return swapPlayers(Number(args?.uid), Number(args?.other)) as T;
    default:
      throw new Error(`No fixture for command "${command}"`);
  }
}
