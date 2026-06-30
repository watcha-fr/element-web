/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect } from "react";
import { useCreateAutoDisposedViewModel, DisambiguatedProfileView } from "@element-hq/web-shared-components";

import { type RoomMember } from "../../../../../models/rooms/RoomMember";
import { useMemberTileViewModel } from "../../../../viewmodels/memberlist/tiles/MemberTileViewModel";
import { E2EIconView } from "./common/E2EIconView";
import AvatarPresenceIconView from "./common/PresenceIconView";
import BaseAvatar from "../../../avatars/BaseAvatar";
import { _t } from "../../../../../languageHandler";
import { MemberTileView } from "./common/MemberTileView";
import { InvitedIconView } from "./common/InvitedIconView";
import { type MemberWithSeparator } from "../../../../viewmodels/memberlist/MemberListViewModel";
import { DisambiguatedProfileViewModel } from "../../../../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";
// watcha+
import { getWatchaAvatarCrownClass } from "../../../../../utils/watcha_AvatarCrown";
// +watcha

interface IProps {
    /**
     * Needed for `onFocus`
     */
    item: MemberWithSeparator;
    member: RoomMember;
    index: number;
    memberCount: number;
    showPresence?: boolean;
    focused?: boolean;
    tabIndex?: number;
    onFocus: (item: MemberWithSeparator, e: React.FocusEvent) => void;
}

export function RoomMemberTileView(props: IProps): JSX.Element {
    const vm = useMemberTileViewModel(props);
    const member = vm.member;
    /* watcha! couronne colorée autour de l'avatar selon le domaine du userId
       (5 instances Watcha). La classe pose un `box-shadow: inset` sur le
       `.mx_BaseAvatar` interne via sélecteur descendant — voir le commentaire
       en tête de `_watcha-AvatarCrown.pcss`. */
    const crownClass = getWatchaAvatarCrownClass(member.userId, "mx_RoomAvatarView_crown_");
    const av = (
        <span className={crownClass}>
            <BaseAvatar
                size="32px"
                name={member.name}
                idName={member.userId}
                title={member.displayUserId}
                url={member.avatarThumbnailUrl}
                altText={_t("common|user_avatar")}
            />
        </span>
    );
    /* !watcha */
    const name = vm.name;
    const disambiguatedProfileVM = useCreateAutoDisposedViewModel(
        () =>
            new DisambiguatedProfileViewModel({
                fallbackName: name,
                member,
                withTooltip: true,
            }),
    );
    useEffect(() => {
        disambiguatedProfileVM.setMember(name, member);
    }, [disambiguatedProfileVM, member, name]);
    const nameJSX = <DisambiguatedProfileView vm={disambiguatedProfileVM} className="mx_DisambiguatedProfile" />;

    const presenceState = member.presenceState;
    let presenceJSX: JSX.Element | undefined;
    if (vm.showPresence && presenceState) {
        presenceJSX = <AvatarPresenceIconView presenceState={presenceState} />;
    }

    let iconJsx;
    if (vm.e2eStatus) {
        iconJsx = <E2EIconView status={vm.e2eStatus} />;
    }
    if (member.isInvite) {
        iconJsx = <InvitedIconView isThreePid={false} />;
    }

    return (
        <MemberTileView
            onClick={vm.onClick}
            onFocus={(e) => props.onFocus(props.item, e)}
            avatarJsx={av}
            presenceJsx={presenceJSX}
            nameJsx={nameJSX}
            userLabel={vm.userLabel}
            ariaLabel={name}
            iconJsx={iconJsx}
            focused={props.focused}
            tabIndex={props.tabIndex}
            memberIndex={props.index - (member.isInvite ? 1 : 0)} // Adjust as invites are below the seperator
            memberCount={props.memberCount}
        />
    );
}
