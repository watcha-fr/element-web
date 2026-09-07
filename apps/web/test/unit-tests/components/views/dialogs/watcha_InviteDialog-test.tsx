/*
Copyright 2026 Watcha SAS.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// watcha+

import React from "react";
import { render, screen, fireEvent, waitFor } from "jest-matrix-react";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { type Mocked } from "jest-mock";

import InviteDialog from "../../../../../src/components/views/dialogs/watcha_InviteDialog";
import { InviteKind } from "../../../../../src/components/views/dialogs/InviteDialogTypes";
import { getMockClientWithEventEmitter, flushPromises } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

const roomId = "!room:example.org";
const myId = "@me:example.org";

describe("watcha_InviteDialog", () => {
    let mockClient: Mocked<MatrixClient>;
    let room: Room;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            getUserId: jest.fn().mockReturnValue(myId),
            getSafeUserId: jest.fn().mockReturnValue(myId),
            getRoom: jest.fn(),
            getRooms: jest.fn().mockReturnValue([]),
            getAccountData: jest.fn(),
            searchUserDirectory: jest.fn().mockResolvedValue({
                limited: false,
                results: [
                    { user_id: "@alice:example.org", display_name: "Alice", email: "alice@example.org" },
                    { user_id: "@bob:example.org", display_name: "Bob" },
                    { user_id: myId, display_name: "Me" },
                ],
            }),
            isGuest: jest.fn().mockReturnValue(false),
            getClientWellKnown: jest.fn(),
            mxcUrlToHttp: jest.fn(),
        });
        (mockClient as any).credentials = { userId: myId };
        room = new Room(roomId, mockClient, myId);
        mockClient.getRoom.mockReturnValue(room);
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
            getDMRoomsForUserId: jest.fn().mockReturnValue([]),
            getDMRoomForIdentifiers: jest.fn(),
        } as unknown as DMRoomMap);
    });

    it("renders the suggested user list after the initial directory search", async () => {
        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);
        await flushPromises();
        expect(mockClient.searchUserDirectory).toHaveBeenCalledWith({ term: "", limit: 500 });
        expect(await screen.findByText("Alice")).toBeInTheDocument();
        expect(await screen.findByText("Bob")).toBeInTheDocument();
        // the current user is excluded from suggestions
        expect(screen.queryByText("Me")).not.toBeInTheDocument();
    });

    it("updates the list when typing in the search box, even if the response arrives before the state commit", async () => {
        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);
        await flushPromises();

        // resolves in a microtask, i.e. before React has committed the
        // `query` state update: regression test for the React 19 batching
        // race in `doUserDirectorySearch`
        mockClient.searchUserDirectory.mockResolvedValue({
            limited: false,
            results: [{ user_id: "@alice:example.org", display_name: "Alice", email: "alice@example.org" }] as any,
        });
        fireEvent.change(screen.getByTestId("searchbox-input"), { target: { value: "ali" } });

        await waitFor(
            () => expect(mockClient.searchUserDirectory).toHaveBeenLastCalledWith({ term: "ali", limit: 500 }),
            { timeout: 2000 },
        );
        await waitFor(() => expect(screen.queryByText("Bob")).not.toBeInTheDocument(), { timeout: 2000 });
        expect(screen.getByText("Alice")).toBeInTheDocument();
    });
});

// +watcha
