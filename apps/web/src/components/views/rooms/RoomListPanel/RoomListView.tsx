/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX, type ReactNode } from "react";
import {
    RoomListView as SharedRoomListView,
    useCreateAutoDisposedViewModel,
    type Room as SharedRoom,
} from "@element-hq/web-shared-components";
import { type Room } from "matrix-js-sdk/src/matrix";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { RoomAvatarView } from "../../avatars/RoomAvatarView";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { Landmark, LandmarkNavigation } from "../../../../accessibility/LandmarkNavigation";
import { RoomListViewModel } from "../../../../viewmodels/room-list/RoomListViewModel";
import { WatchaRoomInviteProgress } from "./watcha_RoomInviteProgress"; // watcha+

/**
 * RoomListView component using shared components with proper MVVM pattern.
 */
export function RoomListView(): JSX.Element {
    const matrixClient = useMatrixClientContext();

    // Create and auto-dispose ViewModel instance
    const vm = useCreateAutoDisposedViewModel(() => new RoomListViewModel({ client: matrixClient }));

    // Render avatar for each room - memoized to prevent re-renders
    const renderAvatar = useCallback((room: SharedRoom): ReactNode => {
        return <RoomAvatarView room={room as Room} />;
    }, []);

    // watcha+
    // Progression d'un envoi d'invitations en cours pour ce salon, s'il y en a
    // un. Le composant se charge lui-même de ne rien rendre le reste du temps.
    const renderBelowName = useCallback((room: SharedRoom): ReactNode => {
        return <WatchaRoomInviteProgress roomId={(room as Room).roomId} />;
    }, []);
    // +watcha

    // Handle keyboard navigation for landmarks
    const onKeyDown = useCallback((ev: React.KeyboardEvent) => {
        const navAction = getKeyBindingsManager().getNavigationAction(ev);
        if (navAction === KeyBindingAction.NextLandmark || navAction === KeyBindingAction.PreviousLandmark) {
            LandmarkNavigation.findAndFocusNextLandmark(
                Landmark.ROOM_LIST,
                navAction === KeyBindingAction.PreviousLandmark,
            );
            ev.stopPropagation();
            ev.preventDefault();
        }
    }, []);

    /* watcha+
    return <SharedRoomListView vm={vm} renderAvatar={renderAvatar} onKeyDown={onKeyDown} />;
    +watcha */
    return (
        <SharedRoomListView
            vm={vm}
            renderAvatar={renderAvatar}
            renderBelowName={renderBelowName}
            onKeyDown={onKeyDown}
        />
    );
}
