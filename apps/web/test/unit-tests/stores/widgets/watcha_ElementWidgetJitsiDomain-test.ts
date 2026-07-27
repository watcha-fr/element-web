/*
Copyright 2026 Watcha

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IWidget } from "matrix-widget-api";

import { ElementWidget } from "../../../../src/stores/widgets/WidgetMessaging";
import SdkConfig from "../../../../src/SdkConfig";
import { Jitsi } from "../../../../src/widgets/Jitsi";

/**
 * A widget records its conference domain in the room state, so a widget created
 * before an infrastructure migration keeps pointing at the decommissioned host
 * for ever. The conference then fails to load, and the only workaround available
 * to users is to delete the widget and add it back.
 */
describe("ElementWidget Jitsi conference domain", () => {
    const STALE_DOMAIN = "jitsi.old.example.org";
    const PREFERRED_DOMAIN = "jitsi.new.example.org";

    /** A Jitsi widget as actually stored in room state, with a stale domain. */
    const jitsiWidget = (domain?: string): IWidget =>
        ({
            id: "jitsi",
            creatorUserId: "@alice:example.org",
            type: "jitsi",
            name: "Jitsi",
            url: "https://example.org/app/jitsi.html?confId=conf1#conferenceDomain=$domain&conferenceId=$conferenceId",
            data: {
                conferenceId: "conf1",
                roomName: "Réunion",
                isAudioOnly: false,
                isVideoChannel: false,
                domain,
                auth: null,
            },
        }) as unknown as IWidget;

    beforeEach(() => {
        SdkConfig.reset();
        SdkConfig.add({ jitsi: { preferred_domain: PREFERRED_DOMAIN } });
        // Jitsi is a singleton reading the config lazily; force it to re-read.
        Jitsi.getInstance()["update"]();
    });

    afterEach(() => {
        SdkConfig.reset();
    });

    describe("by default", () => {
        it("honours the domain stored in the widget", () => {
            // Deployments may deliberately run several Jitsi hosts, and sending
            // everyone to one of them would put participants in different calls.
            const widget = new ElementWidget(jitsiWidget(STALE_DOMAIN));

            expect(widget.rawData.domain).toBe(STALE_DOMAIN);
        });

        it("still falls back to meet.element.io for a v1 widget with no domain", () => {
            const widget = new ElementWidget(jitsiWidget(undefined));

            expect(widget.rawData.domain).toBe("meet.element.io");
        });
    });

    describe("with jitsi.force_preferred_domain enabled", () => {
        beforeEach(() => {
            SdkConfig.add({
                jitsi: { preferred_domain: PREFERRED_DOMAIN, force_preferred_domain: true },
            });
            Jitsi.getInstance()["update"]();
        });

        it("replaces a stale domain with the configured one", () => {
            const widget = new ElementWidget(jitsiWidget(STALE_DOMAIN));

            expect(widget.rawData.domain).toBe(PREFERRED_DOMAIN);
        });

        it("leaves an up-to-date widget untouched", () => {
            const widget = new ElementWidget(jitsiWidget(PREFERRED_DOMAIN));

            expect(widget.rawData.domain).toBe(PREFERRED_DOMAIN);
        });

        it("substitutes the corrected domain into the widget url", () => {
            // The stale domain must not survive template substitution either:
            // $domain is what the wrapper reads as conferenceDomain.
            const widget = new ElementWidget(jitsiWidget(STALE_DOMAIN));

            const url = widget.getCompleteUrl({
                widgetRoomId: "!1:example.org",
                currentUserId: "@alice:example.org",
            });

            expect(url).toContain(PREFERRED_DOMAIN);
            expect(url).not.toContain(STALE_DOMAIN);
        });

        it("does not touch a non-Jitsi widget", () => {
            // Only Jitsi widgets carry a conference domain; overriding `domain`
            // on an arbitrary widget would corrupt unrelated widget data.
            const other = {
                id: "other",
                creatorUserId: "@alice:example.org",
                type: "m.custom",
                name: "Custom",
                url: "https://example.org/widget",
                data: { domain: STALE_DOMAIN },
            } as unknown as IWidget;

            expect(new ElementWidget(other).rawData.domain).toBe(STALE_DOMAIN);
        });

        it("preserves the other conference data", () => {
            const widget = new ElementWidget(jitsiWidget(STALE_DOMAIN));

            expect(widget.rawData).toMatchObject({
                conferenceId: "conf1",
                roomName: "Réunion",
                isAudioOnly: false,
                isVideoChannel: false,
            });
        });
    });
});
