/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX, type PropsWithChildren } from "react";
import { Button } from "@vector-im/compound-web";
import { type Room } from "matrix-js-sdk/src/matrix"; // watcha+

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import PowerSelector from "../elements/PowerSelector";
import { _t } from "../../../languageHandler";
import SettingsFieldset from "./SettingsFieldset";
import Modal from "../../../Modal";
import QuestionDialog from "../dialogs/QuestionDialog";

/**
 * Display in a fieldset, the power level of the users and allow to change them.
 * The apply button is disabled until the power level of an user is changed.
 * If there is no user to display, the children is displayed instead.
 */
interface PowerLevelSelectorProps {
    /**
     * The power levels of the users
     * The key is the user id and the value is the power level
     */
    userLevels: Record<string, number>;
    /**
     * Whether the user can change the power levels of other users
     */
    canChangeLevels: boolean;
    /**
     * The current user's own power level
     */
    currentUserLevel: number;
    /**
     * The callback when the apply button is clicked
     * @param value - new power level for the user
     * @param userId - the user id
     */
    onClick: (value: number, userId: string) => void;
    /**
     * Filter the users to display
     * @param user
     */
    filter: (user: string) => boolean;
    /**
     * The title of the fieldset
     */
    title: string;
    // watcha+
    /**
     * The room the power levels belong to.
     * When provided, the users are labelled with their display name in the room instead of their user id.
     */
    room?: Room;
    // watcha+
}

export function PowerLevelSelector({
    userLevels,
    canChangeLevels,
    currentUserLevel,
    onClick,
    filter,
    title,
    room, // watcha+
    children,
}: PropsWithChildren<PowerLevelSelectorProps>): JSX.Element | null {
    const matrixClient = useMatrixClientContext();
    const [currentPowerLevel, setCurrentPowerLevel] = useState<{ value: number; userId: string } | null>(null);

    // If the power level has changed, we need to enable the apply button
    const powerLevelChanged = Boolean(
        currentPowerLevel && currentPowerLevel.value !== userLevels[currentPowerLevel?.userId],
    );

    const collator = new Intl.Collator();

    // watcha+
    // Prefer the display name of the member over its user id, when the room is known
    const getUserLabel = (userId: string): string => room?.getMember(userId)?.name || userId;
    // watcha+

    // We sort the users by power level, then we filter them
    const users = Object.keys(userLevels)
        .sort((userA, userB) => sortUser(collator, userA, userB, userLevels, getUserLabel)) // watcha!
        .filter(filter);

    // No user to display, we return the children into fragment to convert it to JSX.Element type
    if (!users.length) return <>{children}</>;

    // check at least one admin in the list
    const roomHasAtLeastOneAdmin = (usersLevels: Record<string, number>): boolean => {
        const userLevelValues = Object.values(usersLevels);
        // At least one user as the pL 100 which means he is admin
        return userLevelValues.some((uL) => uL === 100);
    };

    return (
        <SettingsFieldset legend={title}>
            {users.map((userId) => {
                // We only want to display users with a valid power level aka an integer
                if (!Number.isInteger(userLevels[userId])) return;

                const isMe = userId === matrixClient.getUserId();
                // If I can change levels, I can change the level of anyone with a lower level than mine
                const canChange = canChangeLevels && (userLevels[userId] < currentUserLevel || isMe);

                // When the new power level is selected, the fields are rerendered and we need to keep the current value
                const userLevel = currentPowerLevel?.userId === userId ? currentPowerLevel?.value : userLevels[userId];

                return (
                    <PowerSelector
                        value={userLevel}
                        disabled={!canChange}
                        label={getUserLabel(userId)} // watcha!
                        key={userId}
                        maxValue={currentUserLevel}
                        onChange={async (value) => {
                            const userLevelsTmp = Object.assign({}, userLevels);
                            userLevelsTmp[userId] = value;
                            if (!roomHasAtLeastOneAdmin(userLevelsTmp)) {
                                const { finished } = Modal.createDialog(QuestionDialog, {
                                    title: _t("common|warning"),
                                    description: <div>{_t("user_info|demote_self_confirm_room")}</div>,
                                    button: _t("action|continue"),
                                });
                                const [confirmed] = await finished;
                                if (!confirmed) {
                                    // if cancel, we reput initial value
                                    setCurrentPowerLevel({ value: userLevels[userId], userId });
                                    return;
                                }
                            }
                            setCurrentPowerLevel({ value, userId });
                        }}
                    />
                );
            })}

            <Button
                size="md"
                kind="primary"
                // mx_Dialog_nonDialogButton is necessary to avoid the Dialog CSS to override the button style
                className="mx_Dialog_nonDialogButton mx_PowerLevelSelector_Button"
                onClick={() => {
                    if (currentPowerLevel !== null) {
                        onClick(currentPowerLevel.value, currentPowerLevel.userId);
                        setCurrentPowerLevel(null);
                    }
                }}
                disabled={!powerLevelChanged}
                aria-label={_t("action|apply")}
            >
                {_t("action|apply")}
            </Button>
        </SettingsFieldset>
    );
}

/**
 * Sort the users by power level, then by name
 * @param userA
 * @param userB
 * @param userLevels
 * @param getUserLabel - resolve the label displayed for a user, so that the list is sorted on what is shown // watcha+
 */
function sortUser(
    collator: Intl.Collator,
    userA: string,
    userB: string,
    userLevels: PowerLevelSelectorProps["userLevels"],
    getUserLabel: (userId: string) => string, // watcha+
): number {
    const powerLevelDiff = userLevels[userA] - userLevels[userB];
    return powerLevelDiff !== 0
        ? powerLevelDiff
        : collator.compare(getUserLabel(userA).toLocaleLowerCase(), getUserLabel(userB).toLocaleLowerCase()); // watcha!
}
