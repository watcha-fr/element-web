/*
 * Watcha custom — couronne colorée autour de l'avatar selon le serveur
 * d'origine du userId. Une couleur par instance Watcha (5 prod + 3 alias
 * test → prod). La classe générée est de la forme :
 *     mx_<Base>_crown_<domain_avec_underscores>
 * où <Base> = "RoomAvatarView" pour la sidebar (RoomAvatarView.tsx),
 * ou "EventTile_avatar" pour la timeline (EventTile.tsx).
 *
 * Source historique : matrix-react-sdk-watcha, snapshot 2026-06-25
 * (cf. code_specifique_watcha_react-sdk.md, section "Mise à jour 2026-06-25").
 * On consolide ici la logique d'extraction du domain pour éviter la
 * duplication entre RoomAvatarView et EventTile.
 */

const ALLOWED_DOMAINS = [
    "watchatest.watcha.fr",
    "teamnetdev.watcha.fr",
    "discuter-test.territoirenumeriqueouvert.org",
    "discuter.sitiv.fr",
    "discuter-vdl-test.territoirenumeriqueouvert.org",
    "discuter-vdl.territoirenumeriqueouvert.org",
    "discuter-mdl-test.territoirenumeriqueouvert.org",
    "discuter-mdl.territoirenumeriqueouvert.org",
] as const;

const TEST_TO_PROD_ALIAS: Record<string, string> = {
    "discuter-test.territoirenumeriqueouvert.org": "discuter.sitiv.fr",
    "discuter-vdl-test.territoirenumeriqueouvert.org": "discuter-vdl.territoirenumeriqueouvert.org",
    "discuter-mdl-test.territoirenumeriqueouvert.org": "discuter-mdl.territoirenumeriqueouvert.org",
};

/**
 * Retourne la classe CSS de la couronne pour un userId donné, ou une
 * chaîne vide si le domaine n'est pas dans la liste autorisée.
 *
 * @param userId   Matrix userId (ex: "@admin:watchatest.watcha.fr")
 * @param suffix   Préfixe de la classe (ex: "mx_RoomAvatarView_crown_")
 */
export function getWatchaAvatarCrownClass(userId: string | undefined | null, suffix: string): string {
    if (!userId) return "";
    const domain = userId.split(":")[1];
    if (!domain || !ALLOWED_DOMAINS.includes(domain as (typeof ALLOWED_DOMAINS)[number])) return "";
    const canonical = TEST_TO_PROD_ALIAS[domain] ?? domain;
    return `${suffix}${canonical.replace(/\./g, "_")}`;
}
