/*
Copyright 2022-2026 Watcha SAS.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { UserIdentifierCustomisations } from "@element-hq/element-web-module-api";

/**
 * Watcha : afficher la part locale du MXID (sans le @ ni le serveur).
 * Ex: "@alice:watcha.fr" → "alice".
 */
function getDisplayUserIdentifier(
    userId: string,
    _opts: { roomId?: string; withDisplayName?: boolean },
): string | null {
    return userId.split(":")[0].substring(1);
}

export default {
    getDisplayUserIdentifier,
} as UserIdentifierCustomisations;
