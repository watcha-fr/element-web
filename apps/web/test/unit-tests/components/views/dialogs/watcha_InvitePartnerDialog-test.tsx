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

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";

import InvitePartnerDialog, {
    MAX_INVITATIONS_PER_BATCH,
} from "../../../../../src/components/views/dialogs/watcha_InvitePartnerDialog";
import { type IUser } from "../../../../../src/components/views/dialogs/watcha_InviteDialog";
import { getMockClientWithEventEmitter, flushPromises } from "../../../../test-utils";

const addressList = (count: number, offset = 0): string[] =>
    Array.from({ length: count }, (_, index) => `partner${index + offset}@example.org`);

const selected = (addresses: string[]): IUser[] =>
    addresses.map((address) => ({ address, addressType: "email", displayName: address }) as IUser);

describe("watcha_InvitePartnerDialog — plafond par envoi", () => {
    let addEmailAddressesToSelectedList: jest.Mock;

    const renderDialog = (selectedList: IUser[] = []): void => {
        addEmailAddressesToSelectedList = jest.fn();
        render(
            <InvitePartnerDialog
                originalList={[]}
                suggestedList={[]}
                selectedList={selectedList}
                addEmailAddressesToSelectedList={addEmailAddressesToSelectedList}
                onFinished={jest.fn()}
            />,
        );
    };

    const paste = async (addresses: string[]): Promise<void> => {
        // Les adresses du compte courant sont chargées au montage : on laisse
        // cette promesse se résoudre avant de juger la saisie.
        await flushPromises();
        fireEvent.change(screen.getByRole("textbox"), { target: { value: addresses.join("\n") } });
    };

    beforeEach(() => {
        getMockClientWithEventEmitter({
            getThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        });
    });

    it("annonce le plafond dès l'ouverture, avant toute saisie", async () => {
        renderDialog();
        await flushPromises();

        expect(
            await screen.findByText(`0 of ${MAX_INVITATIONS_PER_BATCH} invitations in this batch`),
        ).toBeInTheDocument();
    });

    it("compte la liste d'invitation déjà constituée dans le budget annoncé", async () => {
        renderDialog(selected(addressList(20, 100)));
        await paste(addressList(3));

        expect(
            await screen.findByText(`23 of ${MAX_INVITATIONS_PER_BATCH} invitations in this batch`),
        ).toBeInTheDocument();
    });

    it("ne retient que les premières adresses et annonce celles laissées de côté", async () => {
        renderDialog();
        await paste(addressList(MAX_INVITATIONS_PER_BATCH + 5));

        expect(await screen.findByText(`Add ${MAX_INVITATIONS_PER_BATCH} addresses`)).toBeInTheDocument();
        expect(
            await screen.findByText(
                `Limit of ${MAX_INVITATIONS_PER_BATCH} invitations per batch: 5 addresses were left out.`,
            ),
        ).toBeInTheDocument();
    });

    it("n'ajoute que les adresses retenues", async () => {
        renderDialog();
        await paste(addressList(MAX_INVITATIONS_PER_BATCH + 5));

        fireEvent.click(await screen.findByText(`Add ${MAX_INVITATIONS_PER_BATCH} addresses`));

        const added = addEmailAddressesToSelectedList.mock.calls[0][0];
        expect(added).toHaveLength(MAX_INVITATIONS_PER_BATCH);
        expect(added[0]).toBe("partner0@example.org");
    });

    it("compte les personnes déjà dans la liste d'invitation dans le plafond", async () => {
        renderDialog(selected(addressList(MAX_INVITATIONS_PER_BATCH - 2, 100)));
        await paste(addressList(5));

        expect(await screen.findByText("Add 2 addresses")).toBeInTheDocument();
        expect(
            await screen.findByText(
                `Limit of ${MAX_INVITATIONS_PER_BATCH} invitations per batch: 3 addresses were left out.`,
            ),
        ).toBeInTheDocument();
    });

    it("laisse le bouton inactif quand la liste d'invitation est déjà pleine", async () => {
        renderDialog(selected(addressList(MAX_INVITATIONS_PER_BATCH, 100)));
        await paste(addressList(2));

        expect(
            await screen.findByText(
                `Limit of ${MAX_INVITATIONS_PER_BATCH} invitations per batch: 2 addresses were left out.`,
            ),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("signale une adresse invalide pour ce qu'elle est, pas comme étant en trop", async () => {
        renderDialog();
        await paste(["pas-une-adresse", ...addressList(2)]);

        expect(await screen.findByText(/pas-une-adresse/)).toBeInTheDocument();
        expect(screen.queryByText(/left out/)).not.toBeInTheDocument();
    });
});
