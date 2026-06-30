/*
 * Copyright 2026 Watcha
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 *
 * watcha! Fork du View `UserMenu` upstream (packages/shared-components/src/menus/UserMenu/UserMenu.tsx)
 * pour injecter 5 items Watcha conditionnels :
 *   1. Notifications  — raccourci direct vers Settings>Notifications (item Watcha historique)
 *   2. Administration — ouvre /admin (réservé aux admins synapse, gaté `UIFeature.watcha_Administration`)
 *   3. Mes documents  — Nextcloud (`UIFeature.watcha_Nextcloud`, masqué pour les comptes partner)
 *   4. Vidéoconférence — Jitsi (`UIFeature.Voip`, masqué pour les comptes partner)
 *   5. Ma boite e-mail — webmail (`UIFeature.watcha_Mail`, masqué pour les comptes partner)
 *
 * Le View shared n'expose pas de slot d'extension : ce fork recopie le rendu upstream et insère
 * les items aux endroits idoines. Le ViewModel `UserMenuViewModel.ts` est étendu en parallèle
 * (`WatchaUserMenuSnapshot` / `WatchaUserMenuViewActions`) pour fournir les booléens et handlers.
 * !watcha
 */

import React, { type JSX } from "react";
import { Avatar, Button, Link, Menu, MenuItem, Separator, Text } from "@vector-im/compound-web";
import {
    ChatProblemIcon,
    ComputerIcon,
    DevicesIcon,
    DocumentIcon,
    EmailSolidIcon,
    HomeIcon,
    LockIcon,
    NotificationsIcon,
    PopOutIcon,
    SettingsIcon,
    VideoCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";
import { useViewModel, type ViewModel, useI18n } from "@element-hq/web-shared-components";

import styles from "./watcha_UserMenu.module.css";
import type {
    WatchaUserMenuSnapshot,
    WatchaUserMenuViewActions,
} from "../../../viewmodels/menus/UserMenuViewModel";

export type WatchaUserMenuProps = {
    vm: ViewModel<WatchaUserMenuSnapshot, WatchaUserMenuViewActions>;
    className?: string;
};

export function WatchaUserMenu({ vm, className }: WatchaUserMenuProps): JSX.Element {
    const {
        userId,
        displayName,
        avatarUrl,
        expanded,
        open,
        manageAccountHref,
        actions,
        showAvatar,
        watchaActions,
    } = useViewModel(vm);
    const { translate: _t } = useI18n();

    const trigger = (
        <button className={styles.triggerButton} aria-label={_t("menus|user_menu|title")}>
            <Avatar id={userId} name={displayName} type="round" size="36px" src={avatarUrl} />
        </button>
    );

    const hasServicesSection =
        watchaActions.openNextcloud || watchaActions.openVideoconferencing || watchaActions.openEmail;

    return (
        <div className={classNames(styles.wrapper, className)}>
            <Menu
                open={open}
                showTitle={false}
                title={_t("menus|user_menu|title")}
                trigger={trigger}
                onOpenChange={vm.setOpen}
                align="start"
                side="right"
                className={styles.container}
            >
                <section className={styles.profile}>
                    {showAvatar && <Avatar id={userId} name={displayName} type="round" size="64px" src={avatarUrl} />}
                    <Text className={styles.displayname} type="body" size="lg" weight="semibold" as="span">
                        {displayName}
                    </Text>
                    <Text data-testid="userId" size="md" as="span" type="body">
                        {userId}
                    </Text>
                    {manageAccountHref && (
                        <Button as="a" size="md" kind="tertiary" href={manageAccountHref} Icon={PopOutIcon}>
                            {_t("menus|user_menu|manage_account")}
                        </Button>
                    )}
                    {actions.createAccount && (
                        <Button
                            className={styles.createAccount}
                            size="md"
                            as="button"
                            kind="primary"
                            onClick={vm.createAccount}
                        >
                            {_t("menus|user_menu|create_an_account")}
                        </Button>
                    )}
                    {actions.signIn && (
                        <Text as="span" weight="medium">
                            {_t("menus|user_menu|got_an_account")}
                            <Link as="button" onClick={vm.signIn}>
                                {_t("menus|user_menu|sign_in")}
                            </Link>
                        </Text>
                    )}
                </section>
                <Separator />
                <section className={styles.actions}>
                    {actions.openHomePage && (
                        <MenuItem Icon={HomeIcon} label={_t("user_menu|open_home")} onSelect={vm.openHomePage} />
                    )}
                    {actions.linkNewDevice && (
                        <MenuItem
                            Icon={DevicesIcon}
                            label={_t("user_menu|link_new_device")}
                            onSelect={vm.linkNewDevice}
                        />
                    )}
                    {/* watcha+ raccourci Notifications inséré entre linkNewDevice et openSecurity */}
                    {watchaActions.openNotifications && (
                        <MenuItem
                            Icon={NotificationsIcon}
                            label={_t("notifications|enable_prompt_toast_title")}
                            onSelect={vm.openNotifications}
                        />
                    )}
                    {/* +watcha */}
                    {actions.openSecurity && (
                        <MenuItem Icon={LockIcon} label={_t("user_menu|open_security")} onSelect={vm.openSecurity} />
                    )}
                    {actions.openFeedback && (
                        <MenuItem
                            Icon={ChatProblemIcon}
                            label={_t("user_menu|open_feedback")}
                            onSelect={vm.openFeedback}
                        />
                    )}
                    {actions.openSettings && (
                        <MenuItem
                            Icon={SettingsIcon}
                            label={_t("user_menu|open_settings")}
                            onSelect={vm.openSettings}
                        />
                    )}
                </section>
                {/* watcha+ Section Administration (admins synapse uniquement) */}
                {watchaActions.openAdministration && (
                    <>
                        <Separator />
                        <section className={styles.actions}>
                            <MenuItem
                                Icon={ComputerIcon}
                                label={_t("watcha|administration")}
                                onSelect={vm.openAdministration}
                            />
                        </section>
                    </>
                )}
                {/* Section Services métiers (Documents / Visio / Email — masquée pour les comptes partner) */}
                {hasServicesSection && (
                    <>
                        <Separator />
                        <section className={styles.actions}>
                            {watchaActions.openNextcloud && (
                                <MenuItem
                                    Icon={DocumentIcon}
                                    label={_t("watcha|my_documents")}
                                    onSelect={vm.openNextcloud}
                                />
                            )}
                            {watchaActions.openVideoconferencing && (
                                <MenuItem
                                    Icon={VideoCallSolidIcon}
                                    label={_t("watcha|videoconferencing")}
                                    onSelect={vm.openVideoconferencing}
                                />
                            )}
                            {watchaActions.openEmail && (
                                <MenuItem
                                    Icon={EmailSolidIcon}
                                    label={_t("watcha|my_email")}
                                    onSelect={vm.openEmail}
                                />
                            )}
                        </section>
                    </>
                )}
                {/* +watcha */}
            </Menu>
            {expanded && (
                <Text type="heading" size="sm" as="span" weight="semibold">
                    {displayName}
                </Text>
            )}
        </div>
    );
}
