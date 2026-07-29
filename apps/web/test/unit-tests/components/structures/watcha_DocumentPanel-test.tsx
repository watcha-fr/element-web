/*
Copyright 2026 Watcha

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// watcha+

import React from "react";
import { render, screen, waitFor, fireEvent, act } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type Mocked } from "jest-mock";

import DocumentPanel from "../../../../src/components/structures/watcha_DocumentPanel";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../src/SdkConfig";
import { getMockClientWithEventEmitter, flushPromises } from "../../../test-utils";
import { getRoomFolder, RoomFolderStatus } from "../../../../src/utils/watcha_nextcloudApi";

jest.mock("../../../../src/utils/watcha_nextcloudApi", () => ({
    ...(jest.requireActual("../../../../src/utils/watcha_nextcloudApi") as object),
    getRoomFolder: jest.fn(),
}));

const roomId = "!room:example.org";
const NEXTCLOUD = "https://nextcloud.example.org/";

/** A stored share value as written by the folder selector. */
const shareValue = (params: Record<string, string>): string => {
    const url = new URL(`${NEXTCLOUD}apps/files`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
};

describe("watcha_DocumentPanel", () => {
    let mockClient: Mocked<MatrixClient>;
    let settings: Record<string, any>;

    const renderPanel = () =>
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <DocumentPanel roomId={roomId} initialTabId="tab" empty="No document" emptyClass="empty" />
            </MatrixClientContext.Provider>,
        );

    const iframeSrc = (): string | null =>
        document.querySelector("#watcha_NextcloudPanel")?.getAttribute("src") ?? null;

    beforeEach(() => {
        jest.clearAllMocks();
        SdkConfig.reset();
        SdkConfig.add({ watcha_nextcloud_base_url: NEXTCLOUD });

        mockClient = getMockClientWithEventEmitter({
            getUserId: jest.fn().mockReturnValue("@me:example.org"),
            getSafeUserId: jest.fn().mockReturnValue("@me:example.org"),
            getRoom: jest.fn(),
            getClientWellKnown: jest.fn(),
        });

        settings = { "UIFeature.watcha_nextcloud": true, "nextcloudShare": null };
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: any) => settings[name]);
        jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_l: any, name: any) => settings[name]);
        jest.spyOn(SettingsStore, "canSetValue").mockReturnValue(true);
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
    });

    afterEach(() => {
        SdkConfig.reset();
        jest.restoreAllMocks();
    });

    it("shows the empty state when no folder is bound to the room", () => {
        renderPanel();

        expect(screen.getByText("No document")).toBeInTheDocument();
        expect(getRoomFolder).not.toHaveBeenCalled();
    });

    it("resolves the per-user path even when the stored value carries a file id", async () => {
        // The path is per-user and cannot be inferred from the room setting, so a
        // stored file id is not enough to skip the call.
        settings.nextcloudShare = shareValue({ dir: "/Nouveau dossier", fileid: "59" });
        (getRoomFolder as jest.Mock).mockResolvedValue({
            status: RoomFolderStatus.Ok,
            fileId: 59,
            path: "/FACILITATEURS",
        });

        renderPanel();
        await flushPromises();

        expect(getRoomFolder).toHaveBeenCalled();
        await waitFor(() => expect(iframeSrc()).toContain("dir=%2FFACILITATEURS"));
        expect(iframeSrc()).toContain("fileid=59");
    });

    describe("soft migration of a legacy room", () => {
        it("resolves the file id and records it on the room setting", async () => {
            // No manual intervention must be needed on existing rooms.
            settings.nextcloudShare = shareValue({ dir: "/Nouveau dossier" });
            (getRoomFolder as jest.Mock).mockResolvedValue({
                status: RoomFolderStatus.Ok,
                fileId: 59,
                path: "/FACILITATEURS",
            });

            renderPanel();
            await flushPromises();

            expect(SettingsStore.setValue).toHaveBeenCalledWith(
                "nextcloudShare",
                roomId,
                "room",
                expect.stringContaining("fileid=59"),
            );
            await waitFor(() => expect(iframeSrc()).toContain("fileid=59"));
        });

        it("does not write the setting when the user cannot change room state", async () => {
            // Most members cannot; the panel must still work for them.
            settings.nextcloudShare = shareValue({ dir: "/Nouveau dossier" });
            jest.spyOn(SettingsStore, "canSetValue").mockReturnValue(false);
            (getRoomFolder as jest.Mock).mockResolvedValue({
                status: RoomFolderStatus.Ok,
                fileId: 59,
                path: "/x",
            });

            renderPanel();
            await flushPromises();

            expect(SettingsStore.setValue).not.toHaveBeenCalled();
            await waitFor(() => expect(iframeSrc()).toContain("fileid=59"));
        });
    });

    describe("distinguishes the reasons the folder is unreachable", () => {
        beforeEach(() => {
            settings.nextcloudShare = shareValue({ dir: "/Nouveau dossier" });
        });

        it("tells a non-member why they see nothing", async () => {
            (getRoomFolder as jest.Mock).mockResolvedValue({ status: RoomFolderStatus.NotMember, fileId: null });

            renderPanel();

            expect(await screen.findByText(/not part of this room's Nextcloud group/)).toBeInTheDocument();
            // Nothing the user can retry here, so no misleading button.
            expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
        });

        it("says so when the folder has actually been deleted", async () => {
            (getRoomFolder as jest.Mock).mockResolvedValue({ status: RoomFolderStatus.Deleted, fileId: null });

            renderPanel();

            expect(await screen.findByText(/has been deleted in Nextcloud/)).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
        });

        it("explains an explicitly dismissed share", async () => {
            // The only per-recipient state that really denies access. A merely
            // "unaccepted" share is the normal lazy state and must never surface.
            (getRoomFolder as jest.Mock).mockResolvedValue({ status: RoomFolderStatus.Rejected, fileId: 59 });

            renderPanel();

            expect(await screen.findByText(/dismissed this folder's share/)).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
        });

        it("offers a genuine retry on a network failure", async () => {
            (getRoomFolder as jest.Mock).mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce({
                status: RoomFolderStatus.Ok,
                fileId: 59,
                path: "/Nouveau dossier",
            });

            renderPanel();

            const retry = await screen.findByRole("button", { name: "Retry" });
            expect(screen.getByText(/temporarily unreachable/)).toBeInTheDocument();

            fireEvent.click(retry);
            await waitFor(() => expect(iframeSrc()).toContain("fileid=59"));
        });
    });

    it("re-resolves when the bound folder changes", async () => {
        // Covers a folder swapped in the room settings: a file id resolved for the
        // previous folder must not leak into the new one.
        // `useSettingValue` reads once and then follows SettingsStore.watchSetting,
        // so the change is delivered the way the real store delivers it.
        let notifySettingChanged: (() => void) | undefined;
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation((name: any, _roomId, callback: any) => {
            if (name === "nextcloudShare") notifySettingChanged = () => callback();
            return "ref";
        });
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(() => {});

        settings.nextcloudShare = shareValue({ dir: "/First" });
        (getRoomFolder as jest.Mock).mockResolvedValue({ status: RoomFolderStatus.Ok, fileId: 11, path: "/First" });

        renderPanel();
        await flushPromises();
        await waitFor(() => expect(iframeSrc()).toContain("fileid=11"));

        (getRoomFolder as jest.Mock).mockResolvedValue({ status: RoomFolderStatus.Ok, fileId: 22, path: "/Second" });
        settings.nextcloudShare = shareValue({ dir: "/Second" });
        act(() => notifySettingChanged!());
        await flushPromises();

        await waitFor(() => expect(iframeSrc()).toContain("fileid=22"));
        expect(iframeSrc()).not.toContain("fileid=11");
    });
});
