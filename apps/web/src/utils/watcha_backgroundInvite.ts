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
 * Un seul envoi à la fois.
 *
 * Le toast de progression a une clé unique : deux lots simultanés se
 * l'arracheraient, et le bilan du second effacerait celui du premier — des
 * invitations parties sans que personne ne sache lesquelles ont abouti.
 *
 * L'état tient en mémoire, ce qui suffit à couvrir un utilisateur : Element
 * n'autorise qu'un onglet actif par session (`SessionLock`). Deux personnes
 * différentes qui invitent en même temps ne se voient pas, en revanche — cela
 * ne se traiterait que côté serveur.
 */
let batchInProgress = false;

/** Un envoi d'invitations est-il en cours ? */
export const isInviteInProgress = (): boolean => batchInProgress;

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
    if (batchInProgress) {
        // Garde de dernier recours : l'appelant est censé avoir refusé l'envoi
        // avant de fermer son dialogue, sans quoi la personne perdrait sa
        // saisie sans explication.
        logger.warn("An invitation batch is already running, the new one is ignored");
        return;
    }
    batchInProgress = true;

    const total = addresses.length;
    let sent = 0;

    try {
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
    } finally {
        // Y compris sur l'abandon en erreur : un verrou laissé posé rendrait
        // toute invitation ultérieure impossible jusqu'au rechargement.
        batchInProgress = false;
    }
}
