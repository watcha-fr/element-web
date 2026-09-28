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

interface IPendingBatch {
    client: MatrixClient;
    roomId: string;
    addresses: string[];
    /** Résolu quand ce lot-ci est terminé, qu'il ait abouti ou non. */
    done: () => void;
}

/**
 * Les lots attendent leur tour plutôt que de se marcher dessus.
 *
 * Un seul lot tourne à la fois — le toast de progression a une clé unique, et
 * deux lots simultanés se l'arracheraient : le bilan du second effacerait celui
 * du premier, des invitations partant sans que personne ne sache lesquelles ont
 * abouti. La sérialisation protège aussi le serveur, qui crée les comptes un par
 * un de toute façon.
 *
 * Mais rien n'est refusé : inviter depuis un autre salon pendant qu'un envoi
 * tourne met simplement le nouveau lot en file, et le toast annonce ce qui
 * attend. La file vit en mémoire, ce qui couvre un utilisateur : Element
 * n'autorise qu'un onglet actif par session (`SessionLock`).
 */
const queue: IPendingBatch[] = [];
let draining = false;

/** Le lot en train de partir, s'il y en a un. */
let running: { roomId: string; sent: number; total: number } | null = null;

/** Nombre de lots qui attendent leur tour, celui en cours non compris. */
export const queuedBatchCount = (): number => queue.length;

/** Ce que la liste des salons a besoin de savoir pour un salon donné. */
export interface IRoomInviteProgress {
    /** Invitations déjà parties dans le lot en cours pour ce salon. */
    sent: number;
    /** Attendu au total : le lot en cours plus ceux qui attendent pour ce salon. */
    total: number;
    /** Faux tant qu'aucun lot de ce salon n'a commencé : il attend son tour. */
    started: boolean;
}

/**
 * L'état des invitations d'un salon, ou `null` s'il n'y en a aucune en cours ni
 * en attente. Les lots d'un même salon sont agrégés : de l'extérieur, « 12 sur
 * 80 » est plus parlant que deux barres qui se succèdent.
 */
export function getRoomInviteProgress(roomId: string): IRoomInviteProgress | null {
    let sent = 0;
    let total = 0;
    let started = false;

    if (running?.roomId === roomId) {
        sent = running.sent;
        total = running.total;
        started = true;
    }
    for (const batch of queue) {
        if (batch.roomId === roomId) {
            total += batch.addresses.length;
        }
    }

    return total ? { sent, total, started } : null;
}

type ProgressListener = () => void;
const listeners = new Set<ProgressListener>();

/**
 * S'abonne aux changements d'état de la file. Rend la fonction de désabonnement,
 * à appeler au démontage — la liste des salons monte et démonte ses lignes au
 * fil du défilement (liste virtualisée), un abonnement oublié fuirait à chaque
 * ligne recyclée.
 */
export function subscribeToInviteProgress(listener: ProgressListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notifyProgress(): void {
    // Copie : un écouteur qui se désabonne en réagissant modifierait l'ensemble
    // pendant qu'on le parcourt.
    for (const listener of Array.from(listeners)) {
        listener();
    }
}

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
export function inviteInBackground(client: MatrixClient, roomId: string, addresses: string[]): Promise<void> {
    let done!: () => void;
    // La promesse rendue se résout à la fin de *ce* lot-là. L'appelant courant
    // l'ignore — il ferme son dialogue et rend la main — mais elle rend le
    // comportement observable, pour les tests comme pour un futur appelant.
    const finished = new Promise<void>((resolve) => (done = resolve));

    queue.push({ client, roomId, addresses, done });
    notifyProgress();
    if (!draining) {
        void drainQueue();
    }
    return finished;
}

async function drainQueue(): Promise<void> {
    draining = true;
    try {
        let batch = queue.shift();
        while (batch) {
            try {
                await runBatch(batch);
            } finally {
                // Même sur erreur : un lot laissé « en cours » afficherait une
                // barre figée dans la liste des salons jusqu'au rechargement.
                running = null;
                notifyProgress();
                batch.done();
            }
            batch = queue.shift();
        }
    } finally {
        // Y compris sur une erreur inattendue : une file laissée bloquée
        // rendrait toute invitation ultérieure impossible jusqu'au
        // rechargement de la page.
        draining = false;
    }
}

async function runBatch({ client, roomId, addresses }: IPendingBatch): Promise<void> {
    const total = addresses.length;
    const roomName = client.getRoom(roomId)?.name ?? _t("common|unnamed_room");
    let sent = 0;

    running = { roomId, sent, total };
    showProgressToast(sent, total, roomName, queue.length);
    notifyProgress();

    const inviter = new MultiInviter(client, roomId, {
        // The blocking "Preparing invitations…" modal would defeat the purpose.
        inhibitProgressDialog: true,
        progressCallback: () => {
            sent++;
            running = { roomId, sent, total };
            showProgressToast(sent, total, roomName, queue.length);
            notifyProgress();
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
            roomName,
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
        showFailureToast(total - failures.length, failures, roomName);
    } else if (total) {
        showSuccessToast(total, roomName);
    } else {
        hideToast();
    }
}
