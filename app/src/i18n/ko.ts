// The Korean text of the UI: the same shape as `en.ts` (a missing or extra key fails the build), in the Korean of
// South Korea, whose conventions the dates and numbers follow too (see `index.ts`). It speaks to the player in the
// polite formal style, as FM's Korean does ("…합니다", "…하세요"). The comments in `en.ts` say what each string is for.
//
// The football words are the game's own: FM27 keeps every language in `languages.fmf`, and matching its English and
// Korean strings by key names attributes, traits, clauses, squad statuses, jobs and roles as the Korean game does
// ("골 결정력", "현재 능력", "경기력", "팀 내 위상", "방출 허용 최소 이적료 조항"). The editor's own text is translated
// here.
//
// Korean has no plural, and counts take a counter word after the number ("선수 3명", "구단 12개", "변경 사항 3건"). The
// particle after a word depends on whether it ends in a consonant ("구단을", "선수를"), so the sentences that put one
// after a name or a number pick it with `particle`.

import type { Entity } from "../types";
import type { ErrorTexts, Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("ko-KR");
const percents = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12,345". */
const format = (value: number) => numbers.format(value);

/** Whether the Korean reading of a digit ends in a consonant: 영, 일, 삼, 육, 칠, 팔 do; 이, 사, 오, 구 do not. */
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

/**
 * `word` with the particle that fits its last sound: `closed` after a final consonant ("구단" + "을"), `open` after a
 * vowel ("선수" + "를"). A word that ends in neither Hangul nor a digit (a name in Latin letters, say) gets both, as
 * Korean writes it when the reading is not known: "Arsenal을(를)".
 */
const particle = (word: string, closed: string, open: string) => {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return `${word}${(code - 0xac00) % 28 === 0 ? open : closed}`;
  }
  if (last >= "0" && last <= "9") {
    return `${word}${DIGIT_HAS_FINAL[Number(last)] ? closed : open}`;
  }
  return `${word}${closed}(${open})`;
};

/** "변경 사항 3건". */
const changes = (count: number) => `변경 사항 ${format(count)}건`;

/** For the places that say how many changes there are, which may be none: "변경 사항 없음", "변경 사항 3건". */
const changeCount = (count: number) => (count === 0 ? "변경 사항 없음" : changes(count));

/** "선수 12명". */
const playerCount = (count: number) => `선수 ${format(count)}명`;

/** "값 12개 유지". */
const valuesLeftAlone = (count: number) => `그대로 둔 값 ${format(count)}개`;

/** What each list holds, and the counter word its count takes. */
const nouns: Record<Entity, { noun: string; counter: string }> = {
  player: { noun: "선수", counter: "명" },
  staff: { noun: "스태프", counter: "명" },
  club: { noun: "구단", counter: "개" },
};

/** "선수 237명", "스태프 1명", "구단 12개". */
const entityCount = (entity: Entity, count: number) =>
  `${nouns[entity].noun} ${format(count)}${nouns[entity].counter}`;

/** Squad statuses, by the codes contracts hold them as (see `en.ts`); named as the game's Korean text names them. */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "인기 선수",
  2: "주요 선수",
  3: "주전 선수",
  4: "선수단 선수",
  5: "임팩트 서브",
  7: "비주전 선수",
  9: "비상 후보",
  10: "눈부신 유망주",
  11: "차세대 유망주",
  13: "어린 선수",
  14: "B팀 주전",
  15: "주전 골키퍼",
  16: "컵 대회용 골키퍼",
  17: "국내 컵 골키퍼",
  20: "후보",
  21: "비상 후보(골키퍼)",
  22: "잉여 자원",
};

/** The kinds of contract, by the codes contracts hold them as (see `en.ts`). */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "파트 타임 계약",
  1: "전임 계약",
  2: "아마추어 계약",
  3: "유소년 계약",
  4: "무계약",
  10: "성인 최소 급료 계약",
  11: "성인 계약",
};

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(ko, key ?? "");

/** What a check is about, from the key a failure gives. */
const checkName = (key: string | undefined) => (ko.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";

/** The name of a job code a failure gives, as `jobs` below has it. */
const jobName = (code: string | undefined) => (ko.jobs as Partial<Record<number, string>>)[Number(code)] ?? code ?? "";

/** The noun of the kind of record a failure names, or "기록" when it names none. */
const recordNoun = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? nouns[entity].noun : "기록";

/** The reasons the Rust side gives for a field that cannot be changed some way. */
const UNSUPPORTED: Partial<Record<string, string>> = {
  "a date can only be set": "날짜는 직접 지정만 할 수 있습니다",
  "it is changed one person at a time": "한 사람씩만 변경할 수 있습니다",
  "the new value is not one of the game's own records of that kind": "새 값이 게임에 있는 해당 종류의 기록이 아닙니다",
  "the in-game date is not known": "게임 내 날짜를 알 수 없습니다",
};

const reload = "데이터를 다시 불러온 뒤 다시 시도하세요";

/** The lists of a club's staff, as `staff.noRoom` names them. */
const STAFF_DEPARTMENTS: Partial<Record<string, string>> = {
  medical: "의료진",
  coaching: "코치진",
  scouting: "스카우트진",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as (see `en.ts`); named as the game's
 * Korean contract screen names them where it has the kind.
 */
const CLAUSE_NAMES_KO: Partial<Record<number, string>> = {
  0: "방출 허용 최소 이적료 조항",
  1: "강등 시 이적 허용 조항",
  2: "승격 실패 시 이적 허용 조항",
  3: "매년 급료 인상",
  4: "승격 시 급료 인상",
  5: "강등 시 급료 삭감",
  6: "스태프 직책 제의 시 방출 조항",
  8: "이적료 비율",
  9: "이적료 이윤 비율",
  10: "시즌별 주요 득점 보너스",
  11: "리그 경기 출장 후 1년 연장(마지막 시즌)",
  12: "최고 연봉자 조항",
  13: "구단 리그 경기 일정 횟수 출장 후 급료",
  14: "1부 리그 승격 급료 인상",
  15: "1부 리그 강등 급료 감봉",
  16: "방출 허용 최소 이적료 조항(외국 구단)",
  17: "방출 허용 최소 이적료 조항(상위 리그의 국내 구단)",
  18: "방출 허용 최소 이적료 조항(국내 구단)",
  19: "A매치 출장 후 급료",
  20: "스폰서 지불 급료 비율",
  21: "선수에게 지불한 입장권 수입 비율",
  22: "구단에서 임의로 계약 연장",
  23: "감독직 제의 시 구단 보상금 포기",
  25: "리그 경기 출장 후 1년 연장(마지막 시즌 승격)",
  26: "리그 경기 출장 후 1년 연장(마지막 시즌 강등 탈출)",
  27: "방출 허용 최소 이적료 조항(UEFA 챔피언스리그 참가 구단)",
  28: "MLS 보증 계약 조항",
  29: "승격 후 계약 연장",
  30: "부상 시 방출 조항",
  31: "방출 허용 최소 이적료 조항(대륙간 대회 참가 구단)",
  32: "출장 수당",
  33: "득점 보너스",
  34: "무실점 보너스",
  37: "A매치 출장 보너스",
  38: "교체 미출전 수당",
  39: "도움 보너스",
  40: "시즌별 주요 도움 보너스",
  41: "시즌별 주요 합산 득점 및 도움 보너스",
  54: "게임에 표시되지 않음 (54)",
  55: "강등 시 이적 허용 조항 발동",
  56: "승격 실패 시 이적 허용 조항 발동",
  58: "게임에 표시되지 않음 (58)",
  63: "게임에 표시되지 않음 (63)",
};

/** Reasons to be unhappy, by the codes the game keeps them as (see `en.ts`). */
const CONCERN_MOTIVES_KO: Partial<Record<number, string>> = {
  596: "대회 등록 명단에서 제외됨",
  808: "동료가 부당한 대우를 받았다고 생각함",
  926: "동료가 원하는 만큼의 출전 시간을 받을 자격이 없다고 생각함",
};

/** Players' traits (preferred moves), by their bit in the game's mask (see `en.ts`); the game's Korean names. */
const TRAIT_NAMES_KO: readonly string[] = [
  "왼쪽 측면 돌파 선호",
  "오른쪽 측면 돌파 선호",
  "중앙 돌파 선호",
  "페널티 박스 안으로 침투 선호",
  "수비수와 풀백 사이로 침투",
  "가능할 때마다 최전방으로 침투 선호",
  "짧고 간단한 패스 선호",
  "스루패스를 자주 시도",
  "중거리 슛 선호",
  "강력한 슛 선호",
  "정확한 슛 선호",
  "휘어차는 슛 선호",
  "골키퍼를 제치는 것을 선호",
  "오프사이드 트랩 돌파를 선호",
  "아웃프론트킥 선호",
  "상대 선수를 엄격하게 마크",
  "상대 선수를 거칠게 대하는 것을 선호",
  "심판과 언쟁하는 것을 선호",
  "골문을 등지는 것을 선호",
  "공을 받기 위해 포지션보다 내려옴",
  "2대1 패스 선호",
  "골키퍼를 넘기는 로빙 슛 선호",
  "템포 조절을 선호",
  "오버헤드킥을 시도",
  "득점보다는 패스하는 것을 선호",
  "스루패스 하지 않는 것을 선호",
  "공을 가지면 잠시 멈추는 플레이 선호",
  "공을 차놓고 상대를 제치는 것을 선호",
  "공을 몰기 전 오른발에 공을 가지려고 시도",
  "공을 몰기 전 왼발에 공을 가지려고 시도",
  "공을 오래 소유하는 것을 선호",
  "필요 시 상대 페널티 박스에 한 박자 늦게 침투하는 것을 선호",
  "위기 상황을 벗어나기 위해 개인기를 자주 시도",
  "항상 후방에 있는 것을 선호",
  "약한 발을 사용하지 않는 것을 선호",
  "현란한 개인기를 자주 시도",
  "먼 거리에서 프리킥 시 슛을 자주 시도",
  "슬라이딩 태클 선호",
  "슬라이딩 태클을 하지 않는 것을 선호",
  "측면에서 중앙으로 침투",
  "터치라인을 따라 움직이는 것을 선호",
  "관중들을 열광시키는 행동 선호",
  "빠른 박자에 슛을 자주 시도",
  "긴 패스를 자주 시도",
  "패스를 발밑으로 받는 것을 선호",
  "프리킥 시 강력한 슛 선호",
  "상대를 여러 차례 속이는 것을 선호",
  "반대편 측면으로 공을 전환하는 것을 선호",
  "정상에서 은퇴 예정",
  "가능하다면 최대한 길게 축구를 함",
  "빠르고 낮게 깔리는 스로인 구사",
  "공을 자주 드리블",
  "공을 드물게 드리블",
  "약한 발을 단련하려고 시도",
  "움직임이 적은 타깃맨",
  "역습을 시작할 때 장거리 스로인 사용",
  "중거리 슛 자제",
  "왼쪽 측면에서 중앙으로 침투",
  "오른쪽 측면에서 중앙으로 침투",
  "얼리 크로스",
  "수비 진영에서 드리블하기",
  "발로 공을 다룸",
];

const errors: ErrorTexts = {
  "guard.unknownBuild": () =>
    "FMLibreEditor는 이 게임 버전에서 아직 확인되지 않아 게임에 쓰지 않습니다. 위쪽 알림의 '그래도 편집'을 누르면 " +
    "편집할 수 있습니다.",
  "guard.failed": (p) =>
    `${checkName(p.check)} 항목이 이 게임 버전에서 검사를 통과하지 못해 FMLibreEditor가 변경하지 않습니다.`,
  "edit.unknownField": (p) => `여기에는 “${p.field}”(이)라는 편집 가능한 항목이 없습니다.`,
  "edit.outOfRange": (p) =>
    `${p.value}: ${field(p.field)}에 쓸 수 없는 값입니다. ${p.min}에서 ${p.max}까지 입력할 수 있습니다.`,
  "edit.notADate": (p) => `${p.value}: ${field(p.field)}에 쓸 수 있는 날짜가 아닙니다.`,
  "edit.notAChoice": (p) => `${p.value}: ${field(p.field)}에서 선택할 수 있는 값이 아닙니다.`,
  "edit.taken": (p) =>
    `등번호 ${p.value}번은 이미 사용 중입니다: ${p.name ?? `UID ${p.uid} 선수`}의 번호입니다.`,
  "edit.unsupported": (p) => `${field(p.field)}: 이 방식으로는 변경할 수 없습니다. ${UNSUPPORTED[p.reason] ?? p.reason}.`,
  "edit.moved": (p) => `이 ${recordNoun(p.entity)}의 데이터가 게임 메모리에서 옮겨졌습니다. ${reload}.`,
  "edit.noRecord": (p) => `${field(p.field)}: 여기서 변경할 수 없습니다. 해당 기록이 없거나 검사를 통과하지 못했습니다.`,
  "edit.unset": (p) => `${field(p.field)}: 게임에서 설정되어 있지 않아 그대로 두었습니다.`,
  "edit.implausible": (p) =>
    `${field(p.field)}: 읽은 값 ${p.value}은(는) 있을 수 없는 값이어서 안전을 위해 그대로 두었습니다.`,
  "edit.notApplied": (p) => `${field(p.field)}: ${p.wrote}을(를) 썼지만 다시 읽으니 ${p.read}입니다.`,
  "edit.conflict": (p) =>
    `${field(p.field)}: 지금 값은 ${p.expected}이(가) 아니라 ${p.found}입니다. 그사이 게임이 값을 바꿨습니다.`,
  "move.moved": () => `선수의 데이터가 게임 메모리에서 옮겨졌습니다. ${reload}.`,
  "move.notAClub": () => "이 구단에는 선수가 들어갈 1군이 없습니다.",
  "move.freeAgent": () => "이 선수는 자유 계약 선수입니다. 떠날 구단도, 맞교환할 구단도 없습니다.",
  "move.sameClub": () => "선수가 이미 이 구단 소속입니다.",
  "move.onLoan": () =>
    "선수가 임대 중입니다. 먼저 프로필의 임대 항목에서 임대 복귀시키거나 완전 이적으로 전환하세요.",
  "move.notOnLoan": () => "선수가 임대 중이 아닙니다.",
  "move.playerCoach": () => "플레잉 코치는 이적시킬 수 없습니다. 스태프로도 일하고 있기 때문입니다.",
  "move.unusualContract": () => "이 선수의 계약은 일반적인 선수 계약이 아닙니다.",
  "move.humanClub": () =>
    "이 선수는 사람이 감독하는 구단 소속입니다. 이 게임 버전에서는 에디터가 그 구단의 전술 명단을 아직 찾지 못하므로, " +
    "게임 안에서만 구단을 떠날 수 있습니다.",
  "move.menAndWomen": () => "한 구단은 남자 구단이고 다른 구단은 여자 구단입니다.",
  "move.notListed": () => "선수단 명단에서 선수가 있어야 할 자리에 없습니다.",
  "move.noRoom": (p) =>
    `구단의 선수단 명단에 선수를 더 넣을 자리가 없고(현재 ${p.players}명), 이 시스템에서는 에디터가 명단을 늘릴 수 ` +
    "없습니다.",
  "sign.noPool": () =>
    "이 게임 버전에서 게임이 계약을 보관하는 곳을 에디터가 찾지 못해 자유 계약 선수에게 계약을 줄 수 없습니다.",
  "sign.poolFull": () =>
    "게임이 스스로 새 계약 자리를 만들기 전까지는 계약을 더 넣을 자리가 없습니다. 게임에서 하루 진행한 뒤 다시 " +
    "시도하세요.",
  "sign.noModel": () => "이 구단 1군에는 새 계약의 본보기로 삼을 일반 계약 선수가 없습니다.",
  "sign.noDate": () => "새 계약의 시작일이 되는 게임 내 날짜를 에디터가 읽지 못했습니다.",
  "move.outOfRange": (p) =>
    `${p.value}: ${field(p.field)}에 쓸 수 없는 값입니다. ${p.min}에서 ${p.max}까지 입력할 수 있습니다.`,
  "move.changed": () => `그사이 게임이 해당 메모리를 바꿨습니다. ${reload}.`,
  "move.notApplied": () => "메모리에 썼지만 다시 읽으니 다른 값이 들어 있습니다.",
  "retirement.unknown": () => "이 게임 버전에서 에디터가 예정된 은퇴 정보를 찾지 못했습니다.",
  "retirement.none": () => "게임이 이 선수의 은퇴를 예정하지 않았습니다. 이미 계속 뛰려고 합니다.",
  "clause.noContract": () => "선수에게 계약이 없습니다.",
  "clause.missing": () => `이 조항은 이제 계약에 없습니다. ${reload}.`,
  "clause.notInClause": (p) => `이 조항에는 변경할 ${p.field === "clause.amount" ? "금액" : "조건"}이 없습니다.`,
  "clause.same": () => "계약에 이미 같은 내용이 있습니다.",
  "clause.noRoom": () =>
    "계약의 조항 목록에 자리가 없고 에디터가 목록을 늘릴 수 없습니다. 대신 기존 조항을 변경하세요.",
  "heal.notInjured": () => "선수에게 치료할 부상이 없습니다.",
  "ban.notBanned": () => "선수에게 해제할 출장 정지가 없습니다.",
  "relation.missing": () => `해당 국적 또는 훈련 기록이 이제 선수의 목록에 없습니다. ${reload}.`,
  "relation.noRoom": () => "선수의 목록에 자리가 없고 에디터가 목록을 늘릴 수 없습니다. 대신 기존 항목을 변경하세요.",
  "relation.target": () => "이 항목에 넣을 수 있는 종류의 게임 내 국가나 구단이 아닙니다.",
  "relation.same": () => "선수에게 이미 같은 내용이 있습니다.",
  "relation.rule": (p) => `홈그로운 규정 ${p.rule}은(는) 에디터가 쓸 수 있는 규정이 아닙니다.`,
  "staff.you": () => "당신이 조종하는 감독입니다.",
  "staff.unemployed": () => "이 스태프는 소속 구단이 없습니다.",
  "staff.role": () =>
    "구단이나 구단의 팀이 이 스태프를 직접 가리키고 있습니다(풋볼 디렉터를 겸하는 감독이나 팀을 직접 이끄는 회장처럼). " +
    "이런 경우의 이동은 게임에 맡깁니다.",
  "staff.notListed": () => "구단의 스태프 명단에서 이 스태프가 있어야 할 자리에 없습니다.",
  "staff.noRoom": (p) =>
    `구단의 ${STAFF_DEPARTMENTS[p.department] ?? p.department} 명단에 자리가 없고(현재 ${p.staff}명), 여기서는 에디터가 ` +
    "명단을 늘릴 수 없습니다.",
  "stadium.none": () => "구단 1군이 사용하는 경기장을 읽을 수 없습니다.",
  "stadium.shared": (p) => `게임 안의 ${p.holders}곳이 이 이름을 함께 쓰고 있어 경기장 이름만 따로 바꿀 수 없습니다.`,
  "stadium.nameLength": (p) =>
    `게임이 이름을 보관하는 자리에 맞으려면 이 경기장의 새 이름은 ${p.min}~${p.max}바이트여야 합니다. 입력한 이름은 ` +
    `${p.bytes}바이트입니다.`,
  "stadium.badName": () =>
    "경기장 이름은 비워 둘 수 없고, 공백으로 시작하거나 끝날 수 없으며, 제어 문자를 넣을 수 없습니다.",
  "staff.job": (p) => `에디터는 아직 ${jobName(p.job)} 직책의 스태프를 이동시키거나 그 직책을 줄 수 없습니다.`,
  "staff.directorTaken": (p) =>
    `구단에 이미 풋볼 디렉터가 있습니다: ${p.name ?? "다른 사람"}. 이 스태프에게 그 구단의 다른 직책을 주거나, 먼저 ` +
    `${p.name ?? "그 사람"}을(를) 이동시키세요.`,
  "staff.managerTaken": (p) =>
    `구단에 이미 감독이 있습니다: ${p.name ?? "다른 사람"}. 이 스태프에게 그 구단의 다른 직책을 주거나, 먼저 ` +
    `${p.name ?? "그 사람"}을(를) 이동시키세요.`,
  "staff.yourClub": () =>
    "당신이 감독하는 구단입니다. 이 스태프에게 다른 직책을 주세요. FMLibreEditor는 당신의 자리를 빼앗지 않습니다.",
  "staff.noJob": () => "구단에서 맡을 직책을 선택하세요.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "이 구단에는 스태프가 전혀 없습니다. 이 세이브에서 플레이할 수 없는 리그의 구단에는 게임이 스태프를 두지 않습니다."
      : "이 구단의 스태프 중에는 새 계약의 본보기로 삼을 온전한 계약을 가진 사람이 없습니다.",
  "squad.noTeam": () => `구단에 해당 팀이 없거나 검사를 통과하지 못했습니다. ${reload}.`,
  "captain.notInTeam": () => "선수가 이 팀에서 뛰지 않습니다. 주장은 그 팀의 선수만 맡을 수 있습니다.",
  "captain.unchanged": () => "선수가 이미 그 역할을 맡고 있습니다.",
  "session.notRunning": () =>
    "풋볼 매니저 27이 실행되고 있지 않습니다. 게임을 실행하고 세이브를 불러온 뒤 다시 시도하세요.",
  "session.noSuchProcess": (p) => `PID ${p.pid}인 ${p.exe ?? "fm.exe"} 프로세스가 없습니다.`,
  "session.severalRunning": (p) =>
    `${p.exe ?? "fm.exe"}이(가) ${p.count}개 실행 중입니다(${p.pids}). 하나를 선택하세요.`,
  "session.pluginNotLoaded": () =>
    "게임 데이터가 아직 불러와지지 않았습니다. 메인 메뉴가 나올 때까지 기다린 뒤 다시 시도하세요.",
  "session.unsupportedEdition": (p) => `FM${p.edition}은(는) 아직 지원하지 않습니다.`,
  "session.unknownEdition": () => "어떤 풋볼 매니저인지 알 수 없습니다.",
  "session.playersNotFound": () =>
    "선수 목록을 찾지 못했습니다. 세이브를 불러온 뒤(메인 메뉴만으로는 부족합니다) 다시 시도하세요.",
  "memory.win32": (p) => `Windows가 작업을 거부했습니다(${p.operation}, 오류 ${p.code}).`,
  "memory.read": (p) => `게임 메모리를 읽을 수 없습니다(시스템 오류 ${p.code}).`,
  "memory.write": (p) => `게임 메모리에 쓸 수 없습니다(시스템 오류 ${p.code}).`,
  "memory.readOnly": () => "게임이 읽기 전용으로 열렸습니다. Windows가 쓰기를 허용하지 않았습니다.",
  "memory.notWritable": () => "해당 주소는 게임의 쓰기 가능한 데이터 메모리가 아니어서 쓰지 않았습니다.",
  "memory.invalidPe": () => "게임 모듈을 읽을 수 없습니다.",
  "memory.invalidMachO": () => "게임 모듈을 읽을 수 없습니다.",
  "memory.mach": (p) => `macOS가 작업을 거부했습니다(${p.operation}, 오류 ${p.code}).`,
  "memory.posix": (p) => `macOS가 작업을 거부했습니다(${p.operation}, errno ${p.code}).`,
  "guard.saveChanged": () =>
    "FMLibreEditor가 게임을 읽은 뒤 게임이 세이브를 불러왔거나 메인 메뉴로 돌아갔으므로, '데이터 다시 불러오기'를 " +
    "누를 때까지 아무것도 바꾸지 않습니다.",
  "memory.noBridge": () =>
    "macOS가 FMLibreEditor의 게임 접근을 막고 있습니다. 게임이 FMLibreEditor 브리지 없이 실행되었습니다. 브리지를 " +
    "설정한 뒤 Steam에서 게임을 다시 실행하세요.",
  "memory.bridge": (p) => `게임 안의 FMLibreEditor 브리지가 메모리를 넘겨주지 않았습니다(${p.reason}).`,
  "scout.noClub": () => "이 세이브에서는 감독하는 구단이 없어 스카우트할 대상 구단이 없습니다.",
  "scout.noTactic": (p) => `게임에서 ${p.club}의 전술을 읽을 수 없습니다.`,
  "scout.notPlaced": () => "선수가 전술의 어느 자리에도 배치되어 있지 않습니다.",
  "scout.unknownRole": (p) => `에디터가 모르는 역할입니다: ${p.role}.`,
  "setup.steamRunning": () =>
    "Steam이 실행 중이어서 FM27의 시작 옵션은 건드리지 않았습니다. 브리지 자체는 설치되었습니다. Steam을 종료한 뒤 " +
    "다시 시도하거나, Steam에서 시작 옵션을 직접 입력하세요.",
  "setup.noSteamAccount": () => "이 Mac에서 Steam 계정을 찾지 못했습니다. Steam을 열고 한 번 이상 로그인하세요.",
  "setup.noLibrary": (p) => `앱에 브리지 파일이 없습니다: ${p.path}`,
  "setup.unknownConfig": (p) => `${p.path}: FMLibreEditor가 아는 형식이 아니어서 건드리지 않았습니다.`,
  "setup.io": (p) => `${p.path}: ${p.error}`,
  "app.internal": () => "앱에서 예기치 않은 오류가 발생했습니다.",
  "app.notConnected": () => "게임에 연결되어 있지 않습니다.",
  "app.notFound": (p) => `목록에 ID ${p.uid}인 ${recordNoun(p.entity)}이(가) 없습니다. 데이터를 다시 불러오세요.`,
  "app.dataChanged": () => `이 데이터가 게임에서 바뀌었습니다. ${reload}.`,
  "app.noChange": (p) => `변경 사항 ${p.id}번이 없습니다.`,
  "app.alreadyUndone": () => "이 변경 사항은 이미 되돌렸습니다.",
  "export.failed": (p) => `파일을 쓸 수 없습니다: ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor가 ${p.folder}에 쓸 수 없습니다. macOS가 문서 폴더 사용 여부를 물었다면 시스템 설정 › 개인정보 보호 및 ` +
    "보안 › 파일 및 폴더에서 허용한 뒤 다시 내보내세요.",
  "export.noFolder": () => "내보낼 폴더가 없습니다.",
  "export.notExported": () => "FMLibreEditor가 내보낸 파일이 아닙니다.",
  "export.openFailed": (p) => `열 수 없습니다: ${p.reason}`,
  "mass.noOperations": () => "변경할 항목을 하나 이상 선택하세요.",
  "mass.tooMany": (p) =>
    `결과가 ${p.count}건입니다. 일괄 편집을 하려면 검색이나 필터로 ${p.limit}건 이하로 줄이세요.`,
  "mass.outOfDate": () => "이 미리보기는 더 이상 최신이 아닙니다. 일괄 편집 미리보기를 다시 실행하세요.",
};

export const ko: Strings = {
  attributes: {
    // Technical
    corners: "코너킥",
    crossing: "크로스",
    dribbling: "드리블",
    finishing: "골 결정력",
    first_touch: "퍼스트 터치",
    free_kicks: "프리킥",
    heading: "헤더",
    long_shots: "중거리 슛",
    long_throws: "장거리 스로인",
    marking: "일대일 마크",
    passing: "패스",
    penalty_taking: "페널티킥",
    tackling: "태클",
    technique: "개인기",
    // Mental
    aggression: "적극성",
    anticipation: "예측력",
    bravery: "대담성",
    composure: "침착성",
    concentration: "집중력",
    decisions: "판단력",
    determination: "승부욕",
    flair: "천재성",
    leadership: "리더십",
    off_the_ball: "오프 더 볼",
    positioning: "위치 선정",
    teamwork: "팀워크",
    vision: "시야",
    work_rate: "활동량",
    // Physical
    acceleration: "가속도",
    agility: "민첩성",
    balance: "균형 감각",
    jumping_reach: "점프 거리",
    natural_fitness: "타고난 체력",
    pace: "주력",
    stamina: "지구력",
    strength: "몸싸움",
    // Goalkeeping
    aerial_reach: "공중 장악력",
    command_of_area: "페널티 박스 장악력",
    communication: "수비 조율",
    eccentricity: "기행",
    handling: "핸들링",
    kicking: "골킥",
    one_on_ones: "일대일 방어",
    punching: "펀칭(빈도)",
    reflexes: "반사 신경",
    rushing_out: "돌진(빈도)",
    throwing: "스로잉",
    // Hidden
    consistency: "꾸준함",
    dirtiness: "더티 플레이",
    important_matches: "중요 경기",
    injury_proneness: "부상 빈도",
    versatility: "다재다능",
    // Feet
    left_foot: "왼발",
    right_foot: "오른발",
  },

  staffAttributes: {
    // Coaching
    attacking: "공격",
    defending: "수비",
    fitness: "체력 관리",
    goalkeeping: "골키퍼",
    possession: "공 점유",
    set_pieces: "세트피스",
    tactical: "전술",
    technical: "기술",
    working_with_youngsters: "유소년 육성 능력",
    // Mental
    authority: "기강 유지",
    determination: "승부욕",
    motivating: "동기 부여",
    people_management: "선수 관리",
    // Knowledge
    data_analysis: "데이터 분석",
    judging_ability: "선수 능력 평가",
    judging_potential: "선수 잠재력 평가",
    judging_staff: "스태프 능력 평가",
    negotiating: "협상 능력",
    tactical_knowledge: "전술 이해도",
    // Medical
    physiotherapy: "물리 치료",
    sports_science: "스포츠 과학",
  },

  personality: {
    adaptability: "적응력",
    ambition: "포부",
    loyalty: "의리",
    pressure: "압박감 대처",
    professionalism: "프로 의식",
    sportsmanship: "스포츠맨십",
    temperament: "참을성",
    controversy: "논쟁성",
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
    training: "훈련",
    youth_facilities: "유소년 시설",
    youth_coaching: "유소년 코치",
    youth_recruitment: "유소년 모집",
    corporate: "기업",
  },

  supporterTraits: {
    loyalty: "충성도",
    passion: "열정",
    patience: "인내",
    affluence: "경제력",
    temperament: "기질",
    expectations: "기대치",
  },

  supporterMix: {
    hardcore: "강성형",
    core: "핵심형",
    family: "가족형",
    fair_weather: "철새형",
    corporate: "기업형",
    casual: "캐주얼형",
  },

  jobs: {
    1: "선수",
    2: "코치",
    4: "의장",
    6: "디렉터",
    10: "풋볼 디렉터",
    12: "팀닥터",
    14: "스카우트",
    16: "감독",
    20: "수석 코치",
    22: "세트피스 코치",
    26: "체력 코치",
    34: "골키퍼 코치",
    38: "수석 주치의",
    40: "수석 스포츠 과학자",
    44: "수석 스카우트",
    46: "주치의",
    48: "스포츠 과학자",
    50: "수석 팀닥터",
    58: "영입 분석가",
    60: "기록 분석가",
    62: "수석 기록 분석가",
    64: "수석 유소년 육성가",
    66: "소유주",
    70: "회장",
    86: "임대 매니저",
    88: "테크니컬 디렉터",
  },

  fields: {
    current_ability: "현재 능력",
    potential_ability: "잠재 능력",
    height: "신장 (cm)",
    date_of_birth: "생년월일",
    asking_price: "이적 요구 금액",
    nation: "국적",
    "reputation.home": "국내 명성",
    "reputation.current": "현재 명성",
    "reputation.world": "세계 명성",
    "international.caps": "A매치 출장",
    "international.goals": "A매치 득점",
    "international.u21_caps": "U21 출장",
    "international.u21_goals": "U21 득점",
    condition: "컨디션",
    match_sharpness: "경기력",
    jadedness: "피로도",
    morale: "사기",
    "contract.wage": "주급",
    "contract.loyalty_bonus": "로열티 보너스(주당)",
    "contract.happiness": "만족도",
    "contract.playing_time_happiness": "출전 시간 만족도",
    "contract.unhappiness": "불만 사항",
    "contract.expires": "계약 만료",
    "contract.squad_number": "등번호",
    "contract.squad_status": "팀 내 위상",
    "contract.transfer_listed": "이적 명단 등록",
    "contract.loan_listed": "임대 명단 등록",
    "loan.expires": "임대 만료",
    "loan.option_fee": "완전 영입 옵션",
    "contract.job": "직책",
    "tie.nationality": "추가 국적",
    "tie.trainedInNation": "국가에서 훈련",
    "tie.trainedAtClub": "구단에서 훈련",
    "tie.workPermit": "취업 비자 불필요 국가",
    club: "구단",
    injuries: "부상",
    cohesion: "결속력",
    bans: "출장 정지",
    retirement: "은퇴",
    clause: "계약 조항",
    "clause.amount": "조항 금액",
    "clause.condition": "조항 조건",
    captain: "주장",
    vice_captain: "부주장",
    reputation: "명성",
    "facilities.training": "훈련 시설",
    "facilities.youth_facilities": "유소년 시설",
    "facilities.youth_coaching": "유소년 코치",
    "facilities.youth_recruitment": "유소년 모집",
    "facilities.corporate": "기업 시설",
    "finance.balance": "보유 금액",
    "finance.transfer_budget": "이적 예산",
    "finance.wage_budget": "급료 예산",
    "finance.total_wage_budget": "총 급료 예산",
    "stadium.capacity": "경기장 수용 인원",
    "stadium.name": "경기장 이름",
    "stadium.seating": "좌석 수",
    "stadium.used": "사용 중인 수용 인원",
    "stadium.expansion": "확장 용량",
  },

  profile: {
    close: "프로필 닫기",
    loading: "프로필 불러오는 중…",
    resize: "프로필 패널 크기 조절",
    resizeHint: "드래그하여 패널 너비를 조절합니다. 더블 클릭하면 원래 크기로 돌아갑니다",
    none: "—",

    // Header
    freeAgent: "자유 계약",
    born: "출생",
    height: (cm) => `${cm} cm`,
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "현재 능력",
    currentAbilityShort: "CA",
    potentialAbility: "잠재 능력",
    potentialAbilityShort: "PA",
    potentialRange: "잠재 능력이 범위로 설정됨",

    // Attributes
    technical: "기술",
    goalkeeping: "골키퍼",
    mental: "정신",
    physical: "신체",
    hidden: "숨김",
    feet: "발",
    personality: "성격",
    raw: (raw, scale = 100) => `원본 값 ${raw} / ${scale}`,
    lowerIsBetter: "낮을수록 좋음",
    age: (age) => `${age}세`,

    // Positions
    positions: "포지션",
    positionsSummary: (best) => `포지션 적응도: ${best}`,
    positionRatings: "포지션 적응도",
    positionTiers: {
      natural: "자연스러움",
      accomplished: "능숙함",
      competent: "가능함",
      unconvincing: "불확실함",
      ineffective: "서투름",
    },
    positionTooltip: (position, rating, tier) => `${position} · ${rating} · ${tier}`,

    // Contract
    contract: "계약",
    wage: "주급",
    wageNote: (converted): string =>
      converted
        ? "게임은 파운드로 보관합니다. FM의 환율로 환산해 표시합니다"
        : "게임은 파운드로 보관합니다. 설정에서 다른 통화를 선택할 수 있습니다",
    signed: "계약일",
    expires: "만료",
    joined: "입단",
    squadStatus: "팀 내 위상",
    squadStatusName: (status) => SQUAD_STATUSES[status] ?? `위상 ${status}`,
    contractType: "계약 유형",
    contractTypeName: (code) => CONTRACT_TYPES[code] ?? `유형 ${code}`,
    squadNumber: "등번호",
    transferListed: "이적 명단 등록",
    loanListed: "임대 명단 등록",

    // Career
    career: "경력",
    internationalCaps: "A매치 출장",
    internationalGoals: "A매치 득점",
    u21Caps: "U21 출장",
    u21Goals: "U21 득점",
    askingPrice: "이적 요구 금액",
    notSet: "설정되지 않음",
    reputation: "명성",
    reputationHome: "국내",
    reputationCurrent: "현재",
    reputationWorld: "세계",
    retirement: "은퇴",
    retires: "은퇴 예정일",
    noRetirement: "게임이 이 선수의 은퇴를 예정하지 않았습니다",
    keepPlaying: "은퇴 막기",
    keepingPlaying: "막는 중…",
    keepPlayingTitle:
      "게임의 은퇴 예정에서 이 선수를 빼고, 특성 “정상에서 은퇴 예정” 대신 “가능하다면 최대한 길게 축구를 함”을 줍니다. 변경 내역에서 되돌릴 수 있습니다",

    // Medical
    morale: (value) => `${value} / 20`,
    traits: "특성",
    noTraits: "특성 없음",
    traitName: (bit) => TRAIT_NAMES_KO[bit] ?? `특성 ${bit}`,
    unhappiness: "불만",
    noUnhappiness: "불만 사항이 없습니다",
    removeUnhappiness: "모두 제거",
    removingUnhappiness: "제거하는 중…",
    removeUnhappinessTitle:
      "FMRTE의 Remove all처럼 이 선수의 불만 사항을 목록에서 모두 지웁니다. 변경 내역에서 되돌릴 수 있습니다",
    concernSince: (date) => `${date}부터`,
    concernKind: (kind) => (kind === 1 ? "우려" : kind === 2 ? "내부" : `유형 ${kind}`),
    concernMotive: (motive) => CONCERN_MOTIVES_KO[motive] ?? `사유 ${motive}`,
    clauses: "보너스 및 조항",
    noClauses: "보너스나 조항 없음",
    loyaltyBonus: "로열티 보너스",
    happiness: "만족도",
    playingTimeHappiness: "출전 시간 만족도",
    moodTitle: "FMRTE가 보여 주는 값으로, -100에서 100까지입니다. 게임은 이를 글로 표시합니다",
    clauseName: (kind) => CLAUSE_NAMES_KO[kind] ?? `조항 ${kind}`,
    loan: "임대",
    loanAt: "임대 중인 구단",
    loanParent: "원소속 구단",
    loanFrom: "시작",
    loanUntil: "종료",
    loanNumber: "임대 구단 등번호",
    recall: "임대 복귀",
    recallTitle: "원소속 구단으로 복귀시킵니다. 임대가 오늘 끝납니다. 변경하기 전에 확인을 받습니다",
    recallAgain: "다시 복귀시키기",
    makePermanent: "완전 이적으로 전환",
    makePermanentTitle: "임대 중인 구단에 그 구단과의 계약으로 남깁니다. 변경하기 전에 확인을 받습니다",
    recalledWaiting: "복귀 처리됨 · 복귀 대기 중",
    endsTodayWaiting: "오늘 종료 · 복귀 대기 중",
    pendingTitle: (parent) => `오늘이 임대 마지막 날입니다. 게임에서 하루 진행하면 ${parent}(으)로 돌아옵니다.`,
    endPassed: (date) =>
      `임대가 ${date}에 끝날 예정이었지만 게임이 선수를 복귀시키지 않았습니다. 다시 복귀시킨 뒤 하루 진행하세요.`,
    loanCanRecall: "복귀 가능",
    loanCanRecallTitle: "게임에서 원소속 구단이 선수를 복귀시킬 수 있는지 여부입니다. 여기의 임대 복귀는 어느 쪽이든 작동합니다",
    loanCanTerminate: "조기 종료 가능",
    loanCupMatches: "컵 대회 출전",
    loanAgainstClub: "원소속 구단 상대 출전",
    loanOptionFee: "완전 영입 옵션",
    loanOptionFeeTitle: "임대 중인 구단이 선수를 완전 영입할 수 있는 금액",
    loanMonthlyFee: "월간 임대료",
    loanMonthlyFeeTitle: "선수가 출전한 달마다 임대 구단이 원소속 구단에 지급하는 금액",
    loanUnusedFee: "미출전 시 월간 임대료",
    loanUnusedFeeTitle: "선수가 출전하지 않은 달마다 임대 구단이 원소속 구단에 지급하는 금액",
    clauseCondition: (kind, value) => {
      switch (kind) {
        case 10:
          return `${value}골`;
        case 40:
          return `도움 ${value}개`;
        case 41:
          return `득점 및 도움 ${value}개`;
        case 19:
          return `A매치 ${value}경기`;
        case 11:
        case 13:
        case 25:
        case 26:
          return `리그 ${value}경기`;
        case 22:
        case 29:
          return `${value}년`;
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
    clauseExpires: (date) => `${date} 만료`,
    clauseExpiresAfter: (days) => `계약 후 ${format(days)}일 뒤 만료`,
    clauseProfitShare: (percent, amount) => `${amount} 초과 이익의 ${percent}`,
    clauseWage: (amount) => `주급 ${amount}`,
    moraleTitle:
      "게임은 사기를 선수의 전반적인 만족도로 보여 줍니다. 10이면 만족, 11이면 약간 행복, 15와 20이면 매우 행복입니다",
    jadednessTitle:
      "경기를 뛰며 쌓인 피로로, 휴식하면 줄어듭니다. -500은 완전히 회복된 상태이며, 높을수록 휴식이 더 필요합니다",
    noInjuries: "부상 없음",
    unknownInjury: "알 수 없는 부상",
    injuryStarted: (date) => `${date} 발생`,
    injuryBack: (dates) => `복귀 예정 ${dates}`,
    heal: "치료",
    healTitle: "게임에서 이 선수의 모든 부상을 치료합니다",
    noBans: "출장 정지 없음",
    banMatches: (matches) => `${format(matches)}경기`,
    banStarted: (date) => `${date}부터`,
    liftBans: "해제",
    liftBansTitle: "게임에서 이 선수의 모든 출장 정지를 해제합니다",

    // Above the attributes
    maxAttributes: "능력치 최대",
    maxAttributesTitle: "이 선수의 모든 능력치를 최고로 만듭니다. 20으로, 부상 빈도와 더티 플레이는 1로 설정합니다",
    maxAttributesDone: (count) => (count === 0 ? "모든 능력치가 이미 최고입니다" : `${changes(count)} 기록됨`),
    maxAttributesUndone: (count) => (count === 0 ? "되돌린 내용이 없습니다" : `${changes(count)} 되돌림`),
    undoMax: "되돌리기",
    undoMaxTitle: "이전 능력치를 게임에 다시 씁니다",
    freezeAttributes: "능력치 고정",
    freezeAttributesNote:
      "앱이 열려 있고 연결된 동안에는 이 선수의 능력치가 떨어지지 않습니다. 게임이 깎은 만큼 되돌리며, 오른 능력치는 " +
      "그대로 반영됩니다. 앱은 이 세이브에 대해 이 설정을 기억하고, 다시 연결하면 또 고정합니다.",
    maxStaffAttributesTitle: "이 스태프의 모든 능력치를 최고인 20으로 설정합니다",
    undoMaxStaffTitle: "이전 능력치를 게임에 다시 씁니다",
    freezeStaffAttributesNote:
      "앱이 열려 있고 연결된 동안에는 이 스태프의 능력치가 떨어지지 않습니다. 게임이 깎은 만큼 되돌리며, 오른 능력치는 " +
      "그대로 반영됩니다. 앱은 이 세이브에 대해 이 설정을 기억하고, 다시 연결하면 또 고정합니다.",
    freezeFitness: "컨디션 및 경기력 고정",
    freezeFitnessNote:
      "앱이 열려 있고 연결된 동안에는 이 선수의 컨디션과 경기력이 떨어지지 않습니다. 게임이 깎은 만큼 되돌리며, 오른 " +
      "값은 그대로 반영되므로 100%에서는 계속 100%로 유지됩니다. 앱은 이 세이브에 대해 이 설정을 기억합니다.",
    freezePositions: "고정",
    freezePositionsInfo: "포지션 고정이란?",
    freezePositionsNote:
      "앱이 열려 있고 연결된 동안에는 이 선수의 포지션 적응도가 그대로 유지됩니다. 새 포지션을 익히지 않고, 적응도가 " +
      "오르거나 내리지도 않습니다. 앱은 이 세이브에 대해 이 설정을 기억합니다.",

    // Staff
    you: "나",
    youTitle: "이 세이브에서 당신이 조종하는 감독",
    id: "ID",
    job: "직책",
    changeJob: "직책 변경",
    changeJobTitle: "게임에서 이 스태프에게 소속 구단의 다른 직책을 줍니다",
    newJob: "새 직책",
    applyJob: "적용",
    cancelJob: "취소",
    unemployed: "무직",
    coaching: "코칭",
    knowledge: "지식",
    medical: "의료",
    playerCoach: (job) => `${job} (플레잉 코치)`,
    unknownJob: (code) => `직책 ${code}`,
  },

  playerList: {
    nav: "선수",
    count: (total) => playerCount(total),
    search: "이름 또는 UID로 선수 검색",
    summary: (total, shown, sorted) => {
      const count = playerCount(total);
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · 현재 능력 상위 ${shown}명 표시`
        : `${count} · ${sorted.by} ${sorted.ascending ? "오름차순" : "내림차순"}으로 처음 ${shown}명 표시`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "이 필터에 맞는 선수가 없습니다." : "선수를 찾지 못했습니다.";
      }
      return filtered ? `이 필터에서 “${query}”에 맞는 선수가 없습니다.` : `“${query}”에 맞는 선수가 없습니다.`;
    },
    columns: {
      name: "이름",
      age: "나이",
      positions: "포지션",
      nation: "국적",
      club: "구단",
      contractExpires: "계약",
      born: "출생",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    },
    sortBy: (by) => `${by} 기준으로 정렬`,
    sortNames: {
      currentAbility: "현재 능력",
      potentialAbility: "잠재 능력",
      age: "나이",
      name: "이름",
      nation: "국적",
      club: "구단",
      contractExpires: "계약 만료",
    },
    filters: {
      toggle: "필터",
      toggleActive: (count) => `필터, ${count}개 적용 중`,
      clear: "지우기",
      any: "전체",
      position: "포지션",
      gender: "성별",
      men: "남자",
      women: "여자",
      age: "나이",
      minAge: "최소 나이",
      maxAge: "최대 나이",
      minPlaceholder: "최소",
      maxPlaceholder: "최대",
      minCurrentAbility: "최소 CA",
      minCurrentAbilityTitle: "최소 현재 능력",
      minPotentialAbility: "최소 PA",
      minPotentialAbilityTitle: "최소 잠재 능력",
      abilityPlaceholder: "1–200",
      nation: "국적",
      club: "구단",
      freeAgentsOnly: "자유 계약 선수만",
      contractEndsBy: "계약 만료일 이전",
      transferListedOnly: "이적 명단 등록 선수만",
      loanListedOnly: "임대 명단 등록 선수만",
      attributes: {
        heading: "능력치",
        attribute: "능력치",
        pick: "능력치 선택",
        min: (name) => (name ? `${name} 최소` : "최소"),
        max: (name) => (name ? `${name} 최대` : "최대"),
        add: "능력치 추가",
        remove: (name) => (name ? `${name} 제거` : "이 줄 제거"),
      },
      saved: {
        save: "저장",
        saveTitle: "적용 중인 필터와 정렬을 이름을 붙여 저장합니다",
        name: "저장할 필터 이름",
        namePlaceholder: "필터 이름",
        ok: "확인",
        cancel: "취소",
        select: "저장된 필터",
        delete: "삭제",
        deleteTitle: (name) => `저장된 필터 삭제: ${name}`,
        replaceQuestion: (name) => `“${name}”(이)라는 저장된 필터가 이미 있습니다. 바꿀까요?`,
        replace: "바꾸기",
        full: (max) =>
          `필터는 ${max}개까지 저장할 수 있습니다. 먼저 하나를 삭제하거나, 저장된 필터의 이름을 써서 그 필터를 바꾸세요.`,
      },
    },
  },

  staffList: {
    nav: "스태프",
    count: (total) => entityCount("staff", total),
    search: "이름 또는 ID로 스태프 검색",
    summary: (total, shown, sorted) => {
      const count = entityCount("staff", total);
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · 현재 능력 상위 ${shown}명 표시`
        : `${count} · ${sorted.by} ${sorted.ascending ? "오름차순" : "내림차순"}으로 처음 ${shown}명 표시`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "이 필터에 맞는 스태프가 없습니다." : "스태프를 찾지 못했습니다.";
      }
      return filtered ? `이 필터에서 “${query}”에 맞는 스태프가 없습니다.` : `“${query}”에 맞는 스태프가 없습니다.`;
    },
    columns: {
      name: "이름",
      age: "나이",
      job: "직책",
      club: "구단",
      nation: "국적",
      born: "출생",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    },
    sortBy: (by) => `${by} 기준으로 정렬`,
    sortNames: {
      currentAbility: "현재 능력",
      potentialAbility: "잠재 능력",
      age: "나이",
      name: "이름",
      nation: "국적",
      club: "구단",
    },
    filters: {
      job: "직책",
      anyJob: "전체",
      unemployedOnly: "무직만",
    },
  },

  clubProfile: {
    // Header
    womensClub: "여자 구단",
    founded: (year) => `${year}년 창단`,
    reputationShort: "명성",
    reputationTitle: "명성",

    tabsLabel: "구단 섹션",
    tabs: { overview: "개요", squad: "선수단", stadium: "경기장" },
    squadLocked: "선수단을 열려면 편집을 마치세요",

    facilities: "시설",

    // Supporters
    supporters: "서포터",
    supporterMix: "서포터 구성",
    percent: (value) => `${percents.format(value)}%`,
    mixTooltip: (kind, percent) => `${kind} · ${percent}`,

    // Finances
    finances: "재정",
    balance: "보유 금액",
    transferBudget: "이적 예산",
    wageBudget: "급료 예산(지출)",
    totalWageBudget: "총 급료 예산",
    ticketPrice: "평균 입장권 가격",
    perWeek: "주당",
    noFinances: "FM은 플레이 중인 리그의 구단에 대해서만 재정을 보관합니다.",
    freeze: "자금 고정",
    freezeNote:
      "앱이 열려 있고 연결된 동안에는 보유 금액이 줄지 않습니다. 게임이 깎은 만큼 되돌리며, 수입은 그대로 반영됩니다. " +
      "앱은 이 세이브에 대해 이 설정을 기억하고, 다시 연결하면 또 고정합니다.",

    // Stadium
    stadium: "경기장",
    capacity: "수용 인원",
    seating: "좌석 수",
    used: "사용 중",
    usedAll: "전체",
    usedTitle:
      "게임이 수용 인원을 제한할 때(예: 일부 좌석이 폐쇄된 동안) 입장시키는 인원입니다. 0은 전체를 뜻합니다",
    expansion: "확장 가능 인원",
    noStadium: "이 구단의 경기장을 읽을 수 없습니다.",
    stadiumName: "이름",
    rename: "이름 변경",
    renameTitle: "경기장에 다른 이름을 붙입니다. 바로 기록되며, 변경 내역에서 되돌릴 수 있습니다",
    renameInfoLabel: "이름 변경은 어떻게 작동하나요?",
    renameInfo:
      "게임은 세이브에 경기장 이름을 저장하지 않고, 세이브를 불러올 때마다 데이터베이스에서 가져옵니다. 그래서 " +
      "FMLibreEditor가 이 세이브의 새 이름을 기억해 두었다가, 앱이 열려 있고 연결된 동안 게임이 세이브를 불러올 때마다 " +
      "몇 초 안에 다시 넣어 줍니다. 앱이 닫힌 상태에서 게임이 세이브를 불러오면 앱이 다시 연결될 때까지 게임의 원래 " +
      "이름이 표시됩니다. 이전 이름으로 돌아가려면 변경 내역에서 이름 변경을 되돌리거나 경기장 이름을 다시 바꾸세요.",
    saveName: "저장",
    renaming: "저장하는 중…",
    cancelRename: "취소",
    nameLength: (bytes, min, max) =>
      min <= 1
        ? `최대 ${max}바이트 중 ${bytes}바이트 (한글 한 글자는 3바이트)`
        : `${bytes}바이트: 게임이 이름을 보관하는 자리에 맞도록 ${min}~${max}바이트 (한글 한 글자는 3바이트)`,
    nameShared: (holders) => `게임 안의 ${holders}곳이 이 이름을 함께 쓰고 있어 경기장 이름만 따로 바꿀 수 없습니다`,

    // Club info
    info: "구단 정보",
    seasonTickets: "시즌권",
    socialMedia: "소셜 미디어 팔로워",
  },

  clubList: {
    nav: "구단",
    count: (total) => entityCount("club", total),
    search: "이름 또는 UID로 구단 검색",
    summary: (total, shown) =>
      total > shown
        ? `${entityCount("club", total)} · 명성 상위 ${shown}개 표시`
        : entityCount("club", total),
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "이 필터에 맞는 구단이 없습니다." : "구단을 찾지 못했습니다.";
      }
      return filtered ? `이 필터에서 “${query}”에 맞는 구단이 없습니다.` : `“${query}”에 맞는 구단이 없습니다.`;
    },
    women: "여자",
    columns: {
      name: "이름",
      reputation: "명성",
      founded: "창단",
      uid: "UID",
    },
    filters: {
      kind: "표시할 구단",
      all: "모든 구단",
      men: "남자 구단",
      women: "여자 구단",
    },
  },

  app: {
    stage: "베타",
    settingsLabel: "설정",
    languageLabel: "언어",
    currencyLabel: "통화",

    noteEditable: "편집한 내용은 적용해야 게임에 반영됩니다. 먼저 세이브를 백업하세요.",
    noteReadOnly: "읽기 전용: Windows가 FMLibreEditor의 게임 쓰기를 허용하지 않았습니다.",
    noteUnknownBuild: "읽기 전용: FMLibreEditor가 아직 확인하지 않은 게임 버전입니다.",
    noteNotConnected: "편집하고 적용하기 전까지 게임은 아무것도 바뀌지 않습니다.",

    notConnected: "연결되지 않음",
    previewTag: "브라우저 미리보기 · 샘플 데이터",
    noDate: "게임 내 날짜 없음",
    noDateTitle:
      "FMLibreEditor가 이 게임 버전에서 게임 내 날짜를 읽지 못해 나이가 표시되지 않고 나이 필터로 아무도 찾을 수 " +
      "없습니다. 업데이트를 확인하세요.",
    reload: "데이터 다시 불러오기",
    refresh: "새로 고침",
    detecting: "풋볼 매니저를 찾는 중…",
    connecting: "선수, 스태프, 구단을 읽는 중…",
    reloading: "선수, 스태프, 구단을 다시 읽는 중…",

    /**
     * The notice under the masthead once the game has loaded a save, or gone back to its main menu, since the data was
     * read (`SaveChangedNotice`), beside a Reload data button.
     */
    saveChanged: {
      title: "게임의 세이브가 바뀌었습니다",
      text:
        "FMLibreEditor가 게임을 읽은 뒤 게임이 세이브를 불러왔거나 메인 메뉴로 돌아갔습니다. '데이터 다시 불러오기'를 " +
        "누를 때까지 게임에서 아무것도 바꾸지 않고 고정도 유지하지 않습니다. 지금 보이는 내용은 다른 세이브의 것일 수 " +
        "있습니다.",
    },

    refrozen: {
      title: "지난번 고정 항목을 다시 고정했습니다",
      waitingTitle: "고정했던 항목이 지금은 대기 중입니다",
      players: (names) => `능력치: ${names}`,
      staff: (names) => `스태프 능력치: ${names}`,
      clubs: (names) => `자금: ${names}`,
      fitness: (names) => `컨디션 및 경기력: ${names}`,
      positions: (names) => `포지션: ${names}`,
      stadiums: (names) => `경기장 이름: ${names}`,
      more: (count) => `외 ${format(count)}개`,
      waiting: (count) =>
        `${format(count)}개 항목을 기억하고 있지만 지금은 고정하지 못했습니다. FMLibreEditor가 아직 이 게임 버전에 쓸 수 ` +
        "없습니다.",
      dismiss: "닫기",
    },

    freezeInfo: {
      label: "고정은 어떻게 작동하나요?",
      note:
        "고정은 게임을 영구적으로 바꾸지 않습니다. FMLibreEditor가 2초마다 게임이 깎은 값을 되돌려 놓습니다. 그래서 " +
        "앱이 열려 있고 연결된 동안에만 작동하며, 앱을 닫으면 게임이 값을 다시 바꿉니다. 앱은 이 세이브에서 고정한 " +
        "항목을 기억하고, 다음에 연결하면 다시 고정합니다.",
    },

    connect: {
      title: "풋볼 매니저 27에 연결",
      intro: "FMLibreEditor는 게임이 실행되는 동안 게임의 메모리를 읽습니다. 게임을 실행하고 세이브를 불러온 뒤 연결하세요.",
      notRunning: "풋볼 매니저 27이 실행되고 있지 않습니다.",
      openFailed: (error) => `게임을 열 수 없습니다: ${error}`,
      game: "게임",
      gameData: "게임 데이터",
      loaded: "불러옴",
      stillLoading: "아직 불러오는 중입니다. 메인 메뉴가 나올 때까지 기다리세요",
      process: "프로세스",
      pid: (pid) => `pid ${pid}`,
      several: "게임이 여러 개 실행 중입니다. 첫 번째 게임을 사용합니다.",
      button: "연결하고 선수, 스태프, 구단 읽기",

      bridge: {
        title: "브리지(macOS)",
        intro:
          "macOS는 어떤 앱도 다른 앱의 메모리에 들어가지 못하게 하므로, FM27이 직접 메모리를 넘겨줘야 합니다. FM27이 " +
          "FMLibreEditor의 브리지를 불러오면 그렇게 됩니다. 브리지는 게임의 어떤 것도 후킹하거나 바꾸지 않고 메모리를 이 " +
          "앱에만 넘겨주는 작은 라이브러리입니다. Steam의 시작 옵션으로 FM27이 브리지를 불러오게 합니다.",
        library: "브리지",
        installed: "설치됨",
        missing: "설치되지 않음",
        launchOption: "시작 옵션",
        set: "Steam에 설정됨",
        notSet: "설정되지 않음",
        ready: "설정이 끝났습니다. Steam에서 FM27을 실행하고(실행 중이면 종료한 뒤 다시 실행), 세이브를 불러온 뒤 연결하세요.",
        steamRunning:
          "Steam이 실행 중이며, 실행 중에는 Steam이 시작 옵션을 쥐고 있습니다. 시작 옵션을 자동으로 설정하려면 Steam을 " +
          "종료하거나, Steam에서 직접 입력하세요.",
        setUp: "브리지 설정",
        remove: "브리지 제거",
        manual: "또는 Steam에서 Football Manager 27을 우클릭 › 속성 › 일반 › 시작 옵션에 다음을 입력하세요:",
        copy: "복사",
        copied: "복사됨",
      },
    },
  },

  graphics: {
    reading: "그래픽 팩을 읽는 중…",
    summary: ({ clubLogos, flags, faces }) =>
      `그래픽: 구단 로고 ${format(clubLogos)}개 · 국기 ${format(flags)}개 · 얼굴 사진 ${format(faces)}개`,
    none: "그래픽 팩을 찾지 못했습니다",
    noneHint: "로고와 얼굴 사진 팩은 FM27 graphics 폴더에 넣습니다.",
  },

  compatibility: {
    unknownBuild: (game) => `FMLibreEditor가 아직 ${game}에서 확인되지 않았습니다`,
    unknownBuildText:
      "게임이 업데이트된 것으로 보입니다. FMLibreEditor가 게임 데이터를 찾아 검사했지만, 테스트하지 않은 버전에는 " +
      "허용하기 전까지 쓰지 않습니다. 보통 며칠 안에 새 FMLibreEditor가 나옵니다.",
    allowedText: "이번 세션에서는 검사가 허용하는 범위에서 편집할 수 있습니다. 세이브 백업을 유지하세요.",
    failedTitle: "게임 데이터 일부가 검사를 통과하지 못했습니다",
    reloadHint: "세이브를 불러오는 중이었다면 '데이터 다시 불러오기'로 다시 검사할 수 있습니다.",
    noDate: "게임 내 날짜가 검사를 통과하지 못해 나이를 표시하지 않습니다.",
    failed: (names) => `읽기 전용으로 둔 항목: ${names}.`,
    failedCheck: (name, fit, sampled) => `${name}(${format(sampled)}개 중 ${format(fit)}개 일치)`,
    join: (names) => names.join(", "),
    allow: "그래도 편집",
    allowTitle: "FMLibreEditor를 닫거나 다시 연결할 때까지 편집을 켭니다. 먼저 세이브를 백업하세요.",
  },

  diagnostics: {
    copy: "진단 정보 복사",
    copyTitle:
      "FMLibreEditor가 게임에서 찾은 내용을 복사합니다. 버그 보고에 붙여 넣으세요. 이름이나 파일 경로는 들어 있지 " +
      "않습니다.",
    copied: "복사됨",
    failed: (reason) => `진단 정보를 복사하지 못했습니다: ${reason}`,
  },

  checks: {
    gameDate: "게임 내 날짜",
    players: "선수 정보",
    abilities: "현재 및 잠재 능력",
    positions: "포지션",
    attributes: "능력치",
    personality: "성격",
    liveValues: "컨디션, 경기력, 피로도, 사기",
    contracts: "계약",
    teams: "팀",
    staff: "스태프",
    clubs: "구단",
    cohesion: "구단과의 결속력",
  },

  update: {
    available: (version) => `${particle(`FMLibreEditor ${version}`, "을", "를")} 사용할 수 있습니다`,
    youHave: (version) => `현재 버전: ${version}.`,
    download: "다운로드",
    install: "업데이트",
    installTitle: "새 버전을 다운로드해 설치합니다. FMLibreEditor가 닫혔다가 새 버전으로 다시 열립니다",
    preparing: "준비 중…",
    downloading: (percent) => (percent === null ? "다운로드 중…" : `다운로드 중… ${percent}%`),
    installing: "설치 중: FMLibreEditor가 닫혔다가 새 버전으로 다시 열립니다.",
    installFailed: (reason) => `업데이트할 수 없습니다: ${reason}. 대신 해당 페이지에서 다운로드하세요.`,
    notInstallable: "이 버전은 여기서 설치할 수 없습니다. 대신 해당 페이지에서 다운로드하세요.",
    later: "나중에",
    check: "업데이트 확인",
    checking: "업데이트 확인 중…",
    upToDate: "최신 버전을 사용 중입니다.",
    failed: "업데이트를 확인할 수 없습니다.",
  },

  edit: {
    unknownNation: "알 수 없는 국가",
    edit: "편집",
    editTitle: "게임에서 이 프로필의 값을 변경합니다",
    startFailed: (reason) => `편집을 시작할 수 없습니다: ${reason}`,
    positionRating: (position) => `${position} 적응도`,
    was: (value) => `이전 값: ${value}`,
    invalid: (min, max) => `${min}에서 ${max} 사이의 정수를 입력하세요`,
    invalidDate: (from, to) => `${from}에서 ${to} 사이의 날짜를 입력하세요`,
    invalidMoney: (from, to) => `${from}에서 ${to} 사이의 금액을 정수로 입력하세요`,
    invalidPercentage: (from, to) => `${from}에서 ${to} 사이의 백분율을 정수로 입력하세요`,
    percent: "%",
    yes: "예",
    no: "아니요",
    none: "없음",

    // The footer
    footer: "편집 중",
    changes: changeCount,
    invalidCount: (count) => `잘못된 값 ${count}개`,
    review: "검토",
    reviewList: "적용할 변경 사항",
    discard: "변경 취소",
    apply: "적용",
    applying: "적용하는 중…",
    applyBlocked: "먼저 잘못된 값을 고치세요",
    done: "완료",
    confirmDiscard: (count) => `${changes(count)}을 취소할까요?`,
    keepEditing: "계속 편집",

    // After Apply
    applied: (count) => (count === 0 ? "적용한 변경 사항 없음" : `${changes(count)} 적용됨`),
    nothingToChange: "변경할 것이 없습니다. 게임에 이미 같은 값이 있습니다.",
    refused: (label, reason) => `${label}: ${reason}`,
    rereadFailed: (reason) => `값을 다시 읽을 수 없습니다: ${reason}`,
    dismiss: "닫기",
  },

  changes: {
    nav: "변경 내역",
    title: "이번 세션의 변경 내역",
    hint: "최근 것부터 표시합니다. 변경은 게임에 기록한 값이 그대로 남아 있을 때만 되돌릴 수 있습니다.",
    continueHint: "변경은 게임이 한 번 진행된 뒤에 게임에 표시됩니다. 게임에서 '진행하기'를 누르세요.",
    swappedWith: (name) => `${name}와(과) 맞교환`,
    released: (name) => `${name} 방출됨`,
    fee: (amount) => `이적료 ${amount}`,
    optionRemoved: (amount) => `완전 영입 옵션(${amount}) 제거됨`,
    healed: (count) => `부상 ${format(count)}건 치료`,
    lifted: (count) => `출장 정지 ${format(count)}건 해제`,
    keptPlaying: (date) => (date === null ? "계속 선수 생활을 합니다" : `${date} 은퇴를 막음`),
    count: (total, undone) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${undone}건 되돌림`;
    },
    empty:
      "아직 변경 사항이 없습니다. 선수, 스태프, 구단을 열어 '편집'을 선택하거나 목록에서 '일괄 편집'을 사용하세요.",
    columns: {
      time: "시간",
      name: "이름",
      field: "항목",
      change: "변경",
      status: "상태",
    },
    kinds: { player: "선수", staff: "스태프", club: "구단" },
    stored: (change) => `저장된 값 ${change}`,
    undone: (time) => `${time}에 되돌림`,
    undo: "되돌리기",
    undoTitle: (label) => `${label}의 이전 값을 게임에 다시 씁니다`,
    batch: "일괄 편집",
    batchCount: (total, remaining) =>
      remaining === 0
        ? `${changeCount(total)} · 모두 되돌림`
        : `${changeCount(total)} · ${format(remaining)}건 되돌리지 않음`,
    showChanges: "변경 사항 보기",
    hideChanges: "변경 사항 숨기기",
    undoBatch: "일괄 편집 되돌리기",
    undoBatchTitle: (remaining) =>
      `이 일괄 편집의 이전 값을 게임에 다시 씁니다(${format(remaining)}건이 아직 적용된 상태)`,

    pages: "목록 페이지",
    batchPages: "이 일괄 편집의 변경 사항 페이지",
    previous: "이전",
    next: "다음",
    range: (first, last, total) => `${format(total)}건 중 ${format(first)}–${format(last)}`,
  },

  export: {
    button: "내보내기",
    buttonTitle: {
      player: "목록에 표시된 선수를 스프레드시트나 스크립트에서 쓸 수 있도록 CSV 또는 JSON 파일로 저장합니다",
      staff: "목록에 표시된 스태프를 스프레드시트나 스크립트에서 쓸 수 있도록 CSV 또는 JSON 파일로 저장합니다",
      club: "목록에 표시된 구단을 스프레드시트나 스크립트에서 쓸 수 있도록 CSV 또는 JSON 파일로 저장합니다",
    },
    title: { player: "선수 내보내기", staff: "스태프 내보내기", club: "구단 내보내기" },
    scope: (entity, count) =>
      count === 0
        ? `검색과 필터에 맞는 ${particle(nouns[entity].noun, "이", "가")} 없습니다.`
        : `${entityCount(entity, count)}: 목록의 검색과 필터로 선택된 항목을 목록 순서대로 내보냅니다.`,
    formatLabel: "형식",
    formats: {
      csv: "CSV, 쉼표로 구분",
      csvSemicolon: "CSV, 세미콜론으로 구분",
      json: "JSON",
    },
    formatHints: {
      csv: "대부분의 스프레드시트와 스크립트용",
      csvSemicolon: "소수점을 쉼표로 쓰는 Excel용: 터키어, 스페인어, 독일어 Excel 등",
      json: {
        player: "스크립트용: 포지션, 능력치, 성격을 각각 별도의 객체로 담습니다",
        staff: "스크립트용: 능력치, 성격, 계약을 각각 별도의 객체로 담습니다",
        club: "스크립트용: 서포터, 시설, 경기장, 재정을 각각 별도의 객체로 담습니다",
      },
    },
    contents: {
      player:
        "각 선수의 능력, 포지션과 포지션 적응도, 1–20 기준의 능력치(숨겨진 능력치 포함), 성격, 명성, A매치 출장, " +
        "조항을 포함한 계약을 게임 내 날짜와 함께 담습니다. 금액은 게임이 보관하는 대로 파운드입니다. 게임은 아무것도 " +
        "바뀌지 않습니다.",
      staff:
        "각 스태프의 직책과 소속 구단, 능력, 1–20 기준의 능력치, 성격, 명성, 계약(급여와 날짜)을 게임 내 날짜와 함께 " +
        "담습니다. 금액은 게임이 보관하는 대로 파운드입니다. 게임은 아무것도 바뀌지 않습니다.",
      club:
        "각 구단의 명성, 창단 연도, 시즌권, 소셜 미디어 팔로워, 서포터 구성과 성향, 시설, 경기장, 재정(보유 금액, 이적 " +
        "예산, 주간 급료 지출과 급료 예산, 입장권 가격)을 게임 내 날짜와 함께 담습니다. FM은 플레이 중인 리그의 구단에 " +
        "대해서만 재정을 보관합니다. 금액은 게임이 보관하는 대로 파운드입니다. 게임은 아무것도 바뀌지 않습니다.",
    },
    export: "내보내기",
    exporting: "내보내는 중…",
    done: (entity, count, file) => `${entityCount(entity, count)}을(를) ${file}에 내보냈습니다`,
    folder: (folder) => `위치: ${folder}`,
    skipped: (entity, count) => `${entityCount(entity, count)}은(는) 읽는 동안 게임에서 값이 바뀌어 제외했습니다.`,
    open: "열기",
    openTitle: "시스템의 기본 앱으로 파일을 엽니다",
    show: "폴더에서 보기",
    showTitle: "파일이 있는 폴더에서 파일을 표시합니다",
    close: "닫기",
  },

  massEdit: {
    button: "일괄 편집",
    buttonTitle: "목록에 표시된 모든 항목의 값을 변경합니다. 먼저 미리보기를 보여 줍니다",
    title: {
      player: "선수 일괄 편집",
      staff: "스태프 일괄 편집",
      club: "구단 일괄 편집",
    },

    // What it applies to
    scope: (entity, total) => `지금 목록에 표시된 ${entityCount(entity, total)} (검색 및 필터 기준)`,
    scopeAll: (shown) => `화면에 보이는 처음 ${format(shown)}줄만이 아니라 조건에 맞는 전체입니다.`,
    scopeNone: (entity) =>
      `검색과 필터에 맞는 ${particle(nouns[entity].noun, "이", "가")} 없어 변경할 것이 없습니다.`,
    scopeTooMany: (entity, total, limit) =>
      `목록에 표시된 ${entityCount(entity, total)}은(는) 일괄 편집 한 번에 처리할 수 있는 수(${format(limit)})보다 ` +
      "많습니다. 먼저 검색이나 필터로 범위를 좁히세요.",
    loadingFields: "항목을 읽는 중…",
    fieldsFailed: (reason) => `항목을 읽을 수 없습니다: ${reason}`,

    // The fields to change
    groups: {
      ability: "능력",
      technical: "기술 능력치",
      mental: "정신 능력치",
      physical: "신체 능력치",
      goalkeeping: "골키퍼 능력치",
      hidden: "숨겨진 능력치",
      feet: "발",
      coaching: "코칭 능력치",
      knowledge: "지식 능력치",
      medical: "의료 능력치",
      positions: "포지션",
      personality: "성격",
      reputation: "명성",
      international: "국가대표",
      contract: "계약",
      facilities: "시설",
      finances: "재정",
      stadium: "경기장",
      traits: "특성",
      health: "의료",
      other: "기타",
    },
    fieldsLabel: "변경할 항목",
    row: (position) => `변경 ${position}`,
    field: "항목",
    operation: "작업",
    operations: { set: "값으로 설정", add: "더하기", scale: "%로 조정" },
    values: { set: "값", add: "더할 값", scale: "퍼센트" },
    addTitle: "표시된 값 그대로 모든 값에 더합니다. 음수를 넣으면 뺍니다",
    addPointsTitle: "모든 값에 퍼센트포인트를 더합니다(70%에 10을 더하면 80%). 음수를 넣으면 뺍니다",
    rangeHint: (min, max) => `${format(min)}–${format(max)}`,
    amountHint: (max) => `±${format(max)}`,
    ofCurrent: "현재 값의 %",
    percentTitle: "현재 값에 대한 퍼센트입니다. 100은 그대로, 110은 10분의 1만큼 올리고, 50은 절반으로 줄입니다",
    invalidAdd: (min, max) => `${format(min)}에서 ${format(max)} 사이의 정수를 입력하세요`,
    invalidPercent: (min, max) => `${min}에서 ${max} 사이의 퍼센트를 정수로 입력하세요`,
    dateSetOnly: "날짜는 직접 지정만 할 수 있습니다",
    addField: "항목 추가",
    addFieldFull: (max) => `일괄 편집 한 번에 항목을 ${max}개까지 변경할 수 있습니다`,
    remove: "이 항목 제거",
    removeLast: "일괄 편집에는 항목이 하나 이상 있어야 합니다",

    // The preview
    preview: "미리보기",
    previewing: "미리보기를 만드는 중…",
    previewBlocked: "미리보기를 하려면 모든 항목에 올바른 값을 채우세요",
    summary: (entity, preview) =>
      [
        preview.changes === 0
          ? "변경 사항 없음"
          : `${entityCount(entity, preview.targets)} 중 ${format(preview.targets - preview.unchanged)}` +
            `${nouns[entity].counter}에 ${changes(preview.changes)}`,
        preview.unchanged > 0 &&
          `${particle(`${format(preview.unchanged)}${nouns[entity].counter}`, "은", "는")} 이미 같은 값`,
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "일괄 편집이 만들 변경 사항",
    columns: { name: "이름", field: "항목", change: "변경", reason: "사유" },
    more: (count) => `외 ${format(count)}건`,
    skippedHeading: valuesLeftAlone,
    skippedLabel: "일괄 편집이 그대로 두는 값",

    // Apply and undo
    apply: "적용",
    applying: "적용하는 중…",
    applyTitle: (count) => `${changes(count)}을 게임에 씁니다`,
    applyFirst: "먼저 일괄 편집을 미리보기하세요",
    applyNothing: "미리보기에 기록할 변경 사항이 없습니다",
    hint: "적용하기 전까지 게임은 아무것도 바뀌지 않습니다.",
    applied: (count) => (count === 0 ? "기록한 변경 사항이 없습니다" : `${changes(count)} 적용됨`),
    failure: (name, label, reason) => `${name} · ${label}: ${reason}`,
    undo: "이 일괄 편집 되돌리기",
    undoing: "되돌리는 중…",
    undoTitle: "이 일괄 편집의 이전 값을 게임에 다시 씁니다",
    undone: (count) => (count === 0 ? "되돌린 내용이 없습니다" : `${changes(count)} 되돌림`),
    undoFailure: (who, reason) => `${who}: ${reason}`,
    changeNumber: (id) => `변경 ${id}`,
    close: "닫기",
  },

  comparison: {
    compare: "비교",
    add: "비교에 추가",
    remove: "비교에서 제거",
    full: (max) => `비교에는 선수를 ${max}명까지 넣을 수 있습니다. 이 선수를 추가하려면 한 명을 제거하세요.`,

    // The tray under the player list
    trayLabel: "비교할 선수",
    removePlayer: (name) => `비교에서 제거: ${name}`,
    clear: "지우기",
    open: (count) => `비교 (${count})`,

    // The dialog
    title: "비교",
    hint: "각 줄에서 가장 좋은 값을 강조합니다. 가장 높은 값이며, 낮을수록 좋은 항목은 가장 낮은 값입니다.",
    tooFew: "비교하려면 선수를 두 명 이상 추가하세요.",
    loading: "선수를 불러오는 중…",
    tableLabel: "비교하는 선수들의 값",
    highest: "최고",
    lowest: "최저",
    profile: "프로필",
    close: "닫기",
  },

  move: {
    button: "이적",
    buttonTitle: "게임에서 이 선수를 다른 구단으로 이적시킵니다. 원하면 이적료도 정할 수 있습니다",

    // The dialog
    title: "이적",
    from: "출발",
    to: "도착",

    modeLabel: "이적 또는 맞교환",
    modeMove: "구단으로 이적",
    modeSwap: "선수와 맞교환",

    // Choosing the club
    searchLabel: "이적할 구단 검색",
    resultsLabel: "찾은 구단",
    searching: "구단을 검색하는 중…",
    searchFailed: (reason) => `구단을 검색할 수 없습니다: ${reason}`,
    more: (count) => `외 ${format(count)}개. 더 입력해 검색 범위를 좁히세요`,
    change: "다른 구단 선택",

    // The fee
    feeHeading: "이적료",
    fee: "이적료",
    feeHint: "자유 이적이면 비워 두세요",
    feeInvalid: (max) => `0에서 ${max} 사이의 금액을 정수로 입력하세요`,
    pays: (club, fee, balance, budget) =>
      `${club}: ${fee} 지급 · 보유 금액 ${balance}${budget === null ? "" : `, 이적 예산 ${budget}`}`,
    receives: (club, fee, balance) => `${club}: ${fee} 수령 · 보유 금액 ${balance}`,
    noFinances: (club) => `${club}: 게임에 재정 정보가 없어 자금은 그대로입니다`,

    // The contract
    wageInvalid: "0 이상의 금액을 정수로 입력하세요",
    expiresInvalid: "날짜를 입력하세요",

    // What the dialog says about the move itself
    chooseClub: "선수를 이적시킬 구단을 선택하세요.",
    fixTerms: "먼저 이적료나 계약 값을 고치세요.",
    checking: "이적을 확인하는 중…",
    route: (from, to) => `${from} → ${to}`,
    doesHeading: "이적으로 바뀌는 것",
    does: [
      "새 구단의 1군에 합류합니다",
      "계약 시작일은 게임 내 날짜가 되고, 등번호는 비워집니다",
      "이적 명단과 임대 명단에서 빠집니다",
      "주급과 계약 만료일은 새로 정한 경우에만 바뀝니다",
      "이적료는 영입 구단의 보유 금액과 이적 예산에서 빠져 판매 구단의 보유 금액에 더해집니다",
      "이전 구단에서 맡던 주장직은 비워 둡니다",
      "게임의 이적 기록에는 아직 표시되지 않습니다",
      "변경 내역에 기록되며, 되돌리기 한 번으로 이적과 이적료를 모두 되돌립니다",
    ],

    // A club whose squad list is full
    noRoom: (club) => `${club}의 선수단에 자리가 없습니다.`,
    noRoomInfoLabel: "왜 그런가요?",
    noRoomInfo:
      "에디터는 가능한 경우 꽉 찬 선수단 명단을 늘리지만, 이 명단은 늘릴 수 없습니다. 자리를 만들려면 선수 한 명이 " +
      "떠나야 합니다.",
    noRoomNeed: (player, club) => `${player}이(가) 합류하려면 ${club}에서 선수 한 명이 떠나야 합니다.`,
    releaseChoice: "방출:",
    releasePickLabel: "방출할 선수",
    releaseOutcome: "→ 자유 계약 선수가 됩니다",
    injuredTag: "부상",
    captainTag: "주장",
    swapChoice: "맞교환으로 전환:",
    swapChoiceOutcome: (club) => `이 선수가 ${club}(으)로 갑니다`,
    moveAndRelease: (name) => `이적시키고 ${name} 방출`,
    makeRoomDoes: [
      "방출되는 선수의 자리를 대신해 새 구단의 1군에 합류합니다",
      "방출되는 선수는 그 구단의 모든 팀에서 빠지고 계약이 끝나 자유 계약 선수가 됩니다",
      "계약 시작일은 게임 내 날짜가 되고, 등번호는 비워집니다",
      "이적 명단과 임대 명단에서 빠집니다",
      "주급과 계약 만료일은 새로 정한 경우에만 바뀝니다",
      "이적료는 영입 구단의 보유 금액과 이적 예산에서 빠져 판매 구단의 보유 금액에 더해집니다",
      "두 선수가 떠나는 구단에서 맡던 주장직은 비워 둡니다",
      "게임의 이적 기록에는 아직 표시되지 않습니다",
      "변경 내역에 하나의 변경으로 기록되며, 되돌리기 한 번으로 이적, 방출, 이적료를 모두 되돌립니다",
    ],

    // Swapping with a player of the club instead
    swapTitle: "선수와 맞교환",
    swapWith: "맞교환 상대",
    playerSearchLabel: "맞교환할 선수 검색",
    playerSearch: "이 구단의 선수를 이름으로 검색",
    playersLabel: "찾은 선수",
    playersSearching: "선수를 검색하는 중…",
    playersSearchFailed: (reason) => `선수를 검색할 수 없습니다: ${reason}`,
    playersEmpty: (query) =>
      query === "" ? "이 구단에는 선수가 없습니다." : `이 구단에는 “${query}”에 맞는 선수가 없습니다.`,
    changePlayer: "다른 선수 선택",

    // What the dialog says about the swap
    swapContract: "두 선수 모두 자신의 계약을 유지합니다. 주급과 계약 만료일은 바뀌지 않습니다.",
    staffButtonTitle: "게임에서 이 스태프를 다른 구단으로 옮깁니다",
    staffChooseClub: "이 스태프를 옮길 구단을 선택하세요.",
    staffContract: "직책, 주급, 계약 만료일을 유지합니다. 계약 시작일은 게임 내 날짜가 됩니다.",
    staffJob: "직책",
    staffJobChoose: "직책 선택…",
    staffJobKept: (job) => `${job} (유지)`,
    staffNewJob: "새 직책을 맡고 주급과 계약 만료일은 유지합니다. 계약 시작일은 게임 내 날짜가 됩니다.",
    staffDoes: [
      "새 구단에서 직책에 맞는 곳에 합류합니다. 의료진, 코치진, 스카우트진에 들어가거나 풋볼 디렉터 또는 감독이 되며, " +
        "이미 그 자리가 찬 구단으로는 갈 수 없습니다",
      "주급과 계약 만료일은 그대로이며, 계약 시작일은 게임 내 날짜가 됩니다",
      "팀을 떠나는 감독의 자리는 비워 두어 구단이 채우게 합니다. 이사진은 게임에 맡깁니다",
      "변경 내역에 기록되며, 거기서 되돌릴 수 있습니다",
    ],
    staffSignButtonTitle: "소속 구단이 없는 이 스태프를 게임 안의 구단과 계약시킵니다",
    staffSignTitle: "스태프 영입",
    staffSignChooseClub: "이 스태프를 영입할 구단을 선택하세요.",
    staffSignChooseJob: "구단에서 맡을 직책을 선택하세요.",
    staffSignTerms:
      "비워 두면 그 구단에서 직책이 가장 비슷한 스태프의 주급과 다음 시즌 종료까지의 계약으로 정해집니다.",
    staffSignRoute: (to) => `소속 없음 → ${to}`,
    staffSignContract: (wage, expires) => `새 계약: 주급 ${wage}, ${expires}까지`,
    staffSignDoes: [
      "구단에서 직책에 맞는 곳에 합류합니다. 해당 부서에 들어가며(꽉 찼으면 늘립니다), 풋볼 디렉터나 감독은 그 자리가 " +
        "비어 있을 때만 맡습니다",
      "게임 내 날짜부터 시작하는 새 계약을, 게임이 직접 만들 때처럼 게임의 빈 계약 자리 중 하나에 만듭니다",
      "그 구단에서 같은 직책(없으면 같은 부서, 그것도 없으면 아무 스태프) 중 능력이 가장 비슷한 스태프의 계약을 " +
        "본보기로 삼습니다",
      "입력한 주급과 계약 만료일, 또는 본보기 계약의 주급과 다음 시즌 종료일이 적용됩니다. 조항이나 보너스는 없습니다",
      "변경 내역에 기록되며, 되돌리기 한 번으로 모두 되돌립니다",
    ],
    swapChooseClub: "맞교환할 선수의 구단을 선택하세요.",
    swapChoosePlayer: "맞교환할 선수를 선택하세요.",
    swapChecking: "맞교환을 확인하는 중…",
    swapRoute: (player, from, to, other) => `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "맞교환으로 바뀌는 것",
    swapDoes: [
      "두 선수가 각각 상대 구단의 1군에 합류합니다",
      "계약 시작일은 게임 내 날짜가 되고, 등번호는 비워집니다",
      "두 선수 모두 이적 명단과 임대 명단에서 빠집니다",
      "이전 구단에서 맡던 주장직은 비워 둡니다",
      "이적료는 오가지 않으며, 경력 기록은 갱신되지 않습니다",
      "변경 내역에 하나의 변경으로 기록되며, 되돌리면 두 이동이 모두 취소됩니다",
    ],

    // Signing a free agent
    signButtonTitle: "이 자유 계약 선수를 게임 안의 구단과 계약시킵니다",
    signTitle: "자유 계약 선수 영입",
    signChooseClub: "선수를 영입할 구단을 선택하세요.",
    signChecking: "영입을 확인하는 중…",
    signTerms: "비워 두면 그 구단에서 능력이 가장 비슷한 선수의 주급과 다음 시즌 종료까지의 계약으로 정해집니다.",
    signRoute: (to) => `자유 계약 → ${to}`,
    signContract: (wage, expires, status) => `새 계약: 주급 ${wage}, ${expires}까지, ${status}`,
    signDoesHeading: "영입으로 바뀌는 것",
    signDoes: [
      "구단의 1군에 합류합니다. 선수단 명단이 꽉 찼으면 늘립니다",
      "게임 내 날짜부터 시작하는 새 계약을, 게임이 직접 만들 때처럼 게임의 빈 계약 자리 중 하나에 만듭니다",
      "그 구단에서 능력이 가장 비슷한 선수의 계약을 본보기로 삼습니다. 계약 유형과 팀 내 위상이 같습니다",
      "입력한 주급과 계약 만료일, 또는 그 선수의 주급과 다음 시즌 종료일이 적용됩니다",
      "등번호, 로열티 보너스, 조항, 보너스는 없습니다",
      "게임의 이적 기록에는 아직 표시되지 않습니다",
      "변경 내역에 기록되며, 되돌리기 한 번으로 모두 되돌립니다",
    ],
    signHint: "'영입'을 누르기 전까지 게임은 아무것도 바뀌지 않습니다.",
    sign: "영입",
    signing: "영입하는 중…",

    // The foot
    hint: "'이적'을 누르기 전까지 게임은 아무것도 바뀌지 않습니다.",
    move: "이적",
    moving: "이적시키는 중…",
    cancel: "취소",
    swapHint: "'맞교환'을 누르기 전까지 게임은 아무것도 바뀌지 않습니다.",
    swap: "맞교환",
    swapping: "맞교환하는 중…",
  },

  ties: {
    heading: "국적 및 홈그로운",
    nationalities: "추가 국적",
    trainedInNation: "국가에서 훈련",
    trainedAtClub: "구단에서 훈련",
    workPermit: "취업 비자 불필요 국가",
    none: "없음",
    rules: {
      1: "15-21 홈그로운",
      2: "0-21 홈그로운",
      5: "15-21 홈그로운(임대 제외)",
      10: "0-19 홈그로운(1년)",
    },
    rule: (code) => `홈그로운 규정 ${format(code)}`,

    change: "변경",
    changeTitle: "게임에서 이 선수의 추가 국적과 홈그로운 상태를 변경합니다",
    title: "국적 및 홈그로운",
    hint: "각 변경은 바로 게임에 기록되고 변경 내역에 남으며, 거기서 되돌릴 수 있습니다.",
    full:
      "게임이 이 선수의 목록을 지금 내용에 딱 맞는 크기로 만들어 두었습니다. 국적이나 훈련 기록을 바꾸거나 지울 수는 " +
      "있지만 추가할 수는 없습니다.",
    nationOf: (name) => `${name} 대신 넣을 국가`,
    ruleOf: (name) => `${name}의 홈그로운 규정`,
    remove: "제거",
    removeTitle: (name) => `${name} 제거`,
    addNationality: "국적 추가…",
    addNation: "국가 추가…",
    addPermit: "취업 비자가 필요 없는 국가 추가…",
    daysLeft: (days) => `${format(days)}일 남음`,
    permitInfoLabel: "이것은 무엇을 하나요?",
    permitInfo:
      "게임은 브렉시트 이전에 잉글랜드나 스코틀랜드에 있던 유럽 연합 선수가 일정 기간 취업 비자 없이 그곳에서 뛸 수 " +
      "있게 합니다. 이 항목을 받은 선수도 그 나라에서 뛸 때 취업 비자가 필요 없으며, 기간은 그 선수들에게 남은 날수와 " +
      "같습니다(세이브에 그런 선수가 없으면 10년).",
    newRule: "새 국가의 홈그로운 규정",
    add: "추가",
    changeClub: "구단 변경",
    changeClubTitle: (name) => `${name} 대신 다른 구단에서 훈련받은 것으로 바꿉니다`,
    clubInsteadOf: (name) => `${name} 대신 넣을 구단`,
    addClub: "구단 추가…",
    addClubTitle: "훈련받은 구단을 하나 더 추가합니다",
    newClub: "새 구단",
    pickAnother: "다른 구단 선택",
    newClubRule: "새 구단의 홈그로운 규정",
    cancel: "취소",
    working: "게임에 쓰는 중…",
    close: "닫기",
  },

  clauses: {
    change: "변경",
    changeTitle: "게임에서 이 선수의 보너스와 조항을 변경합니다",
    title: "보너스 및 조항",
    hint: "각 변경은 바로 게임에 기록되고 변경 내역에 남으며, 거기서 되돌릴 수 있습니다.",
    full:
      "게임이 이 계약의 목록을 지금 내용에 딱 맞는 크기로 만들어 두었습니다. 보너스나 조항을 바꾸거나 지울 수는 있지만 " +
      "방출 조항을 추가할 수는 없습니다.",
    amountOf: (name) => `${name} 금액`,
    conditionOf: (name) => `${name} 조건`,
    save: "저장",
    remove: "제거",
    removeTitle: (name) => `${name} 제거`,
    addRelease: "방출 조항 추가",
    releaseAmount: "새 방출 조항의 금액",
    add: "추가",
    outOfRange: (max) => `0에서 ${max} 사이의 정수를 입력하세요.`,
    working: "게임에 쓰는 중…",
    close: "닫기",
  },

  release: {
    button: "방출",
    buttonTitle: "게임에서 이 선수를 소속 구단에서 방출합니다. 자유 계약 선수가 됩니다",

    title: "방출",
    from: "떠나는 구단",
    checking: "방출을 확인하는 중…",
    ready: (club) => `${club} → 자유 계약`,
    doesHeading: "방출로 바뀌는 것",
    does: [
      "구단의 모든 팀에서 빠지고 계약이 끝나, 어느 구단이든 영입할 수 있는 자유 계약 선수가 됩니다",
      "누구에게도 돈이 지급되지 않습니다",
      "구단에서 맡던 주장직은 비워 둡니다",
      "게임의 이적 기록에는 표시되지 않습니다",
      "변경 내역에 기록되며, 되돌리기 한 번으로 선수가 같은 계약으로 돌아옵니다",
    ],

    hint: "'방출'을 누르기 전까지 게임은 아무것도 바뀌지 않습니다.",
    release: "방출",
    releasing: "방출하는 중…",
    cancel: "취소",
  },

  permanent: {
    title: "임대를 완전 이적으로 전환",
    stays: "남는 구단",
    leaves: "떠나는 구단",
    checking: "확인하는 중…",
    doesHeading: "바뀌는 것",
    does: [
      "지금 뛰는 구단에 남고, 오늘부터 위 조건으로 그 구단과 계약합니다",
      "그 구단에서 쓰던 등번호와 팀 내 위상을 유지합니다",
      "원소속 구단의 모든 팀에서 빠지고 임대가 끝납니다",
      "게임의 이적 기록에는 표시되지 않습니다",
      "변경 내역에 이적으로 기록되며, 되돌리기 한 번으로 임대 상태로 돌아갑니다",
    ],
    optionFee: (money) => `임대의 완전 영입 옵션 금액으로 채웠습니다: ${money}`,
    hint: "'완전 이적으로 전환'을 누르기 전까지 게임은 아무것도 바뀌지 않습니다.",
    confirm: "완전 이적으로 전환",
    confirming: "전환하는 중…",
    cancel: "취소",
  },

  recall: {
    title: "임대 복귀",
    from: "임대 중인 구단",
    to: "돌아갈 구단",
    doesHeading: "임대 복귀로 바뀌는 것",
    does: (parent) => [
      "오늘이 임대 마지막 날이 됩니다. 하루가 끝나면 게임이 직접 임대를 종료합니다",
      `게임에서 하루 진행하면 선수가 ${parent}(으)로 돌아옵니다`,
      "그때까지는 변경 내역에 기록되어 있으며, 되돌리면 임대의 원래 종료일로 돌아갑니다",
    ],
    termsHeading: "게임 안에서는",
    notRecallable: (parent) => `임대 조건상 ${parent}은(는) 선수를 복귀시킬 수 없습니다`,
    notTerminable: "임대를 조기 종료할 수 없습니다",
    worksAnyway:
      "그래도 여기의 임대 복귀는 작동합니다. 게임의 복귀 절차를 거치지 않고 임대 마지막 날을 옮기기 때문입니다",
    dropsOption: (club, amount) =>
      `${club}의 완전 영입 옵션(${amount})을 제거합니다. 그대로 두면 임대가 끝날 때 게임이 선수를 ${club}에 팔 수 있습니다`,
    hint: "'복귀'를 누르기 전까지 게임은 아무것도 바뀌지 않습니다.",
    confirm: "복귀",
    confirming: "복귀시키는 중…",
    cancel: "취소",
  },

  squad: {
    teamsLabel: "팀",
    teams: {
      first: "1군",
      b: "B팀",
      age: (limit) => `U${limit}`,
      other: (place) => `팀 ${place}`,
    },
    noTeams: "이 구단에는 팀이 없습니다.",
    loading: "선수단을 읽는 중…",
    empty: "이 팀에는 선수가 없습니다.",

    // Above the table
    players: (count) => playerCount(count),
    averageAge: (age) => `평균 연령 ${age}세`,
    captains: (captain, viceCaptain) => `주장: ${captain} · 부주장: ${viceCaptain}`,

    // The actions on the whole team
    actionsLabel: "팀 전체에 대한 작업",
    healAll: (injured) => (injured === 0 ? "모두 치료" : `모두 치료 (부상 ${format(injured)}명)`),
    healAllTitle: "이 팀 모든 선수의 모든 부상을 치료합니다",
    healNone: "이 팀에는 부상 선수가 없습니다",
    liftAll: (banned) => (banned === 0 ? "출장 정지 해제" : `출장 정지 해제 (${format(banned)}명)`),
    liftAllTitle: "이 팀 모든 선수의 모든 출장 정지를 해제합니다",
    liftNone: "이 팀에는 출장 정지 선수가 없습니다",
    inspireAll: "모두 사기 진작",
    inspireAllTitle: "이 팀 모든 선수의 사기를 최고인 20으로 설정하고 불만 사항을 제거합니다",
    maxCohesion: "결속력 최대",
    maxCohesionTitle:
      "이 팀 모든 선수의 구단과의 결속력을 최고인 100으로 설정합니다. 팀 결속력은 게임이 진행된 뒤 '세력 구도' " +
      "화면에 표시됩니다. 게임에서 '진행하기'를 누르세요",
    cohesionNone:
      "이 팀의 결속력을 읽을 수 없습니다. 이 게임 버전에서 아직 확인되지 않았거나, 구단에 대한 결속력 항목이 있는 " +
      "선수가 없습니다",
    cohesionWithout: (count) => `${playerCount(count)}은 아직 구단과의 결속력이 없습니다`,
    refreshAll: "모두 회복",
    refreshAllTitle: "이 팀 모든 선수의 컨디션과 경기력을 100%로 설정하고 완전히 쉬게 합니다(피로도 -500)",
    maxAll: "능력치 최대",
    maxAllTitle: "이 팀 모든 선수의 모든 능력치를 최고로 만듭니다. 20으로, 부상 빈도와 더티 플레이는 1로 설정합니다",
    hint: "작업은 목록의 모든 선수에게 적용되며, 임대를 떠난 선수도 포함됩니다. 변경 내역 화면에서도 되돌릴 수 있습니다.",

    // Freezing the whole team
    freezeLabel: "팀 전체 고정",
    freezeAttributes: "능력치 고정",
    freezeAttributesTitle:
      "앱이 열려 있고 연결된 동안에는 이 팀 모든 선수의 능력치가 떨어지지 않습니다. 게임이 깎은 만큼 되돌리며, 오른 " +
      "능력치는 그대로 반영됩니다",
    freezeFitness: "컨디션 및 경기력 고정",
    freezeFitnessTitle:
      "앱이 열려 있고 연결된 동안에는 이 팀 모든 선수의 컨디션과 경기력이 떨어지지 않습니다. 게임이 깎은 만큼 " +
      "되돌립니다. 100%로 유지하려면 먼저 '모두 회복'을 누르세요",
    freezePositions: "포지션 고정",
    freezePositionsTitle:
      "앱이 열려 있고 연결된 동안에는 이 팀 모든 선수의 포지션 적응도가 그대로 유지됩니다. 게임이 올리거나 내린 " +
      "적응도를 되돌립니다",
    frozenCount: (frozen, total) => `${format(total)}명 중 ${format(frozen)}명`,
    freezeHint:
      "고정은 목록의 모든 선수에게 적용되며, 선수가 어디로 가든 그 선수에게 유지됩니다. 앱은 이 세이브에 대해 이 설정을 " +
      "기억합니다.",
    frozeAttributes: (count) =>
      count === 0 ? "능력치가 이미 고정되어 있습니다" : `${playerCount(count)}의 능력치를 고정했습니다`,
    unfrozeAttributes: (count) => `${playerCount(count)}의 능력치 고정을 해제했습니다`,
    frozeFitness: (count) =>
      count === 0
        ? "컨디션과 경기력이 이미 고정되어 있습니다"
        : `${playerCount(count)}의 컨디션과 경기력을 고정했습니다`,
    unfrozeFitness: (count) => `${playerCount(count)}의 컨디션과 경기력 고정을 해제했습니다`,
    frozePositions: (count) =>
      count === 0 ? "포지션이 이미 고정되어 있습니다" : `${playerCount(count)}의 포지션을 고정했습니다`,
    unfrozePositions: (count) => `${playerCount(count)}의 포지션 고정을 해제했습니다`,

    // What an action did
    written: (count) => `${changeCount(count)} 기록됨`,
    refused: (name, reason) => `${name}: ${reason}`,
    undo: "되돌리기",
    undoTitle: "이 변경 사항의 이전 값을 게임에 다시 씁니다",

    // Captains
    captainShort: "C",
    viceCaptainShort: "VC",
    menuLabel: (name) => `${name}의 주장직`,
    menuTitle: "주장직",
    makeCaptain: "주장으로 지정",
    makeViceCaptain: "부주장으로 지정",
    nowCaptain: (name) => `이제 ${name}이(가) 주장입니다`,
    nowViceCaptain: (name) => `이제 ${name}이(가) 부주장입니다`,
    noCaptain: "이제 주장이 없습니다",
    noViceCaptain: "이제 부주장이 없습니다",

    // The table
    tableLabel: (team) => `${team} 선수`,
    openProfile: "선수 프로필 열기",
    columns: {
      name: "이름",
      position: "포지션",
      age: "나이",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "컨디션",
      matchSharpness: "경기력",
      jadedness: "피로도",
      morale: "사기",
      cohesion: "결속력",
      actions: "주장직",
    },
    sortBy: (by) => `${by} 기준으로 정렬`,
    sortNames: {
      name: "이름",
      position: "포지션",
      age: "나이",
      currentAbility: "현재 능력",
      potentialAbility: "잠재 능력",
      condition: "컨디션",
      matchSharpness: "경기력",
      jadedness: "피로도",
      morale: "사기",
      cohesion: "결속력",
    },

    // The tags after a name
    injured: "부상",
    injuredTitle: (count) => `부상 ${format(count)}건`,
    banned: "출장 정지",
    bannedTitle: (count) => `출장 정지 ${format(count)}건`,
    onLoan: "임대 중",
    onLoanTitle: "다른 구단으로 임대를 떠나 있습니다",
    loanee: "임대생",
    loaneeTitle: "다른 구단에서 임대로 와 있습니다",
    elsewhere: "다른 팀",
    elsewhereTitle: "구단의 다른 팀에서 뜁니다",
    frozen: "고정됨",
    frozenTitle: (attributes, fitness, positions): string => {
      const frozen = [
        ...(attributes ? ["능력치"] : []),
        ...(fitness ? ["컨디션", "경기력"] : []),
        ...(positions ? ["포지션"] : []),
      ];
      return `고정됨: ${frozen.join(", ")}`;
    },
  },

  game: {
    name: "풋볼 매니저",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "알 수 없는 스토어",
    },
    steamBuild: (id) => `빌드 ${id}`,
  },

  scouting: {
    nav: "스카우트",
    reading: "구단을 읽는 중…",
    refresh: "새로 고침",
    refreshTitle: "게임에서 구단을 다시 읽습니다",
    searching: "검색하는 중…",
    none: "—",
    perWeek: "/주",
    openProfile: "프로필 열기",
    freeAgent: "자유 계약",
    loan: "임대",
    header: {
      transferBudget: "이적 예산",
      wageRoom: "급료 여유분",
      wageBudget: "급료 예산",
      squad: "선수단",
      averageAge: "평균 연령",
      players: (count) => playerCount(count),
    },
    tabs: {
      label: "스카우트 섹션",
      recommend: "영입 조언",
      depth: "선수층",
      departures: "내보낼 선수",
    },
    status: {
      missing: "없음",
      thin: "부족",
      fine: "적정",
      crowded: "과밀",
    },
    lines: {
      goalkeeper: "골키퍼",
      centreBack: "센터백",
      fullBack: "풀백",
      wingBack: "윙백",
      defensiveMidfield: "수비형 미드필더",
      centralMidfield: "중앙 미드필더",
      attackingMidfield: "공격형 미드필더",
      wide: "측면",
      striker: "스트라이커",
    },
    depthLines: {
      gk: "골키퍼",
      dc: "센터백",
      rightBack: "오른쪽 수비수",
      leftBack: "왼쪽 수비수",
      dm: "수비형 미드필더",
      mc: "중앙 미드필더",
      rightWing: "오른쪽 윙어",
      leftWing: "왼쪽 윙어",
      amc: "공격형 미드필더",
      st: "공격수",
    },
    positionTip: (line, count, target, status) =>
      `${line}: 선수단에 ${format(count)}명 (보통 ${format(target)}명) — ${status}`,
    brief: {
      heading: "어떤 선수를 찾고 있나요?",
      pitch: "포지션",
      legend: "점은 각 라인의 선수단 상태를 나타냅니다.",
      inPossession: "공 소유 시",
      outOfPossession: "공 미소유 시",
      anyRole: "전체 — 선수마다 가장 잘 맞는 역할",
      purpose: "용도",
      filters: "필터",
      minAge: "최소 나이",
      maxAge: "최대 나이",
      maxFee: "최대 이적료",
      minProbability: "가능성",
      anyProbability: "전체",
      noFreeAgents: "자유 계약 선수 제외",
    },
    purposes: {
      firstTeam: "1군",
      rotation: "로테이션",
      future: "미래",
      any: "전체",
    },
    purposeTips: {
      firstTeam: "이 포지션에서 당신의 최고 선수보다 나은 선수",
      rotation: "당신의 두 번째 선택지만큼 좋고 가격이 합리적인 선수",
      future: "21세 이하이며 성장 여지가 있는 선수",
      any: "맞는 선수 전체",
    },
    ask: {
      before: "",
      after: " 포지션 조언",
      anyRole: "선수별 최적 역할",
    },
    own: {
      heading: "내 선수단",
      empty: "내 선수단에는 이 자리에서 뛰는 선수가 없습니다.",
      position: "포지션",
    },
    summary: (candidates, eligible, shown, purpose) =>
      `이 자리에서 뛸 수 있는 선수 ${format(candidates)}명 · ${purpose} 조건에 맞는 선수 ${format(eligible)}명 · ` +
      `추천 ${format(shown)}명`,
    how: {
      label: "이 목록은 어떻게 만들어지나요?",
      note: (rule, count) =>
        `스카우트는 이 포지션에서 뛸 수 있는(적응도 10 이상) 모든 선수를 살펴보되, 내 구단의 선수와 다른 사람 감독 구단의 선수는 제외합니다. 그중 ${rule} 선수만 남깁니다. 가장 잘 맞는 400명에 대해 각 선수가 내 구단에 올 가능성을 계산한 뒤, 적합도와 가능성을 함께 따져 상위 ${count}명을 추천합니다. 추천 순서는 적합도 70%, 가능성 30%이며 30세가 넘은 선수는 조금 낮게 봅니다. 로테이션은 둘을 같은 비중으로 보고, 미래는 잠재 능력도 함께 봅니다. 열 제목을 누르면 목록을 정렬할 수 있으며, #은 스카우트가 매긴 순서입니다.`,
    },
    purposeRules: {
      firstTeam: "그 포지션에서 내 최고 선수보다 더 잘 맞는",
      rotation: "내 두 번째 선택지 이상으로 잘 맞는",
      future: "21세 이하이고 성장 여지가 있는(잠재 능력이 현재 능력보다 15 이상 높은)",
      any: "조금이라도 맞는",
    },
    sortBy: (by) => `${by} 기준으로 정렬`,
    sortNames: {
      rank: "스카우트 순서",
      name: "이름",
      age: "나이",
      ca: "현재 능력",
      pa: "잠재 능력",
      fit: "적합도",
      probability: "가능성",
      fee: "이적료",
    },
    backToScoutOrder: "스카우트 순서로 돌아가기",
    showMore: (count) => `${format(count)}명 더 보기`,
    playsFor: (club) => `${club}에서 뛰는 중`,
    empty: "이 설정으로는 이 포지션에 대한 조언이 없습니다. 용도를 '전체'로 바꾸거나 필터를 느슨하게 해 보세요.",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "선수",
      age: "나이",
      fit: "적합도",
      role: "역할",
      probability: "가능성",
      fee: "예상 이적료",
      wage: "주급",
      note: "스카우트 메모",
      money: "이적료",
      value: "몸값",
    },
    probabilityInfo: "선수가 내 구단에 올 가능성입니다. 선수의 몸값, 계약, 소속 구단, 명성으로 추정한 값입니다.",
    probabilityInfoLabel: "가능성이란?",
    fitTitle: (inPossession, outOfPossession, position) =>
      [
        inPossession !== null && `공 소유 시: ${inPossession}`,
        outOfPossession !== null && `공 미소유 시: ${outOfPossession}`,
        `포지션: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note: "적합도는 역할별로 에디터가 정한 능력치 가중치를 사용합니다. 이적료, 주급, 가능성은 추정값입니다.",
    depth: {
      summary: (size, age, level) =>
        `선수 ${format(size)}명${age === null ? "" : ` · 평균 연령 ${age}세`} · 베스트 11 평균 능력 ${level}`,
      weak: "선수단 수준 미달",
      ageing: "고령화",
      cover: (names) => `이 자리에서도 뛸 수 있는 선수: ${names}`,
      advice: "조언 받기",
      adviceTitle: "이 라인에 대한 영입 조언",
      empty: "없음",
      ability: "현재 능력",
      more: (count) => `+${format(count)}명`,
      columns: {
        line: "라인",
        status: "상태",
        count: "선수",
        players: "능력 순",
        cover: "이 자리에서도 뛸 수 있는 선수",
        age: "평균 연령",
      },
      countTitle: (count, target) =>
        `가장 잘 맞는 포지션이 이 라인인 선수 ${format(count)}명. 선수단에는 보통 ${format(target)}명을 둡니다`,
      statusHelp: {
        missing: "이 자리에서 뛰는 선수가 없습니다.",
        thin: "선수단이 보통 두는 수보다 적습니다. 대신 뛸 수 있는 선수는 절반으로 셉니다.",
        fine: "선수단이 보통 두는 수와 비슷합니다.",
        crowded: "선수단이 보통 두는 수보다 두 명 이상 많습니다.",
      },
      attention: "살펴볼 곳:",
      allFine: "모든 라인이 균형 잡혀 있습니다.",
    },
    departures: {
      intro: "스카우트가 내보내도 좋다고 보는 선수들입니다. 시급한 순서로 표시합니다.",
      filter: "조언",
      all: "전체",
      empty: "지금은 스카우트가 내보낼 선수가 없다고 봅니다.",
      sortNames: {
        rank: "스카우트 순서",
        name: "이름",
        age: "나이",
        ca: "현재 능력",
        pa: "잠재 능력",
        value: "몸값",
        wage: "주급",
        contract: "계약 만료",
      },
      columns: {
        player: "선수",
        age: "나이",
        ability: "능력",
        value: "몸값",
        wage: "주급",
        contract: "계약 만료",
        advice: "조언",
        reasons: "사유",
      },
      actions: { sell: "판매", loan: "임대 보내기", release: "방출" },
      rank: (line, rank) => `${line} · ${rank}번째`,
    },
    // The game's names, matched through the editor's keys, which are the game's abbreviations: its AP is the Advanced
    // Playmaker, its IFB and IWB the Inside Full-Back and Wing-Back, its OAM and OCF the Central Outlet roles.
    roles: {
      bgk: "볼 플레잉 골키퍼",
      ngk: "안정형 골키퍼",
      sk: "스위퍼 키퍼",
      lhk: "라인 홀딩 키퍼",
      cb: "센터백",
      bcb: "볼 플레잉 센터백",
      ncb: "안정형 센터백",
      acb: "전진형 센터백",
      ocb: "오버래핑 센터백",
      scb: "스토핑 센터백",
      ccb: "커버링 센터백",
      wcb: "와이드 센터백",
      fb: "풀백",
      ifb: "인사이드 풀백",
      pfb: "압박형 풀백",
      hfb: "홀딩 풀백",
      wb: "윙백",
      iwb: "인사이드 윙백",
      pwb: "플레이메이킹 윙백",
      awb: "전진형 윙백",
      hwb: "홀딩 윙백",
      dm: "수비형 미드필더",
      hb: "하프백",
      ddm: "처진 수비형 미드필더",
      pdm: "압박형 수비형 미드필더",
      bbm: "박스 투 박스 미드필더",
      bbp: "박스 투 박스 플레이메이커",
      cm: "중앙 미드필더",
      pcm: "압박형 중앙 미드필더",
      scm: "스크리닝 중앙 미드필더",
      chm: "채널 미드필더",
      wcm: "와이드 중앙 미드필더",
      ap: "전진형 플레이메이커",
      am: "공격형 미드필더",
      oam: "중앙 지향 공격형 미드필더",
      w: "윙어",
      if: "인사이드 포워드",
      pw: "플레이메이킹 윙어",
      wfd: "와이드 포워드",
      tw: "추적형 윙어",
      iow: "인사이드 지향 윙어",
      cfd: "센터 포워드",
      dlf: "딥라잉 포워드",
      p: "포처",
      tcf: "추적형 센터 포워드",
      ocf: "중앙 지향 센터 포워드",
    },
    reasons: {
      listed: () => "이적 명단 등록",
      freeAgent: () => "자유 계약",
      expiring: (value) => `계약 만료까지 ${value}일`,
      releaseClause: (value) => `방출 조항 ${value}`,
      fringe: () => "소속 구단에서 주전이 아님",
      keyPlayer: () => "소속 구단의 핵심 선수",
      unwanted: () => "소속 구단에서 잉여 자원",
      overBudget: (value) => `예산을 ${value} 초과`,
      stretch: (value) => `예산을 약간 초과 (+${value})`,
      wageHigh: (value) => `주급이 급료 여유분보다 주당 ${value} 많음`,
      biggerClub: () => "더 큰 구단 소속",
      smallerClub: () => "더 작은 구단 소속",
      reputationGap: () => "내 구단에는 너무 큰 이름값",
      ambitious: () => "포부가 큼: 더 큰 무대를 반길 것",
      notForSale: () => "판매 불가",
    },
    departureReasons: {
      surplus: (value) => `과밀한 라인 (${value}명)`,
      belowLevel: () => "선수단 수준 미달",
      ageing: (value) => `나이가 많아짐 (${value})`,
      expiring: (value) => `계약 만료까지 ${value}일`,
      highWage: (value) => `역할에 비해 높은 주급 (주당 ${value})`,
      unhappy: () => "불만",
      lowMorale: () => "낮은 사기",
      blocked: () => "성장하려면 출전이 필요함",
      unwanted: () => "팀 내 위상: 잉여 자원",
      listed: () => "이미 이적 명단에 등록됨",
    },
  },

  errors,
};
