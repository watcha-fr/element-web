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

import React, { useEffect, useRef, type ReactNode } from "react";

import UIStore, { UI_EVENTS } from "../../../stores/UIStore";

/**
 * The dragged element is not the toast itself: `ToastContainer` is a single,
 * shared, absolutely positioned container which only ever renders the topmost
 * toast. So the offset is applied to that container, found from the wrapped
 * content, and the whole toast — title bar included — acts as the handle.
 *
 * The offset lives in module scope so that it survives the toast being
 * replaced: the progress toast is replaced at every invitation sent, then by
 * the final report. It is deliberately kept once the toast is gone, so a later
 * one comes back where the user had put it, and it is clamped to the viewport
 * every time it is applied.
 */
let offsetX = 0;
let offsetY = 0;

// Below this the gesture is a click, not a drag: helps with touchpads and
// nervous hands. Same threshold as `PictureInPictureDragger`.
const DRAG_THRESHOLD_PX = 5;

// A gesture started on one of these is meant for it, not for moving the toast.
const INTERACTIVE_SELECTOR = "button, a, input, textarea, select, [role='button']";

const CONTAINER_CLASS = "watcha_DraggableToast";
const DRAGGING_CLASS = "watcha_DraggableToast_dragging";

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

interface IProps {
    children: ReactNode;
}

/** Makes the toast it wraps movable by dragging it anywhere but its buttons. */
const DraggableToast: React.FC<IProps> = ({ children }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = ref.current?.closest<HTMLElement>(".mx_ToastContainer");
        if (!container) return;

        /** Geometry of the container as laid out by the stylesheet, offset aside. */
        const measureOrigin = (): DOMRect => {
            const applied = container.style.transform;
            container.style.transform = "none";
            const rect = container.getBoundingClientRect();
            container.style.transform = applied;
            return rect;
        };

        const applyOffset = (origin: DOMRect): void => {
            offsetX = clamp(offsetX, -origin.left, UIStore.instance.windowWidth - origin.right);
            offsetY = clamp(offsetY, -origin.top, UIStore.instance.windowHeight - origin.bottom);
            container.style.transform = offsetX || offsetY ? `translate(${offsetX}px, ${offsetY}px)` : "";
        };

        // Kept for the whole gesture: measuring on every move would mean two
        // layout passes per pointer event.
        let origin: DOMRect | null = null;
        let startX = 0;
        let startY = 0;
        let startOffsetX = 0;
        let startOffsetY = 0;
        let pointerId: number | null = null;
        let dragging = false;
        let dropped = false;

        const onPointerDown = (event: PointerEvent): void => {
            if (pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
            if ((event.target as Element | null)?.closest(INTERACTIVE_SELECTOR)) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            startOffsetX = offsetX;
            startOffsetY = offsetY;
            dropped = false;
        };

        const onPointerMove = (event: PointerEvent): void => {
            if (event.pointerId !== pointerId) return;
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            if (!dragging) {
                if (Math.abs(deltaX) < DRAG_THRESHOLD_PX && Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
                dragging = true;
                origin = measureOrigin();
                container.classList.add(DRAGGING_CLASS);
            }
            // Stops the text selection, and the scroll on a touch screen.
            event.preventDefault();
            offsetX = startOffsetX + deltaX;
            offsetY = startOffsetY + deltaY;
            applyOffset(origin!);
        };

        const onPointerUp = (event: PointerEvent): void => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            origin = null;
            if (!dragging) return;
            dragging = false;
            dropped = true;
            container.classList.remove(DRAGGING_CLASS);
        };

        // The pointer may well have been released over a link of the toast: the
        // click ending a drag is not one.
        const onClickCapture = (event: MouseEvent): void => {
            if (!dropped) return;
            dropped = false;
            event.preventDefault();
            event.stopPropagation();
        };

        // A window narrowed down to below the offset would leave the toast out
        // of reach.
        const onResize = (): void => applyOffset(measureOrigin());

        container.classList.add(CONTAINER_CLASS);
        applyOffset(measureOrigin());

        container.addEventListener("pointerdown", onPointerDown);
        container.addEventListener("click", onClickCapture, true);
        // On the window, so that a pointer outrunning the toast keeps moving it.
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        UIStore.instance.on(UI_EVENTS.Resize, onResize);

        return () => {
            container.removeEventListener("pointerdown", onPointerDown);
            container.removeEventListener("click", onClickCapture, true);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
            UIStore.instance.off(UI_EVENTS.Resize, onResize);
            // The container is shared: it must be handed back untouched to the
            // next toast, which has no reason to be moved.
            container.classList.remove(CONTAINER_CLASS, DRAGGING_CLASS);
            container.style.transform = "";
        };
    }, []);

    return <div ref={ref}>{children}</div>;
};

export default DraggableToast;
