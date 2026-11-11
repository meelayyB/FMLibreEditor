// 简体中文界面文案，键与结构以 `en.ts` 为准。
// 注释保留英文源文件中的用途说明，便于和界面位置对应。
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
import type { Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("zh-CN");
const percents = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12,345". */
const format = (value: number) => numbers.format(value);

/** "No changes", "1 change", "3 changes", "12,345 changes". */
const changeCount = (count: number) =>
  count === 0 ? "暂无改动" : `${format(count)} 项改动`;

/** "1 player", "12 players". */
const playerCount = (count: number) => `${format(count)} 名球员`;

/** "1 value left alone", "12 values left alone". */
const valuesLeftAlone = (count: number) =>
  `${format(count)} 个未改动的值`;

/** "237 players", "1 player", "237 staff", "1 member of staff", "12 clubs", "1 club". */
const entityCount: Record<Entity, (count: number) => string> = {
  player: (count) => `${format(count)} 名球员`,
  staff: (count) => `${format(count)} 名职员`,
  club: (count) => `${format(count)} 家俱乐部`,
};

/** What each list holds, in the plural. */
const entityNouns: Record<Entity, string> = { player: "球员", staff: "职员", club: "俱乐部" };

/**
 * Squad statuses, by the codes contracts hold them as; named as the game's English contract screen names them. 15, 16,
 * 17, 20 and 21 are goalkeepers' (21 is the game's "Emergency Backup" too).
 */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "球队核心",
  2: "重要球员",
  3: "常规首发",
  4: "轮换球员",
  5: "替补奇兵",
  7: "边缘球员",
  9: "紧急替补",
  10: "即将崭露头角的新星",
  11: "未来之星",
  13: "年轻球员",
  14: "B 队常规球员",
  15: "主力门将",
  16: "杯赛门将",
  17: "国内杯赛门将",
  20: "替补门将",
  21: "紧急替补门将",
  22: "不再需要",
};

/** The kinds of contract, by the codes contracts hold them as; 10 and 11 are the MLS's. */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "兼职合同",
  1: "全职合同",
  2: "业余合同",
  3: "青年合同",
  4: "无合同",
  10: "资深球员最低工资合同",
  11: "资深球员合同",
};

/**
 * Sentences for the failures of the Rust commands, by code (see `describeError` in format.ts). Each gets the values
 * the failure names, its amounts and dates already written out; fields come as keys, which `fieldName` names. A code
 * a dictionary leaves out shows the English message the command sent.
 */
export type ErrorTexts = Partial<Record<string, (params: Readonly<Record<string, string>>) => string>>;

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(zhCN, key ?? "");

/** What a check is about, from the key a failure gives, with a capital: "Contracts". */
const checkName = (key: string | undefined) => {
  const name = (zhCN.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The name of a job code a failure gives, as `jobs` below has it. */
const jobName = (code: string | undefined) =>
  (zhCN.jobs as Partial<Record<number, string>>)[Number(code)] ?? code ?? "";

/** The noun of the kind of record a failure names, or "记录" when it names none. */
const recordNoun = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? entityNouns[entity] : "记录";

/** The reasons the Rust side gives for a field that cannot be changed some way. */
const UNSUPPORTED: Partial<Record<string, string>> = {
  "a date can only be set": "日期只能直接设定",
  "it is changed one person at a time": "只能逐个人修改",
  "the new value is not one of the game's own records of that kind": "新值不是游戏中该类型的已有记录",
  "the in-game date is not known": "无法得知游戏内日期",
};

/** What to do once the game's data moved under the editor. */
const reload = "请点击“重新读取数据”后重试";

/** The lists of a club's staff, as `staff.noRoom` names them. */
const STAFF_DEPARTMENTS: Partial<Record<string, string>> = {
  medical: "医疗组",
  coaching: "教练组",
  scouting: "球探组",
};

/** 按错误代码显示中文提示；参数由命令返回。 */
const errors: ErrorTexts = {
  "edit.unknownField": (p) => `此处没有可编辑的字段“${p.field}”。`,
  "edit.outOfRange": (p) => `${p.value} 不是有效的${field(p.field)}；取值范围为 ${p.min}–${p.max}。`,
  "edit.notADate": (p) => `${p.value} 不是有效的${field(p.field)}日期。`,
  "edit.notAChoice": (p) => `${p.value} 不是${field(p.field)}可用的选项。`,
  "edit.taken": (p) => `球衣号码 ${p.value} 已被占用：${p.name ?? `UID 为 ${p.uid} 的球员`} 正在穿着该号码。`,
  "edit.unsupported": (p) => `无法以这种方式修改${field(p.field)}：${UNSUPPORTED[p.reason ?? ""] ?? p.reason}。`,
  "edit.moved": (p) => `该${recordNoun(p.entity)}在游戏内存中的位置已改变；${reload}。`,
  "edit.noRecord": (p) => `无法在此修改${field(p.field)}：记录缺失或校验未通过。`,
  "edit.unset": (p) => `游戏中尚未设置${field(p.field)}，因此保留原值。`,
  "edit.implausible": (p) => `${field(p.field)}的值 ${p.value} 超出合理范围；为安全起见，保留原值。`,
  "edit.notApplied": (p) => `${field(p.field)}：写入值为 ${p.wrote}，但读回值为 ${p.read}。`,
  "edit.conflict": (p) => `${field(p.field)}当前为 ${p.found}，预期为 ${p.expected}；游戏已在此期间修改了它。`,
  "move.outOfRange": (p) => `${p.value} 不是有效的${field(p.field)}；取值范围为 ${p.min}–${p.max}。`,
  "export.failed": (p) => `无法写入文件：${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor 无法写入 ${p.folder}。如果 macOS 询问是否允许访问“文稿”文件夹，请在“系统设置 › 隐私与安全性 › 文件与文件夹”中允许，然后重新导出。`,
  "export.openFailed": (p) => `无法打开文件：${p.reason}`,
  "guard.unknownBuild": () =>
    "FMLibreEditor 尚未针对此游戏版本进行验证，因此不会写入游戏。点击顶部提示中的“仍要编辑”即可启用编辑。",
  "guard.failed": (p) =>
    `此游戏版本的${checkName(p.check)}检查未通过，FMLibreEditor 会保留相关数据不变。`,
  "guard.saveChanged": () =>
    "自 FMLibreEditor 读取游戏以来，游戏已载入存档或返回了主菜单，因此在你点击“重新读取数据”之前不会进行任何修改。",
  "memory.noBridge": () =>
    "macOS 不允许 FMLibreEditor 访问游戏：启动游戏时未加载 FMLibreEditor bridge。请先设置 bridge，然后从 Steam 重新启动游戏。",
  "staff.directorTaken": (p) =>
    `${p.name ?? "其他职员"}已担任该俱乐部的足球总监。请为这名职员改派其他职位，或先将${p.name ?? "其本人"}转出。`,
  "staff.managerTaken": (p) =>
    `${p.name ?? "其他职员"}已担任该俱乐部的主教练。请为这名职员改派其他职位，或先将${p.name ?? "其本人"}转出。`,
  "staff.yourClub": () =>
    "你正在执教这家俱乐部。请为这名职员改派其他职位；FMLibreEditor 不会取代你。",
  "staff.noJob": () => "请选择该职员在俱乐部担任的职位。",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "该俱乐部没有职员：此存档中不可游玩的联赛俱乐部不会保存职员数据。"
      : "该俱乐部没有职员拥有可供参照的新合同所需的全职合同。",
  "scout.noClub": () => "你在此存档中没有执教俱乐部，因此没有可供考察的对象。",
  "scout.noTactic": (p) => `无法从游戏中读取 ${p.club} 的战术。`,
  "scout.notPlaced": () => "该球员没有被安排在战术阵型中的任何位置。",
  "scout.unknownRole": (p) => `编辑器不认识“${p.role}”这个职责。`,
  "setup.steamRunning": () =>
    "Steam 正在运行，因此未更改 FM27 的启动选项；bridge 已安装。请退出 Steam 后重试，或自行在 Steam 中填写启动选项。",
  "setup.io": (p) => `${p.path}：${p.error}`,
  "setup.noLibrary": (p) => `应用中缺少一个 bridge 文件：${p.path}`,
  "setup.noSteamAccount": () => "在这台 Mac 上找不到 Steam 账户；请打开 Steam 并至少登录一次。",
  "setup.unknownConfig": (p) => `${p.path} 的格式不是 FMLibreEditor 认识的，因此未作改动。`,

  // The app and its change log
  "app.alreadyUndone": () => "此改动已撤销。",
  "app.dataChanged": () => `游戏中的这些数据已发生变化；${reload}。`,
  "app.internal": () => "应用发生了意外错误。",
  "app.noChange": (p) => `改动 ${p.id} 不存在。`,
  "app.notConnected": () => "尚未连接到游戏。",
  "app.notFound": (p) => `列表中没有 ID 为 ${p.uid} 的${recordNoun(p.entity)}；${reload}。`,

  // Connecting to the game, and its memory
  "session.notRunning": () => "Football Manager 27 未在运行。请启动游戏、载入存档后重试。",
  "session.noSuchProcess": (p) => `没有 PID 为 ${p.pid} 的 ${p.exe ?? "fm.exe"}。`,
  "session.severalRunning": (p) => `有 ${p.count} 个 ${p.exe ?? "fm.exe"} 正在运行（${p.pids}）；请选择其中一个。`,
  "session.pluginNotLoaded": () => "游戏数据尚未载入；请等到主菜单出现后重试。",
  "session.unsupportedEdition": (p) => `尚不支持 FM${p.edition}。`,
  "session.unknownEdition": () => "无法判断这是哪一版 Football Manager。",
  "session.playersNotFound": () => "未找到球员列表；请载入存档（仅停留在主菜单不行）后重试。",
  "memory.win32": (p) => `Windows 拒绝了一项操作（${p.operation}，错误 ${p.code}）。`,
  "memory.mach": (p) => `macOS 拒绝了一项操作（${p.operation}，错误 ${p.code}）。`,
  "memory.posix": (p) => `macOS 拒绝了一项操作（${p.operation}，errno ${p.code}）。`,
  "memory.bridge": (p) => `游戏中的 FMLibreEditor bridge 未能交出内存访问权限（${p.reason}）。`,
  "memory.read": (p) => `无法读取游戏内存（系统错误 ${p.code}）。`,
  "memory.write": (p) => `无法写入游戏内存（系统错误 ${p.code}）。`,
  "memory.readOnly": () => "游戏以只读方式打开；Windows 不允许写入。",
  "memory.notWritable": () => "该地址不在游戏可写的数据内存中，因此未写入。",
  "memory.invalidPe": () => "无法读取游戏模块。",
  "memory.invalidMachO": () => "无法读取游戏模块。",

  // Transfers, loans and signings
  "move.changed": () => `游戏在此期间修改了这部分内存；${reload}。`,
  "move.moved": () => `该球员在游戏内存中的位置已改变；${reload}。`,
  "move.freeAgent": () => "该球员是自由球员：没有可离开的俱乐部，也无法用于交换。",
  "move.humanClub": () =>
    "该球员效力于由玩家执教的俱乐部。在此游戏版本中，编辑器尚找不到该俱乐部的阵容安排，因此只能在游戏内让他离队。",
  "move.menAndWomen": () => "两家俱乐部一家是男足，一家是女足。",
  "move.noRoom": (p) => `该俱乐部的阵容名单已满（目前 ${p.players} 人），且编辑器在此系统上无法扩充。`,
  "move.notAClub": () => "这家俱乐部没有可让球员加入的一线队。",
  "move.notApplied": () => "内存已写入，但读回的内容与写入的不一致。",
  "move.notListed": () => "阵容名单中没有在应有的位置找到该球员。",
  "move.notOnLoan": () => "该球员未被租借。",
  "move.onLoan": () => "该球员正在租借中：请先在其档案的“租借”部分召回，或将租借转为永久转会。",
  "move.playerCoach": () => "球员兼教练无法转会：他们同时也是职员。",
  "move.sameClub": () => "该球员已在这家俱乐部。",
  "move.unusualContract": () => "该球员的合同不是普通的球员合同。",
  "sign.noDate": () => "编辑器无法读取游戏内日期，而新合同需要从该日期开始。",
  "sign.noModel": () => "该俱乐部一线队中没有持普通合同的球员，无法据此拟定新合同。",
  "sign.noPool": () => "在此游戏版本中，编辑器找不到游戏存放合同的位置，因此无法为自由球员签约。",
  "sign.poolFull": () =>
    "游戏自己创建新合同之前（随着日期推进会创建），没有空位再放一份合同：请在游戏中推进一天后重试。",

  // A player's records
  "ban.notBanned": () => "该球员没有可解除的禁赛。",
  "heal.notInjured": () => "该球员没有需要治疗的伤病。",
  "captain.notInTeam": () => "该球员不在这支球队中效力；队长只能由本队球员担任。",
  "captain.unchanged": () => "该球员已担任此职务。",
  "clause.missing": () => `合同中已没有此条款；${reload}。`,
  "clause.noContract": () => "该球员没有合同。",
  "clause.noRoom": () => "合同的条款列表已满，编辑器无法扩充；请改为修改其中一项条款。",
  "clause.notInClause": (p) => `此条款没有可修改的${p.field === "clause.amount" ? "金额" : "条件"}。`,
  "clause.same": () => "合同中已有此项。",
  "relation.missing": () => `球员的列表中已没有该国籍或培养经历；${reload}。`,
  "relation.noRoom": () => "球员的列表已满，编辑器无法扩充；请改为修改其中一项。",
  "relation.rule": (p) => `本土培养规则 ${p.rule} 不在编辑器可写入的规则之列。`,
  "relation.same": () => "该球员已有此项。",
  "relation.target": () => "这不是此项所接受类型的游戏内国家或俱乐部。",
  "retirement.none": () => "游戏没有安排这名球员退役，他本就打算继续踢球。",
  "retirement.unknown": () => "在此游戏版本中，编辑器找不到已计划的退役信息。",

  // Clubs, squads and staff
  "squad.noTeam": () => `该俱乐部没有这支球队，或其未通过检查；${reload}。`,
  "stadium.none": () => "无法读取该俱乐部一线队的主场。",
  "stadium.badName": () => "球场名称不能为空，不能以空格开头或结尾，也不能包含控制字符。",
  "stadium.nameLength": (p) =>
    `为放入游戏存放它的位置，此球场的新名称须占 ${p.min} 到 ${p.max} 字节；当前名称占 ${p.bytes} 字节。`,
  "stadium.shared": (p) => `游戏中有 ${p.holders} 处共用此名称，无法只为这座球场修改。`,
  "staff.job": (p) => `编辑器尚不能转移担任${jobName(p.job)}的职员，也不能分配该职位。`,
  "staff.noRoom": (p) =>
    `该俱乐部的${STAFF_DEPARTMENTS[p.department ?? ""] ?? p.department}名单已满（目前 ${p.staff} 人），且编辑器在此无法扩充。`,
  "staff.notListed": () => "俱乐部的职员名单中没有在应有的位置找到此人。",
  "staff.role": () =>
    "俱乐部或其某支球队直接指向这名职员（例如同时担任足球总监的主教练，或亲自执教球队的主席）；只能由游戏自行调动他。",
  "staff.unemployed": () => "这名职员没有俱乐部。",
  "staff.you": () => "这是你本人，即你所控制的主教练。",

  // Mass edits and exports
  "mass.noOperations": () => "请至少选择一个要修改的字段。",
  "mass.outOfDate": () => "此预览已过期。请重新生成批量编辑的预览。",
  "mass.tooMany": (p) => `共有 ${p.count} 个结果。批量编辑一次最多处理 ${p.limit} 个，请缩小搜索或筛选范围。`,
  "export.noFolder": () => "没有可导出到的文件夹。",
  "export.notExported": () => "这不是 FMLibreEditor 导出的文件。",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as; named as the game's English contract
 * screen names them (6, which only the German one was seen in, after what it does). The game shows no 54, 58 or 63.
 */
const CLAUSE_NAMES_ZH: Partial<Record<number, string>> = {
  0: "最低转会费解约金条款",
  1: "降级解约金条款",
  2: "未能升级解约金条款",
  3: "年度涨薪",
  4: "升级后涨薪",
  5: "降级后降薪",
  6: "职员职位解约金条款",
  8: "二次转会分成比例",
  9: "二次转会利润分成比例",
  10: "赛季进球数奖金",
  11: "合同最后一年联赛出场达到要求后延长一年",
  12: "队内最高薪资条款",
  13: "联赛出场达到要求后的周薪",
  14: "升入顶级联赛后涨薪",
  15: "从顶级联赛降级后降薪",
  16: "最低转会费解约金条款（国外俱乐部）",
  17: "最低转会费解约金条款（国内更高级别联赛俱乐部）",
  18: "最低转会费解约金条款（国内俱乐部）",
  19: "国家队出场达到要求后的周薪",
  20: "赞助商承担的工资比例",
  21: "球员获得的门票收入比例",
  22: "俱乐部可选择延长合同",
  23: "放弃聘请主教练的俱乐部补偿金",
  25: "升班后合同最后一年联赛出场达到要求可延长一年",
  26: "成功保级后合同最后一年联赛出场达到要求可延长一年",
  27: "最低转会费解约金条款（欧冠俱乐部）",
  28: "MLS 保障合同条款",
  29: "升级后延长合同",
  30: "受伤解约条款",
  31: "最低转会费解约金条款（参加洲际赛事的俱乐部）",
  32: "出场费",
  33: "进球奖金",
  34: "零封奖金",
  37: "国家队出场奖金",
  38: "未出场替补费",
  39: "助攻奖金",
  40: "赛季助攻数奖金",
  41: "赛季进球与助攻数奖金",
  54: "游戏中不显示（54）",
  55: "已生效的降级解约金条款",
  56: "已生效的未能升级解约金条款",
  58: "游戏中不显示（58）",
  63: "游戏中不显示（63）",
};

/** Reasons to be unhappy, by the codes the game keeps them as; named as FMRTE names them. */
const CONCERN_MOTIVES_ZH: Partial<Record<number, string>> = {
  596: "落选赛事名单",
  808: "认为队友受到不公平对待",
  926: "认为队友不配获得其想要的出场时间",
};

/** Players' traits (preferred moves), by their bit in the game's mask; named as FMRTE names them. */
const TRAIT_NAMES_ZH: readonly string[] = [
  "带球从左路推进",
  "带球从右路推进",
  "带球从中路推进",
  "进入对方禁区",
  "跑向空当",
  "积极前插",
  "短传",
  "经常尝试直塞",
  "远射",
  "大力射门",
  "推射",
  "弧线射门",
  "喜欢过掉门将",
  "喜欢反越位",
  "擅用外脚背",
  "紧盯对手",
  "挑衅对手",
  "与裁判争论",
  "背身拿球",
  "回撤接球",
  "撞墙配合",
  "喜欢挑射",
  "掌控比赛节奏",
  "尝试倒钩射门",
  "优先传球而非射门",
  "不传直塞球",
  "拖慢比赛节奏",
  "人球分过",
  "盘带前将球调整到右脚",
  "盘带前将球调整到左脚",
  "喜欢控球",
  "后插上进入对方禁区",
  "尝试摆脱逼抢",
  "始终留在后场",
  "避免使用逆足",
  "尝试花式动作",
  "尝试远距离任意球",
  "积极铲抢",
  "避免铲抢",
  "内切",
  "紧贴边线",
  "鼓舞球迷",
  "尝试不停球射门",
  "尝试长传",
  "喜欢脚下球",
  "大力主罚任意球",
  "喜欢反复过人",
  "喜欢转移到另一侧",
  "巅峰退役",
  "尽可能延长职业生涯",
  "擅长平直长距离手抛球",
  "经常带球",
  "很少带球",
  "尝试提升逆足能力",
  "站桩式支点",
  "利用长距离手抛球发动反击",
  "避免远射",
  "从左边锋位置内切",
  "从右边锋位置内切",
  "提前传中",
  "后场带球推进",
  "用脚处理球"
];

export const zhCN: Strings = {
  attributes: {
    // Technical
    corners: "角球",
    crossing: "传中",
    dribbling: "盘带",
    finishing: "射门",
    first_touch: "停球",
    free_kicks: "任意球",
    heading: "头球",
    long_shots: "远射",
    long_throws: "大力手抛球",
    marking: "盯人",
    passing: "传球",
    penalty_taking: "点球",
    tackling: "抢断",
    technique: "技术",
    // Mental
    aggression: "侵略性",
    anticipation: "预判",
    bravery: "勇敢",
    composure: "镇定",
    concentration: "集中",
    decisions: "决断",
    determination: "决心",
    flair: "才华",
    leadership: "领导力",
    off_the_ball: "无球跑动",
    positioning: "位置感",
    teamwork: "团队合作",
    vision: "视野",
    work_rate: "工作投入",
    // Physical
    acceleration: "爆发力",
    agility: "灵活",
    balance: "余额",
    jumping_reach: "弹跳",
    natural_fitness: "自然体能",
    pace: "速度",
    stamina: "耐力",
    strength: "强壮",
    // Goalkeeping (first touch and passing are shared with Technical)
    aerial_reach: "制空范围",
    command_of_area: "制空能力",
    communication: "指挥防线",
    eccentricity: "神经质",
    handling: "手控球",
    kicking: "开球",
    one_on_ones: "一对一",
    punching: "击球倾向",
    reflexes: "反应",
    rushing_out: "出击倾向",
    throwing: "手抛球",
    // Hidden
    consistency: "稳定性",
    dirtiness: "肮脏动作",
    important_matches: "重要比赛",
    injury_proneness: "受伤倾向",
    versatility: "多面性",
    // Feet
    left_foot: "左脚",
    right_foot: "右脚",
  },

  staffAttributes: {
    // Coaching
    attacking: "进攻",
    defending: "防守",
    fitness: "体能",
    goalkeeping: "守门",
    possession: "控球",
    set_pieces: "定位球",
    tactical: "战术",
    technical: "技术",
    working_with_youngsters: "青训",
    // Mental
    authority: "权威",
    determination: "决心",
    motivating: "激励",
    people_management: "人员管理",
    // Knowledge
    data_analysis: "数据分析",
    judging_ability: "球员能力评估",
    judging_potential: "球员潜力评估",
    judging_staff: "职员能力评估",
    negotiating: "谈判",
    tactical_knowledge: "战术知识",
    // Medical
    physiotherapy: "理疗",
    sports_science: "运动科学",
  },

  personality: {
    adaptability: "适应性",
    ambition: "野心",
    loyalty: "忠诚",
    pressure: "抗压能力",
    professionalism: "职业素养",
    sportsmanship: "体育精神",
    temperament: "脾气",
    controversy: "争议性",
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
    training: "训练设施",
    youth_facilities: "青训设施",
    youth_coaching: "青训教练",
    youth_recruitment: "青训招募",
    /** Only a club with finances has it. */
    corporate: "企业",
  },

  supporterTraits: {
    loyalty: "忠诚",
    passion: "热情",
    patience: "耐心",
    affluence: "富裕程度",
    temperament: "脾气",
    expectations: "期待",
  },

  /** The kinds of supporters, in the order of the supporter-mix bar. */
  supporterMix: {
    hardcore: "铁杆球迷",
    core: "核心球迷",
    family: "家庭球迷",
    fair_weather: "顺风球迷",
    corporate: "企业",
    casual: "普通球迷",
  },

  /** FM's job codes as stored in contracts. */
  jobs: {
    1: "球员",
    2: "教练",
    4: "主席",
    6: "董事",
    10: "足球总监",
    12: "理疗师",
    14: "球探",
    16: "主教练",
    20: "助理教练",
    22: "定位球教练",
    26: "体能教练",
    34: "守门教练",
    38: "首席队医",
    40: "运动科学主管",
    44: "首席球探",
    46: "队医",
    48: "运动科学家",
    50: "首席理疗师",
    58: "招募分析师",
    60: "表现分析师",
    62: "首席表现分析师",
    64: "青训主管",
    66: "所有者",
    70: "主席",
    86: "租借主管",
    88: "技术总监",
  },

  /** The names of the fields that are not attributes, personality or positions, by key. */
  fields: {
    current_ability: "当前能力",
    potential_ability: "潜力",
    height: "身高（厘米）",
    date_of_birth: "出生日期",
    asking_price: "要价",
    nation: "国籍",
    "reputation.home": "本国声望",
    "reputation.current": "当前声望",
    "reputation.world": "世界声望",
    "international.caps": "出场次数",
    "international.goals": "国家队进球",
    "international.u21_caps": "U21 出场次数",
    "international.u21_goals": "U21 进球",
    // What the game changes every day.
    condition: "体能",
    match_sharpness: "比赛状态",
    jadedness: "疲劳度",
    morale: "士气",
    cohesion: "凝聚力",
    "contract.wage": "周薪",
    "contract.loyalty_bonus": "每周忠诚奖金",
    "contract.happiness": "满意度",
    "contract.playing_time_happiness": "出场时间满意度",
    "contract.unhappiness": "不满原因",
    "contract.expires": "合同到期日",
    "contract.squad_number": "球衣号码",
    "contract.squad_status": "队内定位",
    "contract.transfer_listed": "已列入转会名单",
    "contract.loan_listed": "已列入外租名单",
    "loan.expires": "租借到期日",
    "loan.option_fee": "买断选项",
    // A member of staff's job, which the change log keeps as a change of its code.
    "contract.job": "职位",
    // A player's ties, which the change log keeps as changes of the nation or club (see `ties`).
    "tie.nationality": "第二国籍",
    "tie.trainedInNation": "在该国家受训",
    "tie.trainedAtClub": "在该俱乐部受训",
    "tie.workPermit": "在以下国家无需工作许可：",
    // A move to another club, which the change log keeps as a change of the player's club.
    club: "俱乐部",
    // Healing a player, which the change log keeps as a change of his injuries.
    injuries: "伤病",
    // Lifting a player's bans, which the change log keeps as a change of his bans.
    bans: "禁赛",
    // Keeping a player from retiring, which the change log keeps as a change of the date he was to retire on.
    retirement: "退役",
    // A change to a player's contract clauses, which the change log keeps as a change of the clause's amount.
    clause: "合同条款",
    "clause.amount": "条款金额",
    "clause.condition": "条款条件",
    // Making a player the captain or vice-captain of one of a club's teams, which the change log keeps as a change of
    // the club's captain or vice-captain.
    captain: "队长",
    vice_captain: "副队长",
    // A club's own reputation, which has no home, current or world.
    reputation: "声望",
    "facilities.training": "训练设施",
    "facilities.youth_facilities": "青训设施",
    "facilities.youth_coaching": "青训教练",
    "facilities.youth_recruitment": "青训招募",
    "facilities.corporate": "企业设施",
    "finance.balance": "余额",
    "finance.transfer_budget": "转会预算",
    "finance.wage_budget": "工资预算",
    "finance.total_wage_budget": "总工资预算",
    "stadium.capacity": "球场容量",
    "stadium.name": "球场名称",
    "stadium.seating": "座位容量",
    "stadium.used": "已使用容量",
    "stadium.expansion": "扩建容量",
  },

  profile: {
    close: "关闭档案",
    loading: "正在载入档案…",
    /** The handle on the left edge of the panel. */
    resize: "调整档案面板大小",
    resizeHint: "拖动可调整面板宽度，双击可恢复默认大小",
    /** Shown where a value is missing. */
    none: "—",

    // Header
    freeAgent: "自由球员",
    born: "出生日期",
    height: (cm: number) => `${cm} 厘米`,
    /** After the input of the height, while the player is edited. */
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "当前能力",
    currentAbilityShort: "CA",
    potentialAbility: "潜力",
    potentialAbilityShort: "PA",
    /** Hover text of a potential ability that is set as a range (the game stores it as a negative number). */
    potentialRange: "潜力以范围形式设定",

    // Attributes
    technical: "技术",
    goalkeeping: "守门",
    mental: "精神",
    physical: "身体",
    hidden: "隐藏",
    feet: "惯用脚",
    personality: "性格",
    /** Hover text of an attribute: the value as stored, 0–100 unless the game stores it on another scale. */
    raw: (raw: number, scale = 100) => `原始值 ${raw} / ${scale}`,
    lowerIsBetter: "数值越低越好",
    age: (age: number) => `${age} 岁`,

    // Positions
    positions: "位置",
    positionsSummary: (best: string) => `位置能力：${best}`,
    /** The group of every position's rating, under the pitch. */
    positionRatings: "位置能力",
    positionTiers: {
      natural: "天然",
      accomplished: "熟练",
      competent: "胜任",
      unconvincing: "不太胜任",
      ineffective: "无效",
    },
    positionTooltip: (position: string, rating: number, tier: string) => `${position} · ${rating} · ${tier}`,

    // Contract
    contract: "合同",
    wage: "周薪",
    /** Under the wage: the game keeps money in pounds; `converted` when the app shows another currency. */
    wageNote: (converted: boolean): string =>
      converted
        ? "游戏以英镑记录金额；此处按 FM 自带的汇率换算显示"
        : "游戏以英镑记录金额；可在设置中切换显示货币",
    signed: "签约日期",
    expires: "到期日期",
    joined: "加入日期",
    squadStatus: "队内定位",
    squadStatusName: (status: number) => SQUAD_STATUSES[status] ?? `定位 ${status}`,
    contractType: "合同类型",
    contractTypeName: (code: number) => CONTRACT_TYPES[code] ?? `类型 ${code}`,
    squadNumber: "球衣号码",
    transferListed: "已列入转会名单",
    loanListed: "已列入外租名单",

    // Career
    career: "生涯",
    internationalCaps: "国家队出场",
    internationalGoals: "国家队进球",
    u21Caps: "U21 出场次数",
    u21Goals: "U21 进球",
    askingPrice: "要价",
    notSet: "未设置",
    reputation: "声望",
    reputationHome: "本国",
    reputationCurrent: "当前",
    reputationWorld: "世界",
    /** The retirement the game has planned for a player, and the button that keeps him playing. */
    retirement: "退役",
    retires: "计划退役",
    noRetirement: "游戏尚未安排其退役",
    keepPlaying: "阻止退役",
    keepingPlaying: "正在阻止…",
    keepPlayingTitle:
      "从游戏的退役计划中移除此球员，并将其习惯改为“尽可能延长职业生涯”，替换“巅峰退役”；可在“改动记录”中撤销",

    // Medical (the group's heading is `medical`, below; the names of its values are in `fields`)
    /** A player's morale, 1–20. */
    morale: (value: number) => `${value} / 20`,
    /** Hover text of his morale: the game shows it as his overall happiness. */
    /** A player's traits (preferred moves): the heading, none, and each one's name by its bit. */
    traits: "习惯",
    noTraits: "没有球员习惯",
    traitName: (bit: number) => TRAIT_NAMES_ZH[bit] ?? `习惯 ${bit}`,
    /** A player's reasons to be unhappy, as FMRTE lists them, and the button that removes them all. */
    unhappiness: "不满",
    noUnhappiness: "没有不满原因",
    removeUnhappiness: "全部移除",
    removingUnhappiness: "正在移除…",
    removeUnhappinessTitle: "移除此球员的所有不满原因，效果与 FMRTE 的“全部移除”相同；可在“改动记录”中撤销",
    concernSince: (date: string) => `始于 ${date}`,
    concernKind: (kind: number) => (kind === 1 ? "不满" : kind === 2 ? "内部问题" : `类型 ${kind}`),
    concernMotive: (motive: number) => CONCERN_MOTIVES_ZH[motive] ?? `原因 ${motive}`,
    /** A contract's clauses and bonuses: the heading, and what each kind the game has is called. */
    clauses: "奖金与条款",
    noClauses: "没有奖金或条款",
    loyaltyBonus: "忠诚奖金",
    happiness: "满意度",
    playingTimeHappiness: "出场时间满意度",
    moodTitle: "按 FMRTE 的方式显示，范围为 -100 至 100；游戏中以文字描述",
    /** The name of a clause or bonus by its kind; a kind the app does not know yet by its number. */
    clauseName: (kind: number) => CLAUSE_NAMES_ZH[kind] ?? `条款 ${kind}`,
    /** A player's loan: where he is on loan, and the button that brings him back. */
    loan: "租借",
    loanAt: "租借至",
    loanParent: "所属俱乐部",
    loanFrom: "起始日期",
    loanUntil: "结束日期",
    loanNumber: "租借球衣号码",
    recall: "召回租借球员",
    recallTitle: "将球员召回原俱乐部：租借今日结束。执行前会再次确认",
    recallAgain: "再次召回",
    makePermanent: "转为永久转会",
    makePermanentTitle: "将球员永久转入当前租借俱乐部并与其签约。执行前会再次确认",
    /** Where the Recall button was, once the loan ends today: recalled by the editor, or ending today anyway. */
    recalledWaiting: "已召回 · 等待归队",
    endsTodayWaiting: "今日结束 · 等待归队",
    pendingTitle: (parent: string) =>
      `今天是租借的最后一天；在游戏中推进一天后，球员将返回 ${parent}。`,
    endPassed: (date: string) =>
      `租借原定于 ${date} 结束，但游戏尚未让球员归队。请再次召回，然后在游戏中推进一天。`,
    /** The loan's terms, as the game's Loan Club tab shows them. */
    loanCanRecall: "可召回",
    loanCanRecallTitle: "说明游戏是否允许所属俱乐部召回；无论此项设置如何，都可以在此召回",
    loanCanTerminate: "可提前结束",
    loanCupMatches: "可参加杯赛",
    loanAgainstClub: "可对阵所属俱乐部",
    loanOptionFee: "买断选项",
    loanOptionFeeTitle: "当前租借俱乐部可据此支付费用，将球员永久签入",
    loanMonthlyFee: "月租借费",
    loanMonthlyFeeTitle: "球员每出场一个月，租借俱乐部向原俱乐部支付的费用",
    loanUnusedFee: "未出场时的月租借费",
    loanUnusedFeeTitle: "球员未出场的月份，租借俱乐部向原俱乐部支付的费用",
    /** What a clause depends on, by kind: goals, assists, league games, matches, years or a percentage. */
    clauseCondition: (kind: number, value: number) => {
      switch (kind) {
        case 10:
          return `${value} 个进球`;
        case 40:
          return `${value} 次助攻`;
        case 41:
          return `${value} 个进球和助攻`;
        case 19:
          return `${value} 次国家队出场`;
        case 11:
        case 13:
        case 25:
        case 26:
          return `${value} 场联赛`;
        case 22:
        case 29:
          return `${value} 年`;
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
    clauseExpires: (date: string) => `${date} 到期`,
    clauseExpiresAfter: (days: number) => `签约 ${format(days)} 天后到期`,
    /** A sell-on clause on the profit: its percentage of what the selling club makes over the amount. */
    clauseProfitShare: (percent: string, amount: string) => `超过 ${amount} 的利润部分中，${percent}`,
    /** The wage a clause gives from then on. */
    clauseWage: (amount: string) => `每周 ${amount}`,
    moraleTitle: "游戏以球员的整体满意度显示士气：10 为满意，11 为略感开心，15 和 20 为非常开心",
    /** Hover text of jadedness, which the profile shows as stored. */
    jadednessTitle: "表示球员因比赛累积的疲劳，可通过休息恢复；-500 表示完全恢复，数值越高越需要休息",
    noInjuries: "没有伤病",
    /** The name of an injury the game gave none for. */
    unknownInjury: "未知伤病",
    /** Under the name of an injury: when it began, and when he is expected back (`dates`: one date, or a range). */
    injuryStarted: (date: string) => `${date} 受伤`,
    injuryBack: (dates: string) => `预计复出：${dates}`,
    /** Heals every injury of the player at once. */
    heal: "治疗",
    healTitle: "在游戏中治愈该球员的所有伤病",
    noBans: "没有禁赛",
    /** A ban: how many matches the player still has to miss, and under it when it began. */
    banMatches: (matches: number) => `${format(matches)} 场比赛`,
    banStarted: (date: string) => `起始日期：${date}`,
    /** Lifts every ban of the player at once. */
    liftBans: "解除",
    liftBansTitle: "在游戏中解除该球员的所有禁赛",

    // Above the attributes, while the profile is read
    /** Sets every attribute of the player to its best at once. */
    maxAttributes: "属性拉满",
    maxAttributesTitle: "将该球员的所有属性设为最高值 20；受伤倾向和肮脏动作设为最低值 1",
    /** What Max attributes wrote, beside the button that takes it back; then what that undid. */
    maxAttributesDone: (count: number) =>
      count === 0 ? "所有属性已是最高值" : `已写入 ${changeCount(count)}`,
    maxAttributesUndone: (count: number) => (count === 0 ? "没有可撤销的改动" : `已撤销 ${changeCount(count)}`),
    undoMax: "撤销",
    undoMaxTitle: "将该球员原有的属性值写回游戏",
    /** Freezing his attributes, while the game can be written to, and what that does. */
    freezeAttributes: "锁定属性",
    freezeAttributesNote:
      "应用保持打开并连接时，球员属性不会下降：游戏扣减的数值会写回，属性提升仍会保留。此设置会记在当前存档中，下次连接时自动重新锁定。",
    /** The same for a member of staff, who has no injury proneness or dirtiness. */
    maxStaffAttributesTitle: "将该职员的所有属性设为最高值 20",
    undoMaxStaffTitle: "将原有的属性值写回游戏",
    freezeStaffAttributesNote:
      "应用保持打开并连接时，职员属性不会下降：游戏扣减的数值会写回，属性提升仍会保留。此设置会记在当前存档中，下次连接时自动重新锁定。",
    /** Freezing his energy and match sharpness, under them in the Medical group, and what that does. */
    freezeFitness: "锁定体能与比赛状态",
    freezeFitnessNote:
      "应用保持打开并连接时，体能和比赛状态不会下降：游戏扣减的数值会写回，提升仍会保留；达到 100% 后会保持在 100%。此设置会记在当前存档中。",
    /** Freezing his position ratings: the box under the pitch, and the (i) after it, which says what that does. */
    freezePositions: "锁定",
    freezePositionsInfo: "锁定位置能力有什么作用？",
    freezePositionsNote:
      "应用保持打开并连接时，球员的位置能力会保持不变：不会学习新位置，能力值也不会升降。此设置会记在当前存档中。",

    // Staff
    /** Badge on the manager the user controls. */
    you: "你",
    youTitle: "你在此存档中执教的主教练",
    id: "ID",
    job: "职位",
    /** Giving a member of staff another job at their club, under the job in the contract. */
    changeJob: "更换职位",
    changeJobTitle: "在游戏中为这名职员改派该俱乐部的其他职位。",
    newJob: "新职位",
    applyJob: "应用",
    cancelJob: "取消",
    unemployed: "无业",
    coaching: "教练组",
    knowledge: "知识",
    medical: "医疗",
    /** A coaching job held by someone who still plays. */
    playerCoach: (job: string) => `${job}（兼任球员）`,
    unknownJob: (code: number) => `职位 ${code}`,
  },

  /** The player list: search, filter bar and columns. */
  playerList: {
    /** The entry in the sidebar. */
    nav: "球员",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} 名球员`,
    search: "按姓名或 UID 搜索球员",
    /**
     * The line beside the search box. `sorted` is the order a column header was clicked for, or null while the
     * list is in its default order (best current ability first); its `by` is a name from `sortNames`.
     */
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} 名球员`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · 按当前能力显示前 ${shown} 名`
        : `${count} · 按${sorted.by}${sorted.ascending ? "升序" : "降序"}显示前 ${shown} 名`;
    },
    /** The message under an empty table; `filtered` is whether any filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "没有符合筛选条件的球员。" : "未找到球员。";
      }
      return filtered ? `没有符合筛选条件的球员：“${query}”。` : `未找到球员：“${query}”。`;
    },
    columns: {
      name: "姓名",
      age: "年龄",
      positions: "位置",
      nation: "国家/地区",
      club: "俱乐部",
      contractExpires: "合同",
      born: "出生日期",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    } satisfies Record<PlayerSort | "positions" | "born" | "uid", string>,
    /** Hover text of a column header that sorts the list; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `按${by}排序`,
    /** The name of each sortable column, as the summary line and the hover text of a header say it. */
    sortNames: {
      currentAbility: "当前能力",
      potentialAbility: "潜力",
      age: "年龄",
      name: "姓名",
      nation: "国家/地区",
      club: "俱乐部",
      contractExpires: "合同到期日",
    } satisfies Record<PlayerSort, string>,
    /** The filters; the staff list has those that are not about players too (see FilterBar.tsx). */
    filters: {
      /** The button that shows or hides the filters. */
      toggle: "筛选",
      /** Its name for assistive technology while `count` of the filters are in effect. */
      toggleActive: (count: number) => `筛选，已启用 ${count} 项`,
      clear: "清除",
      /** The entry of the position select that is no filter. */
      any: "不限",
      position: "位置",
      /** Whom the list shows: the select's name, and its choices after `any`. */
      gender: "性别",
      men: "男子",
      women: "女子",
      age: "年龄",
      minAge: "最低年龄",
      maxAge: "最高年龄",
      /** The hint in an empty age input. */
      minPlaceholder: "最低",
      maxPlaceholder: "最高",
      minCurrentAbility: "最低 CA",
      minCurrentAbilityTitle: "最低当前能力",
      minPotentialAbility: "最低 PA",
      minPotentialAbilityTitle: "最低潜力",
      /** The hint in an empty ability input: what it accepts. */
      abilityPlaceholder: "1–200",
      nation: "国家/地区",
      club: "俱乐部",
      freeAgentsOnly: "仅自由球员",
      contractEndsBy: "合同到期不晚于",
      transferListedOnly: "仅显示已列入转会名单的球员",
      loanListedOnly: "仅显示已列入外租名单的球员",
      /** Bounds on attributes, a row each, under the other filters; the staff list has them too. */
      attributes: {
        heading: "属性",
        /** The select of a row, for assistive technology, and its entry before an attribute is picked. */
        attribute: "属性",
        pick: "选择属性",
        /** The two inputs of a row, for assistive technology; `name` is the attribute, "" before one is picked. */
        min: (name: string) => (name ? `${name} 最低值` : "最低"),
        max: (name: string) => (name ? `${name} 最高值` : "最高"),
        add: "添加属性",
        /** The button that takes a row away, for assistive technology and as its hover text. */
        remove: (name: string) => (name ? `移除 ${name}` : "移除此行"),
      },
      /** Saving the filters in effect, and the sort, under a name of the user's own; the names stay as typed. */
      saved: {
        /** The button that starts saving, and its hover text. */
        save: "保存",
        saveTitle: "为当前筛选条件和排序保存一个名称。",
        /** The name input, for assistive technology, and the hint in it while it is empty. */
        name: "已保存筛选条件的名称",
        namePlaceholder: "筛选名称",
        ok: "确定",
        cancel: "取消",
        /** The select of the saved filters: its name, and what it shows while none is the one in effect. */
        select: "已保存的筛选条件",
        delete: "删除",
        /** The name and hover text of Delete; `name` is the saved filter's. */
        deleteTitle: (name: string) => `删除已保存的筛选条件：${name}`,
        /** The question when the name is taken; `name` is the one typed. */
        replaceQuestion: (name: string) => `已存在名为“${name}”的筛选条件。要替换吗？`,
        replace: "替换",
        /** When the name is a new one and `max` filters are saved already. */
        full: (max: number) =>
          `最多可保存 ${max} 个筛选条件。请先删除一个，或使用已有名称进行替换。`,
      },
    },
  },

  /** The staff list. */
  staffList: {
    /** The entry in the sidebar. */
    nav: "职员",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} 名职员`,
    search: "按姓名或 ID 搜索职员",
    /**
     * The line beside the search box. `sorted` is the order a column header was clicked for, or null while the
     * list is in its default order (the human manager first, then the best current ability); its `by` is a name from
     * `sortNames`.
     */
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} 名职员`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · 按当前能力显示前 ${shown} 名`
        : `${count} · 按${sorted.by}${sorted.ascending ? "升序" : "降序"}显示前 ${shown} 名`;
    },
    /** The message under an empty table; `filtered` is whether any filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "没有符合筛选条件的职员。" : "未找到职员。";
      }
      return filtered ? `没有符合筛选条件的职员：“${query}”。` : `未找到职员：“${query}”。`;
    },
    columns: {
      name: "姓名",
      age: "年龄",
      job: "职位",
      club: "俱乐部",
      nation: "国家/地区",
      born: "出生日期",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    } satisfies Record<StaffSort | "job" | "born" | "id", string>,
    /** Hover text of a column header that sorts the list; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `按${by}排序`,
    /** The name of each sortable column, as the summary line and the hover text of a header say it. */
    sortNames: {
      currentAbility: "当前能力",
      potentialAbility: "潜力",
      age: "年龄",
      name: "姓名",
      nation: "国家/地区",
      club: "俱乐部",
    } satisfies Record<StaffSort, string>,
    /** The filters only the staff list has; the others are the player list's (`playerList.filters`). */
    filters: {
      job: "职位",
      /** The entry of the job select that is no filter. */
      anyJob: "不限",
      unemployedOnly: "仅显示无业职员",
    },
  },

  /** The club profile: what the player and staff panels do not have. */
  clubProfile: {
    // Header
    womensClub: "女子俱乐部",
    /** "Founded 1882", in the line under the name. */
    founded: (year: number) => `${year} 年成立`,
    reputationShort: "声望",
    reputationTitle: "声望",

    // The tabs under the header: what the club has, and its squad (see `squad`).
    /** The name of the tabs for assistive technology. */
    tabsLabel: "俱乐部栏目",
    tabs: { overview: "概览", squad: "阵容", stadium: "球场" },
    /** Hover text of the Squad tab while the club is edited: its values are on the Overview. */
    squadLocked: "完成编辑后才能打开阵容",

    facilities: "设施",

    // Supporters
    supporters: "球迷",
    supporterMix: "球迷构成",
    /** A share of the supporters; `value` is already a percentage (35 for 35%). */
    percent: (value: number) => `${percents.format(value)}%`,
    /** Hover text of a segment of the supporter-mix bar. */
    mixTooltip: (kind: string, percent: string) => `${kind} · ${percent}`,

    // Finances
    finances: "财务",
    balance: "余额",
    transferBudget: "转会预算",
    wageBudget: "工资预算（支出）",
    totalWageBudget: "总工资预算",
    ticketPrice: "平均票价",
    /** Under the labels of the two wage budgets, which are amounts per week. */
    perWeek: "每周",
    /** Clubs outside the leagues being played have no finance record in memory. */
    noFinances: "FM 只为正在进行的联赛中的俱乐部保存财务数据。",
    /** Freezing the club's money, while the game can be written to, and what that does. */
    freeze: "锁定资金",
    freezeNote:
      "应用保持打开并连接时，俱乐部余额不会减少：游戏扣除的金额会写回，收入仍会正常计入。" +
      "此设置会记录在当前存档中，下次连接时自动重新锁定。",

    // Stadium
    stadium: "球场",
    capacity: "容量",
    seating: "座位数",
    used: "已使用",
    /** The capacity in use when the game does not limit it (stored as 0). */
    usedAll: "全部",
    usedTitle: "游戏限制入场人数时实际开放的容量（例如关闭部分看台时）；0 表示不限制。",
    expansion: "扩建后容量",
    /** When the layout of this build does not know where the stadium is, or the club's stadium did not check out. */
    noStadium: "无法读取该俱乐部的球场信息。",
    /** Its name, which can be changed in place: in the block the game gave the old one. */
    stadiumName: "球场名称",
    rename: "重命名",
    renameTitle: "修改球场名称会立即写入游戏，也可在“改动记录”中撤销。",
    /** The (i) beside the name: how a new name lasts, and that the app has to stay open for it. */
    renameInfoLabel: "重命名如何运作？",
    renameInfo:
      "游戏不会在存档中保存球场名称；每次载入存档时都会从数据库读取名称。因此，" +
      "FMLibreEditor 会为当前存档记住新名称，并在游戏每次载入存档后的数秒内重新写回。" +
      "前提是应用保持打开并连接。如果应用关闭时游戏载入存档，游戏会暂时显示" +
      "游戏原有的名称，直到应用重新连接。若要恢复旧名称，可在“改动记录”中撤销重命名，或重新命名" +
      "球场。",
    saveName: "保存",
    renaming: "正在保存…",
    cancelRename: "取消",
    /** How long the name being typed is, in bytes of UTF-8, and how long it may be. */
    nameLength: (bytes: number, min: number, max: number) =>
      min <= 1
        ? `已输入 ${bytes} 字节，最多 ${max} 个字符（带重音符号的字母按 2 个字符计）`
        : `已输入 ${bytes} 字节；名称须为 ${min}–${max} 个字符，以符合游戏的存储限制（带重音符号的字母按 2 个字符计）`,
    /** Instead of Rename, when other things in the game hold the same name. */
    nameShared: (holders: number) =>
      `游戏中有 ${holders} 项内容使用了此名称，因此无法只单独修改球场名称。`,

    // Club info
    info: "俱乐部信息",
    seasonTickets: "季票",
    socialMedia: "社交媒体关注者",
  },

  /** The club list, with the sidebar entry and the status-line count that go with it. */
  clubList: {
    /** The entry in the sidebar. */
    nav: "俱乐部",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} 家俱乐部`,
    search: "按名称或 UID 搜索俱乐部",
    summary: (total: number, shown: number) =>
      total > shown
        ? `${format(total)} 家俱乐部 · 按声望显示前 ${shown} 家`
        : `${format(total)} 家俱乐部`,
    /** The message under an empty table; `filtered` is whether a filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "没有符合筛选条件的俱乐部。" : "未找到俱乐部。";
      }
      return filtered ? `没有符合筛选条件的俱乐部：“${query}”。` : `未找到俱乐部：“${query}”。`;
    },
    /** The small tag on a women's club. */
    women: "女子",
    columns: {
      name: "名称",
      reputation: "声望",
      founded: "成立年份",
      uid: "UID",
    },
    filters: {
      /** The name of the select, which has no label of its own. */
      kind: "显示俱乐部",
      all: "所有俱乐部",
      men: "男子俱乐部",
      women: "女子俱乐部",
    },
  },

  /** The app around the lists: the sidebar, the status line and the connect panel. */
  app: {
    /** The small line under the name in the sidebar. */
    stage: "测试版",
    /** The settings menu at the right of the masthead: its name, and the headings of its two lists. */
    settingsLabel: "设置",
    languageLabel: "语言",
    currencyLabel: "货币",

    // The note at the foot of the sidebar; which one shows depends on the connection (see `ConnectionInfo.editable`).
    /** Connected, and the game was opened for writing. */
    noteEditable: "只有点击“应用”后，改动才会写入游戏。请先备份存档。",
    /** Connected, but Windows did not allow writing. */
    noteReadOnly: "只读：Windows 不允许 FMLibreEditor 写入游戏。",
    /** Read-only because the game is a version FMLibreEditor was not checked with (see `compatibility`). */
    noteUnknownBuild: "只读：FMLibreEditor 尚未验证此游戏版本。",
    noteNotConnected: "编辑并应用之前，游戏不会发生任何变化。",

    // The status line and the busy texts beside it
    notConnected: "未连接",
    /** Beside the status line in a plain browser, where fixtures stand in for the game. */
    previewTag: "浏览器预览 · 示例数据",
    /** In place of the game's date when it could not be read, and the note it shows on hover. */
    noDate: "没有游戏内日期",
    noDateTitle: "FMLibreEditor 无法读取此游戏版本的游戏内日期，因此不显示年龄，年龄筛选也不会匹配结果。请检查更新。",
    /** The button that reads the game again, once connected. */
    reload: "重新读取数据",
    /** The button that looks for the game again, while not connected. */
    refresh: "刷新",
    detecting: "正在查找 Football Manager…",
    connecting: "正在读取球员、职员和俱乐部…",
    reloading: "正在重新读取球员、职员和俱乐部…",

    /**
     * The notice under the masthead once the game has loaded a save, or gone back to its main menu, since the data was
     * read (`SaveChangedNotice`), beside a Reload data button.
     */
    saveChanged: {
      title: "游戏存档已更改",
      text:
        "自 FMLibreEditor 读取游戏以来，游戏已载入存档或返回了主菜单。在你点击“重新读取数据”之前，它不会修改游戏中的" +
        "任何内容，也不会保持任何锁定：当前显示的内容可能属于另一个存档。",
    },

    /** The notice after connecting to a save in which something was frozen before (`FrozenNotice`). */
    refrozen: {
      title: "已重新锁定上次的项目",
      /** When nothing could be frozen again. */
      waitingTitle: "上次锁定的项目暂未处理",
      /** `names` are the players' names, set apart by commas. */
      players: (names: string) => `球员属性：${names}`,
      staff: (names: string) => `职员属性：${names}`,
      clubs: (names: string) => `资金：${names}`,
      fitness: (names: string) => `体能和比赛状态：${names}`,
      positions: (names: string) => `位置能力：${names}`,
      /** `names` are the stadiums' new names, given again. */
      stadiums: (names: string) => `球场名称：${names}`,
      /** After the first few names. */
      more: (count: number) => `以及另外 ${format(count)} 项`,
      /** What was left for later: an update of the game, say. */
      waiting: (count: number) =>
        `已记住 ${format(count)} 项，但暂未锁定：FMLibreEditor 尚未验证此游戏版本，无法写入。`,
      dismiss: "关闭",
    },

    /** The (i) beside every box that freezes something: how freezing works, and that the app has to stay open. */
    freezeInfo: {
      label: "锁定如何运作？",
      note:
        "锁定不会永久改变游戏数据：FMLibreEditor 每 2 秒写回一次被游戏扣减的数值。因此只有应用保持打开并连接时才有效；关闭应用后，游戏会继续修改这些数值。锁定项目会记录在当前存档中，下次连接时自动恢复。",
    },

    /** The panel shown while not connected. */
    connect: {
      title: "连接到 Football Manager 27",
      intro: "FMLibreEditor 会在游戏运行时读取内存。请启动游戏并载入存档，然后连接。",
      notRunning: "Football Manager 27 尚未运行。",
      /** `error` is the answer of the Rust side, which stays in English. */
      openFailed: (error: string) => `无法打开游戏：${error}`,
      game: "游戏",
      gameData: "游戏数据",
      loaded: "已载入",
      stillLoading: "仍在载入，请等待主菜单出现",
      process: "进程",
      pid: (pid: number) => `进程 ID ${pid}`,
      several: "检测到多个游戏进程，将连接第一个。",
      button: "连接并读取球员、职员和俱乐部",

      /** macOS: the bridge FM27 has to load before the app can reach it, and setting it up. */
      bridge: {
        title: "Bridge（macOS）",
        intro:
          "macOS 不允许应用直接访问其他应用的内存，因此 FM27 需要自行交出内存访问权限。加载 FMLibreEditor 的 bridge 后即可连接：这是一个不会钩取或修改游戏的轻量库，只向本应用提供游戏内存。Steam 启动选项会让 FM27 加载它。",
        library: "Bridge（游戏桥接）",
        installed: "已安装",
        missing: "未安装",
        launchOption: "启动选项",
        set: "已在 Steam 中设置",
        notSet: "未设置",
        ready: "设置完成。请从 Steam 启动 FM27（如果游戏正在运行，请退出后重新启动），载入存档，然后连接。",
        steamRunning: "Steam 正在运行，并会暂时接管启动选项。请退出 Steam 以自动设置启动选项，或自行在 Steam 中填写。",
        setUp: "设置 bridge",
        remove: "移除 bridge",
        manual: "或者在 Steam 中右键点击 Football Manager 27，依次选择“属性 › 通用 › 启动选项”，然后输入：",
        copy: "复制",
        copied: "已复制",
      },
    },
  },

  /** The graphics packs the pictures (club logos, faces, flags) come from: their status at the foot of the sidebar. */
  graphics: {
    /** While the app is still reading the packs, which takes a moment after it starts. */
    reading: "正在读取图像包…",
    /** What the packs hold: "Graphics: 68,131 club logos · 250 flags · 0 faces". */
    summary: ({ clubLogos, flags, faces }: Pick<GraphicsCounts, "clubLogos" | "flags" | "faces">) =>
      `图像：${format(clubLogos)} 个队徽 · ${format(flags)} 面旗帜 · ${format(faces)} 张头像`,
    /** When the app found no pack, and under it where packs go. The folder itself is the hover text of both lines. */
    none: "未找到图像包",
    noneHint: "队徽和头像包应放入 FM27 的 graphics 文件夹。",
  },

  /**
   * The notice under the masthead when the game is a version FMLibreEditor has no profile for, or some of the checks
   * it makes before writing did not pass (`CompatibilityNotice`).
   */
  compatibility: {
    /** The headline for a version without a profile; `game` as the status line names it. */
    unknownBuild: (game: string) => `FMLibreEditor 尚未验证 ${game}`,
    unknownBuildText:
      "游戏可能已更新。FMLibreEditor 已找到并检查游戏数据，但在你明确启用前，不会向未经验证的版本写入。新版本的 FMLibreEditor 通常会在数日内推出。",
    /** Once Edit anyway was pressed. */
    allowedText: "本次会话已启用编辑，具体范围取决于安全检查结果。请保留存档备份。",
    /** The headline when checks did not pass on a version the editor knows, and what may help. */
    failedTitle: "游戏中的部分数据未通过检查",
    reloadHint: "如果存档仍在载入，请点击“重新读取数据”再次检查。",
    /** The in-game date did not check out: shown apart, as it leaves nothing read-only. */
    noDate: "游戏内日期未通过检查，因此不显示年龄。",
    /** The other checks that did not pass, their names joined (see `checks`). */
    failed: (names: string) => `以下项目保持只读：${names}。`,
    failedCheck: (name: string, fit: number, sampled: number) =>
      `${name}（${format(sampled)} 项中 ${format(fit)} 项符合要求）`,
    /** Joins the names of the checks that did not pass. */
    join: (names: string[]) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join("、")}和${names[names.length - 1]}`,
    allow: "仍要编辑",
    allowTitle: "启用编辑，直到关闭 FMLibreEditor 或重新连接为止。请先备份存档。",
  },

  diagnostics: {
    copy: "复制诊断信息",
    copyTitle: "复制 FMLibreEditor 在游戏中发现的信息，以便粘贴到问题报告中。信息不包含姓名或路径。",
    copied: "已复制",
    failed: (reason: string) => `无法复制诊断信息：${reason}`,
  },

  /** What each check is about (`CheckKey`), as the notice lists the ones that did not pass and the errors name them. */
  checks: {
    gameDate: "游戏内日期",
    players: "球员信息",
    abilities: "当前能力和潜力",
    positions: "位置能力",
    attributes: "属性",
    personality: "性格",
    liveValues: "体能、比赛状态、疲劳度和士气",
    contracts: "合同",
    teams: "球队",
    staff: "职员",
    clubs: "俱乐部",
    cohesion: "与俱乐部的凝聚力",
  } satisfies Record<CheckKey, string>,

  /** New versions: the notice under the masthead, and the version and Check for updates at the foot of the window. */
  update: {
    /** The notice's headline, and what a check by hand found. */
    available: (version: string) => `FMLibreEditor ${version} 已发布`,
    youHave: (version: string) => `当前版本：${version}。`,
    /** Opens the release's page in the browser. */
    download: "下载",
    /** Downloads the new version's installer and runs it, where the app can update itself (see `can_self_update`). */
    install: "更新",
    installTitle: "下载并安装新版本；FMLibreEditor 将关闭，并在更新后重新启动。",
    preparing: "正在准备…",
    /** `percent` is null while the size of the download is not known. */
    downloading: (percent: number | null) => (percent === null ? "正在下载…" : `正在下载… ${percent}%`),
    installing: "正在安装：FMLibreEditor 将关闭，并在更新后重新启动。",
    installFailed: (reason: string) => `更新失败：${reason}。请前往发布页面下载。`,
    notInstallable: "无法在此安装此版本，请前往发布页面下载。",
    /** Hides the notice until the app starts again. */
    later: "稍后",
    check: "检查更新",
    checking: "正在检查更新…",
    upToDate: "当前已是最新版本。",
    failed: "无法检查更新。",
  },

  /** Editing a person or a club: the Edit button, the inputs, and the footer under the profile. */
  edit: {
    /** A nation field's value whose name the app has not read: one no one in the lists belongs to. */
    unknownNation: "未知国家或地区",
    /** The button in the header of a profile that can be edited. */
    edit: "编辑",
    editTitle: "修改此档案在游戏中的数值",
    /** Why editing did not start: the field table or the values could not be read. */
    startFailed: (reason: string) => `无法开始编辑：${reason}`,
    /** The name of a position's field, e.g. "ST rating"; `position` is its entry in `positions`. */
    positionRating: (position: string) => `${position} 能力`,
    /** Hover text of a changed input: the value it started from, as shown. */
    was: (value: string) => `原值：${value}`,
    /** Hover text of an input that cannot be applied; `min` and `max` are the values it takes, as shown. */
    invalid: (min: number, max: number) => `请输入 ${min} 至 ${max} 之间的整数`,
    /** The same for a date input; `from` and `to` are the earliest and the latest date it takes, as dates are shown. */
    invalidDate: (from: string, to: string) => `请输入 ${from} 至 ${to} 之间的日期`,
    /**
     * The same for an amount of money, in whole units of the chosen currency; `from` and `to` are the least and the
     * most it takes, as amounts are shown.
     */
    invalidMoney: (from: string, to: string) => `请输入 ${from} 至 ${to} 之间的整数金额`,
    /** The same for a percentage, in whole percent; `from` and `to` are the least and the most it takes, as shown. */
    invalidPercentage: (from: string, to: string) => `请输入 ${from} 至 ${to} 之间的整数百分比`,
    /** After the input of a percentage: the game shows energy and match sharpness as 0–100%. */
    percent: "%",
    /** The two values of a yes-or-no field, as the lists of changes and the hover text of its checkbox say them. */
    yes: "是",
    no: "否",
    /**
     * What an input that may be left empty reads as then, in its hint, the hover text and the lists of changes:
     * "Squad number 20 → none". The profile itself shows a dash for it (`profile.none`).
     */
    none: "无",

    // The footer
    footer: "编辑中",
    changes: changeCount,
    /** After the number of changes, while some inputs hold values that cannot be applied. */
    invalidCount: (count: number) => `${count} 项无效`,
    /** Opens the list of the changes Apply would write. */
    review: "检查改动",
    reviewList: "待应用的改动",
    /** Puts the inputs back to the values the game has. */
    discard: "放弃",
    apply: "应用",
    applying: "正在应用…",
    /** Hover text of Apply while an input holds a value that cannot be written. */
    applyBlocked: "请先修正无效值",
    /** Leaves edit mode. */
    done: "完成",
    /** Takes the place of the buttons when leaving (Done, close, another row) would lose `count` changes. */
    confirmDiscard: (count: number) => `放弃 ${changeCount(count)}？`,
    keepEditing: "继续编辑",

    // After Apply
    applied: (count: number) => `已应用 ${changeCount(count)}`,
    /** Every value asked for was the game's already. */
    nothingToChange: "无需修改：游戏中的值已符合设置。",
    /** A change the game refused; `label` is the field's name (see `fieldLabel`) and `reason` the game's answer. */
    refused: (label: string, reason: string) => `${label}：${reason}`,
    rereadFailed: (reason: string) => `无法读回数值：${reason}`,
    dismiss: "关闭",
  },

  /** The Changes view: what was written to the game this session. */
  changes: {
    /** The entry in the sidebar. */
    nav: "改动记录",
    title: "本次会话的改动",
    hint: "按时间从新到旧排列。只有游戏中的值仍与写入值一致时，才能撤销改动。",
    /** Under the hint: a change shows in the game only after it has moved on once. */
    continueHint: "在游戏中点击“继续”后，改动才会显示。",
    /** Under a move to another club that was a swap: the player who went the other way. */
    swappedWith: (name: string) => `与 ${name} 互换`,
    /** Under a move that released a player of the new club to make room: that player. */
    released: (name: string) => `${name} 已解约`,
    /** Under a transfer that had a fee: the amount, written out. */
    fee: (amount: string) => `转会费 ${amount}`,
    /** Under a recall from loan that took the loan's option to buy away, which its undo writes back. */
    optionRemoved: (amount: string) => `已移除买断选项（${amount}）`,
    /** What a heal changed, in the place of its values: `count` is how many injuries the player had. */
    healed: (count: number) => `已治愈 ${format(count)} 处伤病`,
    /** The same for lifting bans: `count` is how many bans the player had. */
    lifted: (count: number) => `已解除 ${format(count)} 项禁赛`,
    /** What keeping a player from retiring changed: the date he was to retire on, or none when only his traits changed. */
    keptPlaying: (date: string | null) => (date === null ? "将继续踢球" : `已阻止其于 ${date} 退役`),
    /** The line beside the title; `undone` of the `total` changes were undone. */
    count: (total: number, undone: number) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · 已撤销 ${undone} 项`;
    },
    empty: "暂无改动。打开球员、职员或俱乐部档案后选择“编辑”，也可以在列表中使用“批量编辑”。",
    columns: {
      time: "时间",
      /** The player, member of staff or club the change was made to. */
      name: "姓名",
      field: "字段",
      change: "改动",
      status: "状态",
    },
    /** The small tag after a name. */
    kinds: { player: "球员", staff: "职员", club: "俱乐部" } satisfies Record<Entity, string>,
    /** Hover text of a change of an attribute: the values as stored; `change` is from `valueChange`. */
    stored: (change: string) => `游戏中记录为：${change}`,
    undone: (time: string) => `已于 ${time} 撤销`,
    undo: "撤销",
    /** Hover text of Undo; `label` is the field's name. */
    undoTitle: (label: string) => `将 ${label} 的原值写回游戏`,
    /** The small tag after the fields a mass edit changed: a mass edit is one row of the list. */
    batch: "批量编辑",
    /** Under those fields: how many changes the mass edit made, and how many of them are not undone. */
    batchCount: (total: number, remaining: number) =>
      remaining === 0
        ? `${changeCount(total)} · 已全部撤销`
        : `${changeCount(total)} · 还有 ${format(remaining)} 项未撤销`,
    /** Opens the list of the changes of a mass edit under its row, and closes it again. */
    showChanges: "显示改动",
    hideChanges: "隐藏改动",
    /** Undoes the whole mass edit. */
    undoBatch: "撤销批量编辑",
    /** Hover text of Undo mass edit; `remaining` is how many of its changes are not undone yet. */
    undoBatchTitle: (remaining: number) =>
      `将本次批量编辑前的值写回游戏（仍有 ${format(remaining)} 项保持修改状态）`,

    // Pages: the list, and the changes of a mass edit that is open, are shown a page at a time.
    /** The names of the two groups of buttons for assistive technology. */
    pages: "列表分页",
    batchPages: "本次批量编辑的改动分页",
    previous: "上一页",
    next: "下一页",
    /** Between the buttons: the rows on show and how many there are, e.g. "101–200 of 450". */
    range: (first: number, last: number, total: number) => `${format(first)}–${format(last)} / ${format(total)}`,
  },

  /** Exporting players or clubs to a file: the button in the toolbar of the player and club lists and its dialog. */
  export: {
    button: "导出",
    buttonTitle: {
      player: "将当前列表中的球员导出为 CSV 或 JSON 文件，供表格或脚本使用。",
      staff: "将当前列表中的职员导出为 CSV 或 JSON 文件，供表格或脚本使用。",
      club: "将当前列表中的俱乐部导出为 CSV 或 JSON 文件，供表格或脚本使用。",
    } satisfies Record<ExportEntity, string>,
    title: { player: "导出球员", staff: "导出职员", club: "导出俱乐部" } satisfies Record<ExportEntity, string>,
    /** What the export covers: everything the list's search and filters select, in its order. */
    scope: (entity: ExportEntity, count: number) =>
      count === 0
        ? `没有符合搜索和筛选条件的${entityNouns[entity]}。`
        : `当前列表中的${entityCount[entity](count)}（按搜索和筛选结果）。`,
    formatLabel: "格式",
    formats: {
      csv: "CSV，逗号分隔",
      csvSemicolon: "CSV，分号分隔",
      json: "JSON",
    } satisfies Record<ExportFormat, string>,
    formatHints: {
      csv: "适用于大多数表格和脚本",
      csvSemicolon: "适用于小数点使用逗号的 Excel 区域设置，例如土耳其语、西班牙语或德语",
      json: {
        player: "供脚本使用：位置、属性和性格分别作为独立对象导出",
        staff: "供脚本使用：属性、性格和合同分别作为独立对象导出",
        club: "供脚本使用：球迷、设施、球场和财务分别作为独立对象导出",
      } satisfies Record<ExportEntity, string>,
    },
    contents: {
      player:
        "导出球员的能力、位置与位置能力、1–20 级属性（包括隐藏属性）、性格、声望、国家队出场和带有条款的合同，并附上游戏内日期。金额以英镑表示，与游戏中的记录一致。此操作不会修改游戏。",
      staff:
        "导出职员的职位和所属俱乐部、能力、1–20 级属性、性格、声望和合同（工资与日期），并附上游戏内日期。" +
        "金额以英镑表示，与游戏中的记录一致。此操作不会修改游戏。",
      club:
        "导出俱乐部的声望、成立年份、季票、社交媒体关注者、球迷构成与特征、设施、球场及财务信息（余额、转会预算、每周工资支出、工资预算和票价），并附上游戏内日期。FM 只为正在进行的联赛中的俱乐部保存财务数据。金额以英镑表示，与游戏中的记录一致。此操作不会修改游戏。",
    } satisfies Record<ExportEntity, string>,
    export: "导出",
    exporting: "正在导出…",
    /** After the export: what was written, and where. */
    done: (entity: ExportEntity, count: number, file: string) => `已将 ${entityCount[entity](count)} 导出到 ${file}`,
    folder: (folder: string) => `位于 ${folder}`,
    skipped: (entity: ExportEntity, count: number) => {
      const pronoun = `${entityNouns[entity]}在导出时`;
      return (
        `${pronoun}，游戏中的 ${entityCount[entity](count)} 发生了变化，因此未导出。`
      );
    },
    open: "打开",
    openTitle: "使用系统默认应用打开文件",
    show: "在文件夹中显示",
    showTitle: "在所在文件夹中显示该文件",
    close: "关闭",
  },

  /** Mass editing: the button in the toolbar of a list and the dialog it opens. */
  massEdit: {
    /** The button in the toolbar of the player, staff and club lists. */
    button: "批量编辑",
    buttonTitle: "先预览，再批量修改当前列表中的项目",
    title: {
      player: "批量编辑球员",
      staff: "批量编辑职员",
      club: "批量编辑俱乐部",
    } satisfies Record<Entity, string>,

    // What it applies to
    /** `total` is the list's: the search and the filters of the list select them. */
    scope: (entity: Entity, total: number) =>
      `当前列表中的${entityCount[entity](total)}（按搜索和筛选结果）`,
    /** After the scope, when the list shows only the first `shown` rows of its `total`. */
    scopeAll: (shown: number) => `这是全部匹配结果，不只是屏幕上显示的前 ${format(shown)} 行。`,
    scopeNone: (entity: Entity) =>
      `没有符合搜索和筛选条件的${entityNouns[entity]}，无需修改。`,
    /** `limit` is the most one mass edit takes. */
    scopeTooMany: (entity: Entity, total: number, limit: number) =>
      `当前列表中的${entityCount[entity](total)}超过单次批量编辑上限（${format(limit)}）。请先缩小搜索或筛选范围。`,
    loadingFields: "正在读取字段…",
    fieldsFailed: (reason: string) => `无法读取字段：${reason}`,

    // The fields to change
    /** The groups of the field select, in the order the dialog lists them. */
    groups: {
      ability: "能力",
      technical: "技术属性",
      mental: "精神属性",
      physical: "身体属性",
      goalkeeping: "守门属性",
      hidden: "隐藏属性",
      feet: "惯用脚",
      coaching: "执教属性",
      knowledge: "知识属性",
      medical: "医疗属性",
      positions: "位置",
      personality: "性格",
      reputation: "声望",
      international: "国家队",
      contract: "合同",
      facilities: "设施",
      finances: "财务",
      stadium: "球场",
      traits: "习惯",
      /** A player's energy, match sharpness and morale: the Medical group of his profile. */
      health: "医疗",
      /** Whatever the other groups do not have, e.g. a player's height. */
      other: "其他",
    },
    fieldsLabel: "要修改的字段",
    /** The name of a row of the dialog for assistive technology; `position` counts from 1. */
    row: (position: number) => `第 ${position} 项改动`,
    field: "字段",
    operation: "操作",
    operations: { set: "设为", add: "增加", scale: "按百分比缩放" } satisfies Record<MassOperationKind["op"], string>,
    /** The name of the value input, by operation. */
    values: { set: "数值", add: "数量", scale: "百分比" } satisfies Record<MassOperationKind["op"], string>,
    /** Hover text of the amount of an Add. */
    addTitle: "按显示值加到每个数值上；输入负数则会减去相应数值。",
    /** The same for a percentage: the amount is in percentage points, not a percent of the value (that is Scale). */
    addPointsTitle: "为每个百分比值增加百分点（例如 70% 加 10 得到 80%）；输入负数则会减少。",
    /** The hint in an empty value input: what it takes. */
    rangeHint: (min: number, max: number) => `${format(min)}–${format(max)}`,
    /** The same for an amount, which may be negative: up to `max` either way. */
    amountHint: (max: number) => `±${format(max)}`,
    /** After the input of a Scale: the number is a percent of the value the game has now. */
    ofCurrent: "当前值的百分比",
    percentTitle: "按当前值的百分比缩放：100% 保持不变，110% 增加十分之一，50% 减半。",
    /** Hover text of an amount that cannot be applied; `min` and `max` are what it takes. */
    invalidAdd: (min: number, max: number) => `请输入 ${format(min)} 至 ${format(max)} 之间的整数`,
    invalidPercent: (min: number, max: number) => `请输入 ${min} 至 ${max} 之间的整数百分比`,
    /** A date cannot be added to or scaled. */
    dateSetOnly: "日期只能直接设定",
    addField: "添加字段",
    /** Hover text of Add a field when the rows are full; `max` is how many fields one mass edit changes. */
    addFieldFull: (max: number) => `每次批量编辑最多可修改 ${max} 个字段`,
    remove: "移除此字段",
    /** Hover text of Remove on the only row. */
    removeLast: "批量编辑至少需要一个字段",

    // The preview
    preview: "预览",
    previewing: "正在生成预览…",
    /** Beside Preview while it cannot be pressed. */
    previewBlocked: "请为每个字段填写有效值后再预览",
    /** "312 changes for 140 of 237 players · 97 already have these values · 12 values left alone". */
    summary: (entity: Entity, preview: MassPreview) =>
      [
        preview.changes === 0
          ? "暂无改动"
          : `${changeCount(preview.changes)} · ${format(preview.targets - preview.unchanged)} / ` +
            entityCount[entity](preview.targets),
        preview.unchanged > 0 &&
          (preview.unchanged === 1
            ? "1 项无需修改"
            : `${format(preview.unchanged)} 项无需修改`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "批量编辑将进行的改动",
    columns: { name: "姓名", field: "字段", change: "改动", reason: "原因" },
    /** Under a table or a list that shows only the first rows; `count` is how many more there are. */
    more: (count: number) => `以及另外 ${format(count)} 项`,
    /** The line that opens the list of the values left alone. */
    skippedHeading: valuesLeftAlone,
    skippedLabel: "批量编辑会保留不变的值",

    // Apply and undo
    apply: "应用",
    applying: "正在应用…",
    /** Hover text of Apply; `changes` is how many values it writes. */
    applyTitle: (changes: number) => `将 ${changeCount(changes)} 写入游戏`,
    applyFirst: "请先预览批量编辑",
    applyNothing: "预览中没有需要写入的改动",
    /** Nothing changes in the game until Apply. */
    hint: "点击“应用”后才会修改游戏。",
    applied: (count: number) => (count === 0 ? "没有写入任何改动" : `已应用 ${changeCount(count)}`),
    /** A change the game refused: who, which field (see `fieldLabel`) and the game's answer. */
    failure: (name: string, label: string, reason: string) => `${name} · ${label}：${reason}`,
    undo: "撤销本次批量编辑",
    undoing: "正在撤销…",
    undoTitle: "将本次批量编辑前的值写回游戏。",
    undone: (count: number) => (count === 0 ? "没有撤销任何改动" : `已撤销 ${changeCount(count)}`),
    /** A change an undo could not take back: `who` names the person and the field, or the change by its number. */
    undoFailure: (who: string, reason: string) => `${who}：${reason}`,
    changeNumber: (id: number) => `改动 ${id}`,
    close: "关闭",
  },

  /** Comparing players: the button in a player's profile, the tray under the player list and the dialog. */
  comparison: {
    /** The button in the header of a player's profile. */
    compare: "对比",
    /** Hover text of that button while the player is not in the comparison, and while they are. */
    add: "加入对比",
    remove: "从对比中移除",
    /** Hover text of the button while the comparison is full and cannot take this player; `max` is its size. */
    full: (max: number) => `对比最多可添加 ${max} 名球员。请先移除一名球员，再添加此球员。`,

    // The tray under the player list
    trayLabel: "待对比球员",
    /** The name and hover text of the × on a player's chip. */
    removePlayer: (name: string) => `从对比中移除：${name}`,
    clear: "清除",
    /** The button that opens the dialog; `count` is how many players are picked. */
    open: (count: number) => `对比（${count}）`,

    // The dialog
    title: "球员对比",
    /** Under the title: what the highlight in the table means. */
    hint: "每行会突出显示最佳值：通常为最高值；对于越低越好的属性，则显示最低值。",
    /** What the dialog says when fewer than two players are picked. */
    tooFew: "至少添加两名球员才能进行对比。",
    loading: "正在读取球员…",
    tableLabel: "球员对比数据",
    /** Said after the highlighted value of a row, for assistive technology. */
    highest: "最高",
    lowest: "最低",
    /** The heading of the rows with the positions, height, reputation and contract. */
    profile: "档案",
    close: "关闭",
  },

  /**
   * Moving a player to another club, or swapping him with a player of another club: the button in his profile and the
   * dialog it opens.
   */
  move: {
    /** The button in the header of a player's profile. */
    button: "转会",
    buttonTitle: "将这名球员转会到其他俱乐部，可设置转会费。",

    // The dialog
    title: "转会",
    /** The club the player is at, and the club he moves to (or, in a swap, goes to). */
    from: "起始日期",
    to: "转入",

    // The switch at the top of the dialog: a move to a club, or a swap with one of its players.
    /** Its name for assistive technology. */
    modeLabel: "转会或交换",
    modeMove: "转会至俱乐部",
    modeSwap: "与球员互换",

    // Choosing the club
    /** The name of the search box, and of the list of clubs under it, for assistive technology. */
    searchLabel: "搜索要转入的俱乐部",
    resultsLabel: "找到的俱乐部",
    searching: "正在搜索俱乐部…",
    searchFailed: (reason: string) => `无法搜索俱乐部：${reason}`,
    /** Under the list when the search found more clubs than it lists; `count` is how many more. */
    more: (count: number) => `还有 ${format(count)} 家；输入文字可缩小搜索范围`,
    /** Takes the place of the search once a club is picked: the button that brings it back. */
    change: "更换俱乐部",

    // The fee
    feeHeading: "费用",
    fee: "转会费",
    /** Under the fee input while it can be sent, and while it cannot. */
    feeHint: "留空表示免签",
    /** `max` is the most a fee can be, as amounts are shown. */
    feeInvalid: (max: string) => `请输入 0 至 ${max} 之间的整数金额`,
    /**
     * What the fee does to the clubs' money, a line each in the plan. `fee` is the amount, `balance` and `budget` a
     * change written out ("£9,492,232 → £10,726,799"); `budget` is null when the club has no transfer budget set.
     */
    pays: (club: string, fee: string, balance: string, budget: string | null) =>
      `${club} 支付 ${fee}：余额 ${balance}${budget === null ? "" : `，转会预算 ${budget}`}`,
    receives: (club: string, fee: string, balance: string) => `${club} 收取 ${fee}：余额 ${balance}`,
    /** For a club outside the leagues being played, which the game keeps no finances for. */
    noFinances: (club: string) => `游戏中没有 ${club} 的财务数据：其资金保持不变`,

    // The contract
    /** Under an input that cannot be sent. */
    wageInvalid: "请输入大于或等于 0 的整数金额",
    expiresInvalid: "请输入日期",

    // What the dialog says about the move itself
    chooseClub: "请选择球员转入的俱乐部。",
    fixTerms: "请先修正转会费或合同数值。",
    checking: "正在检查转会…",
    /** The move can be made; `from` and `to` are the names of the clubs. */
    route: (from: string, to: string) => `${from} → ${to}`,
    doesHeading: "转会内容",
    /** What the game does to the player, one line each. */
    does: [
      "加入新俱乐部的一线队",
      "合同日期设为游戏内日期；清除球衣号码",
      "从转会和外租名单中移除",
      "只有填写新值时才会修改周薪和合同到期日",
      "转会费从买方俱乐部的余额和转会预算中扣除，并计入卖方俱乐部的余额",
      "球员在原俱乐部担任的队长职务将空缺",
      "游戏的转会记录暂不显示此笔转会",
      "改动会列在“改动记录”中，可一次撤销转会及转会费",
    ],

    // A club whose squad list is full: the box that takes the place of the refusal and offers to make room, by
    // releasing one of its players in the same transfer, or by making it a swap with that player.
    /** The first line; `club` is the club picked. */
    noRoom: (club: string) => `${club} 的阵容没有空位。`,
    /** The name of the (i) button after the first line, for assistive technology, and the note it shows. */
    noRoomInfoLabel: "为什么？",
    noRoomInfo:
      "编辑器可以扩充部分满员阵容，但无法扩充这支球队的阵容名单；必须先有球员离队才能腾出位置。",
    /** The second line, which also names the choices under it; `player` is the player transferred. */
    noRoomNeed: (player: string, club: string) => `${player} 加盟前，必须先有一名球员离开 ${club}。`,
    /** The first choice: a player of the club picked from a list, who becomes a free agent. */
    releaseChoice: "放走球员：",
    releasePickLabel: "要放走的球员",
    releaseOutcome: "→ 将成为自由球员",
    /** After a player's name in that list: what makes him a worse choice. */
    injuredTag: "受伤",
    captainTag: "队长",
    /** The second choice, which turns the dialog into a swap with the player picked; `club` is the player's club. */
    swapChoice: "改为球员互换：",
    swapChoiceOutcome: (club: string) => `该球员将转入 ${club}`,
    /** The button of the foot while a player is released; `name` is that player. */
    moveAndRelease: (name: string) => `转会并解约 ${name}`,
    /** What a transfer that makes room does, one line each, in the place of `does`. */
    makeRoomDoes: [
      "加入新俱乐部的一线队，替代被解约的球员",
      "被解约的球员将离开该俱乐部的所有球队并终止合同，成为自由球员",
      "合同日期设为游戏内日期；清除球衣号码",
      "从转会和外租名单中移除",
      "只有填写新值时才会修改周薪和合同到期日",
      "转会费从买方俱乐部的余额和转会预算中扣除，并计入卖方俱乐部的余额",
      "两名球员在离队俱乐部担任的队长职务都会空缺",
      "游戏的转会记录暂不显示此笔转会",
      "改动会作为一项记录列出，可一次撤销转会、解约及转会费",
    ],

    // Swapping with a player of the club instead: the title, and the section that picks the player (the club is
    // chosen as for a move).
    swapTitle: "与球员互换",
    /** The player who goes the other way. */
    swapWith: "与其互换",
    /** The name of the search box of the club's players, its hint, and the name of the list under it. */
    playerSearchLabel: "搜索要交换的球员",
    playerSearch: "按姓名搜索该俱乐部的球员",
    playersLabel: "找到的球员",
    playersSearching: "正在搜索球员…",
    playersSearchFailed: (reason: string) => `无法搜索球员：${reason}`,
    /** Under the list when it is empty: `query` is what was typed. */
    playersEmpty: (query: string) =>
      query === "" ? "该俱乐部没有球员。" : `该俱乐部没有符合“${query}”的球员。`,
    /** Takes the place of the list once a player is picked: the button that brings it back. */
    changePlayer: "更换球员",

    // What the dialog says about the swap
    /** A swap has no contract terms to set. */
    swapContract: "双方保留各自的合同；周薪和合同到期日不变。",
    // Moving a member of staff, who has neither a fee nor terms to set, and no swap.
    staffButtonTitle: "将这名职员转到游戏中的其他俱乐部。",
    staffChooseClub: "请选择这名职员要转入的俱乐部。",
    staffContract: "保留职位、周薪和合同到期日；合同起始日期设为游戏内日期。",
    /** The select of the job they take at the club, and its first choice for one who has no job yet. */
    staffJob: "职位",
    staffJobChoose: "选择职位…",
    /** After the name of their own job in that select. */
    staffJobKept: (job: string) => `${job}（保持不变）`,
    /** In the place of `staffContract` when another job is chosen. */
    staffNewJob: "改任新职位，保留周薪和合同到期日；合同起始日期设为游戏内日期。",
    staffDoes: [
      "加入新俱乐部对应的医疗、教练或球探部门；如担任足球总监或主教练，该俱乐部必须尚无此职位人选",
      "周薪和合同到期日不变；合同起始日期设为游戏内日期",
      "离任的主教练会留下空缺职位，由俱乐部安排继任者；董事会由游戏处理",
      "改动会列在“改动记录”中，可撤销",
    ],
    // Signing a member of staff who has no club: the same dialog with a job to choose and a contract the editor makes.
    staffSignButtonTitle: "为游戏中的俱乐部签下这名自由职员。",
    staffSignTitle: "签下职员",
    staffSignChooseClub: "请选择要签约的俱乐部。",
    staffSignChooseJob: "请选择该职员在俱乐部担任的职位。",
    /** Under the contract's inputs. */
    staffSignTerms: "留空则按该俱乐部职位最接近的职员设置周薪，合同到期日设为下赛季结束。",
    /** The signing can be made: `to` is the club. */
    staffSignRoute: (to: string) => `无所属俱乐部 → ${to}`,
    /** The contract the editor makes: `wage` and `expires` written out. */
    staffSignContract: (wage: string, expires: string) => `新合同：周薪 ${wage}，到期日 ${expires}`,
    staffSignDoes: [
      "加入对应部门；部门满员时会扩充名额。若该俱乐部尚无足球总监或主教练，则可担任该职位",
      "从游戏内日期开始签订新合同，并使用游戏提供的空闲合同记录",
      "参考该俱乐部能力最接近、职位相同的职员合同；若没有，则依次参考同部门或其他职员",
      "采用你的周薪和合同到期日，或参考合同的周薪并设为下赛季结束；不含条款或奖金",
      "所有改动会列在“改动记录”中，可一次撤销",
    ],
    swapChooseClub: "请选择交换对象所在的俱乐部。",
    swapChoosePlayer: "请选择要交换的球员。",
    swapChecking: "正在检查交换…",
    /** The swap can be made: who goes where, a line each. `from` is the club of the player, `to` that of the other. */
    swapRoute: (player: string, from: string, to: string, other: string) =>
      `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "交换内容",
    swapDoes: [
      "双方分别加入对方俱乐部的一线队",
      "合同日期设为游戏内日期；清除球衣号码",
      "双方均从转会和外租名单中移除",
      "两人在原俱乐部担任的队长职务都会空缺",
      "不支付转会费，也不会更新职业履历",
      "改动会作为一项记录列出，可一次撤销双方转会",
    ],

    // Signing a free agent, who has no club: the same dialog with no fee and no swap, and a contract the editor makes.
    signButtonTitle: "为游戏中的俱乐部签下这名自由球员。",
    signTitle: "签下自由球员",
    signChooseClub: "请选择要签约的俱乐部。",
    signChecking: "正在检查签约…",
    /** Under the contract's inputs. */
    signTerms: "留空则按该俱乐部能力最接近的球员设置周薪，合同到期日设为下赛季结束。",
    /** The signing can be made: `to` is the club. */
    signRoute: (to: string) => `自由球员 → ${to}`,
    /** The contract the editor makes: `wage` and `expires` written out, `status` the squad status's name. */
    signContract: (wage: string, expires: string, status: string) =>
      `新合同：周薪 ${wage}，到期日 ${expires}，${status}`,
    signDoesHeading: "签约内容",
    signDoes: [
      "加入俱乐部一线队；阵容名单满员时会扩充名额",
      "从游戏内日期开始签订新合同，并使用游戏提供的空闲合同记录",
      "参考俱乐部能力最接近球员的合同类型和队内定位",
      "采用你的周薪和合同到期日，或参考球员的周薪并设为下赛季结束",
      "不设置球衣号码、忠诚奖金、条款或其他奖金",
      "游戏的转会记录暂不显示此笔签约",
      "所有改动会列在“改动记录”中，可一次撤销",
    ],
    signHint: "点击“签约”后才会修改游戏。",
    sign: "签约",
    signing: "正在签约…",

    // The foot
    /** Nothing changes in the game until Transfer, or Swap. */
    hint: "点击“转会”后才会修改游戏。",
    move: "转会",
    moving: "正在转会…",
    cancel: "取消",
    swapHint: "点击“交换”后才会修改游戏。",
    swap: "交换",
    swapping: "正在交换…",
  },

  /**
   * A player's ties to nations and clubs: their secondary nationalities, and the nations and clubs they were trained
   * in, which decide whether they count as homegrown under a competition's rules. The group in the profile and its
   * dialog.
   */
  ties: {
    heading: "国籍与本土培养",
    nationalities: "第二国籍",
    trainedInNation: "在该国家受训",
    trainedAtClub: "在该俱乐部受训",
    /** A nation he needs no work permit in, as the game lets players of the EU who were in the UK before Brexit. */
    workPermit: "在以下国家无需工作许可：",
    none: "无",
    /** The game's names of its homegrown rules, by code; `rule` names one it has no name for here. */
    rules: {
      1: "本土培养（15–21 岁）",
      2: "本土培养（0–21 岁）",
      5: "本土培养（15–21 岁，不含租借）",
      10: "本土培养（0–19 岁，1 年）",
    } as Readonly<Record<number, string>>,
    rule: (code: number) => `本土培养规则 ${format(code)}`,

    // The button under the group, and the dialog it opens
    change: "改动",
    changeTitle: "修改该球员在游戏中的第二国籍和本土培养身份",
    title: "国籍与本土培养",
    hint: "每项改动都会立即写入游戏，并列在“改动记录”中，可在那里撤销。",
    /** When the player's list has no room for another tie. */
    full:
      "游戏只为该球员当前已有的国籍或受训经历分配了记录空间，因此可以修改或移除现有项目，但不能新增。",
    /** The control of a row, for assistive technology: `name` is the nation's or club's. */
    nationOf: (name: string) => `替换为国家/地区：${name}`,
    ruleOf: (name: string) => `${name} 的本土培养规则`,
    remove: "移除",
    removeTitle: (name: string) => `移除 ${name}`,
    /** The rows that add a tie, where the list has room. */
    addNationality: "添加国籍…",
    addNation: "添加国家…",
    addPermit: "添加无需工作许可的国家…",
    /** After a nation he needs no work permit in. */
    daysLeft: (days: number) => `剩余 ${format(days)} 天`,
    permitInfoLabel: "此功能如何运作？",
    permitInfo:
      "游戏允许脱欧前已在英格兰或苏格兰的欧盟球员在一定期限内免工作许可参赛。为球员添加此项后，其在对应国家/地区也可免工作许可参赛，期限与原规则剩余天数相同；若存档中没有此类规则，则设为十年。",
    newRule: "新国家的本土培养规则",
    add: "增加",
    /** A club he was trained at: the button that points it at another club, and the search it opens. */
    changeClub: "更改俱乐部",
    changeClubTitle: (name: string) => `将受训俱乐部改为其他俱乐部，替换 ${name}`,
    clubInsteadOf: (name: string) => `替换俱乐部：${name}`,
    /** The button that adds a club he was trained at, and what it opens. */
    addClub: "添加俱乐部…",
    addClubTitle: "将该球员设为在另一家俱乐部受训",
    newClub: "新俱乐部",
    pickAnother: "重新选择",
    newClubRule: "新俱乐部的本土培养规则",
    cancel: "取消",
    working: "正在写入游戏…",
    close: "关闭",
  },

  /** Changing a contract's bonuses and clauses: the button under them in the profile, and the dialog it opens. */
  clauses: {
    change: "改动",
    changeTitle: "修改该球员在游戏中的奖金与合同条款",
    title: "奖金与条款",
    hint: "每项改动都会立即写入游戏，并列在“改动记录”中，可在那里撤销。",
    /** When the contract has no release clause and its list has no room for one. */
    full:
      "游戏只为合同当前已有的奖金或条款分配了记录空间，因此可以修改或移除现有项目，但不能新增解约金条款。",
    /** The inputs of a row, for assistive technology: `name` is the clause's. */
    amountOf: (name: string) => `${name} 金额`,
    conditionOf: (name: string) => `${name} 条件`,
    save: "保存",
    remove: "移除",
    removeTitle: (name: string) => `移除 ${name}`,
    /** The row that adds a release clause, where the list has room and the contract has none. */
    addRelease: "添加解约金条款",
    releaseAmount: "新解约金金额",
    add: "增加",
    /** When an amount or condition typed is not a whole number in range: `max` is the most it may be. */
    /** `max` is written out already: an amount as amounts are shown, or a number. */
    outOfRange: (max: string) => `请输入 0 至 ${max} 之间的整数。`,
    working: "正在写入游戏…",
    close: "关闭",
  },

  /** Releasing a player from their club, which leaves them a free agent: the button beside Transfer and its dialog. */
  release: {
    /** The button in the header of a player's profile, beside Transfer. */
    button: "解约",
    buttonTitle: "将这名球员从俱乐部解约，使其成为自由球员。",

    // The dialog
    title: "解约",
    /** The club the player leaves. */
    from: "离队",
    checking: "正在检查解约…",
    /** The player can be released; `club` is the name of their club. */
    ready: (club: string) => `${club} → 自由球员`,
    doesHeading: "解约内容",
    /** What the game does to the player, one line each. */
    does: [
      "离开俱乐部的所有球队并终止合同，成为任何俱乐部都可签下的自由球员",
      "不支付任何费用",
      "球员在该俱乐部担任的队长职务将空缺",
      "游戏的转会记录不会显示此次解约",
      "改动会列在“改动记录”中，撤销后球员将恢复原合同",
    ],

    // The foot
    /** Nothing changes in the game until Release. */
    hint: "点击“解约”后才会修改游戏。",
    release: "解约",
    releasing: "正在解约…",
    cancel: "取消",
  },

  /** Making a player's loan permanent: the dialog the Make permanent button of the Loan part of his profile opens. */
  permanent: {
    title: "将租借转为永久转会",
    /** The club he stays at, and his own club, which he leaves. */
    stays: "留在",
    leaves: "离队",
    checking: "正在检查…",
    doesHeading: "操作内容",
    /** One line each. */
    does: [
      "球员留在当前俱乐部，并按上述条款从今天起与其签约",
      "保留其在该俱乐部的球衣号码和队内定位",
      "离开原俱乐部的所有球队，租借关系结束",
      "游戏的转会记录不会显示此次转会",
      "改动会作为转会列在“改动记录”中，撤销后可恢复租借关系",
    ],
    /** The fee, filled in from the loan's option to buy. */
    optionFee: (money: string) => `已根据租借合同中的买断选项填入：${money}`,
    /** Nothing changes in the game until Make permanent. */
    hint: "点击“转为永久转会”后才会修改游戏。",
    confirm: "转为永久转会",
    confirming: "正在转为永久转会…",
    cancel: "取消",
  },

  /** Recalling a player from his loan: the dialog the Recall button of the Loan part of his profile opens. */
  recall: {
    title: "召回租借球员",
    /** The club he is on loan at, and the one he goes back to. */
    from: "租借至",
    to: "返回",
    doesHeading: "召回内容",
    /** One line each; `parent` is the club he goes back to. */
    does: (parent: string) => [
      "今天设为租借的最后一天；游戏日期结束后会自动终止租借",
      `在游戏中推进一天后，球员将返回 ${parent}`,
      "在此之前，召回会列在“改动记录”中；撤销可恢复原租借到期日",
    ],
    /**
     * What the loan's terms would not allow in the game, when it would not let his club recall him or end the loan
     * early; `parent` is his club. The recall here moves the loan's last day all the same.
     */
    termsHeading: "游戏内条款",
    notRecallable: (parent: string) => `租借条款不允许 ${parent} 召回球员`,
    notTerminable: "租借不能提前结束",
    worksAnyway: "此处仍可召回：操作不会调用游戏内的召回功能，而是将租借结束日期改为今天",
    /**
     * A line of what the recall does, for a loan with an option to buy: `club` is the club he is on loan at. When a loan
     * with one ends, the game may let that club sign him for it.
     */
    dropsOption: (club: string, amount: string) =>
      `已移除 ${club} 以 ${amount} 买断球员的选项；否则租借结束时，游戏可能会将球员出售给 ${club}`,
    /** Nothing changes in the game until Recall. */
    hint: "点击“召回”后才会修改游戏。",
    confirm: "召回",
    confirming: "正在召回…",
    cancel: "取消",
  },

  /**
   * A club's squad: the tab of the club profile that lists the players of each of its teams, with the actions on a
   * whole team and the captains.
   */
  squad: {
    // The switch between the club's teams
    /** The name of the switch for assistive technology. */
    teamsLabel: "球队",
    /**
     * The names of the teams (see `teamLabel` in labels.ts): the first team, a B team, a team with an age limit, and
     * any other, which is named by its place in the club's list (`place` counts from 1, the first team being the
     * first).
     */
    teams: {
      first: "一线队",
      b: "B 队",
      age: (limit: number) => `U${limit}`,
      other: (place: number) => `球队 ${place}`,
    },
    /** When the game lists no team for the club. */
    noTeams: "该俱乐部没有球队。",
    loading: "正在读取阵容…",
    /** The message under an empty table. */
    empty: "这支球队中没有球员。",

    // Above the table
    players: (count: number) => `${format(count)} 名球员`,
    /** `age` is written out already, with one decimal. */
    averageAge: (age: string) => `平均年龄 ${age}`,
    /** `captain` and `viceCaptain` are names, or `profile.none` for nobody. */
    captains: (captain: string, viceCaptain: string) => `队长：${captain} · 副队长：${viceCaptain}`,

    // The actions on the whole team
    /** The name of the group of buttons for assistive technology. */
    actionsLabel: "全队操作",
    /** `injured` is how many of the team's players have an injury. */
    healAll: (injured: number) => (injured === 0 ? "治疗全队" : `治疗全队（${format(injured)} 人受伤）`),
    healAllTitle: "治疗这支球队所有球员的伤病",
    /** Hover text of Heal all while nobody in the team is injured. */
    healNone: "这支球队没有受伤球员",
    /** `banned` is how many of the team's players have a ban. */
    liftAll: (banned: number) => (banned === 0 ? "解除全队禁赛" : `解除全队禁赛（${format(banned)} 人遭禁赛）`),
    liftAllTitle: "解除这支球队所有球员的禁赛",
    /** Hover text of Lift bans while nobody in the team is banned. */
    liftNone: "这支球队没有遭到禁赛的球员",
    inspireAll: "鼓舞全队",
    inspireAllTitle: "将全队士气设为最高值 20，并移除球员的不满原因",
    maxCohesion: "凝聚力拉满",
    maxCohesionTitle:
      "将这支球队每位球员与俱乐部的凝聚力设为最高值 100。在游戏中点击“继续”推进后，球队动态页面会显示更新后的凝聚力。",
    cohesionNone: "无法读取这支球队的凝聚力：此游戏版本尚未验证该功能，或球员都没有与俱乐部的凝聚力记录。",
    cohesionWithout: (count: number) => `${format(count)} 名球员尚无与俱乐部的凝聚力记录`,
    refreshAll: "恢复全队状态",
    refreshAllTitle: "将全队体能和比赛状态恢复至 100%，并彻底消除疲劳（疲劳度 -500）",
    maxAll: "属性拉满",
    maxAllTitle:
      "将全队所有球员的属性设为最高值 20；受伤倾向和肮脏动作设为最低值 1",
    /** Beside the buttons: whom they cover, and where undoing is. */
    hint: "操作会应用于列表中的所有球员，包括外租球员。也可以在“改动记录”中撤销。",

    // Freezing the whole team, under the actions
    /** The name of the group of boxes for assistive technology. */
    freezeLabel: "锁定全队",
    freezeAttributes: "锁定属性",
    freezeAttributesTitle:
      "应用保持打开并连接时，全队球员属性不会下降：游戏扣减的数值会写回，属性提升仍会保留。",
    freezeFitness: "锁定体能和比赛状态",
    freezeFitnessTitle:
      "应用保持打开并连接时，全队球员的体能和比赛状态不会下降：游戏扣减的数值会写回。先恢复全队状态可将其保持在 100%。",
    freezePositions: "锁定位置能力",
    freezePositionsTitle:
      "应用保持打开并连接时，全队球员的位置能力会保持不变：游戏提高或降低的能力值都会写回原值。",
    /** After a box: how many of the team's `total` players are frozen that way, while some are and some are not. */
    frozenCount: (frozen: number, total: number) => `${format(frozen)} / ${format(total)}`,
    /** Beside the boxes: whom freezing covers, and for how long. */
    freezeHint:
      "锁定会应用于列表中的所有球员，并随球员转会继续生效。设置会记录在当前存档中。",
    /** What a box did, in the line under the buttons; `count` is how many players it froze or unfroze now. */
    frozeAttributes: (count: number) =>
      count === 0 ? "球员属性已锁定" : `已锁定 ${playerCount(count)} 的属性`,
    unfrozeAttributes: (count: number) => `已解除 ${playerCount(count)} 的属性锁定`,
    frozeFitness: (count: number) =>
      count === 0
        ? "球员体能和比赛状态已锁定"
        : `已锁定 ${playerCount(count)} 的体能和比赛状态`,
    unfrozeFitness: (count: number) => `已解除 ${playerCount(count)} 的体能和比赛状态锁定`,
    frozePositions: (count: number) =>
      count === 0 ? "球员的位置能力已锁定" : `已锁定 ${playerCount(count)} 的位置能力`,
    unfrozePositions: (count: number) => `已解除 ${playerCount(count)} 的位置能力锁定`,

    // What an action did, under the buttons
    /** `count` is how many values were written. */
    written: (count: number) => `已写入 ${changeCount(count)}`,
    /** A change the game refused: `name` is the player's, `reason` the game's answer (it names the value). */
    refused: (name: string, reason: string) => `${name}：${reason}`,
    /** Takes back what the line beside it says was written. */
    undo: "撤销",
    undoTitle: "将这些改动之前的值写回游戏",

    // Captains
    /** The badges after the name of the captain and of the vice-captain; their hover texts are the roles' names. */
    captainShort: "C",
    viceCaptainShort: "VC",
    /** The menu button at the end of a row: its name for assistive technology (`name` is the player's), hover text. */
    menuLabel: (name: string) => `${name} 的队长设置`,
    menuTitle: "队长设置",
    makeCaptain: "设为队长",
    makeViceCaptain: "设为副队长",
    /** Who holds a role now: said after a change, and in the Changes view under a captaincy that moved the other. */
    nowCaptain: (name: string) => `${name} 已设为队长`,
    nowViceCaptain: (name: string) => `${name} 已设为副队长`,
    /** The same when there was nobody to take the role the new holder left, so that it stands empty. */
    noCaptain: "当前没有队长",
    noViceCaptain: "当前没有副队长",

    // The table
    /** The table's name for assistive technology; `team` is the name of the team. */
    tableLabel: (team: string) => `${team} 球员列表`,
    /** Hover text of a player's name, which opens his profile in the player list. */
    openProfile: "打开球员档案",
    columns: {
      name: "姓名",
      position: "位置",
      age: "年龄",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "体能",
      matchSharpness: "比赛状态",
      jadedness: "疲劳度",
      morale: "士气",
      cohesion: "凝聚力",
      /** The last column has no heading but this one, for assistive technology: it holds the captaincy menus. */
      actions: "队长设置",
    } satisfies Record<SquadSort | "actions", string>,
    /** Hover text of a column header that sorts the table; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `按${by}排序`,
    sortNames: {
      name: "姓名",
      position: "位置",
      age: "年龄",
      currentAbility: "当前能力",
      potentialAbility: "潜力",
      condition: "体能",
      matchSharpness: "比赛状态",
      jadedness: "疲劳度",
      morale: "士气",
      cohesion: "凝聚力",
    } satisfies Record<SquadSort, string>,

    // The tags after a name, with what each means as hover text
    injured: "受伤",
    /** `count` is how many injuries he has. */
    injuredTitle: (count: number) => `${format(count)} 处伤病`,
    banned: "禁赛",
    /** `count` is how many bans he has. */
    bannedTitle: (count: number) => `${format(count)} 项禁赛`,
    onLoan: "外租",
    onLoanTitle: "租借至其他俱乐部",
    loanee: "租入",
    loaneeTitle: "从其他俱乐部租借而来",
    elsewhere: "其他梯队",
    elsewhereTitle: "效力于本俱乐部的另一支球队",
    frozen: "已锁定",
    /** Hover text of Frozen: what is frozen, one of them at least. */
    frozenTitle: (attributes: boolean, fitness: boolean, positions: boolean): string => {
      const frozen = [
        ...(attributes ? ["属性"] : []),
        ...(fitness ? ["体能", "比赛状态"] : []),
        ...(positions ? ["位置能力"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join("、")}和${last}` : last;
      return `已锁定其${listed}`;
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
      unknown: "未知商店",
    } satisfies Record<Storefront, string>,
    /** Steam's build id of the install, e.g. `"build 26227640`". */
    steamBuild: (id: string) => `版本号 ${id}`,
  },

  /** The Scouting tab: an assistant scout who advises on signings, the squad's depth and who could go. */
  scouting: {
    nav: "球探",
    reading: "正在读取你的俱乐部…",
    refresh: "刷新",
    refreshTitle: "从游戏中重新读取俱乐部信息",
    searching: "正在搜索…",
    none: "—",
    perWeek: "/周",
    openProfile: "打开档案",
    freeAgent: "自由球员",
    loan: "租借",
    header: {
      transferBudget: "转会预算",
      wageRoom: "工资空间",
      wageBudget: "工资预算",
      squad: "阵容",
      averageAge: "平均年龄",
      players: (count: number) => playerCount(count),
    },
    tabs: {
      label: "球探栏目",
      recommend: "转会建议",
      depth: "阵容深度",
      departures: "建议放走",
    },
    /** The depth statuses: the dots on the pitch and the badges of the cards. */
    status: {
      missing: "缺员",
      thin: "偏薄",
      fine: "适中",
      crowded: "拥挤",
    },
    /** The lines of the formation that roles belong to: the groups of the role selects. */
    lines: {
      goalkeeper: "门将",
      centreBack: "中后卫",
      fullBack: "边后卫",
      wingBack: "翼卫",
      defensiveMidfield: "防守型中场",
      centralMidfield: "中场",
      attackingMidfield: "攻击型中场",
      wide: "边路",
      striker: "前锋",
    },
    /** The squad lines, by key. */
    depthLines: {
      gk: "门将",
      dc: "中后卫",
      rightBack: "右后卫",
      leftBack: "左后卫",
      dm: "防守型中场",
      mc: "中场球员",
      rightWing: "右边锋",
      leftWing: "左边锋",
      amc: "攻击型中场",
      st: "前锋",
    } as Record<string, string>,
    /** The hover of a position on the pitch: "Right-backs: 2 in the squad (usually 2) — Fine". */
    positionTip: (line: string, count: number, target: number, status: string) =>
      `${line}：阵容 ${format(count)} 人（通常 ${format(target)} 人）· ${status}`,
    brief: {
      heading: "你想寻找什么？",
      pitch: "位置",
      legend: "圆点表示阵容在各条线上的人员配置。",
      inPossession: "控球时",
      outOfPossession: "无球时",
      anyRole: "不限 — 为每名球员选择最适合的职责",
      purpose: "用途",
      filters: "筛选",
      minAge: "最低年龄",
      maxAge: "最高年龄",
      maxFee: "最高转会费",
      minProbability: "可能性",
      anyProbability: "不限",
      noFreeAgents: "没有符合条件的自由球员",
    },
    purposes: {
      firstTeam: "一线队",
      rotation: "轮换",
      future: "未来",
      any: "全部",
    },
    purposeTips: {
      firstTeam: "比你在该位置上的最佳球员更出色",
      rotation: "实力不逊于第二选择，且价格合理",
      future: "21 岁或以下，仍有成长空间",
      any: "所有符合条件的球员",
    },
    /** The sentence above the advice: before the position, and after it; `roles` and `purpose` follow a dot. */
    ask: {
      before: "建议位置：",
      after: "",
      anyRole: "每名球员的最佳职责",
    },
    own: {
      heading: "你的阵容",
      empty: "阵容中没有球员能胜任此位置。",
      position: "位置",
    },
    summary: (candidates: number, eligible: number, shown: number, purpose: string) =>
      `${format(candidates)} 名球员可胜任 · ${format(eligible)} 人符合“${purpose}” · 推荐 ${format(shown)} 人`,
    how: {
      label: "此列表如何生成？",
      note: (rule: string, count: string) =>
        `球探会检查所有能胜任此位置（能力值至少为 10）的球员，排除你所在俱乐部和其他人类经理的球员，并筛选出${rule}的候选人。接着评估其中适配度最高的 400 人加盟你所在俱乐部的可能性，并综合适配度与可能性推荐前 ${count} 名。默认排序按适配度占 70%、可能性占 30%计算；30 岁以上球员的可能性权重略低。“轮换”会平均考虑两项，“未来”也会考虑潜力。点击列标题可排序；“#”表示球探推荐顺序。`,
    },
    purposeRules: {
      firstTeam: "比你在该位置上的最佳球员更适合",
      rotation: "适配度至少不低于你的第二选择",
      future: "21 岁或以下且有成长空间（潜力至少比当前能力高 15）",
      any: "所有能胜任此位置的球员",
    },
    sortBy: (by: string) => `按${by}排序`,
    sortNames: {
      rank: "球探推荐顺序",
      name: "姓名",
      age: "年龄",
      ca: "当前能力",
      pa: "潜力",
      fit: "适配度",
      probability: "可能性",
      fee: "转会费",
    },
    backToScoutOrder: "恢复球探推荐顺序",
    showMore: (count: number) => `再显示 ${format(count)} 人`,
    /** Under a player whose contract is with another club: the club he plays for, on loan or in its second team. */
    playsFor: (club: string) => `效力于 ${club}`,
    empty: "当前设置下没有此位置的建议。试试“全部”用途或放宽筛选条件。",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "球员",
      age: "年龄",
      fit: "适配度",
      role: "职责",
      probability: "可能性",
      fee: "预估转会费",
      wage: "周薪",
      note: "球探意见",
      money: "费用",
      value: "数值",
    },
    probabilityInfo:
      "球员加盟你所在俱乐部的可能性估算，参考其身价、合同、所属俱乐部和声望。",
    probabilityInfoLabel: "什么是可能性？",
    /** The hover of a fit: his attributes for each role (1–20) and how well he plays the position. */
    fitTitle: (inPossession: string | null, outOfPossession: string | null, position: string) =>
      [
        inPossession !== null && `控球时：${inPossession}`,
        outOfPossession !== null && `无球时：${outOfPossession}`,
        `位置：${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note: "适配度根据编辑器为各职责设定的属性权重计算；转会费、周薪和可能性均为估算值。",
    depth: {
      summary: (size: number, age: string | null, level: string) =>
        `${format(size)} 名球员${age === null ? "" : ` · 平均年龄 ${age}`} · 最佳十一人平均能力 ${level}`,
      weak: "低于阵容水准",
      ageing: "年龄偏大",
      cover: (names: string) => `也能胜任此位置：${names}`,
      advice: "获取建议",
      adviceTitle: "此条线的转会建议",
      empty: "无人",
      ability: "当前能力",
      more: (count: number) => `另有 ${format(count)} 人`,
      columns: {
        line: "位置线",
        status: "状态",
        count: "球员",
        players: "按能力从高到低",
        cover: "也能胜任此位置",
        age: "平均年龄",
      },
      countTitle: (count: number, target: number) =>
        `${format(count)} 名球员的最佳位置属于此条线；球队通常配置 ${format(target)} 人`,
      statusHelp: {
        missing: "没有球员能胜任此位置。",
        thin: "人数少于球队通常配置；能够客串该位置的球员按半人计算。",
        fine: "人数符合球队的通常配置。",
        crowded: "比球队通常配置多出至少两人。",
      },
      attention: "需要关注：",
      allFine: "各条线配置均衡。",
    },
    departures: {
      intro: "球探建议放走的球员，按紧迫程度排序。",
      filter: "建议",
      all: "全部",
      empty: "球探目前没有建议放走任何球员。",
      sortNames: {
        rank: "球探推荐顺序",
        name: "姓名",
        age: "年龄",
        ca: "当前能力",
        pa: "潜力",
        value: "身价",
        wage: "周薪",
        contract: "合同到期日",
      },
      columns: {
        player: "球员",
        age: "年龄",
        ability: "能力",
        value: "数值",
        wage: "周薪",
        contract: "合同到期日",
        advice: "建议",
        reasons: "原因",
      },
      actions: { sell: "出售", loan: "外租", release: "解约" },
      /** "3rd" in a line. */
      rank: (line: string, rank: number) => `${line} · 第 ${rank} 位`,
    },
    roles: {
      bgk: "出球型门将",
      ngk: "传统门将",
      sk: "清道夫门将",
      lhk: "门线型门将",
      cb: "中后卫",
      bcb: "出球中后卫",
      ncb: "传统型中后卫",
      acb: "前插中后卫",
      ocb: "套边中后卫",
      scb: "上抢中后卫",
      ccb: "拖后中后卫",
      wcb: "边中卫",
      fb: "边后卫",
      ifb: "内收型边后卫",
      pfb: "逼抢型边后卫",
      hfb: "防守型边后卫",
      wb: "翼卫",
      iwb: "内收型翼卫",
      pwb: "组织型翼卫",
      awb: "进攻型翼卫",
      hwb: "防守型翼卫",
      dm: "防守型中场",
      hb: "半后卫",
      ddm: "回撤型防守中场",
      pdm: "逼抢型防守中场",
      bbm: "全能中场",
      bbp: "全能组织核心",
      cm: "中场",
      pcm: "逼抢型中场",
      scm: "屏障型中场",
      chm: "肋部中场",
      wcm: "宽幅中场",
      ap: "进攻组织核心",
      am: "攻击型中场",
      oam: "出球点型攻击中场",
      w: "边锋",
      if: "内锋",
      pw: "组织型边锋",
      wfd: "边路前锋",
      tw: "回防型边锋",
      iow: "内切出球边锋",
      cfd: "中锋",
      dlf: "拖后前锋",
      p: "偷猎者",
      tcf: "回防型中锋",
      ocf: "出球点型中锋",
    } as Record<string, string>,
    reasons: {
      listed: () => "已列入转会名单",
      freeAgent: () => "自由球员",
      expiring: (value: string) => `合同将在 ${value} 天后到期`,
      releaseClause: (value: string) => `解约金 ${value}`,
      fringe: () => "并非俱乐部常规主力",
      keyPlayer: () => "俱乐部关键球员",
      unwanted: () => "在俱乐部属于冗员",
      overBudget: (value: string) => `超出预算 ${value}`,
      stretch: (value: string) => `略超预算（+${value}）`,
      wageHigh: (value: string) => `周薪 ${value}，超出可用空间`,
      biggerClub: () => "效力于更大的俱乐部",
      smallerClub: () => "效力于规模较小的俱乐部",
      reputationGap: () => "名气远超你的俱乐部",
      ambitious: () => "有抱负：愿意加盟更高水平的俱乐部",
      notForSale: () => "非卖品",
    } as Record<string, (value: string) => string>,
    /** Why a player could go, by code; `value` is the reason's value as text. */
    departureReasons: {
      surplus: (value: string) => `该位置人员过多（${value} 人）`,
      belowLevel: () => "低于阵容水准",
      ageing: (value: string) => `年龄偏大（${value} 岁）`,
      expiring: (value: string) => `合同将在 ${value} 天后到期`,
      highWage: (value: string) => `对该职责而言周薪偏高（${value}/周）`,
      unhappy: () => "不开心",
      lowMorale: () => "士气低落",
      blocked: () => "需要出场时间来成长",
      unwanted: () => "队内定位：冗员",
      listed: () => "已列入转会名单",
    } as Record<string, (value: string) => string>,
  },

  errors,
};

/** What a dictionary has to provide. */
