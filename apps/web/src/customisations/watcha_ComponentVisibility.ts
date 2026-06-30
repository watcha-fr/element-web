/*
Copyright 2021-2026 Watcha SAS.
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    UIComponent,
    type ComponentVisibilityCustomisations as IComponentVisibilityCustomisations,
} from "@element-hq/element-web-module-api";

import { MatrixClientPeg } from "../MatrixClientPeg";

function shouldShowComponent(component: UIComponent): boolean {
    const client = MatrixClientPeg.safeGet();
    const isPartner = client.isPartner();
    return isPartner &&
        [UIComponent.InviteUsers, UIComponent.CreateRooms, UIComponent.CreateSpaces, UIComponent.ExploreRooms].includes(
            component,
        )
        ? false
        : true;
}

export const ComponentVisibilityCustomisations: IComponentVisibilityCustomisations = {
    shouldShowComponent,
};
