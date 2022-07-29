/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import SdkConfig from "matrix-react-sdk/src/SdkConfig";

function onLoggedOutAndStorageCleared(isPartner, capabilities): void {
    const config = SdkConfig.get();
    const sloUrl = config.watcha_slo_url;
    const externalAuthenticationForPartners = capabilities.watcha?.external_authentication_for_partners?.enabled;
    if (sloUrl && (!isPartner || externalAuthenticationForPartners)) {
        window.location.href = sloUrl;
    } else if (isPartner && !externalAuthenticationForPartners) {
        window.location.hash = "/partner";
    }
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface ILifecycleCustomisations {
    onLoggedOutAndStorageCleared?: typeof onLoggedOutAndStorageCleared;
}

// A real customisation module will define and export one or more of the
// customisation points that make up `ILifecycleCustomisations`.
export default { onLoggedOutAndStorageCleared } as ILifecycleCustomisations;
