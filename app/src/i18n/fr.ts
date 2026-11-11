// The French text of the UI: the same shape as `en.ts` (a missing or extra key fails the build), in the French of
// France, whose conventions the dates and numbers follow too (see `index.ts`). It speaks to the player as "vous", as
// FM's French does ("Voulez-vous vraiment quitter ?", "Cliquez pour voir"). The comments in `en.ts` say what each
// string is for.
//
// The football words are the game's own: FM27 keeps every language in `languages.fmf`, and matching its English and
// French strings by key names attributes, positions, traits, roles, clauses, squad statuses and jobs as the French game
// does ("Finition", "Niveau actuel", "Forme physique", "Libre de tout contrat"). The editor's own text is translated
// here: freezing is "bloquer", as the game's "Bloquer attributs" has it, and a mass edit a "modification groupée".
//
// French puts the singular after 0 and 1 and the plural after the rest ("0 joueur", "1 joueur", "2 joueurs"), and the
// words after a count agree with its noun ("1 modification appliquée", "3 modifications appliquées"). A player, a
// member of staff and a club are all masculine nouns here. French typography wants a no-break space before : ; ? ! and
// %, and inside « » ("\u00a0" below).

import type { Entity } from "../types";
import type { ErrorTexts, Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("fr-FR");
const percents = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12 345". */
const format = (value: number) => numbers.format(value);

/** Whether a count takes the plural: French puts the singular after 0 and 1 ("0 joueur", "1 joueur", "2 joueurs"). */
const plural = (count: number) => Math.abs(count) >= 2;

/** The same for a count the caller has as text already ("45", "1 234"). */
const pluralText = (value: string) => plural(Number(value.replace(/[^\d.-]/g, "")));

/** A count and its noun, singular or plural: "0 joueur", "1 joueur", "12 345 joueurs". */
const counted = (count: number, one: string, many: string) => `${format(count)} ${plural(count) ? many : one}`;

/** The "s" of a word that agrees with a count: "1 modification appliquée", "3 modifications appliquées". */
const agree = (count: number) => (plural(count) ? "s" : "");

/** "0 modification", "1 modification", "12 345 modifications". A change is feminine: "modification appliquée". */
const changes = (count: number) => counted(count, "modification", "modifications");

/** For the places that say how many changes there are, which may be none: "Aucune modification", "3 modifications". */
const changeCount = (count: number) => (count === 0 ? "Aucune modification" : changes(count));

/** "1 joueur", "12 joueurs". */
const playerCount = (count: number) => counted(count, "joueur", "joueurs");

/** "1 valeur laissée telle quelle", "12 valeurs laissées telles quelles". */
const valuesLeftAlone = (count: number) =>
  plural(count) ? `${format(count)} valeurs laissées telles quelles` : `${format(count)} valeur laissée telle quelle`;

/** "jour" or "jours" after a count the caller has as text. */
const days = (value: string) => (pluralText(value) ? "jours" : "jour");

/** What each list holds, for one and for many; all three nouns are masculine, so the words around them are too. */
const nouns: Record<Entity, { one: string; many: string }> = {
  player: { one: "joueur", many: "joueurs" },
  staff: { one: "membre du staff", many: "membres du staff" },
  club: { one: "club", many: "clubs" },
};

/** "237 joueurs", "1 membre du staff", "12 clubs". */
const entityCount = (entity: Entity, count: number) => counted(count, nouns[entity].one, nouns[entity].many);

/** "de" before a name, elided before a vowel: "de Lyon", "d'Arsenal". */
const de = (name: string) => (/^[aeiouàâäæéèêëîïôöœùûü]/i.test(name) ? `d'${name}` : `de ${name}`);

/** A text with a capital: "Ce joueur". */
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Squad statuses, by the codes contracts hold them as (see `en.ts`); named as the game's French text names them (14,
 * which it has no name for, after its "Titulaire régulier" and "Équipe B").
 */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Joueur vedette",
  2: "Joueur important",
  3: "Titulaire régulier",
  4: "Joueur de rotation",
  5: "Super sub",
  7: "Joueur secondaire",
  9: "Remplaçant en cas de crise",
  10: "Jeune espoir sur le point de percer",
  11: "Jeune prometteur",
  13: "Jeune",
  14: "Titulaire régulier en équipe B",
  15: "Gardien titulaire",
  16: "Gardien en coupe",
  17: "Gardien en coupe nationale",
  20: "Remplaçant",
  21: "Remplaçant en cas de crise (gardien)",
  22: "Pas utile à l'équipe",
};

/** The kinds of contract (see `en.ts`). */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Contrat à temps partiel",
  1: "Contrat à temps plein",
  2: "Contrat amateur",
  3: "Contrat jeune",
  4: "Sans contrat",
  10: "Contrat salaire minimum senior",
  11: "Contrat senior",
};

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(fr, key ?? "");

/** The same in quotes, for the middle of a sentence: « Finition ». */
const quoted = (key: string | undefined) => `«\u00a0${field(key)}\u00a0»`;

/** The noun of the kind of record a failure names, or "enregistrement" when it names none; all are masculine. */
const recordNoun = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? nouns[entity].one : "enregistrement";

/** That noun after "ce", which takes a t before a vowel: "ce joueur", "cet enregistrement". */
const thisRecord = (entity: string | undefined) => {
  const noun = recordNoun(entity);
  return /^[aeiouéè]/i.test(noun) ? `cet ${noun}` : `ce ${noun}`;
};

/** The reasons the Rust side gives for a field that cannot be changed some way. */
const UNSUPPORTED: Partial<Record<string, string>> = {
  "a date can only be set": "une date peut seulement être fixée",
  "it is changed one person at a time": "il se modifie une personne à la fois",
  "the new value is not one of the game's own records of that kind":
    "la nouvelle valeur ne fait pas partie des enregistrements du jeu de ce type",
  "the in-game date is not known": "la date du jeu n'est pas connue",
};

const reload = "rechargez les données et réessayez";

/** The lists of a club's staff, as `staff.noRoom` names them. */
const STAFF_DEPARTMENTS: Partial<Record<string, string>> = {
  medical: "du staff médical",
  coaching: "des préparateurs",
  scouting: "des recruteurs",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as (see `en.ts`); named as the game's
 * French contract screen names them, the release clauses after its "Clause libératoire (clubs étrangers)".
 */
const CLAUSE_NAMES_FR: Partial<Record<number, string>> = {
  0: "Clause libératoire minimum",
  1: "Clause de départ en cas de relégation",
  2: "Clause de départ si le club ne monte pas",
  3: "Augmentation annuelle du salaire",
  4: "Augmentation de salaire en cas de montée",
  5: "Baisse de salaire en cas de relégation",
  6: "Clause de départ en cas d'offre de poste dans un staff",
  8: "Pourcentage sur la revente",
  9: "Pourcentage sur bénéfice de la revente",
  10: "Prime de buts inscrits (saison)",
  11: "Prolongation d'un an après matchs de championnat (dernière saison)",
  12: "Clause pour égaler le plus gros salaire",
  13: "Salaire après nombre d'apparitions en championnat",
  14: "Augmentation de salaire en cas de montée dans l'élite",
  15: "Baisse de salaire en cas de relégation de division d'élite",
  16: "Clause libératoire (clubs étrangers)",
  17: "Clause libératoire (clubs nationaux de division supérieure)",
  18: "Clause libératoire (clubs nationaux)",
  19: "Salaire après sélections internationales",
  20: "Pourcentage du salaire pris en charge par le sponsor",
  21: "Pourcentage des recettes guichet reversé au joueur",
  22: "Option de prolongation de contrat par le club",
  23: "Renoncement à la compensation (club) en cas d'offre de poste à responsabilités",
  25: "Prolongation d'un an après matchs de championnat (dernière saison et promotion)",
  26: "Prolongation d'un an après matchs de championnat (dernière saison et relégation évitée)",
  27: "Clause libératoire (clubs en Ligue des champions de l'UEFA)",
  28: "Clause de contrat garanti en MLS",
  29: "Prolongation de contrat en cas de montée",
  30: "Clause libératoire en cas de blessure",
  31: "Clause libératoire (clubs en compétition continentale)",
  32: "Prime de match",
  33: "Prime de but",
  34: "Prime de cages inviolées",
  37: "Prime de sélection",
  38: "Prime de remplaçant non utilisé",
  39: "Prime de passe décisive",
  40: "Prime de passes décisives (saison)",
  41: "Prime de buts et de passes décisives combinés (saison)",
  54: "Non affichée dans le jeu (54)",
  55: "Clause de départ active de relégation",
  56: "Clause de départ active de non-promotion",
  58: "Non affichée dans le jeu (58)",
  63: "Non affichée dans le jeu (63)",
};

/** Reasons to be unhappy, by the codes the game keeps them as (see `en.ts`). */
const CONCERN_MOTIVES_FR: Partial<Record<number, string>> = {
  596: "Non inscrit dans l'effectif d'une compétition",
  808: "Estime qu'un coéquipier a été traité injustement",
  926: "Estime qu'un coéquipier ne mérite pas le temps de jeu qu'il réclame",
};

/**
 * Players' traits (preferred moves), by their bit in the game's mask (see `en.ts`); the game's French names, and for
 * the few it has none for (48, 49, 53, 54) a name in its words.
 */
const TRAIT_NAMES_FR: readonly string[] = [
  "Court avec le ballon sur le flanc gauche",
  "Court avec le ballon sur le flanc droit",
  "Court avec le ballon dans l'axe",
  "Rentre dans la surface adverse",
  "Prend les espaces",
  "Se projette vers l'avant dès que possible",
  "Joue court et simple",
  "Tente souvent des ouvertures dans le dos de la défense",
  "Tire de loin",
  "Tire avec puissance",
  "Place ses frappes",
  "Brosse le ballon",
  "Aime crocheter le gardien",
  "Aime jouer à la limite du hors-jeu",
  "Utilise son extérieur du pied",
  "Marque de près son adversaire",
  "Resserre ses adversaires",
  "S'en prend aux arbitres",
  "Joue dos au but",
  "Décroche pour récupérer le ballon",
  "Joue en une-deux",
  "Aime lober le gardien",
  "Dicte son rythme",
  "Tente des retournés",
  "Cherche à faire une passe plutôt que de marquer",
  "Ne joue pas en profondeur",
  "Ralentit le jeu",
  "Déborde son adversaire",
  "Met le ballon sur son pied droit pour dribbler",
  "Met le ballon sur son pied gauche pour dribbler",
  "Conserve la balle",
  "Arrive tard dans la surface adverse",
  "Ne dégage pas sous pression",
  "Reste toujours en défense",
  "Évite de jouer sur son pied faible",
  "Tente des gestes techniques",
  "Tente des coups francs lointains",
  "Se jette pour tacler",
  "Ne se jette pas pour tacler",
  "Repique dans l'axe depuis les ailes",
  "Joue le long de la ligne de touche",
  "Sait jouer avec le public",
  "Tente des tirs instantanés",
  "Tente des passes de loin",
  "Aime recevoir le ballon dans les pieds",
  "Joue les coups francs avec puissance",
  "Aime dribbler ses adversaires plusieurs fois",
  "Tente d'orienter le jeu sur les ailes",
  "Prendra sa retraite au sommet",
  "Jouera au football le plus longtemps possible",
  "Peut effectuer de longues touches",
  "Court souvent avec le ballon",
  "Court rarement avec le ballon",
  "Tente d'améliorer son mauvais pied",
  "Pivot statique",
  "Effectue des touches longues pour lancer des contre-attaques",
  "Se retient de tirer de loin",
  "Repique dans l'axe depuis l'aile gauche",
  "Repique dans l'axe depuis l'aile droite",
  "Centre rapidement",
  "Sort de la défense balle au pied",
  "Joue au pied",
];

/** What a check is about, from the key a failure gives, with a capital. */
const checkName = (key: string | undefined) => {
  const name = (fr.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return capital(name);
};

/** The name of a job code a failure gives, as `jobs` below has it. */
const jobName = (code: string | undefined) => (fr.jobs as Partial<Record<number, string>>)[Number(code)] ?? code;

const errors: ErrorTexts = {
  "guard.unknownBuild": () =>
    "FMLibreEditor n'a pas été vérifié avec cette version du jeu\u00a0; il n'y écrit donc pas. «\u00a0Modifier quand " +
    "même\u00a0», dans l'avis en haut, active la modification.",
  "guard.failed": (p) =>
    `${checkName(p.check)}\u00a0: échec des vérifications dans cette version du jeu\u00a0; FMLibreEditor n'y touche ` +
    "donc pas.",
  "edit.unknownField": (p) => `Il n'y a ici aucun champ modifiable nommé «\u00a0${p.field}\u00a0».`,
  "edit.outOfRange": (p) =>
    `${p.value} n'est pas une valeur valide pour ${quoted(p.field)}\u00a0: ce champ accepte de ${p.min} à ${p.max}.`,
  "edit.notADate": (p) => `${p.value} n'est pas une date valide pour ${quoted(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} ne fait pas partie des valeurs que ${quoted(p.field)} accepte.`,
  "edit.taken": (p) =>
    `Le numéro de maillot ${p.value} est déjà pris\u00a0: ${p.name ?? `le joueur avec l'UID ${p.uid}`} le porte.`,
  "edit.unsupported": (p) =>
    `Le champ ${quoted(p.field)} ne peut pas être modifié ainsi\u00a0: ${UNSUPPORTED[p.reason] ?? p.reason}.`,
  "edit.moved": (p) => `${capital(thisRecord(p.entity))} a changé de place dans la mémoire du jeu\u00a0; ${reload}.`,
  "edit.noRecord": (p) =>
    `Le champ ${quoted(p.field)} ne peut pas être modifié ici\u00a0: son enregistrement manque ou ne passe pas les ` +
    "vérifications.",
  "edit.unset": (p) => `Le champ ${quoted(p.field)} n'a pas de valeur dans le jeu\u00a0; il n'a donc pas été touché.`,
  "edit.implausible": (p) =>
    `Le champ ${quoted(p.field)} vaut ${p.value}, une valeur qu'il ne peut pas avoir\u00a0; par sécurité, il n'a pas ` +
    "été touché.",
  "edit.notApplied": (p) => `Champ ${quoted(p.field)}\u00a0: ${p.wrote} a été écrit, mais la relecture donne ${p.read}.`,
  "edit.conflict": (p) =>
    `Le champ ${quoted(p.field)} vaut maintenant ${p.found}, et non ${p.expected}\u00a0: le jeu l'a modifié entre-temps.`,
  "move.moved": () => `Le joueur a changé de place dans la mémoire du jeu\u00a0; ${reload}.`,
  "move.notAClub": () => "Ce club n'a pas d'équipe première que le joueur puisse rejoindre.",
  "move.freeAgent": () =>
    "Le joueur est libre de tout contrat\u00a0: il n'a pas de club à quitter, ni avec lequel faire un échange.",
  "move.sameClub": () => "Le joueur est déjà dans ce club.",
  "move.onLoan": () =>
    "Le joueur est en prêt\u00a0: rappelez-le d'abord de son prêt, ou rendez le prêt définitif, dans la partie Prêt de " +
    "son profil.",
  "move.notOnLoan": () => "Le joueur n'est pas en prêt.",
  "move.playerCoach": () =>
    "Les joueurs-entraîneurs ne peuvent pas être transférés\u00a0: ils font aussi partie du staff.",
  "move.unusualContract": () => "Le contrat du joueur n'est pas un simple contrat de joueur.",
  "move.humanClub": () =>
    "Le joueur est dans un club dirigé par un entraîneur humain, et l'éditeur ne trouve pas encore les compositions " +
    "d'équipe de ce club dans cette version du jeu pour l'en retirer\u00a0; il ne peut quitter ce club que dans le jeu " +
    "lui-même.",
  "move.menAndWomen": () => "L'un des clubs est un club masculin et l'autre un club féminin.",
  "move.notListed": () => "Les listes de l'effectif ne contiennent pas le joueur là où elles le devraient.",
  "move.noRoom": (p) =>
    `La liste de l'effectif du club n'a plus de place pour un autre joueur (${p.players} actuellement), et l'éditeur ` +
    "ne peut pas l'agrandir ici.",
  "sign.noPool": () =>
    "L'éditeur ne trouve pas où le jeu garde ses contrats dans cette version\u00a0; il ne peut donc pas en donner un à " +
    "un joueur libre.",
  "sign.poolFull": () =>
    "Le jeu n'a plus de place pour un autre contrat tant qu'il n'en crée pas un lui-même, comme il le fait au fil des " +
    "jours\u00a0: avancez d'un jour dans le jeu, puis réessayez.",
  "sign.noModel": () =>
    "Le club n'a aucun joueur sous simple contrat avec son équipe première sur lequel calquer le nouveau contrat.",
  "sign.noDate": () => "L'éditeur ne parvient pas à lire la date du jeu, à laquelle commence le nouveau contrat.",
  "move.outOfRange": (p) =>
    `${p.value} n'est pas une valeur valide pour ${quoted(p.field)}\u00a0: ce champ accepte de ${p.min} à ${p.max}.`,
  "move.changed": () => `Le jeu a modifié cette mémoire entre-temps\u00a0; ${reload}.`,
  "move.notApplied": () => "La mémoire a été écrite, mais la relecture donne autre chose.",
  "retirement.unknown": () =>
    "L'éditeur ne trouve pas les départs à la retraite prévus dans cette version du jeu.",
  "retirement.none": () =>
    "Le jeu n'a pas prévu le départ à la retraite de ce joueur, qui compte déjà continuer à jouer.",
  "clause.noContract": () => "Le joueur n'a pas de contrat.",
  "clause.missing": () => `Cette clause n'est plus dans le contrat\u00a0; ${reload}.`,
  "clause.notInClause": (p) =>
    `Cette clause n'a pas ${p.field === "clause.amount" ? "de montant" : "de condition"} à modifier.`,
  "clause.same": () => "Le contrat contient déjà cela.",
  "clause.noRoom": () =>
    "La liste des clauses du contrat n'a plus de place, et l'éditeur ne peut pas l'agrandir\u00a0; modifiez plutôt " +
    "une clause existante.",
  "heal.notInjured": () => "Le joueur n'a aucune blessure à soigner.",
  "ban.notBanned": () => "Le joueur n'a aucune suspension à lever.",
  "relation.missing": () =>
    `Cette nationalité ou cette formation n'est plus dans la liste du joueur\u00a0; ${reload}.`,
  "relation.noRoom": () =>
    "La liste du joueur n'a plus de place, et l'éditeur ne peut pas l'agrandir ici\u00a0; modifiez plutôt l'une de " +
    "ses entrées.",
  "relation.target": () => "Ce n'est pas un pays ou un club du jeu du type que cette entrée accepte.",
  "relation.same": () => "Le joueur a déjà cela.",
  "relation.rule": (p) => `La règle de formation ${p.rule} ne fait pas partie de celles que l'éditeur écrit.`,
  "staff.you": () => "C'est vous, l'entraîneur que vous contrôlez.",
  "staff.unemployed": () => "Ce membre du staff n'a pas de club.",
  "staff.role": () =>
    "Le club ou l'une de ses équipes désigne directement ce membre du staff (comme un club désigne un entraîneur qui " +
    "est aussi son directeur sportif)\u00a0; c'est le jeu lui-même qui le déplace.",
  "staff.notListed": () => "Les listes du staff du club ne le contiennent pas là où elles le devraient.",
  "staff.noRoom": (p) =>
    `La liste ${STAFF_DEPARTMENTS[p.department] ?? `«\u00a0${p.department}\u00a0»`} du club n'a plus de place pour ` +
    `quelqu'un d'autre (${p.staff} actuellement), et l'éditeur ne peut pas l'agrandir ici.`,
  "stadium.none": () => "Impossible de lire le stade où joue l'équipe première du club.",
  "stadium.shared": (p) =>
    `${p.holders} éléments du jeu portent le même nom que ce stade\u00a0; il ne peut pas être changé pour le stade seul.`,
  "stadium.nameLength": (p) =>
    `Le nouveau nom de ce stade doit occuper de ${p.min} à ${p.max} octets pour tenir là où le jeu le garde\u00a0; ` +
    `celui-ci en occupe ${p.bytes}.`,
  "stadium.badName": () =>
    "Le nom d'un stade ne peut pas être vide, commencer ou finir par une espace, ni contenir de caractères de contrôle.",
  "staff.job": (p) =>
    `L'éditeur ne déplace pas encore les membres du staff dont la fonction est «\u00a0${jobName(p.job)}\u00a0», et ne ` +
    "donne pas cette fonction.",
  "staff.directorTaken": (p) =>
    `Le club a déjà un directeur sportif\u00a0: ${p.name ?? "une autre personne"}. Donnez une autre fonction à ce ` +
    `membre du staff dans ce club, ou déplacez d'abord ${p.name ?? "cette personne"}.`,
  "staff.managerTaken": (p) =>
    `Le club a déjà un entraîneur\u00a0: ${p.name ?? "une autre personne"}. Donnez une autre fonction à ce membre du ` +
    `staff dans ce club, ou déplacez d'abord ${p.name ?? "cette personne"}.`,
  "staff.yourClub": () =>
    "Vous dirigez ce club. Donnez une autre fonction à ce membre du staff dans ce club\u00a0: FMLibreEditor ne prend " +
    "jamais votre place.",
  "staff.noJob": () => "Choisissez la fonction qu'il occupera dans le club.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "Ce club n'a aucun staff\u00a0: le jeu n'en garde pas dans les clubs des championnats qui ne sont pas jouables " +
        "dans cette partie."
      : "Aucun membre du staff de ce club n'a de contrat complet à lui sur lequel calquer un nouveau contrat.",
  "squad.noTeam": () => `Le club n'a pas cette équipe, ou elle ne passe pas les vérifications\u00a0; ${reload}.`,
  "captain.notInTeam": () =>
    "Le joueur ne joue pas dans cette équipe\u00a0; seul un joueur de l'équipe elle-même peut en être capitaine.",
  "captain.unchanged": () => "Le joueur a déjà ce rôle.",
  "session.notRunning": () =>
    "Football Manager 27 n'est pas lancé. Lancez le jeu, chargez une partie et réessayez.",
  "session.noSuchProcess": (p) => `Il n'y a aucun ${p.exe ?? "fm.exe"} avec le PID ${p.pid}.`,
  "session.severalRunning": (p) =>
    `${p.count} copies de ${p.exe ?? "fm.exe"} sont lancées (${p.pids})\u00a0; choisissez-en une.`,
  "session.pluginNotLoaded": () =>
    "Les données du jeu ne sont pas encore chargées\u00a0; attendez le menu principal et réessayez.",
  "session.unsupportedEdition": (p) => `FM${p.edition} n'est pas encore pris en charge.`,
  "session.unknownEdition": () => "Impossible de déterminer de quel Football Manager il s'agit.",
  "session.playersNotFound": () =>
    "La liste des joueurs est introuvable\u00a0; chargez une partie (le menu principal ne suffit pas) et réessayez.",
  "memory.win32": (p) => `Windows a refusé une opération (${p.operation}, erreur ${p.code}).`,
  "memory.read": (p) => `Impossible de lire la mémoire du jeu (erreur système ${p.code}).`,
  "memory.write": (p) => `Impossible d'écrire dans la mémoire du jeu (erreur système ${p.code}).`,
  "memory.readOnly": () => "Le jeu a été ouvert en lecture seule\u00a0; Windows n'a pas autorisé l'écriture.",
  "memory.notWritable": () =>
    "Cette adresse ne fait pas partie de la mémoire de données modifiable du jeu\u00a0; rien n'y a été écrit.",
  "memory.invalidPe": () => "Impossible de lire le module du jeu.",
  "memory.invalidMachO": () => "Impossible de lire le module du jeu.",
  "memory.mach": (p) => `macOS a refusé une opération (${p.operation}, erreur ${p.code}).`,
  "memory.posix": (p) => `macOS a refusé une opération (${p.operation}, errno ${p.code}).`,
  "guard.saveChanged": () =>
    "Le jeu a chargé une partie, ou est revenu à son menu principal, depuis que FMLibreEditor l'a lu\u00a0: rien n'est " +
    "modifié tant que vous ne rechargez pas les données.",
  "memory.noBridge": () =>
    "macOS ne laisse pas FMLibreEditor accéder au jeu\u00a0: le jeu a été lancé sans le bridge de FMLibreEditor. " +
    "Installez le bridge, puis relancez le jeu depuis Steam.",
  "memory.bridge": (p) => `Le bridge de FMLibreEditor dans le jeu n'a pas transmis la mémoire (${p.reason}).`,
  "scout.noClub": () =>
    "Vous ne dirigez aucun club dans cette partie\u00a0: il n'y a personne pour qui recruter.",
  "scout.noTactic": (p) => `Impossible de lire dans le jeu la tactique ${de(p.club ?? "")}.`,
  "scout.notPlaced": () => "Le joueur n'occupe aucun poste de la tactique.",
  "scout.unknownRole": (p) => `L'éditeur ne connaît pas le rôle ${p.role}.`,
  "setup.steamRunning": () =>
    "Steam est ouvert\u00a0: les options de lancement de FM27 n'ont donc pas été touchées\u00a0; le bridge lui-même est " +
    "installé. Quittez Steam et réessayez, ou saisissez vous-même l'option de lancement dans Steam.",
  "setup.noSteamAccount": () =>
    "Aucun compte Steam n'a été trouvé sur ce Mac\u00a0; ouvrez Steam et connectez-vous au moins une fois.",
  "setup.noLibrary": (p) => `Il manque un fichier du bridge dans l'application\u00a0: ${p.path}`,
  "setup.unknownConfig": (p) =>
    `${p.path} n'a pas un format que FMLibreEditor connaît\u00a0; il n'a donc pas été touché.`,
  "setup.io": (p) => `${p.path}\u00a0: ${p.error}`,
  "app.internal": () => "Une erreur inattendue s'est produite dans l'application.",
  "app.notConnected": () => "Pas de connexion au jeu.",
  "app.notFound": (p) =>
    `Aucun ${recordNoun(p.entity)} avec l'ID ${p.uid} dans les listes\u00a0; rechargez les données.`,
  "app.dataChanged": () => `Ces données ont changé dans le jeu\u00a0; ${reload}.`,
  "app.noChange": (p) => `La modification ${p.id} n'existe pas.`,
  "app.alreadyUndone": () => "Cette modification a déjà été annulée.",
  "export.failed": (p) => `Impossible d'écrire le fichier\u00a0: ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor ne peut pas écrire dans ${p.folder}. Si macOS a demandé s'il pouvait utiliser votre dossier ` +
    "Documents, autorisez-le dans Réglages Système › Confidentialité et sécurité › Fichiers et dossiers, puis exportez " +
    "à nouveau.",
  "export.noFolder": () => "Il n'y a aucun dossier où exporter.",
  "export.notExported": () => "Ce n'est pas un fichier exporté par FMLibreEditor.",
  "export.openFailed": (p) => `Impossible de l'ouvrir\u00a0: ${p.reason}`,
  "mass.noOperations": () => "Choisissez au moins un champ à modifier.",
  "mass.tooMany": (p) =>
    `Il y a ${p.count} résultats. Pour une modification groupée, réduisez la recherche ou les filtres à ${p.limit} ` +
    "au maximum.",
  "mass.outOfDate": () => "Cet aperçu n'est plus à jour. Relancez l'aperçu de la modification groupée.",
};

export const fr: Strings = {
  attributes: {
    // Technique
    corners: "Corners",
    crossing: "Centres",
    dribbling: "Dribbles",
    finishing: "Finition",
    first_touch: "Contrôle de balle",
    free_kicks: "Coups francs",
    heading: "Jeu de tête",
    long_shots: "Tirs de loin",
    long_throws: "Touches longues",
    marking: "Marquage",
    passing: "Passes",
    penalty_taking: "Penalties",
    tackling: "Tacles",
    technique: "Technique",
    // Mental
    aggression: "Agressivité",
    anticipation: "Anticipation",
    bravery: "Courage",
    composure: "Sang-froid",
    concentration: "Concentration",
    decisions: "Décisions",
    determination: "Détermination",
    flair: "Inspiration",
    leadership: "Leadership",
    off_the_ball: "Appels de balle",
    positioning: "Placement",
    teamwork: "Jeu collectif",
    vision: "Vision du jeu",
    work_rate: "Volume de jeu",
    // Physique
    acceleration: "Accélération",
    agility: "Agilité",
    balance: "Équilibre",
    jumping_reach: "Détente verticale",
    natural_fitness: "Qualités physiques naturelles",
    pace: "Vitesse",
    stamina: "Endurance",
    strength: "Puissance",
    // Gardien de but (le contrôle de balle et les passes sont ceux de la Technique)
    aerial_reach: "Détente",
    command_of_area: "Autorité dans la surface",
    communication: "Communication",
    eccentricity: "Excentricité",
    handling: "Prise de balle",
    kicking: "Dégagements au pied",
    one_on_ones: "Un contre un",
    punching: "Dégagement au poing (tendance)",
    reflexes: "Réflexes",
    rushing_out: "Sorties dans les pieds (tendance)",
    throwing: "Relances à la main",
    // Cachés
    consistency: "Régularité",
    dirtiness: "Violence",
    important_matches: "Matchs importants",
    injury_proneness: "Tendance à se blesser",
    versatility: "Polyvalence",
    // Pieds
    left_foot: "Pied gauche",
    right_foot: "Pied droit",
  },

  staffAttributes: {
    // Entraînement
    attacking: "Offensif",
    defending: "Défensif",
    fitness: "Condition physique",
    goalkeeping: "Gardiens",
    possession: "Possession",
    set_pieces: "Coups de pied arrêtés",
    tactical: "Tactique",
    technical: "Technique",
    working_with_youngsters: "Entraînement des jeunes",
    // Mental
    authority: "Autorité",
    determination: "Détermination",
    motivating: "Capacité à motiver",
    people_management: "Gestion des personnes",
    // Connaissances
    data_analysis: "Analyse de données",
    judging_ability: "Évaluation des joueurs",
    judging_potential: "Évaluation du potentiel",
    judging_staff: "Évaluation du niveau du staff",
    negotiating: "Négociation",
    tactical_knowledge: "Notions tactiques",
    // Médical
    physiotherapy: "Kiné",
    sports_science: "Sciences du sport",
  },

  personality: {
    adaptability: "Adaptabilité",
    ambition: "Ambition",
    loyalty: "Fidélité",
    pressure: "Pression",
    professionalism: "Professionnalisme",
    sportsmanship: "Fair-play",
    temperament: "Tempérament",
    controversy: "Polémique",
  },

  // The game's French abbreviations, from the table its position screens use. That table gives the defensive and the
  // right midfielder the same "MD", so the defensive midfielder is "MDC" here; it has none for the sweeper ("LIB").
  positions: {
    gk: "GB",
    sw: "LIB",
    dl: "DG",
    dc: "DC",
    dr: "DD",
    dm: "MDC",
    ml: "MG",
    mc: "MC",
    mr: "MD",
    aml: "MOG",
    amc: "MOC",
    amr: "MOD",
    st: "BT",
    wbl: "ALG",
    wbr: "ALD",
  },

  clubFacilities: {
    training: "Centre d'entraînement",
    youth_facilities: "Structures de formation",
    youth_coaching: "Encadrement des jeunes",
    youth_recruitment: "Recrutement des jeunes",
    corporate: "Loges VIP",
  },

  supporterTraits: {
    loyalty: "Fidélité",
    passion: "Passion",
    patience: "Patience",
    affluence: "Richesse",
    temperament: "Tempérament",
    expectations: "Attentes",
  },

  supporterMix: {
    hardcore: "Inconditionnels",
    core: "Réguliers",
    family: "Familiaux",
    fair_weather: "Footix",
    corporate: "VIP",
    casual: "Occasionnels",
  },

  jobs: {
    1: "Joueur",
    2: "Préparateur",
    4: "Président(e)",
    6: "Administrateur",
    10: "Directeur sportif",
    12: "Kiné",
    14: "Recruteur",
    16: "Entraîneur",
    20: "Entraîneur adjoint",
    22: "Préparateur aux coups de pied arrêtés",
    26: "Préparateur physique",
    34: "Entraîneur des gardiens",
    38: "Médecin chef",
    40: "Responsable sciences du sport",
    44: "Responsable du recrutement",
    46: "Médecin",
    48: "Chercheur en sciences du sport",
    50: "Responsable des kinés",
    58: "Analyste du recrutement",
    60: "Analyste des performances",
    62: "Responsable des analystes des performances",
    64: "Responsable de la formation des jeunes",
    66: "Propriétaire",
    70: "Président du club",
    86: "Responsable des prêts",
    88: "Directeur technique",
  },

  fields: {
    current_ability: "Niveau actuel",
    potential_ability: "Niveau potentiel",
    height: "Taille (cm)",
    date_of_birth: "Date de naissance",
    asking_price: "Prix demandé",
    nation: "Nationalité",
    "reputation.home": "Réputation à domicile",
    "reputation.current": "Réputation actuelle",
    "reputation.world": "Réputation mondiale",
    "international.caps": "Sélections",
    "international.goals": "Buts en équipe nationale",
    "international.u21_caps": "Sélections U21",
    "international.u21_goals": "Buts en U21",
    condition: "Énergie",
    match_sharpness: "Forme physique",
    jadedness: "Fatigue",
    morale: "Moral",
    "contract.wage": "Salaire hebdomadaire",
    "contract.loyalty_bonus": "Prime de fidélité hebdomadaire",
    "contract.happiness": "État d'esprit",
    "contract.playing_time_happiness": "Satisfaction temps de jeu",
    "contract.unhappiness": "Motifs de mécontentement",
    "contract.expires": "Fin du contrat",
    "contract.squad_number": "Numéro de maillot",
    "contract.squad_status": "Statut effectif",
    "contract.transfer_listed": "Sur liste des transferts",
    "contract.loan_listed": "Disponible en prêt",
    "loan.expires": "Fin du prêt",
    "loan.option_fee": "Option d'achat",
    "contract.job": "Fonction",
    "tie.nationality": "Deuxième nationalité",
    "tie.trainedInNation": "Formé au pays",
    "tie.trainedAtClub": "Formé au club",
    "tie.workPermit": "Pays sans permis de travail requis",
    club: "Club",
    injuries: "Blessures",
    cohesion: "Cohésion",
    bans: "Suspensions",
    retirement: "Départ à la retraite",
    clause: "Clause du contrat",
    "clause.amount": "Montant de la clause",
    "clause.condition": "Condition de la clause",
    captain: "Capitaine",
    vice_captain: "Vice-capitaine",
    reputation: "Réputation",
    "facilities.training": "Centre d'entraînement",
    "facilities.youth_facilities": "Structures de formation",
    "facilities.youth_coaching": "Encadrement des jeunes",
    "facilities.youth_recruitment": "Recrutement des jeunes",
    "facilities.corporate": "Loges VIP",
    "finance.balance": "Solde",
    "finance.transfer_budget": "Budget transferts",
    "finance.wage_budget": "Budget salarial",
    "finance.total_wage_budget": "Budget salarial total",
    "stadium.capacity": "Capacité du stade",
    "stadium.name": "Nom du stade",
    "stadium.seating": "Places assises",
    "stadium.used": "Capacité utilisée",
    "stadium.expansion": "Agrandissement du stade",
  },

  profile: {
    close: "Fermer le profil",
    loading: "Chargement du profil…",
    resize: "Redimensionner le panneau du profil",
    resizeHint: "Faites glisser pour élargir ou rétrécir le panneau\u00a0; double-cliquez pour le réinitialiser",
    none: "—",

    // En-tête
    freeAgent: "Libre de tout contrat",
    born: "Né le",
    height: (cm) => `${cm}\u00a0cm`,
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Niveau actuel",
    currentAbilityShort: "CA",
    potentialAbility: "Niveau potentiel",
    potentialAbilityShort: "PA",
    potentialRange: "Potentiel défini comme une plage",

    // Attributs
    technical: "Technique",
    goalkeeping: "Gardien de but",
    mental: "Mental",
    physical: "Physique",
    hidden: "Cachés",
    feet: "Pieds",
    personality: "Personnalité",
    raw: (raw, scale = 100) => `valeur brute ${raw} / ${scale}`,
    lowerIsBetter: "plus c'est bas, mieux c'est",
    age: (age) => `${age}\u00a0${plural(age) ? "ans" : "an"}`,

    // Postes
    positions: "Postes",
    positionsSummary: (best) => `Notes par poste\u00a0: ${best}`,
    positionRatings: "Notes par poste",
    positionTiers: {
      natural: "Naturel",
      accomplished: "Accompli",
      competent: "Convenable",
      unconvincing: "Médiocre",
      ineffective: "Inefficace",
    },
    positionTooltip: (position, rating, tier) => `${position} · ${rating} · ${tier}`,

    // Contrat
    contract: "Contrat",
    wage: "Salaire hebdomadaire",
    wageNote: (converted) =>
      converted
        ? "le jeu compte en livres\u00a0; affiché au taux de change de FM"
        : "le jeu compte en livres\u00a0; une autre devise peut être choisie dans les paramètres",
    signed: "Signature",
    expires: "Expire le",
    joined: "Arrivée",
    squadStatus: "Statut effectif",
    squadStatusName: (status) => SQUAD_STATUSES[status] ?? `Statut ${status}`,
    contractType: "Type de contrat",
    contractTypeName: (code) => CONTRACT_TYPES[code] ?? `Type ${code}`,
    squadNumber: "Numéro de maillot",
    transferListed: "Sur liste des transferts",
    loanListed: "Disponible en prêt",

    // Carrière
    career: "Carrière",
    internationalCaps: "Sélections",
    internationalGoals: "Buts en équipe nationale",
    u21Caps: "Sélections U21",
    u21Goals: "Buts en U21",
    askingPrice: "Prix demandé",
    notSet: "Non défini",
    reputation: "Réputation",
    reputationHome: "À domicile",
    reputationCurrent: "Actuelle",
    reputationWorld: "Mondiale",
    retirement: "Départ à la retraite",
    retires: "Retraite prévue",
    noRetirement: "Le jeu n'a pas prévu son départ à la retraite",
    keepPlaying: "Empêcher la retraite",
    keepingPlaying: "En cours…",
    keepPlayingTitle:
      "Retirer son départ à la retraite des plans du jeu et lui donner la caractéristique «\u00a0Jouera au football " +
      "le plus longtemps possible\u00a0» à la place de «\u00a0Prendra sa retraite au sommet\u00a0»\u00a0; annulable dans " +
      "Modifications",

    // Médical
    morale: (value) => `${value} / 20`,
    traits: "Caractéristiques",
    noTraits: "Aucune caractéristique",
    traitName: (bit) => TRAIT_NAMES_FR[bit] ?? `Caractéristique ${bit}`,
    unhappiness: "Mécontentement",
    noUnhappiness: "Rien ne le rend mécontent",
    removeUnhappiness: "Tout retirer",
    removingUnhappiness: "Retrait…",
    removeUnhappinessTitle:
      "Retirer de sa liste tous les motifs de mécontentement, comme le fait FMRTE\u00a0; annulable dans Modifications",
    concernSince: (date) => `depuis le ${date}`,
    concernKind: (kind) => (kind === 1 ? "Préoccupé" : kind === 2 ? "Interne" : `Type ${kind}`),
    concernMotive: (motive) => CONCERN_MOTIVES_FR[motive] ?? `Motif ${motive}`,
    clauses: "Primes et clauses",
    noClauses: "Aucune prime ni clause",
    loyaltyBonus: "Prime de fidélité",
    happiness: "État d'esprit",
    playingTimeHappiness: "Satisfaction temps de jeu",
    moodTitle: "Tel que FMRTE l'affiche, de -100 à 100\u00a0; le jeu l'affiche en mots",
    clauseName: (kind) => CLAUSE_NAMES_FR[kind] ?? `Clause ${kind}`,
    loan: "Prêt",
    loanAt: "En prêt à",
    loanParent: "Appartient à",
    loanFrom: "Début",
    loanUntil: "Fin",
    loanNumber: "Numéro au club d'accueil",
    recall: "Rappeler de prêt",
    recallTitle:
      "Le faire revenir dans son club\u00a0: le prêt se termine aujourd'hui. Demande confirmation avant tout changement",
    recallAgain: "Rappeler à nouveau",
    makePermanent: "Rendre définitif",
    makePermanentTitle:
      "Le garder dans le club où il est prêté, sous contrat avec ce club. Demande confirmation avant tout changement",
    recalledWaiting: "Rappelé · retour en attente",
    endsTodayWaiting: "Se termine aujourd'hui · retour en attente",
    pendingTitle: (parent) =>
      `Aujourd'hui est le dernier jour du prêt\u00a0: avancez d'un jour dans le jeu et il sera de retour à ${parent}.`,
    endPassed: (date) =>
      `Le prêt devait se terminer le ${date}, mais le jeu ne l'a pas fait revenir. Rappelez-le à nouveau, puis ` +
      "avancez d'un jour.",
    loanCanRecall: "Peut être rappelé",
    loanCanRecallTitle:
      "Si son club peut le rappeler dans le jeu. «\u00a0Rappeler de prêt\u00a0», ici, fonctionne dans tous les cas",
    loanCanTerminate: "Peut être écourté",
    loanCupMatches: "Peut jouer en coupe",
    loanAgainstClub: "Peut jouer contre son club",
    loanOptionFee: "Option d'achat",
    loanOptionFeeTitle: "Le montant pour lequel le club qui l'accueille en prêt peut le recruter définitivement",
    loanMonthlyFee: "Indemnité mensuelle",
    loanMonthlyFeeTitle: "Ce que le club qui l'accueille en prêt verse à son club pour chaque mois où il joue",
    loanUnusedFee: "Indemnité mensuelle joueur non utilisé",
    loanUnusedFeeTitle:
      "Ce que le club qui l'accueille en prêt verse à son club pour chaque mois où il n'est pas utilisé",
    clauseCondition: (kind, value) => {
      switch (kind) {
        case 10:
          return counted(value, "but", "buts");
        case 40:
          return counted(value, "passe décisive", "passes décisives");
        case 41:
          return counted(value, "but ou passe décisive", "buts et passes décisives");
        case 19:
          return counted(value, "sélection en équipe nationale", "sélections en équipe nationale");
        case 11:
        case 13:
        case 25:
        case 26:
          return counted(value, "match de championnat", "matchs de championnat");
        case 22:
        case 29:
          return counted(value, "an", "ans");
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value}\u00a0%`;
        default:
          return String(value);
      }
    },
    clauseExpires: (date) => `expire le ${date}`,
    clauseExpiresAfter: (count) => `expire ${counted(count, "jour", "jours")} après la signature`,
    clauseProfitShare: (percent, amount) => `${percent} du bénéfice au-delà de ${amount}`,
    clauseWage: (amount) => `${amount} par semaine`,
    moraleTitle:
      "Le jeu affiche le moral comme l'état d'esprit général du joueur\u00a0: satisfait à 10, plutôt heureux à 11, " +
      "extrêmement heureux à 15 et 20",
    jadednessTitle:
      "À quel point le joueur est usé par les matchs, ce que le repos efface\u00a0: -500 signifie complètement reposé, " +
      "et plus la valeur est élevée, plus il a besoin de repos",
    noInjuries: "Aucune blessure",
    unknownInjury: "Blessure inconnue",
    injuryStarted: (date) => `Depuis le ${date}`,
    injuryBack: (dates) => `Retour prévu\u00a0: ${dates}`,
    heal: "Soigner",
    healTitle: "Soigner toutes les blessures de ce joueur dans le jeu",
    noBans: "Aucune suspension",
    banMatches: (matches) => counted(matches, "match", "matchs"),
    banStarted: (date) => `Depuis le ${date}`,
    liftBans: "Lever",
    liftBansTitle: "Lever toutes les suspensions de ce joueur dans le jeu",

    // Au-dessus des attributs, pendant la lecture du profil
    maxAttributes: "Attributs au maximum",
    maxAttributesTitle:
      "Porter chaque attribut de ce joueur à son meilleur niveau\u00a0: 20, et 1 pour la tendance à se blesser et la " +
      "violence",
    maxAttributesDone: (count) =>
      count === 0 ? "Tous les attributs sont déjà au maximum" : `${changes(count)} écrite${agree(count)}`,
    maxAttributesUndone: (count) =>
      count === 0 ? "Rien n'a été annulé" : `${changes(count)} annulée${agree(count)}`,
    undoMax: "Annuler",
    undoMaxTitle: "Réécrire ses anciens attributs dans le jeu",
    freezeAttributes: "Bloquer les attributs",
    freezeAttributesNote:
      "Tant que l'application est ouverte et connectée, ses attributs ne baissent pas\u00a0: ce que le jeu retire est " +
      "remis, et les progrès comptent toujours. L'application s'en souvient pour cette partie, et les bloque à nouveau " +
      "quand elle s'y connecte.",
    maxStaffAttributesTitle: "Porter chaque attribut de ce membre du staff à son meilleur niveau\u00a0: 20",
    undoMaxStaffTitle: "Réécrire les anciens attributs dans le jeu",
    freezeStaffAttributesNote:
      "Tant que l'application est ouverte et connectée, ses attributs ne baissent pas\u00a0: ce que le jeu retire est " +
      "remis, et les progrès comptent toujours. L'application s'en souvient pour cette partie, et les bloque à nouveau " +
      "quand elle s'y connecte.",
    freezeFitness: "Bloquer l'énergie et la forme physique",
    freezeFitnessNote:
      "Tant que l'application est ouverte et connectée, son énergie et sa forme physique ne baissent pas\u00a0: ce que " +
      "le jeu retire est remis, et les gains comptent toujours\u00a0; à 100\u00a0%, il y reste donc. L'application s'en " +
      "souvient pour cette partie.",
    freezePositions: "Bloquer",
    freezePositionsInfo: "Que fait le blocage des postes\u00a0?",
    freezePositionsNote:
      "Tant que l'application est ouverte et connectée, ses notes par poste restent telles quelles\u00a0: il n'apprend " +
      "pas de nouveau poste, et ses notes ne montent ni ne baissent. L'application s'en souvient pour cette partie.",

    // Staff
    you: "Vous",
    youTitle: "L'entraîneur que vous contrôlez dans cette partie",
    id: "ID",
    job: "Fonction",
    changeJob: "Changer de fonction",
    changeJobTitle: "Donner à ce membre du staff une autre fonction dans son club, dans le jeu",
    newJob: "Nouvelle fonction",
    applyJob: "Appliquer",
    cancelJob: "Annuler",
    unemployed: "Sans emploi",
    coaching: "Entraînement",
    knowledge: "Connaissances",
    medical: "Médical",
    playerCoach: (job) => `${job} (joueur-entraîneur)`,
    unknownJob: (code) => `Fonction ${code}`,
  },

  playerList: {
    nav: "Joueurs",
    count: (total) => playerCount(total),
    search: "Rechercher des joueurs par nom ou UID",
    summary: (total, shown, sorted) => {
      const count = playerCount(total);
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · les ${shown} premiers par niveau actuel`
        : `${count} · les ${shown} premiers par ${sorted.by}, ordre ${sorted.ascending ? "croissant" : "décroissant"}`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Aucun joueur ne correspond à ces filtres." : "Aucun joueur trouvé.";
      }
      return filtered
        ? `Aucun joueur ne correspond à «\u00a0${query}\u00a0» avec ces filtres.`
        : `Aucun joueur ne correspond à «\u00a0${query}\u00a0».`;
    },
    columns: {
      name: "Nom",
      age: "Âge",
      positions: "Postes",
      nation: "Pays",
      club: "Club",
      contractExpires: "Contrat",
      born: "Né le",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    },
    sortBy: (by) => `Trier par ${by}`,
    sortNames: {
      currentAbility: "niveau actuel",
      potentialAbility: "niveau potentiel",
      age: "âge",
      name: "nom",
      nation: "pays",
      club: "club",
      contractExpires: "fin du contrat",
    },
    filters: {
      toggle: "Filtres",
      toggleActive: (count) => `Filtres, ${count} actif${agree(count)}`,
      clear: "Effacer",
      any: "Tous",
      position: "Poste",
      gender: "Sexe",
      men: "Hommes",
      women: "Femmes",
      age: "Âge",
      minAge: "Âge minimum",
      maxAge: "Âge maximum",
      minPlaceholder: "Min",
      maxPlaceholder: "Max",
      minCurrentAbility: "CA min",
      minCurrentAbilityTitle: "Niveau actuel minimum",
      minPotentialAbility: "PA min",
      minPotentialAbilityTitle: "Niveau potentiel minimum",
      abilityPlaceholder: "1–200",
      nation: "Pays",
      club: "Club",
      freeAgentsOnly: "Joueurs libres uniquement",
      contractEndsBy: "Fin de contrat au plus tard le",
      transferListedOnly: "Sur liste des transferts uniquement",
      loanListedOnly: "Disponibles en prêt uniquement",
      attributes: {
        heading: "Attributs",
        attribute: "Attribut",
        pick: "Choisissez un attribut",
        min: (name) => (name ? `${name}\u00a0: minimum` : "Minimum"),
        max: (name) => (name ? `${name}\u00a0: maximum` : "Maximum"),
        add: "Ajouter un attribut",
        remove: (name) => (name ? `Retirer ${name}` : "Retirer cette ligne"),
      },
      saved: {
        save: "Enregistrer",
        saveTitle: "Enregistrer sous un nom les filtres et le tri en cours",
        name: "Nom du filtre enregistré",
        namePlaceholder: "Nom du filtre",
        ok: "OK",
        cancel: "Annuler",
        select: "Filtres enregistrés",
        delete: "Supprimer",
        deleteTitle: (name) => `Supprimer le filtre enregistré\u00a0: ${name}`,
        replaceQuestion: (name) => `Un filtre enregistré nommé «\u00a0${name}\u00a0» existe déjà. Le remplacer\u00a0?`,
        replace: "Remplacer",
        full: (max) =>
          `Vous pouvez enregistrer jusqu'à ${max} filtres. Supprimez-en d'abord un, ou utilisez le nom d'un filtre ` +
          "enregistré pour le remplacer.",
      },
    },
  },

  staffList: {
    nav: "Staff",
    count: (total) => counted(total, "membre du staff", "membres du staff"),
    search: "Rechercher le staff par nom ou ID",
    summary: (total, shown, sorted) => {
      const count = counted(total, "membre du staff", "membres du staff");
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · les ${shown} premiers par niveau actuel`
        : `${count} · les ${shown} premiers par ${sorted.by}, ordre ${sorted.ascending ? "croissant" : "décroissant"}`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Aucun membre du staff ne correspond à ces filtres." : "Aucun membre du staff trouvé.";
      }
      return filtered
        ? `Aucun membre du staff ne correspond à «\u00a0${query}\u00a0» avec ces filtres.`
        : `Aucun membre du staff ne correspond à «\u00a0${query}\u00a0».`;
    },
    columns: {
      name: "Nom",
      age: "Âge",
      job: "Fonction",
      club: "Club",
      nation: "Pays",
      born: "Né le",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    },
    sortBy: (by) => `Trier par ${by}`,
    sortNames: {
      currentAbility: "niveau actuel",
      potentialAbility: "niveau potentiel",
      age: "âge",
      name: "nom",
      nation: "pays",
      club: "club",
    },
    filters: {
      job: "Fonction",
      anyJob: "Toutes",
      unemployedOnly: "Sans emploi uniquement",
    },
  },

  clubProfile: {
    // En-tête
    womensClub: "Club féminin",
    founded: (year) => `Établi en ${year}`,
    reputationShort: "RÉP",
    reputationTitle: "Réputation",

    tabsLabel: "Sections du club",
    tabs: { overview: "Vue d'ensemble", squad: "Effectif", stadium: "Stade" },
    squadLocked: "Terminez la modification pour ouvrir l'effectif",

    facilities: "Infrastructures",

    // Supporters
    supporters: "Supporters",
    supporterMix: "Profil des supporters",
    percent: (value) => `${percents.format(value)}\u00a0%`,
    mixTooltip: (kind, percent) => `${kind} · ${percent}`,

    // Finances
    finances: "Finances",
    balance: "Solde",
    transferBudget: "Budget transferts",
    wageBudget: "Budget salarial (dépenses)",
    totalWageBudget: "Budget salarial total",
    ticketPrice: "Prix moyen des places",
    perWeek: "par semaine",
    noFinances: "FM ne garde les finances que pour les clubs des championnats joués.",
    freeze: "Bloquer l'argent",
    freezeNote:
      "Tant que l'application est ouverte et connectée, le solde ne baisse pas\u00a0: ce que le jeu retire est remis, et " +
      "les revenus comptent toujours. L'application s'en souvient pour cette partie, et le bloque à nouveau quand elle " +
      "s'y connecte.",

    // Stade
    stadium: "Stade",
    capacity: "Capacité",
    seating: "Places assises",
    used: "Utilisée",
    usedAll: "Totale",
    usedTitle:
      "La part de la capacité que le jeu laisse entrer, quand il la limite (par exemple pendant que des places sont " +
      "fermées)\u00a0; 0 signifie la totalité",
    expansion: "Agrandissement possible jusqu'à",
    noStadium: "Impossible de lire le stade de ce club.",
    stadiumName: "Nom",
    rename: "Renommer",
    renameTitle: "Donner un autre nom au stade\u00a0; il est écrit aussitôt, et annulable dans Modifications",
    renameInfoLabel: "Comment fonctionne le renommage\u00a0?",
    renameInfo:
      "Le jeu ne garde aucun nom de stade dans ses sauvegardes\u00a0: il les reprend de sa base de données chaque fois " +
      "qu'il charge une partie. FMLibreEditor retient donc le nouveau nom pour cette partie, et le remet en quelques " +
      "secondes chaque fois que le jeu la charge, tant que l'application est ouverte et connectée. Si le jeu charge la " +
      "partie alors que l'application est fermée, il affiche son propre nom jusqu'à ce que l'application se reconnecte. " +
      "Pour revenir à l'ancien nom, annulez le renommage dans Modifications, ou renommez à nouveau le stade.",
    saveName: "Enregistrer",
    renaming: "Enregistrement…",
    cancelRename: "Annuler",
    nameLength: (bytes, min, max) =>
      min <= 1
        ? `${counted(bytes, "caractère", "caractères")} sur ${max} au maximum (une lettre accentuée compte pour deux)`
        : `${counted(bytes, "caractère", "caractères")}\u00a0: de ${min} à ${max}, pour tenir là où le jeu garde le ` +
          "nom (une lettre accentuée compte pour deux)",
    nameShared: (holders) =>
      `${counted(holders, "élément du jeu porte", "éléments du jeu portent")} ce nom\u00a0: il ne peut donc pas être ` +
      "changé pour le stade seul",

    // Infos club
    info: "Infos club",
    seasonTickets: "Abonnements",
    socialMedia: "Followers sur les réseaux sociaux",
  },

  clubList: {
    nav: "Clubs",
    count: (total) => counted(total, "club", "clubs"),
    search: "Rechercher des clubs par nom ou UID",
    summary: (total, shown) =>
      total > shown
        ? `${counted(total, "club", "clubs")} · les ${shown} premiers par réputation`
        : counted(total, "club", "clubs"),
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Aucun club ne correspond à ce filtre." : "Aucun club trouvé.";
      }
      return filtered
        ? `Aucun club ne correspond à «\u00a0${query}\u00a0» avec ce filtre.`
        : `Aucun club ne correspond à «\u00a0${query}\u00a0».`;
    },
    women: "Féminin",
    columns: {
      name: "Nom",
      reputation: "Réputation",
      founded: "Établi en",
      uid: "UID",
    },
    filters: {
      kind: "Clubs à afficher",
      all: "Tous les clubs",
      men: "Clubs masculins",
      women: "Clubs féminins",
    },
  },

  app: {
    stage: "bêta",
    settingsLabel: "Paramètres",
    languageLabel: "Langue",
    currencyLabel: "Devise",

    noteEditable:
      "Les modifications n'atteignent le jeu que lorsque vous les appliquez. Faites d'abord une copie de sauvegarde de " +
      "votre partie.",
    noteReadOnly: "Lecture seule\u00a0: Windows n'a pas laissé FMLibreEditor écrire dans le jeu.",
    noteUnknownBuild: "Lecture seule\u00a0: cette version du jeu est nouvelle pour FMLibreEditor.",
    noteNotConnected: "Rien ne change dans le jeu tant que vous n'avez pas modifié puis appliqué.",

    notConnected: "Non connecté",
    previewTag: "aperçu dans le navigateur · données d'exemple",
    noDate: "Aucune date de jeu",
    noDateTitle:
      "FMLibreEditor n'a pas pu lire la date du jeu dans cette version du jeu\u00a0: les âges ne sont donc pas affichés " +
      "et les filtres d'âge ne trouvent personne. Vérifiez s'il existe des mises à jour.",
    reload: "Recharger les données",
    refresh: "Actualiser",
    detecting: "Recherche de Football Manager…",
    connecting: "Lecture des joueurs, du staff et des clubs…",
    reloading: "Relecture des joueurs, du staff et des clubs…",

    /**
     * The notice under the masthead once the game has loaded a save, or gone back to its main menu, since the data was
     * read (`SaveChangedNotice`), beside a Reload data button.
     */
    saveChanged: {
      title: "La partie du jeu a changé",
      text:
        "Le jeu a chargé une partie, ou est revenu à son menu principal, depuis que FMLibreEditor l'a lu. Tant que vous " +
        "ne rechargez pas les données, il ne modifie rien dans le jeu et ne maintient aucun blocage\u00a0: ce qu'il affiche " +
        "peut appartenir à une autre partie.",
    },

    refrozen: {
      title: "De nouveau bloqués, comme la dernière fois",
      waitingTitle: "Ce qui était bloqué attend pour l'instant",
      players: (names) => `Attributs\u00a0: ${names}`,
      staff: (names) => `Attributs du staff\u00a0: ${names}`,
      clubs: (names) => `Argent\u00a0: ${names}`,
      fitness: (names) => `Énergie et forme physique\u00a0: ${names}`,
      positions: (names) => `Postes\u00a0: ${names}`,
      stadiums: (names) => `Noms de stade\u00a0: ${names}`,
      more: (count) => `et ${counted(count, "autre", "autres")}`,
      waiting: (count) =>
        `${plural(count) ? `${format(count)} éléments sont mémorisés` : `${format(count)} élément est mémorisé`} ` +
        `mais pas bloqué${agree(count)} pour l'instant\u00a0: FMLibreEditor ne peut pas encore écrire dans cette ` +
        "version du jeu.",
      dismiss: "Fermer",
    },

    freezeInfo: {
      label: "Comment fonctionne le blocage\u00a0?",
      note:
        "Le blocage ne modifie pas le jeu définitivement\u00a0: toutes les 2 secondes, FMLibreEditor remet ce que le jeu " +
        "a retiré. Il ne fonctionne donc que tant que l'application est ouverte et connectée\u00a0; fermez-la, et le jeu " +
        "recommence à modifier ces valeurs. L'application se souvient de ce qui est bloqué dans cette partie, et le " +
        "bloque à nouveau la prochaine fois qu'elle s'y connecte.",
    },

    connect: {
      title: "Se connecter à Football Manager 27",
      intro:
        "FMLibreEditor lit la mémoire du jeu pendant qu'il tourne. Lancez le jeu et chargez une partie, puis " +
        "connectez-vous.",
      notRunning: "Football Manager 27 n'est pas lancé.",
      openFailed: (error) => `Impossible d'ouvrir le jeu\u00a0: ${error}`,
      game: "Jeu",
      gameData: "Données du jeu",
      loaded: "Chargées",
      stillLoading: "Chargement en cours\u00a0; attendez le menu principal",
      process: "Processus",
      pid: (pid) => `PID ${pid}`,
      several: "Plusieurs copies du jeu sont lancées\u00a0; la première est utilisée.",
      button: "Se connecter et lire les joueurs, le staff et les clubs",

      bridge: {
        title: "Le bridge (macOS)",
        intro:
          "macOS ne laisse aucune application accéder à la mémoire d'une autre\u00a0: FM27 doit donc transmettre sa " +
          "mémoire lui-même. Il le fait dès qu'il charge le bridge de FMLibreEditor\u00a0: une petite bibliothèque qui " +
          "n'intercepte et ne modifie rien dans le jeu, et ne donne sa mémoire qu'à cette application. Une option de " +
          "lancement dans Steam fait charger le bridge par FM27.",
        library: "Bridge",
        installed: "Installé",
        missing: "Non installé",
        launchOption: "Option de lancement",
        set: "Définie dans Steam",
        notSet: "Non définie",
        ready:
          "Prêt. Lancez FM27 depuis Steam (quittez-le et relancez-le s'il est ouvert), chargez une partie, puis " +
          "connectez-vous.",
        steamRunning:
          "Steam est ouvert, et garde les options de lancement tant qu'il l'est. Quittez Steam pour que l'option de " +
          "lancement soit définie pour vous, ou saisissez-la vous-même dans Steam.",
        setUp: "Installer le bridge",
        remove: "Supprimer le bridge",
        manual:
          "Ou, dans Steam, faites un clic droit sur Football Manager 27 › Propriétés › Général › Options de lancement, " +
          "et saisissez\u00a0:",
        copy: "Copier",
        copied: "Copié",
      },
    },
  },

  graphics: {
    reading: "Lecture des packs graphiques…",
    summary: ({ clubLogos, flags, faces }) =>
      `Graphismes\u00a0: ${counted(clubLogos, "logo de club", "logos de club")} · ` +
      `${counted(flags, "drapeau", "drapeaux")} · ${counted(faces, "visage", "visages")}`,
    none: "Aucun pack graphique trouvé",
    noneHint: "Les packs de logos et de visages vont dans le dossier graphics de FM27.",
  },

  compatibility: {
    unknownBuild: (game) => `FMLibreEditor n'a pas encore été vérifié avec ${game}`,
    unknownBuildText:
      "Le jeu a probablement été mis à jour. FMLibreEditor a trouvé les données du jeu et les a vérifiées, mais il " +
      "n'écrit pas dans une version avec laquelle il n'a pas été testé tant que vous ne l'autorisez pas. Un nouveau " +
      "FMLibreEditor suit généralement en quelques jours.",
    allowedText:
      "La modification est activée pour cette session, dans la limite des vérifications. Gardez une copie de " +
      "sauvegarde de votre partie.",
    failedTitle: "Certaines données du jeu n'ont pas passé les vérifications",
    reloadHint: "Si une partie était encore en cours de chargement, «\u00a0Recharger les données\u00a0» vérifie à nouveau.",
    noDate: "La date du jeu n'a pas passé les vérifications\u00a0: aucun âge n'est donc affiché.",
    failed: (names) => `En lecture seule\u00a0: ${names}.`,
    failedCheck: (name, fit, sampled) =>
      `${name} (${format(fit)} sur ${format(sampled)} conforme${agree(fit)})`,
    join: (names) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`,
    allow: "Modifier quand même",
    allowTitle:
      "Activer la modification jusqu'à ce que FMLibreEditor soit fermé ou se reconnecte. Faites d'abord une copie de " +
      "sauvegarde de votre partie.",
  },

  diagnostics: {
    copy: "Copier le diagnostic",
    copyTitle:
      "Copier ce que FMLibreEditor a trouvé dans le jeu, pour le coller dans un rapport de bug. Ne contient ni noms ni " +
      "chemins.",
    copied: "Copié",
    failed: (reason) => `Impossible de copier le diagnostic\u00a0: ${reason}`,
  },

  checks: {
    gameDate: "la date du jeu",
    players: "les données des joueurs",
    abilities: "le niveau actuel et le potentiel",
    positions: "les postes",
    attributes: "les attributs",
    personality: "la personnalité",
    liveValues: "l'énergie, la forme physique, la fatigue et le moral",
    contracts: "les contrats",
    teams: "les équipes",
    staff: "le staff",
    clubs: "les clubs",
    cohesion: "la cohésion avec les clubs",
  },

  update: {
    available: (version) => `FMLibreEditor ${version} est disponible`,
    youHave: (version) => `Vous avez la version ${version}.`,
    download: "Télécharger",
    install: "Mettre à jour",
    installTitle: "Télécharger et installer la nouvelle version\u00a0; FMLibreEditor se ferme et se rouvre avec elle",
    preparing: "Préparation…",
    downloading: (percent) => (percent === null ? "Téléchargement…" : `Téléchargement… ${percent}\u00a0%`),
    installing: "Installation\u00a0: FMLibreEditor se ferme et se rouvre avec la nouvelle version.",
    installFailed: (reason) => `Mise à jour impossible\u00a0: ${reason}. Téléchargez-la plutôt depuis sa page.`,
    notInstallable: "Cette version ne peut pas être installée d'ici. Téléchargez-la plutôt depuis sa page.",
    later: "Plus tard",
    check: "Rechercher des mises à jour",
    checking: "Recherche de mises à jour…",
    upToDate: "Vous avez la dernière version.",
    failed: "Impossible de rechercher des mises à jour.",
  },

  edit: {
    unknownNation: "Pays inconnu",
    edit: "Modifier",
    editTitle: "Modifier les valeurs de ce profil dans le jeu",
    startFailed: (reason) => `Impossible de commencer la modification\u00a0: ${reason}`,
    positionRating: (position) => `Note au poste ${position}`,
    was: (value) => `avant\u00a0: ${value}`,
    invalid: (min, max) => `Saisissez un nombre entier de ${min} à ${max}`,
    invalidDate: (from, to) => `Saisissez une date du ${from} au ${to}`,
    invalidMoney: (from, to) => `Saisissez un montant entier de ${from} à ${to}`,
    invalidPercentage: (from, to) => `Saisissez un pourcentage entier de ${from} à ${to}`,
    percent: "%",
    yes: "Oui",
    no: "Non",
    none: "aucun",

    // Le pied de page
    footer: "Modification en cours",
    changes: changeCount,
    invalidCount: (count) => `${count} non valide${agree(count)}`,
    review: "Revoir",
    reviewList: "Modifications à appliquer",
    discard: "Abandonner",
    apply: "Appliquer",
    applying: "Application…",
    applyBlocked: "Corrigez d'abord les valeurs non valides",
    done: "Terminé",
    confirmDiscard: (count) => `Abandonner ${changes(count)}\u00a0?`,
    keepEditing: "Continuer à modifier",

    // Après Appliquer
    applied: (count) => `${changes(count)} appliquée${agree(count)}`,
    nothingToChange: "Rien à changer\u00a0: le jeu a déjà ces valeurs.",
    refused: (label, reason) => `${label}\u00a0: ${reason}`,
    rereadFailed: (reason) => `Impossible de relire les valeurs\u00a0: ${reason}`,
    dismiss: "Fermer",
  },

  changes: {
    nav: "Modifications",
    title: "Modifications de cette session",
    hint:
      "Les plus récentes d'abord. Une modification ne peut être annulée que tant que le jeu garde la valeur qu'elle a " +
      "écrite.",
    continueHint: "Le jeu affiche une modification une fois qu'il avance\u00a0: appuyez sur Continuer dans le jeu.",
    swappedWith: (name) => `Échange avec ${name}`,
    released: (name) => `Libération ${de(name)}`,
    fee: (amount) => `Montant\u00a0: ${amount}`,
    optionRemoved: (amount) => `Option d'achat (${amount}) supprimée`,
    healed: (count) => counted(count, "blessure soignée", "blessures soignées"),
    lifted: (count) => counted(count, "suspension levée", "suspensions levées"),
    keptPlaying: (date) => (date === null ? "Continuera à jouer" : `Retraite prévue le ${date} annulée`),
    count: (total, undone) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${format(undone)} annulée${agree(undone)}`;
    },
    empty:
      "Aucune modification pour l'instant. Ouvrez un joueur, un membre du staff ou un club et choisissez Modifier, ou " +
      "utilisez Modification groupée dans une liste.",
    columns: {
      time: "Heure",
      name: "Nom",
      field: "Champ",
      change: "Modification",
      status: "Statut",
    },
    kinds: { player: "Joueur", staff: "Staff", club: "Club" },
    stored: (change) => `valeur brute ${change}`,
    undone: (time) => `Annulée à ${time}`,
    undo: "Annuler",
    undoTitle: (label) => `Réécrire dans le jeu l'ancienne valeur de «\u00a0${label}\u00a0»`,
    batch: "Modification groupée",
    batchCount: (total, remaining) =>
      remaining === 0
        ? `${changeCount(total)} · ${plural(total) ? "toutes annulées" : "annulée"}`
        : `${changeCount(total)} · ${format(remaining)} non annulée${agree(remaining)}`,
    showChanges: "Afficher les modifications",
    hideChanges: "Masquer les modifications",
    undoBatch: "Annuler la modification groupée",
    undoBatchTitle: (remaining) =>
      `Réécrire dans le jeu les anciennes valeurs de cette modification groupée (${format(remaining)} encore en place)`,

    pages: "Pages de la liste",
    batchPages: "Pages des modifications de cette modification groupée",
    previous: "Précédent",
    next: "Suivant",
    range: (first, last, total) => `${format(first)}–${format(last)} sur ${format(total)}`,
  },

  export: {
    button: "Exporter",
    buttonTitle: {
      player: "Écrire les joueurs affichés par la liste dans un fichier CSV ou JSON, pour un tableur ou un script",
      staff:
        "Écrire les membres du staff affichés par la liste dans un fichier CSV ou JSON, pour un tableur ou un script",
      club: "Écrire les clubs affichés par la liste dans un fichier CSV ou JSON, pour un tableur ou un script",
    },
    title: { player: "Exporter les joueurs", staff: "Exporter le staff", club: "Exporter les clubs" },
    scope: (entity, count) =>
      count === 0
        ? `Aucun ${nouns[entity].one} ne correspond à la recherche et aux filtres.`
        : `${entityCount(entity, count)}\u00a0: ce que sélectionnent la recherche et les filtres de la liste, dans son ` +
          "ordre.",
    formatLabel: "Format",
    formats: {
      csv: "CSV, séparateur virgule",
      csvSemicolon: "CSV, séparateur point-virgule",
      json: "JSON",
    },
    formatHints: {
      csv: "Pour la plupart des tableurs et des scripts",
      csvSemicolon:
        "Pour Excel quand les décimales s'écrivent avec une virgule\u00a0: en français, en espagnol ou en allemand, par " +
        "exemple",
      json: {
        player: "Pour les scripts\u00a0: les postes, les attributs et la personnalité en objets à part",
        staff: "Pour les scripts\u00a0: les attributs, la personnalité et le contrat en objets à part",
        club: "Pour les scripts\u00a0: les supporters, les infrastructures, le stade et les finances en objets à part",
      },
    },
    contents: {
      player:
        "Pour chaque joueur\u00a0: niveaux, postes et notes par poste, attributs sur l'échelle 1–20 (y compris les " +
        "attributs cachés), personnalité, réputation, sélections, et contrat avec ses clauses, avec la date du jeu. " +
        "L'argent est en livres, comme le jeu le garde. Rien ne change dans le jeu.",
      staff:
        "Pour chaque membre du staff\u00a0: fonction et club, niveaux, attributs sur l'\u00e9chelle 1\u201320, personnalit\u00e9, " +
        "r\u00e9putation et contrat (salaire et dates), avec la date du jeu. L'argent est en livres, comme le jeu le garde. " +
        "Rien ne change dans le jeu.",
      club:
        "Pour chaque club\u00a0: réputation, année de fondation, abonnements, followers sur les réseaux sociaux, profil " +
        "et caractéristiques des supporters, infrastructures, stade et finances (solde, budget transferts, dépenses " +
        "salariales et budget salarial hebdomadaires, prix des places), avec la date du jeu. FM ne garde les finances " +
        "que pour les clubs des championnats joués. L'argent est en livres, comme le jeu le garde. Rien ne change dans " +
        "le jeu.",
    },
    export: "Exporter",
    exporting: "Exportation…",
    done: (entity, count, file) => `${entityCount(entity, count)} exporté${agree(count)} dans ${file}`,
    folder: (folder) => `dans ${folder}`,
    skipped: (entity, count) =>
      plural(count)
        ? `${entityCount(entity, count)} ont changé dans le jeu pendant leur lecture et ont été exclus.`
        : `${entityCount(entity, count)} a changé dans le jeu pendant sa lecture et a été exclu.`,
    open: "Ouvrir",
    openTitle: "Ouvrir le fichier avec l'application que votre système lui associe",
    show: "Afficher dans le dossier",
    showTitle: "Afficher le fichier dans son dossier",
    close: "Fermer",
  },

  massEdit: {
    button: "Modification groupée",
    buttonTitle: "Modifier les valeurs de tout ce qu'affiche la liste, avec d'abord un aperçu",
    title: {
      player: "Modification groupée des joueurs",
      staff: "Modification groupée du staff",
      club: "Modification groupée des clubs",
    },

    // Ce à quoi elle s'applique
    scope: (entity, total) =>
      `${entityCount(entity, total)} affiché${agree(total)} actuellement par la liste (recherche et filtres)`,
    scopeAll: (shown) =>
      `C'est-à-dire tous les résultats, pas seulement les ${format(shown)} premières lignes à l'écran.`,
    scopeNone: (entity) =>
      `Aucun ${nouns[entity].one} ne correspond à la recherche et aux filtres\u00a0: il n'y a rien à modifier.`,
    scopeTooMany: (entity, total, limit) =>
      `${entityCount(entity, total)} affiché${agree(total)} par la liste\u00a0: c'est plus qu'une modification groupée ` +
      `n'en accepte (${format(limit)}). Affinez d'abord la recherche ou les filtres.`,
    loadingFields: "Lecture des champs…",
    fieldsFailed: (reason) => `Impossible de lire les champs\u00a0: ${reason}`,

    // Les champs à modifier
    groups: {
      ability: "Niveau",
      technical: "Attributs techniques",
      mental: "Attributs mentaux",
      physical: "Attributs physiques",
      goalkeeping: "Attributs de gardien",
      hidden: "Attributs cachés",
      feet: "Pieds",
      coaching: "Attributs d'entraînement",
      knowledge: "Attributs de connaissances",
      medical: "Attributs médicaux",
      positions: "Postes",
      personality: "Personnalité",
      reputation: "Réputation",
      international: "Sélection nationale",
      contract: "Contrat",
      facilities: "Infrastructures",
      finances: "Finances",
      stadium: "Stade",
      traits: "Caractéristiques",
      health: "Médical",
      other: "Autres",
    },
    fieldsLabel: "Champs à modifier",
    row: (position) => `Modification ${position}`,
    field: "Champ",
    operation: "Opération",
    operations: { set: "Fixer à", add: "Ajouter", scale: "Porter à %" },
    values: { set: "Valeur", add: "Quantité", scale: "Pourcentage" },
    addTitle: "Ajouté à chaque valeur telle qu'elle est affichée\u00a0; un nombre négatif retire",
    addPointsTitle:
      "Points de pourcentage ajoutés à chaque valeur (70\u00a0% plus 10 font 80\u00a0%)\u00a0; un nombre négatif retire",
    rangeHint: (min, max) => `${format(min)}–${format(max)}`,
    amountHint: (max) => `±${format(max)}`,
    ofCurrent: "% de la valeur actuelle",
    percentTitle:
      "Un pourcentage de la valeur actuelle\u00a0: 100 la garde, 110 l'augmente d'un dixième, 50 la divise par deux",
    invalidAdd: (min, max) => `Saisissez un nombre entier de ${format(min)} à ${format(max)}`,
    invalidPercent: (min, max) => `Saisissez un pourcentage entier de ${min} à ${max}`,
    dateSetOnly: "Une date peut seulement être fixée",
    addField: "Ajouter un champ",
    addFieldFull: (max) => `Une modification groupée change au plus ${max} champs`,
    remove: "Retirer ce champ",
    removeLast: "Une modification groupée nécessite au moins un champ",

    // L'aperçu
    preview: "Aperçu",
    previewing: "Aperçu en cours…",
    previewBlocked: "Remplissez chaque champ avec une valeur valide pour obtenir un aperçu",
    summary: (entity, preview) =>
      [
        preview.changes === 0
          ? "Aucune modification"
          : `${changeCount(preview.changes)} pour ${format(preview.targets - preview.unchanged)} sur ` +
            entityCount(entity, preview.targets),
        preview.unchanged > 0 &&
          (plural(preview.unchanged)
            ? `${format(preview.unchanged)} ont déjà ces valeurs`
            : `${format(preview.unchanged)} a déjà ces valeurs`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Modifications que ferait la modification groupée",
    columns: { name: "Nom", field: "Champ", change: "Modification", reason: "Raison" },
    more: (count) => `et ${counted(count, "autre", "autres")}`,
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Valeurs que la modification groupée laisse telles quelles",

    // Appliquer et annuler
    apply: "Appliquer",
    applying: "Application…",
    applyTitle: (count) =>
      count === 0 ? "Aucune modification à écrire dans le jeu" : `Écrire ${changes(count)} dans le jeu`,
    applyFirst: "Faites d'abord l'aperçu de la modification groupée",
    applyNothing: "L'aperçu ne contient aucune modification à écrire",
    hint: "Rien ne change dans le jeu tant que vous n'appliquez pas.",
    applied: (count) =>
      count === 0 ? "Aucune modification n'a été écrite" : `${changes(count)} appliquée${agree(count)}`,
    failure: (name, label, reason) => `${name} · ${label}\u00a0: ${reason}`,
    undo: "Annuler cette modification groupée",
    undoing: "Annulation…",
    undoTitle: "Réécrire dans le jeu les anciennes valeurs de cette modification groupée",
    undone: (count) => (count === 0 ? "Rien n'a été annulé" : `${changes(count)} annulée${agree(count)}`),
    undoFailure: (who, reason) => `${who}\u00a0: ${reason}`,
    changeNumber: (id) => `Modification n°\u00a0${id}`,
    close: "Fermer",
  },

  comparison: {
    compare: "Comparer",
    add: "Ajouter à la comparaison",
    remove: "Retirer de la comparaison",
    full: (max) => `Une comparaison contient au plus ${max} joueurs. Retirez-en un pour ajouter ce joueur.`,

    trayLabel: "Joueurs à comparer",
    removePlayer: (name) => `Retirer de la comparaison\u00a0: ${name}`,
    clear: "Effacer",
    open: (count) => `Comparer (${count})`,

    title: "Comparaison",
    hint:
      "La meilleure valeur de chaque ligne est mise en évidence\u00a0: la plus haute, ou la plus basse là où plus bas " +
      "vaut mieux.",
    tooFew: "Ajoutez au moins deux joueurs pour les comparer.",
    loading: "Chargement des joueurs…",
    tableLabel: "Valeurs des joueurs comparés",
    highest: "la plus haute",
    lowest: "la plus basse",
    profile: "Profil",
    close: "Fermer",
  },

  move: {
    button: "Transférer",
    buttonTitle: "Transférer ce joueur dans un autre club dans le jeu, contre un montant si vous le souhaitez",

    // La fenêtre
    title: "Transfert",
    from: "De",
    to: "Vers",

    modeLabel: "Transfert ou échange",
    modeMove: "Transférer vers un club",
    modeSwap: "Échanger avec un joueur",

    // Le choix du club
    searchLabel: "Rechercher le club où le transférer",
    resultsLabel: "Clubs trouvés",
    searching: "Recherche des clubs…",
    searchFailed: (reason) => `Impossible de rechercher les clubs\u00a0: ${reason}`,
    more: (count) => `et ${counted(count, "autre", "autres")}\u00a0; tapez pour affiner la recherche`,
    change: "Choisir un autre club",

    // Le montant
    feeHeading: "Montant",
    fee: "Montant du transfert",
    feeHint: "Laissez vide pour un transfert libre",
    feeInvalid: (max) => `Saisissez un montant entier, de 0 à ${max}`,
    pays: (club, fee, balance, budget) =>
      `${club} paie ${fee}\u00a0: solde ${balance}${budget === null ? "" : `, budget transferts ${budget}`}`,
    receives: (club, fee, balance) => `${club} reçoit ${fee}\u00a0: solde ${balance}`,
    noFinances: (club) => `${club} n'a pas de finances dans le jeu\u00a0: son argent reste tel quel`,

    // Le contrat
    wageInvalid: "Saisissez un montant entier, 0 ou plus",
    expiresInvalid: "Saisissez une date",

    // Ce que dit la fenêtre du transfert
    chooseClub: "Choisissez le club où transférer le joueur.",
    fixTerms: "Corrigez d'abord le montant ou les valeurs du contrat.",
    checking: "Vérification du transfert…",
    route: (from, to) => `${from} → ${to}`,
    doesHeading: "Ce que fait le transfert",
    does: [
      "Rejoint l'équipe première du nouveau club",
      "Contrat daté de la date du jeu\u00a0; numéro de maillot effacé",
      "Sort de la liste des transferts et de celle des prêts",
      "Le salaire et la fin du contrat ne changent que si vous en fixez de nouveaux",
      "Le montant est retiré du solde et du budget transferts du club acheteur, et versé au solde du club vendeur",
      "Tout capitanat dans l'ancien club reste vacant",
      "L'historique des transferts du jeu ne le mentionne pas encore",
      "Apparaît dans Modifications, où une seule annulation défait le transfert et le montant",
    ],

    // Un club dont la liste de l'effectif est pleine
    noRoom: (club) => `${club} n'a plus de place dans son effectif.`,
    noRoomInfoLabel: "Pourquoi\u00a0?",
    noRoomInfo:
      "L'éditeur agrandit une liste d'effectif pleine quand il le peut, mais il ne peut pas agrandir celle-ci\u00a0: un " +
      "joueur doit partir pour faire de la place.",
    noRoomNeed: (player, club) => `Pour que ${player} puisse arriver, un joueur doit quitter ${club}.`,
    releaseChoice: "Libérer\u00a0:",
    releasePickLabel: "Joueur à libérer",
    releaseOutcome: "→ devient libre de tout contrat",
    injuredTag: "blessé",
    captainTag: "capitaine",
    swapChoice: "En faire un échange\u00a0:",
    swapChoiceOutcome: (club) => `ce joueur rejoint ${club}`,
    moveAndRelease: (name) => `Transférer et libérer ${name}`,
    makeRoomDoes: [
      "Rejoint l'équipe première du nouveau club, à la place du joueur libéré",
      "Le joueur libéré quitte toutes les équipes de ce club, et son contrat prend fin\u00a0: libre de tout contrat",
      "Contrat daté de la date du jeu\u00a0; numéro de maillot effacé",
      "Sort de la liste des transferts et de celle des prêts",
      "Le salaire et la fin du contrat ne changent que si vous en fixez de nouveaux",
      "Le montant est retiré du solde et du budget transferts du club acheteur, et versé au solde du club vendeur",
      "Tout capitanat que l'un ou l'autre avait dans le club qu'il quitte reste vacant",
      "L'historique des transferts du jeu ne le mentionne pas encore",
      "Apparaît dans Modifications comme une seule modification, où une seule annulation défait le transfert, la " +
        "libération et le montant",
    ],

    // L'échange avec un joueur du club
    swapTitle: "Échanger avec un joueur",
    swapWith: "Échanger avec",
    playerSearchLabel: "Rechercher le joueur avec qui l'échanger",
    playerSearch: "Rechercher les joueurs de ce club par nom",
    playersLabel: "Joueurs trouvés",
    playersSearching: "Recherche des joueurs…",
    playersSearchFailed: (reason) => `Impossible de rechercher les joueurs\u00a0: ${reason}`,
    playersEmpty: (query) =>
      query === ""
        ? "Ce club n'a aucun joueur."
        : `Aucun joueur de ce club ne correspond à «\u00a0${query}\u00a0».`,
    changePlayer: "Choisir un autre joueur",

    // Ce que dit la fenêtre de l'échange
    swapContract: "Chaque joueur garde son propre contrat\u00a0; les salaires et les fins de contrat ne changent pas.",
    staffButtonTitle: "Déplacer ce membre du staff dans un autre club dans le jeu",
    staffChooseClub: "Choisissez le club où déplacer ce membre du staff.",
    staffContract: "Garde la fonction, le salaire et la fin du contrat\u00a0; le contrat est daté de la date du jeu.",
    staffJob: "Fonction",
    staffJobChoose: "Choisissez une fonction…",
    staffJobKept: (job) => `${job} (fonction actuelle)`,
    staffNewJob:
      "Prend la nouvelle fonction, et garde le salaire et la fin du contrat\u00a0; le contrat est daté de la date du jeu.",
    staffDoes: [
      "Rejoint le nouveau club là où se trouve la fonction\u00a0: son staff médical, ses préparateurs ou ses " +
        "recruteurs, ou comme directeur sportif ou entraîneur, ce qu'un club qui en a déjà un n'accepte pas",
      "Même salaire et même fin de contrat\u00a0; le contrat est daté de la date du jeu",
      "Un entraîneur qui quitte une équipe y laisse sa place vacante, que le club pourvoira\u00a0; les dirigeants sont " +
        "laissés au jeu",
      "Apparaît dans Modifications, où il peut être annulé",
    ],
    staffSignButtonTitle: "Recruter ce membre du staff, qui n'a pas de club, pour un club dans le jeu",
    staffSignTitle: "Recruter un membre du staff",
    staffSignChooseClub: "Choisissez le club pour lequel le recruter.",
    staffSignChooseJob: "Choisissez la fonction qu'il occupera dans le club.",
    staffSignTerms:
      "Laissez vide pour le salaire du membre du staff du club dont la fonction ressemble le plus à la sienne, et un " +
      "contrat jusqu'à la fin de la saison prochaine.",
    staffSignRoute: (to) => `Sans club → ${to}`,
    staffSignContract: (wage, expires) => `Nouveau contrat\u00a0: ${wage} par semaine jusqu'au ${expires}`,
    staffSignDoes: [
      "Rejoint le club là où se trouve la fonction\u00a0: son département, agrandi s'il est plein, ou comme directeur " +
        "sportif ou entraîneur, s'il n'en a pas",
      "Un nouveau contrat à la date du jeu, dans l'un des emplacements de contrat libres du jeu, comme le jeu en crée un",
      "Calqué sur le contrat du membre du staff du club qui a la même fonction (sinon du même département, sinon de " +
        "n'importe qui) et le niveau le plus proche du sien",
      "Votre salaire et votre fin de contrat, ou le salaire de ce contrat et la fin de la saison prochaine\u00a0; ni " +
        "primes ni clauses",
      "Apparaît dans Modifications, où une seule annulation défait tout",
    ],
    swapChooseClub: "Choisissez le club du joueur avec qui l'échanger.",
    swapChoosePlayer: "Choisissez le joueur avec qui l'échanger.",
    swapChecking: "Vérification de l'échange…",
    swapRoute: (player, from, to, other) => `${player}\u00a0: ${from} → ${to}\n${other}\u00a0: ${to} → ${from}`,
    swapDoesHeading: "Ce que fait l'échange",
    swapDoes: [
      "Chacun rejoint l'équipe première du club de l'autre",
      "Contrats datés de la date du jeu\u00a0; numéros de maillot effacés",
      "Les deux sortent de la liste des transferts et de celle des prêts",
      "Tout capitanat dans leurs anciens clubs reste vacant",
      "Aucun montant n'est payé\u00a0; l'historique de carrière n'est pas mis à jour",
      "Apparaît dans Modifications comme une seule modification, qui annule les deux mouvements",
    ],

    // Le recrutement d'un joueur libre
    signButtonTitle: "Recruter ce joueur libre pour un club dans le jeu",
    signTitle: "Recruter un joueur libre",
    signChooseClub: "Choisissez le club pour lequel recruter le joueur.",
    signChecking: "Vérification du recrutement…",
    signTerms:
      "Laissez vide pour le salaire du joueur du club le plus proche de son niveau, et un contrat jusqu'à la fin de la " +
      "saison prochaine.",
    signRoute: (to) => `Libre de tout contrat → ${to}`,
    signContract: (wage, expires, status) =>
      `Nouveau contrat\u00a0: ${wage} par semaine jusqu'au ${expires}, ${status}`,
    signDoesHeading: "Ce que fait le recrutement",
    signDoes: [
      "Rejoint l'équipe première du club\u00a0; une liste d'effectif pleine est agrandie",
      "Un nouveau contrat à la date du jeu, dans l'un des emplacements de contrat libres du jeu, comme le jeu en crée un",
      "Calqué sur le contrat du joueur du club le plus proche de son niveau\u00a0: même type de contrat et même statut " +
        "effectif",
      "Votre salaire et votre fin de contrat, ou le salaire de ce joueur et la fin de la saison prochaine",
      "Ni numéro de maillot, ni prime de fidélité, ni clauses, ni primes",
      "L'historique des transferts du jeu ne le mentionne pas encore",
      "Apparaît dans Modifications, où une seule annulation défait tout",
    ],
    signHint: "Rien ne change dans le jeu tant que vous n'appuyez pas sur Recruter.",
    sign: "Recruter",
    signing: "Recrutement…",

    // Le pied de la fenêtre
    hint: "Rien ne change dans le jeu tant que vous n'appuyez pas sur Transférer.",
    move: "Transférer",
    moving: "Transfert…",
    cancel: "Annuler",
    swapHint: "Rien ne change dans le jeu tant que vous n'appuyez pas sur Échanger.",
    swap: "Échanger",
    swapping: "Échange…",
  },

  ties: {
    heading: "Nationalité et formation",
    nationalities: "Deuxièmes nationalités",
    trainedInNation: "Formé au pays",
    trainedAtClub: "Formé au club",
    workPermit: "Pays sans permis de travail requis",
    none: "Néant",
    rules: {
      1: "Formés au pays 15-21",
      2: "Formés au pays 0-21",
      5: "Formés au pays 15-21 (sauf prêts)",
      10: "Formés au pays 0-19 (1 an)",
    },
    rule: (code) => `Règle de formation ${format(code)}`,

    // Le bouton sous le groupe, et la fenêtre qu'il ouvre
    change: "Modifier",
    changeTitle: "Modifier dans le jeu les deuxièmes nationalités et le statut formé au pays de ce joueur",
    title: "Nationalité et formation",
    hint: "Chaque modification est écrite aussitôt dans le jeu et apparaît dans Modifications, où elle peut être annulée.",
    full:
      "Le jeu a fait la liste de ce joueur juste assez grande pour ce qu'elle contient\u00a0: une nationalité ou une " +
      "formation peut être modifiée ou retirée, mais pas ajoutée.",
    nationOf: (name) => `Pays au lieu de\u00a0: ${name}`,
    ruleOf: (name) => `Règle de formation pour\u00a0: ${name}`,
    remove: "Retirer",
    removeTitle: (name) => `Retirer\u00a0: ${name}`,
    addNationality: "Ajouter une nationalité…",
    addNation: "Ajouter un pays…",
    addPermit: "Ajouter un pays sans permis de travail requis…",
    daysLeft: (count) => counted(count, "jour restant", "jours restants"),
    permitInfoLabel: "Qu'est-ce que cela fait\u00a0?",
    permitInfo:
      "Le jeu permet aux joueurs de l'Union européenne qui étaient en Angleterre ou en Écosse avant le Brexit d'y jouer " +
      "sans permis de travail, pendant un certain nombre de jours. Un joueur à qui vous donnez ceci n'a pas non plus " +
      "besoin de permis de travail pour jouer dans ce pays, pendant autant de jours qu'il en reste aux leurs (dix ans " +
      "là où personne dans la partie ne l'a).",
    newRule: "Règle de formation du nouveau pays",
    add: "Ajouter",
    changeClub: "Changer de club",
    changeClubTitle: (name) => `Le déclarer formé dans un autre club à la place ${de(name)}`,
    clubInsteadOf: (name) => `Club au lieu de\u00a0: ${name}`,
    addClub: "Ajouter un club…",
    addClubTitle: "Le déclarer formé dans un club de plus",
    newClub: "Nouveau club",
    pickAnother: "En choisir un autre",
    newClubRule: "Règle de formation du nouveau club",
    cancel: "Annuler",
    working: "Écriture dans le jeu…",
    close: "Fermer",
  },

  clauses: {
    change: "Modifier",
    changeTitle: "Modifier les primes et les clauses de ce joueur dans le jeu",
    title: "Primes et clauses",
    hint: "Chaque modification est écrite aussitôt dans le jeu et apparaît dans Modifications, où elle peut être annulée.",
    full:
      "Le jeu a fait la liste de ce contrat juste assez grande pour ce qu'elle contient\u00a0: une prime ou une clause " +
      "peut être modifiée ou retirée, mais aucune clause libératoire ne peut être ajoutée.",
    amountOf: (name) => `Montant de «\u00a0${name}\u00a0»`,
    conditionOf: (name) => `Condition de «\u00a0${name}\u00a0»`,
    save: "Enregistrer",
    remove: "Retirer",
    removeTitle: (name) => `Retirer «\u00a0${name}\u00a0»`,
    addRelease: "Ajouter une clause libératoire",
    releaseAmount: "Montant de la nouvelle clause libératoire",
    add: "Ajouter",
    outOfRange: (max) => `Saisissez un nombre entier de 0 à ${max}.`,
    working: "Écriture dans le jeu…",
    close: "Fermer",
  },

  release: {
    button: "Libérer",
    buttonTitle: "Libérer ce joueur de son club dans le jeu\u00a0: il devient libre de tout contrat",

    // La fenêtre
    title: "Libération",
    from: "Quitte",
    checking: "Vérification de la libération…",
    ready: (club) => `${club} → libre de tout contrat`,
    doesHeading: "Ce que fait la libération",
    does: [
      "Quitte toutes les équipes du club, et le contrat prend fin\u00a0: un joueur libre que n'importe quel club peut " +
        "recruter",
      "Personne n'est payé",
      "Tout capitanat dans le club reste vacant",
      "L'historique des transferts du jeu ne la mentionne pas",
      "Apparaît dans Modifications, où une seule annulation fait revenir le joueur avec le même contrat",
    ],

    // Le pied de la fenêtre
    hint: "Rien ne change dans le jeu tant que vous n'appuyez pas sur Libérer.",
    release: "Libérer",
    releasing: "Libération…",
    cancel: "Annuler",
  },

  permanent: {
    title: "Rendre le prêt définitif",
    stays: "Reste à",
    leaves: "Quitte",
    checking: "Vérification…",
    doesHeading: "Ce que cela fait",
    does: [
      "Il reste là où il joue, sous contrat avec ce club à partir d'aujourd'hui, aux conditions ci-dessus",
      "Il garde le numéro de maillot et le statut effectif qu'il a là-bas",
      "Il quitte toutes les équipes de son propre club, et le prêt prend fin",
      "L'historique des transferts du jeu ne le mentionne pas",
      "Apparaît dans Modifications comme un transfert, où une seule annulation rétablit le prêt",
    ],
    optionFee: (money) => `Rempli d'après l'option d'achat du prêt\u00a0: ${money}`,
    hint: "Rien ne change dans le jeu tant que vous n'appuyez pas sur Rendre définitif.",
    confirm: "Rendre définitif",
    confirming: "En cours…",
    cancel: "Annuler",
  },

  recall: {
    title: "Rappeler de prêt",
    from: "En prêt à",
    to: "Retourne à",
    doesHeading: "Ce que fait le rappel",
    does: (parent) => [
      "Aujourd'hui devient le dernier jour du prêt\u00a0: à la fin de la journée, le jeu met fin au prêt de lui-même",
      `Avancez d'un jour dans le jeu et il sera de retour à ${parent}`,
      "D'ici là, il apparaît dans Modifications, où une annulation rétablit l'ancienne fin du prêt",
    ],
    termsHeading: "Dans le jeu",
    notRecallable: (parent) => `Le prêt ne permet pas à ${parent} de le rappeler`,
    notTerminable: "Le prêt ne peut pas être écourté",
    worksAnyway:
      "Le rappel fonctionne ici quand même\u00a0: il ne passe pas par le rappel du jeu, il déplace le dernier jour du prêt",
    dropsOption: (club, amount) =>
      `L'option d'achat ${de(club)} pour ${amount} est supprimée\u00a0: sinon, à la fin du prêt, le jeu pourrait le ` +
      `vendre à ${club}`,
    hint: "Rien ne change dans le jeu tant que vous n'appuyez pas sur Rappeler.",
    confirm: "Rappeler",
    confirming: "Rappel…",
    cancel: "Annuler",
  },

  squad: {
    teamsLabel: "Équipe",
    teams: {
      first: "Équipe première",
      b: "Équipe B",
      age: (limit) => `U${limit}`,
      other: (place) => `Équipe ${place}`,
    },
    noTeams: "Ce club n'a aucune équipe.",
    loading: "Lecture de l'effectif…",
    empty: "Aucun joueur dans cette équipe.",

    // Au-dessus du tableau
    players: (count) => playerCount(count),
    averageAge: (age) => `âge moyen ${age}`,
    captains: (captain, viceCaptain) => `Capitaine\u00a0: ${captain} · Vice-capitaine\u00a0: ${viceCaptain}`,

    // Les actions sur toute l'équipe
    actionsLabel: "Actions sur toute l'équipe",
    healAll: (injured) =>
      injured === 0 ? "Tout soigner" : `Tout soigner (${format(injured)} blessé${agree(injured)})`,
    healAllTitle: "Soigner toutes les blessures de tous les joueurs de cette équipe",
    healNone: "Personne n'est blessé dans cette équipe",
    liftAll: (banned) =>
      banned === 0 ? "Lever les suspensions" : `Lever les suspensions (${format(banned)} suspendu${agree(banned)})`,
    liftAllTitle: "Lever toutes les suspensions de tous les joueurs de cette équipe",
    liftNone: "Personne n'est suspendu dans cette équipe",
    inspireAll: "Inspirer l'équipe",
    inspireAllTitle:
      "Porter le moral de chaque joueur de cette équipe à 20, le maximum, et retirer ses motifs de mécontentement",
    maxCohesion: "Cohésion maximale",
    maxCohesionTitle:
      "Porter la cohésion avec le club de chaque joueur de cette équipe à 100, le maximum. Le jeu affiche la cohésion " +
      "d'équipe sur sa page Dynamique de groupe une fois qu'il avance\u00a0: appuyez sur Continuer dans le jeu",
    cohesionNone:
      "L'éditeur ne peut pas lire la cohésion de cette équipe\u00a0: cette version du jeu n'a pas été vérifiée pour " +
      "cela, ou aucun de ses joueurs n'a d'entrée pour le club",
    cohesionWithout: (count: number) =>
      plural(count)
        ? `${format(count)} joueurs n'ont pas encore de cohésion avec le club`
        : `${format(count)} joueur n'a pas encore de cohésion avec le club`,
    refreshAll: "Tout régénérer",
    refreshAllTitle:
      "Porter l'énergie et la forme physique de chaque joueur de cette équipe à 100\u00a0%, et le reposer complètement " +
      "(fatigue -500)",
    maxAll: "Attributs au maximum",
    maxAllTitle:
      "Porter chaque attribut de chaque joueur de cette équipe à son meilleur niveau\u00a0: 20, et 1 pour la tendance à " +
      "se blesser et la violence",
    hint:
      "Les actions concernent chaque joueur de la liste, y compris ceux prêtés ailleurs. L'annulation se trouve aussi " +
      "dans la vue Modifications.",

    // Le blocage de toute l'équipe
    freezeLabel: "Bloquer toute l'équipe",
    freezeAttributes: "Bloquer les attributs",
    freezeAttributesTitle:
      "Tant que l'application est ouverte et connectée, les attributs de chaque joueur de cette équipe ne baissent " +
      "pas\u00a0: ce que le jeu retire est remis, et les progrès comptent toujours",
    freezeFitness: "Bloquer l'énergie et la forme physique",
    freezeFitnessTitle:
      "Tant que l'application est ouverte et connectée, l'énergie et la forme physique de chaque joueur de cette équipe " +
      "ne baissent pas\u00a0: ce que le jeu retire est remis. Utilisez d'abord «\u00a0Tout régénérer\u00a0» pour les " +
      "garder à 100\u00a0%",
    freezePositions: "Bloquer les postes",
    freezePositionsTitle:
      "Tant que l'application est ouverte et connectée, les notes par poste de chaque joueur de cette équipe restent " +
      "telles quelles\u00a0: une note que le jeu monte ou baisse est remise",
    frozenCount: (frozen, total) => `${format(frozen)} sur ${format(total)}`,
    freezeHint:
      "Le blocage concerne chaque joueur de la liste et le suit partout où il va. L'application s'en souvient pour " +
      "cette partie.",
    frozeAttributes: (count) =>
      count === 0 ? "Leurs attributs étaient déjà bloqués" : `Attributs de ${playerCount(count)} bloqués`,
    unfrozeAttributes: (count) => `Attributs de ${playerCount(count)} débloqués`,
    frozeFitness: (count) =>
      count === 0
        ? "Leur énergie et leur forme physique étaient déjà bloquées"
        : `Énergie et forme physique de ${playerCount(count)} bloquées`,
    unfrozeFitness: (count) => `Énergie et forme physique de ${playerCount(count)} débloquées`,
    frozePositions: (count) =>
      count === 0 ? "Leurs postes étaient déjà bloqués" : `Postes de ${playerCount(count)} bloqués`,
    unfrozePositions: (count) => `Postes de ${playerCount(count)} débloqués`,

    // Ce qu'a fait une action, sous les boutons
    written: (count) => (count === 0 ? "Aucune modification écrite" : `${changes(count)} écrite${agree(count)}`),
    refused: (name, reason) => `${name}\u00a0: ${reason}`,
    undo: "Annuler",
    undoTitle: "Réécrire dans le jeu les anciennes valeurs de ces modifications",

    // Capitaines
    captainShort: "C",
    viceCaptainShort: "VC",
    menuLabel: (name) => `Capitanat ${de(name)}`,
    menuTitle: "Capitanat",
    makeCaptain: "Nommer capitaine",
    makeViceCaptain: "Nommer vice-capitaine",
    nowCaptain: (name) => `${name} est désormais capitaine`,
    nowViceCaptain: (name) => `${name} est désormais vice-capitaine`,
    noCaptain: "Plus personne n'est capitaine",
    noViceCaptain: "Plus personne n'est vice-capitaine",

    // Le tableau
    tableLabel: (team) => `Joueurs\u00a0: ${team}`,
    openProfile: "Ouvrir le profil du joueur",
    columns: {
      name: "Nom",
      position: "Poste",
      age: "Âge",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "Énergie",
      matchSharpness: "Forme",
      jadedness: "Fatigue",
      morale: "Moral",
      cohesion: "Cohésion",
      actions: "Capitanat",
    },
    sortBy: (by) => `Trier par ${by}`,
    sortNames: {
      name: "nom",
      position: "poste",
      age: "âge",
      currentAbility: "niveau actuel",
      potentialAbility: "niveau potentiel",
      condition: "énergie",
      matchSharpness: "forme physique",
      jadedness: "fatigue",
      morale: "moral",
      cohesion: "cohésion",
    },

    // Les étiquettes après un nom, avec leur sens au survol
    injured: "Blessé",
    injuredTitle: (count) => counted(count, "blessure", "blessures"),
    banned: "Suspendu",
    bannedTitle: (count) => counted(count, "suspension", "suspensions"),
    onLoan: "Parti en prêt",
    onLoanTitle: "Prêté à un autre club",
    loanee: "Arrivé en prêt",
    loaneeTitle: "Prêté ici par un autre club",
    elsewhere: "Ailleurs",
    elsewhereTitle: "Joue dans une autre équipe du club",
    frozen: "Bloqué",
    frozenTitle: (attributes, fitness, positions) => {
      const frozen = [
        ...(attributes ? ["attributs"] : []),
        ...(fitness ? ["énergie", "forme physique"] : []),
        ...(positions ? ["postes"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} et ${last}` : last;
      return `${attributes || positions ? "Bloqués" : "Bloquées"}\u00a0: ${listed}`;
    },
  },

  game: {
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Boutique inconnue",
    },
    steamBuild: (id) => `build ${id}`,
  },

  scouting: {
    nav: "Recrutement",
    reading: "Lecture de votre club…",
    refresh: "Actualiser",
    refreshTitle: "Relire le club depuis le jeu",
    searching: "Recherche…",
    none: "—",
    perWeek: "/sem.",
    openProfile: "Ouvrir le profil",
    freeAgent: "Libre de tout contrat",
    loan: "Prêt",
    header: {
      transferBudget: "Budget transferts",
      wageRoom: "Marge salariale",
      wageBudget: "Budget salarial",
      squad: "Effectif",
      averageAge: "Âge moyen",
      players: (count) => playerCount(count),
    },
    tabs: {
      label: "Sections du recrutement",
      recommend: "Conseils de transfert",
      depth: "Profondeur de l'effectif",
      departures: "Départs conseillés",
    },
    status: {
      missing: "Manquant",
      thin: "Juste",
      fine: "Correct",
      crowded: "Surchargé",
    },
    lines: {
      goalkeeper: "Gardien de but",
      centreBack: "Défenseur central",
      fullBack: "Arrière latéral",
      wingBack: "Latéral offensif",
      defensiveMidfield: "Milieu défensif",
      centralMidfield: "Milieu axial",
      attackingMidfield: "Milieu offensif",
      wide: "Excentrés",
      striker: "Buteur",
    },
    depthLines: {
      gk: "Gardiens",
      dc: "Défenseurs centraux",
      rightBack: "Arrières droits",
      leftBack: "Arrières gauches",
      dm: "Milieux défensifs",
      mc: "Milieux axiaux",
      rightWing: "Ailiers droits",
      leftWing: "Ailiers gauches",
      amc: "Milieux offensifs",
      st: "Buteurs",
    },
    positionTip: (line, count, target, status) =>
      `${line}\u00a0: ${format(count)} dans l'effectif (en général ${format(target)}) — ${status}`,
    brief: {
      heading: "Que recherchez-vous\u00a0?",
      pitch: "Poste",
      legend: "Les points montrent l'état de l'effectif dans chaque ligne.",
      inPossession: "Avec le ballon",
      outOfPossession: "Sans le ballon",
      anyRole: "Tous — le meilleur rôle de chaque joueur",
      purpose: "Pour",
      filters: "Filtres",
      minAge: "Âge min",
      maxAge: "Âge max",
      maxFee: "Montant max",
      minProbability: "Probabilité",
      anyProbability: "Toutes",
      noFreeAgents: "Sans joueurs libres",
    },
    purposes: {
      firstTeam: "Équipe première",
      rotation: "Rotation",
      future: "Avenir",
      any: "Tous",
    },
    purposeTips: {
      firstTeam: "Meilleur que votre meilleur joueur à ce poste",
      rotation: "Aussi bon que votre deuxième choix, à un prix raisonnable",
      future: "21 ans ou moins, avec une marge de progression",
      any: "Tous ceux qui conviennent",
    },
    ask: {
      before: "Conseils pour ",
      after: "",
      anyRole: "meilleur rôle par joueur",
    },
    own: {
      heading: "Dans votre effectif",
      empty: "Personne dans votre effectif ne joue ici.",
      position: "Poste",
    },
    summary: (candidates, eligible, shown, purpose) =>
      `${counted(candidates, "joueur peut jouer ici", "joueurs peuvent jouer ici")} · ${format(eligible)} ` +
      `adapté${agree(eligible)} à «\u00a0${purpose}\u00a0» · ${format(shown)} recommandé${agree(shown)}`,
    how: {
      label: "Comment cette liste est-elle établie\u00a0?",
      note: (rule, count) =>
        "Le recruteur examine chaque joueur capable de jouer à ce poste (avec une note d'au moins 10), en excluant les " +
        `joueurs de votre club et ceux des autres entraîneurs humains. Parmi eux, il garde ceux qui ${rule}. Pour les ` +
        "400 qui conviennent le mieux, il estime la probabilité que chacun vous rejoigne, puis recommande les " +
        `${count} meilleurs selon l'adéquation et la probabilité combinées. Ordre recommandé\u00a0: 70\u00a0% ` +
        "d'adéquation et 30\u00a0% de probabilité, un peu moins pour les joueurs de plus de 30 ans\u00a0; Rotation pèse " +
        "les deux à égalité, et Avenir tient aussi compte du potentiel. Cliquez sur le titre d'une colonne pour trier " +
        "la liste\u00a0; # est l'ordre du recruteur.",
    },
    purposeRules: {
      firstTeam: "conviennent mieux au poste que votre meilleur joueur actuel",
      rotation: "conviennent au moins aussi bien que votre deuxième choix",
      future: "ont 21 ans ou moins et une marge de progression (un potentiel supérieur d'au moins 15 à leur niveau)",
      any: "conviennent, même un peu",
    },
    sortBy: (by) => `Trier par ${by}`,
    sortNames: {
      rank: "l'ordre du recruteur",
      name: "nom",
      age: "âge",
      ca: "niveau actuel",
      pa: "niveau potentiel",
      fit: "adéquation",
      probability: "probabilité",
      fee: "montant",
    },
    backToScoutOrder: "Revenir à l'ordre du recruteur",
    showMore: (count) => `Afficher ${format(count)} de plus`,
    playsFor: (club) => `joue pour ${club}`,
    empty: "Aucun conseil pour ce poste avec ces réglages. Essayez l'objectif Tous ou des filtres plus larges.",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "Joueur",
      age: "Âge",
      fit: "Adéquation",
      role: "Rôle",
      probability: "Probabilité",
      fee: "Montant est.",
      wage: "Salaire",
      note: "Note du recruteur",
      money: "Montant",
      value: "Valeur",
    },
    probabilityInfo:
      "La probabilité que le joueur rejoigne votre club — une estimation fondée sur sa valeur, son contrat, son club et " +
      "sa réputation.",
    probabilityInfoLabel: "Qu'est-ce que la probabilité\u00a0?",
    fitTitle: (inPossession, outOfPossession, position) =>
      [
        inPossession !== null && `Avec le ballon\u00a0: ${inPossession}`,
        outOfPossession !== null && `Sans le ballon\u00a0: ${outOfPossession}`,
        `Poste\u00a0: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note:
      "L'adéquation utilise les pondérations d'attributs propres à l'éditeur pour chaque rôle\u00a0; les montants, les " +
      "salaires et les probabilités sont des estimations.",
    depth: {
      summary: (size, age, level) =>
        `${playerCount(size)}${age === null ? "" : ` · âge moyen ${age}`} · niveau moyen du meilleur onze ${level}`,
      weak: "Sous le niveau de l'effectif",
      ageing: "Vieillissant",
      cover: (names) => `Peuvent aussi jouer ici\u00a0: ${names}`,
      advice: "Obtenir des conseils",
      adviceTitle: "Conseils de transfert pour cette ligne",
      empty: "Personne",
      ability: "Niveau actuel",
      more: (count) => `+${format(count)} de plus`,
      columns: {
        line: "Ligne",
        status: "Statut",
        count: "Joueurs",
        players: "Les meilleurs d'abord (niveau)",
        cover: "Peuvent aussi jouer ici",
        age: "Âge moyen",
      },
      countTitle: (count, target) =>
        `${counted(count, "joueur dont le meilleur poste est", "joueurs dont le meilleur poste est")} dans cette ` +
        `ligne\u00a0; un effectif en compte généralement ${format(target)}`,
      statusHelp: {
        missing: "Personne ne joue ici.",
        thin:
          "Moins que ce qu'un effectif compte généralement\u00a0; les joueurs qui peuvent dépanner comptent pour moitié.",
        fine: "À peu près ce qu'un effectif compte généralement.",
        crowded: "Deux joueurs ou plus au-delà de ce qu'un effectif compte généralement.",
      },
      attention: "À examiner\u00a0:",
      allFine: "Chaque ligne semble équilibrée.",
    },
    departures: {
      intro: "Les joueurs dont votre recruteur se séparerait, les plus urgents d'abord.",
      filter: "Conseil",
      all: "Tous",
      empty: "Votre recruteur ne se séparerait de personne pour l'instant.",
      sortNames: {
        rank: "l'ordre du recruteur",
        name: "nom",
        age: "âge",
        ca: "niveau actuel",
        pa: "niveau potentiel",
        value: "valeur",
        wage: "salaire",
        contract: "fin du contrat",
      },
      columns: {
        player: "Joueur",
        age: "Âge",
        ability: "Niveau",
        value: "Valeur",
        wage: "Salaire",
        contract: "Contrat jusqu'au",
        advice: "Conseil",
        reasons: "Raisons",
      },
      actions: { sell: "Vendre", loan: "Prêter", release: "Libérer" },
      rank: (line, rank) => `${line} · ${rank === 1 ? "1er" : `${rank}e`}`,
    },
    // The game's names, matched through the editor's keys, which are the game's abbreviations (its French ones beside
    // them: GAP, DCP, ALI, LOI, LOM, LOA, AMJ, AtD...). Its AP is the Advanced Playmaker, its OAM and OCF the Central
    // Outlet roles; the few it has no French name for (IWB, PWB, AWB, PW, WFD) are named after those. The box-to-box
    // roles are the "relayeur" of French football: the game's "box to box" reads as English.
    roles: {
      bgk: "Gardien à l'aise au pied",
      ngk: "Gardien pragmatique",
      sk: "Gardien-libéro",
      lhk: "Gardien sur la ligne",
      cb: "Défenseur central",
      bcb: "Défenseur central à l'aise au pied",
      ncb: "Défenseur central strict",
      acb: "Défenseur central avancé",
      ocb: "Défenseur central de dédoublement",
      scb: "Défenseur central stoppeur",
      ccb: "Défenseur central de couverture",
      wcb: "Défenseur central excentré",
      fb: "Arrière latéral",
      ifb: "Arrière latéral intérieur",
      pfb: "Arrière latéral de pressing",
      hfb: "Arrière latéral en retrait",
      wb: "Latéral offensif",
      iwb: "Latéral offensif intérieur",
      pwb: "Latéral offensif meneur de jeu",
      awb: "Latéral offensif avancé",
      hwb: "Latéral offensif en retrait",
      dm: "Milieu défensif",
      hb: "Demi-centre",
      ddm: "Milieu défensif en retrait",
      pdm: "Milieu défensif de pressing",
      bbm: "Milieu relayeur",
      bbp: "Meneur de jeu relayeur",
      cm: "Milieu axial",
      pcm: "Milieu axial de pressing",
      scm: "Milieu axial de couverture",
      chm: "Milieu de couloir",
      wcm: "Milieu central désaxé",
      ap: "Meneur de jeu avancé",
      am: "Milieu offensif",
      oam: "Milieu de terrain offensif de contre-attaque axiale",
      w: "Ailier",
      if: "Attaquant intérieur",
      pw: "Ailier meneur de jeu",
      wfd: "Attaquant désaxé",
      tw: "Ailier de couverture",
      iow: "Ailier inversé de contre-attaque",
      cfd: "Attaquant central",
      dlf: "Attaquant en retrait",
      p: "Renard des surfaces",
      tcf: "Avant-centre de couverture",
      ocf: "Avant-centre point d'appui axial",
    },
    reasons: {
      listed: () => "Sur liste des transferts",
      freeAgent: () => "Libre de tout contrat",
      expiring: (value) => `Fin de contrat dans ${value} ${days(value)}`,
      releaseClause: (value) => `Clause libératoire\u00a0: ${value}`,
      fringe: () => "Pas titulaire dans son club",
      keyPlayer: () => "Joueur clé dans son club",
      unwanted: () => "Statut «\u00a0Pas utile à l'équipe\u00a0» dans son club",
      overBudget: (value) => `${value} au-dessus de votre budget`,
      stretch: (value) => `Juste au-dessus du budget (+${value})`,
      wageHigh: (value) => `Salaire de ${value}/sem. au-delà de votre marge`,
      biggerClub: () => "Joue dans un club plus grand",
      smallerClub: () => "Joue dans un club plus petit",
      reputationGap: () => "Un nom trop grand pour votre club",
      ambitious: () => "Ambitieux\u00a0: accueillerait volontiers ce pas en avant",
      notForSale: () => "Pas à vendre",
    },
    departureReasons: {
      surplus: (value) => `Ligne surchargée (${value} ${pluralText(value) ? "joueurs" : "joueur"})`,
      belowLevel: () => "Sous le niveau de l'effectif",
      ageing: (value) => `Prend de l'âge (${value})`,
      expiring: (value) => `Fin de contrat dans ${value} ${days(value)}`,
      highWage: (value) => `Salaire élevé pour son rôle (${value}/sem.)`,
      unhappy: () => "Mécontent",
      lowMorale: () => "Moral bas",
      blocked: () => "A besoin de jouer pour progresser",
      unwanted: () => "Statut effectif\u00a0: pas utile à l'équipe",
      listed: () => "Déjà sur liste des transferts",
    },
  },

  errors,
};
