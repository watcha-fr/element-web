/*
Copyright 2026 Watcha SAS.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// watcha+
import React, { type ReactNode } from "react";
import classNames from "classnames";

import { getWatchaAvatarCrownClass } from "../../../utils/watcha_AvatarCrown";

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

const EntityTile: React.FC<IEntityTileProps> = ({
    avatarJsx,
    name,
    title,
    className,
    onClick,
    userId,
    subtextLabel,
    children,
}) => {
    const interactive = !!onClick;
    const crownClass = getWatchaAvatarCrownClass(userId, "mx_EntityTile_avatar_crown_");
    const usernameColorClass = getWatchaAvatarCrownClass(userId, "mx_Username_color_");

    return (
        <div
            className={classNames("mx_EntityTile", className)}
            onClick={onClick}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            title={title}
        >
            <span className={classNames("mx_EntityTile_avatar", crownClass)}>{avatarJsx}</span>
            <div className="mx_EntityTile_details">
                <div className={classNames("mx_EntityTile_name", usernameColorClass)}>{name}</div>
                {subtextLabel ? <div className="mx_EntityTile_subtext">{subtextLabel}</div> : null}
            </div>
            {children}
        </div>
    );
};

export default EntityTile;
// +watcha
