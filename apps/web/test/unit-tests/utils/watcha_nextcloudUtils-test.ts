/*
Copyright 2026 Watcha

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getDocumentWidgetUrl, getShareFileId, withFileId, withPath } from "../../../src/utils/watcha_nextcloudUtils";
import SdkConfig from "../../../src/SdkConfig";

const NEXTCLOUD = "https://nextcloud.example.org/";

/**
 * A room folder must never be addressed by name. A Nextcloud mount name is
 * per-recipient: any member may rename their own mount, and Nextcloud appends a
 * suffix on collision, so the same folder can be `/Nouveau dossier` for its owner,
 * `/Facilitateurs` for one member and `/FACILITATEURS` for another.
 */
describe("watcha_nextcloudUtils room folder addressing", () => {
    beforeEach(() => {
        SdkConfig.reset();
        SdkConfig.add({ watcha_nextcloud_base_url: NEXTCLOUD });
    });

    afterEach(() => SdkConfig.reset());

    const shareUrl = (params: Record<string, string>): string => {
        const url = new URL(`${NEXTCLOUD}apps/files`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        return url.toString();
    };

    describe("getShareFileId", () => {
        it("reads the file id from a stored share value", () => {
            expect(getShareFileId(shareUrl({ dir: "/Nouveau dossier", fileid: "12345" }))).toBe("12345");
        });

        it("returns null for a legacy value carrying only a path", () => {
            expect(getShareFileId(shareUrl({ dir: "/Nouveau dossier" }))).toBeNull();
        });

        it("returns null rather than throwing on a value that is not a URL", () => {
            // Room state is written by clients of every vintage; a malformed value
            // must degrade to the legacy path, not break the panel.
            expect(getShareFileId("/Nouveau dossier")).toBeNull();
            expect(getShareFileId("")).toBeNull();
        });
    });

    describe("withFileId", () => {
        it("adds the file id while preserving the rest of the value", () => {
            const migrated = withFileId(shareUrl({ dir: "/Nouveau dossier" }), 12345);

            const params = new URL(migrated).searchParams;
            expect(params.get("fileid")).toBe("12345");
            // `dir` is kept so that clients predating this change keep working.
            expect(params.get("dir")).toBe("/Nouveau dossier");
        });

        it("replaces a stale file id", () => {
            const migrated = withFileId(shareUrl({ dir: "/x", fileid: "1" }), 2);

            expect(new URL(migrated).searchParams.get("fileid")).toBe("2");
        });

        it("keeps the value parseable by older clients", () => {
            // Older clients do `new URL(value).searchParams.get("dir")`, so the
            // stored value must remain a URL with a usable `dir`.
            const migrated = withFileId(shareUrl({ dir: "/Nouveau dossier" }), 42);

            expect(() => new URL(migrated)).not.toThrow();
            expect(new URL(migrated).searchParams.get("dir")).toBe("/Nouveau dossier");
        });
    });

    describe("withPath", () => {
        it("replaces the stored path with the one resolved for this user", () => {
            // The stored path is whoever picked the folder's view of it; every
            // recipient may rename their own mount or get a collision suffix.
            const forThisUser = withPath(shareUrl({ dir: "/Nouveau dossier", fileid: "59" }), "/FACILITATEURS");

            const params = new URL(forThisUser).searchParams;
            expect(params.get("dir")).toBe("/FACILITATEURS");
            expect(params.get("fileid")).toBe("59");
        });
    });

    describe("getDocumentWidgetUrl", () => {
        it("always sends a path, and the file id alongside it", () => {
            // Dropping `dir` and relying on `fileid` alone made the Files app open
            // the user's root, exposing their whole personal tree in the panel:
            // in the current frontend `fileid` is a selection hint, not a
            // navigation target.
            const url = new URL(getDocumentWidgetUrl(shareUrl({ dir: "/Facilitateurs", fileid: "12345" })));

            expect(url.searchParams.get("fileid")).toBe("12345");
            expect(url.searchParams.get("dir")).toBe("/Facilitateurs");
        });

        it("still falls back to the stored path when no file id is known", () => {
            // Rooms that have not been migrated must keep working exactly as before.
            const url = new URL(getDocumentWidgetUrl(shareUrl({ dir: "/Nouveau dossier" })));

            expect(url.searchParams.get("dir")).toBe("/Nouveau dossier");
            expect(url.searchParams.has("fileid")).toBe(false);
        });

        it("targets the Files app of the configured Nextcloud", () => {
            const url = new URL(getDocumentWidgetUrl(shareUrl({ dir: "/x", fileid: "1" })));

            expect(url.origin).toBe("https://nextcloud.example.org");
            expect(url.pathname).toBe("/apps/files");
            expect(url.searchParams.has("watcha_widget")).toBe(true);
        });
    });
});
