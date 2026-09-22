/*
Copyright 2026 Watcha

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

import { mocked } from "jest-mock";
import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import Modal from "../../../src/Modal";
import { inviteInBackground, isInviteInProgress } from "../../../src/utils/watcha_backgroundInvite";
import * as InviteProgressToast from "../../../src/toasts/watcha_InviteProgressToast";
import * as TestUtilsMatrix from "../../test-utils";

jest.mock("../../../src/toasts/watcha_InviteProgressToast");
jest.mock("../../../src/Modal", () => ({
    createDialog: jest.fn(),
}));

const ROOM_ID = "!room:server";
const EMAIL1 = "joe@example.com";
const EMAIL2 = "jane@example.com";
const EMAIL3 = "bob@example.com";

describe("inviteInBackground", () => {
    let client: jest.Mocked<MatrixClient>;

    beforeEach(() => {
        jest.resetAllMocks();
        mocked(Modal.createDialog).mockReturnValue({ close: jest.fn(), finished: new Promise(() => {}) });

        TestUtilsMatrix.stubClient();
        client = MatrixClientPeg.safeGet() as jest.Mocked<MatrixClient>;
        client.inviteByEmail = jest.fn().mockResolvedValue({});
    });

    it("reports its progress through a toast instead of a blocking dialog", async () => {
        await inviteInBackground(client, ROOM_ID, [EMAIL1, EMAIL2, EMAIL3]);

        // The blocking "Preparing invitations…" modal of MultiInviter must stay away.
        expect(Modal.createDialog).not.toHaveBeenCalled();

        // A toast is shown before the first invitation, then after each one.
        expect(mocked(InviteProgressToast.showProgressToast).mock.calls).toEqual([
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
        ]);
        expect(client.inviteByEmail).toHaveBeenCalledTimes(3);
    });

    it("reports a success once every invitation went through", async () => {
        await inviteInBackground(client, ROOM_ID, [EMAIL1, EMAIL2]);

        expect(InviteProgressToast.showSuccessToast).toHaveBeenCalledWith(2);
        expect(InviteProgressToast.showFailureToast).not.toHaveBeenCalled();
    });

    it("reports the addresses that could not be invited, with their reason", async () => {
        client.inviteByEmail = jest.fn().mockImplementation(async (_roomId: string, address: string) => {
            if (address === EMAIL2) {
                throw new MatrixError({ errcode: "M_BAD_STATE" });
            }
            return {};
        });

        await inviteInBackground(client, ROOM_ID, [EMAIL1, EMAIL2, EMAIL3]);

        expect(InviteProgressToast.showSuccessToast).not.toHaveBeenCalled();
        expect(InviteProgressToast.showFailureToast).toHaveBeenCalledTimes(1);
        const [sent, failures] = mocked(InviteProgressToast.showFailureToast).mock.calls[0];
        expect(sent).toBe(2);
        expect(failures).toHaveLength(1);
        expect(failures[0].address).toBe(EMAIL2);
        expect(failures[0].errorText).toBeTruthy();
    });

    /** Laisse tourner les micro-tâches jusqu'à ce que la condition soit vraie. */
    const until = async (predicate: () => boolean): Promise<void> => {
        for (let attempt = 0; attempt < 20 && !predicate(); attempt++) {
            await TestUtilsMatrix.flushPromises();
        }
    };

    it("refuses a second batch while the first one is still running", async () => {
        let unblock: () => void = () => {};
        client.inviteByEmail = jest
            .fn()
            .mockImplementation(() => new Promise<void>((resolve) => (unblock = () => resolve())));

        const first = inviteInBackground(client, ROOM_ID, [EMAIL1]);
        await until(() => client.inviteByEmail.mock.calls.length > 0);
        expect(isInviteInProgress()).toBe(true);

        await inviteInBackground(client, ROOM_ID, [EMAIL2, EMAIL3]);

        // Le second lot n'a envoyé aucune invitation, et n'a pas touché au toast
        // de progression du premier.
        expect(client.inviteByEmail).toHaveBeenCalledTimes(1);
        expect(mocked(InviteProgressToast.showProgressToast).mock.calls).toEqual([[0, 1]]);

        unblock();
        await first;
        expect(isInviteInProgress()).toBe(false);
    });

    it("releases the lock once the batch is over, failures included", async () => {
        client.inviteByEmail = jest.fn().mockRejectedValue(new MatrixError({ errcode: "M_BAD_STATE" }));

        await inviteInBackground(client, ROOM_ID, [EMAIL1]);

        expect(InviteProgressToast.showFailureToast).toHaveBeenCalled();
        expect(isInviteInProgress()).toBe(false);

        // Et un envoi suivant repart normalement.
        client.inviteByEmail = jest.fn().mockResolvedValue({});
        await inviteInBackground(client, ROOM_ID, [EMAIL2]);
        expect(client.inviteByEmail).toHaveBeenCalledTimes(1);
    });

    it("reports the addresses left aside when the invitations are given up on", async () => {
        // A permission error is fatal: MultiInviter stops without trying the rest.
        client.inviteByEmail = jest.fn().mockImplementation(async (_roomId: string, address: string) => {
            if (address === EMAIL1) {
                throw new MatrixError({ errcode: "M_FORBIDDEN" });
            }
            return {};
        });

        await inviteInBackground(client, ROOM_ID, [EMAIL1, EMAIL2, EMAIL3]);

        expect(client.inviteByEmail).toHaveBeenCalledTimes(1);
        const [sent, failures] = mocked(InviteProgressToast.showFailureToast).mock.calls[0];
        expect(sent).toBe(0);
        expect(failures.map((failure) => failure.address)).toEqual([EMAIL1, EMAIL2, EMAIL3]);
    });
});
