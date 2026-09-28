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

import React from "react";

import { _t } from "../languageHandler";
import Modal from "../Modal";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import GenericToast from "../components/views/toasts/GenericToast";
import DraggableToast from "../components/views/toasts/watcha_DraggableToast";
import ProgressBar from "../components/views/elements/ProgressBar";
import ToastStore from "../stores/ToastStore";

const TOAST_KEY = "watcha_inviteprogress";

// Above the informative toasts (analytics, notifications…) which the user can
// deal with later, below the ones requiring an immediate answer (calls).
const TOAST_PRIORITY = 80;

// How long the "all invitations sent" toast stays before fading away on its own.
const SUCCESS_TOAST_TIMEOUT_MS = 8000;

/**
 * Le minuteur du bilan, gardé pour être annulé.
 *
 * Sans ça, un envoi lancé dans les huit secondes qui suivent un bilan se faisait
 * éteindre en cours de route par le minuteur du précédent : le toast
 * disparaissait puis revenait à la progression suivante.
 */
let dismissTimeout: number | null = null;

const cancelDismiss = (): void => {
    if (dismissTimeout !== null) {
        window.clearTimeout(dismissTimeout);
        dismissTimeout = null;
    }
};

interface IProgressProps {
    sent: number;
    total: number;
    roomName: string;
    queued: number;
}

/**
 * Les compteurs couvrent la file entière : la barre avance d'un bout à l'autre
 * de l'envoi au lieu de repartir de zéro à chaque salon. Seul le nom affiché
 * change quand un lot passe la main, et les lots restants sont annoncés.
 */
const InviteProgress: React.FC<IProgressProps> = ({ sent, total, roomName, queued }) => (
    <DraggableToast>
        <div className="watcha_InviteProgressToast">
            <div className="watcha_InviteProgressToast_room">{roomName}</div>
            <div className="mx_Toast_description">{_t("watcha|invite_progress", { sent, total })}</div>
            <ProgressBar value={sent} max={total} />
            {queued > 0 && (
                <div className="watcha_InviteProgressToast_queued">
                    {_t("watcha|invite_queued", { count: queued })}
                </div>
            )}
        </div>
    </DraggableToast>
);

/**
 * The report is a plain `GenericToast`, made movable the same way as the
 * progress it replaces — so that it does not come back over whatever the user
 * had cleared the toast away from.
 *
 * Declared at module level: `addOrReplaceToast` compares components by
 * identity, and one rebuilt at every call would remount the toast — losing the
 * listeners of the drag — at every invitation sent.
 */
const DraggableGenericToast: React.FC<React.ComponentProps<typeof GenericToast>> = (props) => (
    <DraggableToast>
        <GenericToast {...props} />
    </DraggableToast>
);

/**
 * Shows — or updates — the toast reporting how many invitations have been sent
 * so far. Non blocking: the user keeps using the application meanwhile.
 */
export const showProgressToast = (sent: number, total: number, roomName: string, queued = 0): void => {
    cancelDismiss();
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("watcha|invite_progress_title"),
        props: { sent, total, roomName, queued },
        component: InviteProgress,
        priority: TOAST_PRIORITY,
    });
};

export const hideToast = (): void => {
    cancelDismiss();
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};

/**
 * Reports that every invitation went through — celles de toute la file, quel
 * que soit le nombre de salons traversés. Fades away on its own.
 */
export const showSuccessToast = (sent: number): void => {
    cancelDismiss();
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("watcha|invite_progress_title"),
        props: {
            description: _t("watcha|invite_sent", { count: sent }),
            primaryLabel: _t("action|ok"),
            onPrimaryClick: hideToast,
        },
        component: DraggableGenericToast,
        priority: TOAST_PRIORITY,
    });
    dismissTimeout = window.setTimeout(hideToast, SUCCESS_TOAST_TIMEOUT_MS);
};

/**
 * Reports that some invitations could not be sent. Stays until dismissed, and
 * gives access to the reason for each address.
 */
export const showFailureToast = (
    sent: number,
    failures: { address: string; errorText: string; roomName: string }[],
): void => {
    // Le détail est groupé par salon : la file en traverse plusieurs, et une
    // liste à plat ne dirait pas où l'adresse a manqué.
    const parRoom = new Map<string, { address: string; errorText: string }[]>();
    for (const { address, errorText, roomName } of failures) {
        const liste = parRoom.get(roomName) ?? [];
        liste.push({ address, errorText });
        parRoom.set(roomName, liste);
    }

    const showDetails = (): void => {
        hideToast();
        Modal.createDialog(ErrorDialog, {
            title: _t("watcha|invite_incomplete_title"),
            description: (
                <div>
                    <p>{_t("watcha|invite_sent", { count: sent })}</p>
                    {Array.from(parRoom.entries()).map(([roomName, liste]) => (
                        <div key={roomName}>
                            <p>
                                <strong>{roomName}</strong>
                            </p>
                            <ul>
                                {liste.map(({ address, errorText }) => (
                                    <li key={address}>{`${address} — ${errorText}`}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ),
        });
    };

    cancelDismiss();
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("watcha|invite_incomplete_title"),
        props: {
            description: _t("watcha|invite_not_sent", { count: failures.length }),
            secondaryLabel: _t("action|dismiss"),
            onSecondaryClick: hideToast,
            primaryLabel: _t("action|view"),
            onPrimaryClick: showDetails,
        },
        component: DraggableGenericToast,
        priority: TOAST_PRIORITY,
    });
};
