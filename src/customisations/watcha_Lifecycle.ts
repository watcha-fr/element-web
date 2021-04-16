import SdkConfig from "matrix-react-sdk/src/SdkConfig";

function onLoggedOutAndStorageCleared(): void {
    const config = SdkConfig.get();
    const sloUrl = config.watcha_slo_url;
    let nextcloudBaseUrl = config.watcha_nextcloud_base_url;
    if (nextcloudBaseUrl && config.features?.feature_nextcloud) {
        const iframe = document.createElement("iframe");
        iframe.id = "nextcloudIframeLogout";
        iframe.style.display = "none";
        if (!nextcloudBaseUrl.endsWith("/")) {
            nextcloudBaseUrl += "/";
        }
        iframe.src = nextcloudBaseUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.onload = () => {
                if (sloUrl) {
                    window.location.href = sloUrl;
                }
            };
            const url = new URL("logout", nextcloudBaseUrl);
            const requestToken = iframe.contentDocument.head.getAttribute("data-requesttoken");
            url.searchParams.append("requesttoken", requestToken);
            iframe.src = url.href;
        };
    } else if (sloUrl) {
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
