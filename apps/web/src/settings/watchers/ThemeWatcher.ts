/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../SettingsStore";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { findHighContrastTheme, getCustomTheme } from "../../theme";
import { type ActionPayload } from "../../dispatcher/payloads";
import { SettingLevel } from "../SettingLevel";

export enum ThemeWatcherEvent {
    Change = "change",
}

interface ThemeWatcherEventHandlerMap {
    [ThemeWatcherEvent.Change]: (theme: string) => void;
}

export default class ThemeWatcher extends TypedEventEmitter<ThemeWatcherEvent, ThemeWatcherEventHandlerMap> {
    // watcha+
    /**
     * Whether the app is currently showing an unauthenticated screen (welcome, login,
     * register, forgot password). While it is, {@link getEffectiveTheme} forces the
     * Watcha-branded theme so those pages stay on brand whatever the stored preference.
     *
     * Replaces the upstream `ThemeController.isLogin`, dropped in element-web #31293,
     * which forced "light" in exactly the same situation. Like that flag this one
     * defaults to false and is driven by MatrixChat, which is the only component that
     * knows which view is on screen. It must NOT be inferred from `window.location.hash`:
     * an unset hash is indistinguishable from a logged-in user landing on the bare root
     * URL, and nothing rechecks the theme on navigation, so such a user would be stuck
     * on the Watcha theme for the whole session. Contexts with no route at all (unit
     * tests, the Jitsi widget wrapper) would silently get it too.
     */
    public static isAuthScreen = false;
    // +watcha

    private themeWatchRef?: string;
    private systemThemeWatchRef?: string;
    private dispatcherRef?: string;

    private preferDark: MediaQueryList;
    private preferLight: MediaQueryList;
    private preferHighContrast: MediaQueryList;

    private currentTheme: string;

    public constructor() {
        super();
        // we have both here as each may either match or not match, so by having both
        // we can get the tristate of dark/light/unsupported
        this.preferDark = (<any>global).matchMedia("(prefers-color-scheme: dark)");
        this.preferLight = (<any>global).matchMedia("(prefers-color-scheme: light)");
        this.preferHighContrast = (<any>global).matchMedia("(prefers-contrast: more)");

        this.currentTheme = this.getEffectiveTheme();
    }

    public start(): void {
        this.themeWatchRef = SettingsStore.watchSetting("theme", null, this.onChange);
        this.systemThemeWatchRef = SettingsStore.watchSetting("use_system_theme", null, this.onChange);
        this.preferDark.addEventListener("change", this.onChange);
        this.preferLight.addEventListener("change", this.onChange);
        this.preferHighContrast.addEventListener("change", this.onChange);
        this.dispatcherRef = dis.register(this.onAction);
    }

    public stop(): void {
        this.preferDark.removeEventListener("change", this.onChange);
        this.preferLight.removeEventListener("change", this.onChange);
        this.preferHighContrast.removeEventListener("change", this.onChange);
        SettingsStore.unwatchSetting(this.systemThemeWatchRef);
        SettingsStore.unwatchSetting(this.themeWatchRef);
        dis.unregister(this.dispatcherRef);
    }

    private onChange = (): void => {
        this.recheck();
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.RecheckTheme) {
            // XXX forceTheme
            this.recheck(payload.forceTheme);
        }
    };

    // XXX: forceTheme param added here as local echo appears to be unreliable
    // https://github.com/vector-im/element-web/issues/11443
    public recheck(forceTheme?: string): void {
        const oldTheme = this.currentTheme;
        this.currentTheme = forceTheme === undefined ? this.getEffectiveTheme() : forceTheme;
        if (oldTheme !== this.currentTheme) this.emit(ThemeWatcherEvent.Change, this.currentTheme);
    }

    public getEffectiveTheme(): string {
        // Dev note: Much of this logic is replicated in the AppearanceUserSettingsTab

        // watcha+
        // Force the Watcha-branded theme on the unauthenticated screens, where the user
        // has not yet had a chance to express any theme preference. See isAuthScreen.
        // Note: "watcha" is a built-in theme (BUILTIN_THEMES in theme.ts + webpack entry
        // theme-watcha) — must NOT use the "custom-" prefix or setTheme() would route to
        // getCustomTheme() and throw "Can't find custom theme 'watcha'".
        if (ThemeWatcher.isAuthScreen) {
            return "watcha";
        }
        // +watcha

        // If the user has specifically enabled the system matching option (excluding default),
        // then use that over anything else. We pick the lowest possible level for the setting
        // to ensure the ordering otherwise works.
        const systemThemeExplicit = SettingsStore.getValueAt(
            SettingLevel.DEVICE,
            "use_system_theme",
            null,
            false,
            true,
        );
        if (systemThemeExplicit) {
            logger.log("returning explicit system theme");
            const theme = this.themeBasedOnSystem();
            if (theme) {
                return theme;
            }
        }

        // If the user has specifically enabled the theme (without the system matching option being
        // enabled specifically and excluding the default), use that theme. We pick the lowest possible
        // level for the setting to ensure the ordering otherwise works.
        const themeExplicit = SettingsStore.getValueAt(SettingLevel.DEVICE, "theme", null, false, true);
        if (themeExplicit) {
            logger.log("returning explicit theme: " + themeExplicit);
            return themeExplicit;
        }

        // If the user hasn't really made a preference in either direction, assume the defaults of the
        // settings and use those.
        if (SettingsStore.getValue("use_system_theme")) {
            const theme = this.themeBasedOnSystem();
            if (theme) {
                return theme;
            }
        }
        return SettingsStore.getValue("theme");
    }

    /**
     * Returns true if user is on a dark theme, if false implies user is on a light theme
     */
    public isUserOnDarkTheme(): boolean {
        const theme = this.currentTheme;
        if (theme.startsWith("custom-")) {
            return !!getCustomTheme(theme.substring("custom-".length)).is_dark;
        }
        return theme === "dark" || theme === "dark-hc";
    }

    private themeBasedOnSystem(): string | undefined {
        let newTheme: string | undefined;
        if (this.preferDark.matches) {
            newTheme = "dark";
        } else if (this.preferLight.matches) {
            newTheme = "light";
        }
        if (newTheme && this.preferHighContrast.matches) {
            const hcTheme = findHighContrastTheme(newTheme);
            if (hcTheme) {
                newTheme = hcTheme;
            }
        }
        return newTheme;
    }

    public isSystemThemeSupported(): boolean {
        return this.preferDark.matches || this.preferLight.matches;
    }
}
