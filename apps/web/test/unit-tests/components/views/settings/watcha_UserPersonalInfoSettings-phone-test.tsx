/*
Copyright 2026 Watcha

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// watcha+

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type Mocked } from "jest-mock";

import { UserPersonalInfoSettings } from "../../../../../src/components/views/settings/UserPersonalInfoSettings";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import SdkConfig from "../../../../../src/SdkConfig";
import { getMockClientWithEventEmitter } from "../../../../test-utils";

/**
 * ComUE asked for the phone-number section to disappear from user settings.
 * It is gated by the `watcha_hide_phone_number` config flag, off by default, so
 * upstream deployments keep both the email and phone sections.
 */
describe("UserPersonalInfoSettings — watcha_hide_phone_number", () => {
    let client: Mocked<MatrixClient>;

    const renderTab = () =>
        render(
            <MatrixClientContext.Provider value={client}>
                <UserPersonalInfoSettings canMake3pidChanges={true} />
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        SdkConfig.reset();
        client = getMockClientWithEventEmitter({
            getThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        });
        // The whole panel is itself gated behind this UI feature upstream.
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => name === UIFeature.ThirdPartyID);
    });

    afterEach(() => {
        SdkConfig.reset();
        jest.restoreAllMocks();
    });

    it("shows both email and phone sections by default", async () => {
        renderTab();

        await waitFor(() => expect(screen.getByTestId("mx_AccountEmailAddresses")).toBeInTheDocument());
        expect(screen.getByTestId("mx_AccountPhoneNumbers")).toBeInTheDocument();
    });

    it("hides the phone section, and only that, when the flag is set", async () => {
        SdkConfig.add({ watcha_hide_phone_number: true });

        renderTab();

        // Email stays; only the phone section is removed.
        await waitFor(() => expect(screen.getByTestId("mx_AccountEmailAddresses")).toBeInTheDocument());
        expect(screen.queryByTestId("mx_AccountPhoneNumbers")).not.toBeInTheDocument();
    });
});
