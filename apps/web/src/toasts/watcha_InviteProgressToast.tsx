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
import ProgressBar from "../components/views/elements/ProgressBar";
import ToastStore from "../stores/ToastStore";

const TOAST_KEY = "watcha_inviteprogress";

// Above the informative toasts (analytics, notifications…) which the user can
// deal with later, below the ones requiring an immediate answer (calls).
const TOAST_PRIORITY = 80;

// How long the "all invitations sent" toast stays before fading away on its own.
const SUCCESS_TOAST_TIMEOUT_MS = 8000;

interface IProgressProps {
    sent: number;
    total: number;
}

const InviteProgress: React.FC<IProgressProps> = ({ sent, total }) => (
    <div>
        <div className="mx_Toast_description">{_t("watcha|invite_progress", { sent, total })}</div>
        <ProgressBar value={sent} max={total} />
    </div>
);

/**
 * Shows — or updates — the toast reporting how many invitations have been sent
 * so far. Non blocking: the user keeps using the application meanwhile.
 */
export const showProgressToast = (sent: number, total: number): void => {
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("watcha|invite_progress_title"),
        props: { sent, total },
        component: InviteProgress,
        priority: TOAST_PRIORITY,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};

/** Reports that every invitation went through. Fades away on its own. */
export const showSuccessToast = (sent: number): void => {
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("watcha|invite_progress_title"),
        props: {
            description: _t("watcha|invite_sent", { count: sent }),
            primaryLabel: _t("action|ok"),
            onPrimaryClick: hideToast,
        },
        component: GenericToast,
        priority: TOAST_PRIORITY,
    });
    window.setTimeout(hideToast, SUCCESS_TOAST_TIMEOUT_MS);
};

/**
 * Reports that some invitations could not be sent. Stays until dismissed, and
 * gives access to the reason for each address.
 */
export const showFailureToast = (sent: number, failures: { address: string; errorText: string }[]): void => {
    const showDetails = (): void => {
        hideToast();
        Modal.createDialog(ErrorDialog, {
            title: _t("watcha|invite_incomplete_title"),
            description: (
                <div>
                    <p>{_t("watcha|invite_sent", { count: sent })}</p>
                    <ul>
                        {failures.map(({ address, errorText }) => (
                            <li key={address}>{`${address} — ${errorText}`}</li>
                        ))}
                    </ul>
                </div>
            ),
        });
    };

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
        component: GenericToast,
        priority: TOAST_PRIORITY,
    });
};
