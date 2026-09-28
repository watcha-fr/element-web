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
import { act, render, screen } from "jest-matrix-react";

import { WatchaRoomInviteProgress } from "../../../../../../src/components/views/rooms/RoomListPanel/watcha_RoomInviteProgress";
import { type IRoomInviteProgress } from "../../../../../../src/utils/watcha_backgroundInvite";

const ROOM_ID = "!room:server";

/**
 * L'état de la file est en portée module ; on pilote ici la façade que le
 * composant consomme, ce qui évite de faire tourner un vrai lot d'invitations.
 * Les noms commencent par `mock` : `jest.mock` est hissé en tête de fichier et
 * n'accepte de référence extérieure que sous ce préfixe.
 */
const mockListeners = new Set<() => void>();
let mockProgress: IRoomInviteProgress | null = null;

jest.mock("../../../../../../src/utils/watcha_backgroundInvite", () => ({
    getRoomInviteProgress: (roomId: string) => (roomId === "!room:server" ? mockProgress : null),
    subscribeToInviteProgress: (listener: () => void) => {
        mockListeners.add(listener);
        return () => {
            mockListeners.delete(listener);
        };
    },
}));

const setProgress = (next: IRoomInviteProgress | null): void => {
    mockProgress = next;
    act(() => {
        for (const listener of Array.from(mockListeners)) listener();
    });
};

describe("WatchaRoomInviteProgress", () => {
    beforeEach(() => {
        mockListeners.clear();
        mockProgress = null;
    });

    it("ne rend rien quand le salon n'a aucun envoi en cours", () => {
        const { container } = render(<WatchaRoomInviteProgress roomId={ROOM_ID} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("affiche la progression du lot en cours et la suit", () => {
        mockProgress = { sent: 3, total: 10, started: true };
        render(<WatchaRoomInviteProgress roomId={ROOM_ID} />);

        expect(screen.getByText("3/10")).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("max", "10");

        setProgress({ sent: 7, total: 10, started: true });
        expect(screen.getByText("7/10")).toBeInTheDocument();
    });

    it("annonce un lot qui attend encore son tour", () => {
        mockProgress = { sent: 0, total: 4, started: false };
        render(<WatchaRoomInviteProgress roomId={ROOM_ID} />);

        expect(screen.getByText("0/4")).toBeInTheDocument();
        // Le libellé distingue l'attente de l'envoi commencé.
        expect(screen.getByLabelText("Waiting to send 4 invitations")).toBeInTheDocument();
    });

    it("disparaît dès que l'envoi est terminé, et se désabonne au démontage", () => {
        mockProgress = { sent: 1, total: 2, started: true };
        const { container, unmount } = render(<WatchaRoomInviteProgress roomId={ROOM_ID} />);
        expect(mockListeners.size).toBe(1);

        setProgress(null);
        expect(container).toBeEmptyDOMElement();

        unmount();
        expect(mockListeners.size).toBe(0);
    });

    it("ignore les envois des autres salons", () => {
        mockProgress = { sent: 1, total: 2, started: true };
        const { container } = render(<WatchaRoomInviteProgress roomId="!autre:server" />);
        expect(container).toBeEmptyDOMElement();
    });
});
