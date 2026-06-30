/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type UserMenuSnapshot, type UserMenuViewActions } from "@element-hq/web-shared-components";

import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import Modal from "../../Modal";
import { Action } from "../../dispatcher/actions";
import { UserTab } from "../../components/views/dialogs/UserTab";
import FeedbackDialog from "../../components/views/dialogs/FeedbackDialog";
import { shouldShowFeedback } from "../../utils/Feedback";
import { getHomePageUrl } from "../../utils/pages";
import SdkConfig from "../../SdkConfig";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
// watcha+
import SettingsStore from "../../settings/SettingsStore";
import { UIFeature } from "../../settings/UIFeature";
import { getNextcloudBaseUrl } from "../../utils/watcha_nextcloudUtils";
import { Jitsi } from "../../widgets/Jitsi";
// +watcha

// Matches maximum size of an avatar in the UserMenu
const AVATAR_PX = 88;

/* watcha! Étend le snapshot upstream avec les 5 booléens des items Watcha
   (Notifications shortcut, Administration, Documents, Vidéoconférence, Email)
   + état isSynapseAdministrator. Le rendu reste dans le View fork
   `watcha_UserMenu.tsx` qui consomme ce type étendu. */
export interface WatchaUserMenuSnapshot extends UserMenuSnapshot {
    watchaActions: {
        openNotifications: boolean;
        openAdministration: boolean;
        openNextcloud: boolean;
        openVideoconferencing: boolean;
        openEmail: boolean;
    };
}

export interface WatchaUserMenuViewActions extends UserMenuViewActions {
    openNotifications: () => void;
    openAdministration: () => void;
    openNextcloud: () => void;
    openVideoconferencing: () => void;
    openEmail: () => void;
}
/* !watcha */

export class UserMenuViewModel
    extends BaseViewModel<WatchaUserMenuSnapshot, undefined> // watcha! snapshot étendu
    implements WatchaUserMenuViewActions // watcha! actions étendues
{
    /* watcha+ */
    private isSynapseAdministrator = false;
    private isPartner = false;
    /* +watcha */

    private static computeSnapshot(
        client: MatrixClient,
        isPanelCollapsed: boolean,
        accountManagementEndpoint: string | undefined,
        // watcha+
        isSynapseAdministrator: boolean,
        isPartner: boolean,
        // +watcha
    ): WatchaUserMenuSnapshot {
        const hasHomePage = !!getHomePageUrl(SdkConfig.get(), client);
        const isAuthenticated = !client.isGuest();
        const userId = client.getSafeUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        /* watcha! comptes partner = droits réduits → on masque les services
           métier (Documents, Visio, Email). L'admin synapse a en plus le
           raccourci Administration. Notifications est un raccourci universel. */
        const partnerExcluded = isAuthenticated && !isPartner;
        const watchaActions = {
            openNotifications: isAuthenticated,
            openAdministration:
                isAuthenticated && isSynapseAdministrator && SettingsStore.getValue(UIFeature.watcha_Administration),
            openNextcloud: partnerExcluded && SettingsStore.getValue(UIFeature.watcha_Nextcloud),
            openVideoconferencing: partnerExcluded && SettingsStore.getValue(UIFeature.Voip),
            openEmail: partnerExcluded && SettingsStore.getValue(UIFeature.watcha_Mail),
        };
        /* !watcha */

        return {
            open: false,
            userId,
            displayName,
            avatarUrl,
            expanded: !isPanelCollapsed,
            manageAccountHref: accountManagementEndpoint,
            showAvatar: isAuthenticated,
            actions: {
                createAccount: !isAuthenticated,
                signIn: !isAuthenticated,
                openHomePage: hasHomePage,
                linkNewDevice: isAuthenticated,
                openSecurity: isAuthenticated,
                openFeedback: shouldShowFeedback(),
                openSettings: true,
            },
            watchaActions, // watcha+
        };
    }

    public constructor(
        private readonly dispatcher: MatrixDispatcher,
        private readonly client: MatrixClient, // watcha! retenu pour les handlers
        isPanelCollapsed: boolean,
        accountManagementEndpoint?: string,
    ) {
        super(
            undefined,
            UserMenuViewModel.computeSnapshot(client, isPanelCollapsed, accountManagementEndpoint, false, false),
        );
        OwnProfileStore.instance.on(UPDATE_EVENT, this.recalculateProfile);
        /* watcha! charge isSynapseAdministrator + isPartner de façon asynchrone
           puis remerge le snapshot. Tolère M_FORBIDDEN silencieusement (cas
           normal pour un non-admin). */
        this.isPartner = client.isPartner();
        client
            .isSynapseAdministrator()
            .then((isAdmin) => {
                this.isSynapseAdministrator = isAdmin;
                this.recalculateWatchaActions();
            })
            .catch((error) => {
                if (error.errcode !== "M_FORBIDDEN") {
                    // eslint-disable-next-line no-console
                    console.error(`[watcha] ${error.message} - ${error.errcode}`);
                }
            });
        /* !watcha */
    }

    public dispose(): void {
        OwnProfileStore.instance.off(UPDATE_EVENT, this.recalculateProfile);
        super.dispose();
    }

    public readonly recalculateProfile = (): void => {
        const displayName = OwnProfileStore.instance.displayName || this.snapshot.current.userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        this.snapshot.merge({ displayName, avatarUrl });
    };

    /* watcha+ */
    private recalculateWatchaActions = (): void => {
        const isAuthenticated = !this.client.isGuest();
        const partnerExcluded = isAuthenticated && !this.isPartner;
        this.snapshot.merge({
            watchaActions: {
                openNotifications: isAuthenticated,
                openAdministration:
                    isAuthenticated &&
                    this.isSynapseAdministrator &&
                    SettingsStore.getValue(UIFeature.watcha_Administration),
                openNextcloud: partnerExcluded && SettingsStore.getValue(UIFeature.watcha_Nextcloud),
                openVideoconferencing: partnerExcluded && SettingsStore.getValue(UIFeature.Voip),
                openEmail: partnerExcluded && SettingsStore.getValue(UIFeature.watcha_Mail),
            },
        });
    };
    /* +watcha */

    public readonly setOpen = (isOpen: boolean): void => {
        this.snapshot.merge({ open: isOpen });
    };

    public readonly setExpanded = (expanded: boolean): void => {
        this.snapshot.merge({ expanded });
    };

    public readonly createAccount = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: "start_registration" });
    };

    public readonly signIn = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: "start_login" });
    };

    public readonly openHomePage = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: Action.ViewHomePage });
    };

    public readonly openFeedback = (): void => {
        this.setOpen(false);
        Modal.createDialog(FeedbackDialog);
    };

    public readonly linkNewDevice = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.SessionManager,
            props: { showMsc4108QrCode: true },
        });
    };

    public readonly openSecurity = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Security,
        });
    };

    public readonly openSettings = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
        });
    };

    /* watcha+ Handlers des 5 items Watcha (Notifications + 4 raccourcis externes) */
    public readonly openNotifications = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Notifications,
        });
    };

    public readonly openAdministration = (): void => {
        this.setOpen(false);
        window.open("/admin", "admin");
    };

    public readonly openNextcloud = (): void => {
        this.setOpen(false);
        window.open(getNextcloudBaseUrl().toString(), "nextcloud");
    };

    public readonly openVideoconferencing = (): void => {
        this.setOpen(false);
        const jitsiBaseUrl =
            SdkConfig.get().watcha_jitsi_home_url || "https://" + Jitsi.getInstance().preferredDomain;
        window.open(jitsiBaseUrl);
    };

    public readonly openEmail = (): void => {
        this.setOpen(false);
        const emailBaseUrl = SdkConfig.get().watcha_email_base_url;
        if (emailBaseUrl) window.open(emailBaseUrl);
    };
    /* +watcha */
}
