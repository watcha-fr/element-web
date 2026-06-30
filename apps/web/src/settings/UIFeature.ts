/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// see settings.md for documentation on conventions
export const enum UIFeature {
    AdvancedEncryption = "UIFeature.advancedEncryption",
    URLPreviews = "UIFeature.urlPreviews",
    Widgets = "UIFeature.widgets",
    LocationSharing = "UIFeature.locationSharing",
    Voip = "UIFeature.voip",
    Feedback = "UIFeature.feedback",
    Registration = "UIFeature.registration",
    PasswordReset = "UIFeature.passwordReset",
    Deactivate = "UIFeature.deactivate",
    ShareQRCode = "UIFeature.shareQrCode",
    ShareSocial = "UIFeature.shareSocial",
    IdentityServer = "UIFeature.identityServer",
    ThirdPartyID = "UIFeature.thirdPartyId",
    AdvancedSettings = "UIFeature.advancedSettings",
    RoomHistorySettings = "UIFeature.roomHistorySettings",
    TimelineEnableRelativeDates = "UIFeature.timelineEnableRelativeDates",
    AllowCreatingPublicRooms = "UIFeature.allowCreatingPublicRooms",
    AllowCreatingPublicSpaces = "UIFeature.allowCreatingPublicSpaces",

    // watcha+
    /* eslint-disable camelcase */
    watcha_Administration = "UIFeature.watcha_administration",
    watcha_E2EEUISetting = "UIFeature.watcha_e2eeUiSetting",
    watcha_Federation = "UIFeature.watcha_federation",
    watcha_Nextcloud = "UIFeature.watcha_nextcloud",
    watcha_Partner = "UIFeature.watcha_partner",
    watcha_SSOProfile = "UIFeature.watcha_ssoProfile",
    watcha_StickersSetting = "UIFeature.watcha_stickersSetting",
    watcha_ReportEvent = "UIFeature.watcha_reportEvent",
    watcha_SitivFieldDisabled = "UIFeature.watcha_sitivFieldDisabled",
    watcha_Mail = "UIFeature.watcha_mail",
    watcha_ComUE = "UIFeature.watcha_comue",
    /* eslint-enable camelcase */
    // +watcha
}

export { UIComponent } from "@element-hq/element-web-module-api";
