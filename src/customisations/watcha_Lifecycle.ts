import SdkConfig from "matrix-react-sdk/src/SdkConfig";

function onLoggedOutAndStorageCleared(): void {
    const config = SdkConfig.get();
    const sloUrl = config.watcha_slo_url;
    if (sloUrl) {
        window.location.href = sloUrl;
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
