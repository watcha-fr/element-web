/*
Copyright 2026 Watcha SAS.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// watcha+
// STUB Watcha : EntityTile a été retiré d'element-web v1.12.21+. Ce module est un
// stub temporaire pour permettre la compilation de watcha_InviteDialog.tsx en
// attendant un refactor complet utilisant MemberAvatar + nom inline.
// TODO refactor : remplacer EntityTile par MemberAvatar dans watcha_InviteDialog.tsx

import React, { type ReactNode } from "react";

interface IEntityTileProps {
    name?: string;
    title?: string;
    suppressOnHover?: boolean;
    avatarJsx?: ReactNode;
    className?: string;
    presenceState?: string;
    onClick?: (event: React.MouseEvent) => void;
    children?: ReactNode;
    powerStatus?: string;
    showPresence?: boolean;
    userId?: string;
    subtextLabel?: string;
}

const EntityTile: React.FC<IEntityTileProps> = ({ avatarJsx, name, className, onClick, children }) => {
    return (
        <div className={className} onClick={onClick} role="button" tabIndex={0}>
            {avatarJsx}
            <span>{name}</span>
            {children}
        </div>
    );
};

export default EntityTile;
// +watcha
