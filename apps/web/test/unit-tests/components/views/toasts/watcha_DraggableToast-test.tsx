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
import { render, screen } from "jest-matrix-react";

import DraggableToast from "../../../../../src/components/views/toasts/watcha_DraggableToast";

/** The markup `ToastContainer` builds around the component of a toast. */
const renderToast = (): ReturnType<typeof render> =>
    render(
        <div className="mx_ToastContainer" role="alert">
            <div className="mx_Toast_toast">
                <div className="mx_Toast_title">Sending the invitations</div>
                <div className="mx_Toast_body">
                    <DraggableToast>
                        <div className="mx_Toast_description">1 of 3 sent</div>
                        <button>Dismiss</button>
                    </DraggableToast>
                </div>
            </div>
        </div>,
    );

const getContainer = (): HTMLElement => document.querySelector<HTMLElement>(".mx_ToastContainer")!;

/**
 * The offsets accumulate from one test to the next — the position is kept on
 * purpose so a later toast comes back where the user had put it — so the
 * assertions are made on the movement, not on an absolute position.
 */
const offsetOf = (element: HTMLElement): { x: number; y: number } => {
    const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(element.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
};

/**
 * jsdom implements no `PointerEvent`, and the fallback of `fireEvent` drops the
 * coordinates as well as the button: a `MouseEvent` carries both, the pointer
 * fields are added by hand.
 */
const pointerEvent = (type: string, init: MouseEventInit): MouseEvent => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
    Object.defineProperty(event, "pointerId", { value: 1 });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    return event;
};

const drag = (from: Element, deltaX: number, deltaY: number, button = 0): void => {
    from.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100, button }));
    window.dispatchEvent(pointerEvent("pointermove", { clientX: 100 + deltaX, clientY: 100 + deltaY }));
    window.dispatchEvent(pointerEvent("pointerup", { clientX: 100 + deltaX, clientY: 100 + deltaY }));
};

describe("watcha_DraggableToast", () => {
    it("moves the shared toast container along with the pointer", () => {
        renderToast();
        const container = getContainer();
        const before = offsetOf(container);

        drag(screen.getByText("Sending the invitations"), 30, 40);

        const after = offsetOf(container);
        expect(after.x - before.x).toBe(30);
        expect(after.y - before.y).toBe(40);
        expect(container).toHaveClass("watcha_DraggableToast");
        expect(container).not.toHaveClass("watcha_DraggableToast_dragging");
    });

    it("takes a barely moved pointer for a click, not a drag", () => {
        renderToast();
        const container = getContainer();
        const before = container.style.transform;

        drag(screen.getByText("1 of 3 sent"), 3, 2);

        expect(container.style.transform).toBe(before);
    });

    it("stays put on a right click, which is meant for the context menu", () => {
        renderToast();
        const container = getContainer();
        const before = container.style.transform;

        drag(screen.getByText("Sending the invitations"), 30, 40, 2);

        expect(container.style.transform).toBe(before);
    });

    it("leaves the buttons of the toast alone", () => {
        renderToast();
        const container = getContainer();
        const before = container.style.transform;

        drag(screen.getByRole("button", { name: "Dismiss" }), 30, 40);

        expect(container.style.transform).toBe(before);
    });

    it("hands the container back untouched, but remembers where the toast was put", () => {
        const { unmount } = renderToast();
        const container = getContainer();
        drag(screen.getByText("Sending the invitations"), 30, 40);
        const moved = container.style.transform;
        expect(moved).not.toBe("");

        unmount();

        // The container is shared: the next toast, which has no reason to be
        // moved, must get it back where the stylesheet puts it.
        expect(container.style.transform).toBe("");
        expect(container).not.toHaveClass("watcha_DraggableToast");

        // A later draggable toast, however, comes back where the user left it.
        renderToast();
        expect(getContainer().style.transform).toBe(moved);
    });
});
