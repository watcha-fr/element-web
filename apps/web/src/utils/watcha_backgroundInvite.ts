/*
Copyright 2026 Watcha

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import MultiInviter, { InviteState } from "./MultiInviter";
import { _t } from "../languageHandler";
import { hideToast, showFailureToast, showProgressToast, showSuccessToast } from "../toasts/watcha_InviteProgressToast";

/**
 * Invites a list of addresses to a room without holding the user hostage.
 *
 * Inviting an external partner makes the homeserver create an account, then
 * notify it by mail: on a large list this takes minutes, during which the
 * blocking spinner of the invitation dialog used to leave the inviter unable to
 * do anything else. The invitations are now sent in the background and reported
 * through a toast, so the dialog can be closed straight away.
 *
 * Note that the invitations are sent by the browser, one after the other: they
 * stop if the user closes the application before the end. The toast reflects the
 * actual progress, so this stays visible.
 */
export async function inviteInBackground(client: MatrixClient, roomId: string, addresses: string[]): Promise<void> {
    const total = addresses.length;
    let sent = 0;

    showProgressToast(sent, total);

    const inviter = new MultiInviter(client, roomId, {
        // The blocking "Preparing invitations…" modal would defeat the purpose.
        inhibitProgressDialog: true,
        progressCallback: () => {
            sent++;
            showProgressToast(sent, total);
        },
    });

    let states;
    try {
        states = await inviter.invite(addresses);
    } catch (error) {
        logger.error("Error whilst inviting users in the background: ", error);
        showFailureToast(
            sent,
            addresses.slice(sent).map((address) => ({ address, errorText: _t("invite|error_invite") })),
        );
        return;
    }

    // Anything not reported as invited has failed, including the addresses left
    // untouched when `MultiInviter` gives up early on a fatal error.
    const failures = addresses
        .filter((address) => states[address] !== InviteState.Invited)
        .map((address) => ({
            address,
            errorText: inviter.getErrorText(address) ?? _t("invite|error_invite"),
        }));

    if (failures.length) {
        showFailureToast(total - failures.length, failures);
    } else if (total) {
        showSuccessToast(total);
    } else {
        hideToast();
    }
}
