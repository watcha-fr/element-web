/*
Copyright 2022 Watcha

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

import { getNextcloudWellKnown } from "./WellKnownUtils";
import SdkConfig from "../SdkConfig";

export const CALENDAR_EVENT_TYPE = "watcha.room.nextcloud_calendar";

export enum StateKeys {
    VEVENT_VTODO = "VEVENT_VTODO",
    VEVENT = "VEVENT",
    VTODO = "VTODO",
}

export enum AppNames {
    Files = "files",
    Calendar = "calendar",
    Tasks = "tasks",
}

export enum RefineTargets {
    Widget = "watcha_widget",
    DocumentSelector = "watcha_doc-selector",
}

export function getNextcloudBaseUrl() {
    const url = new URL(
        SdkConfig.get().watcha_nextcloud_base_url ||
            getNextcloudWellKnown()?.base_url ||
            window.location.origin + "/nextcloud",
    );
    if (!url.pathname.endsWith("/")) {
        url.pathname += "/";
    }
    return url;
}

export function getDocumentSelectorUrl(shareUrl: string, skipDirParam = true) {
    return getDocumentWidgetUrl(shareUrl, [RefineTargets.DocumentSelector], skipDirParam);
}

/**
 * The Nextcloud file id recorded in a stored share value, if any.
 *
 * The file id is the only stable way to designate a room folder: a mount name is
 * per-recipient (any member may rename their own mount, and Nextcloud appends a
 * suffix on collision), so the `dir` path stored by whoever picked the folder is
 * wrong for anyone whose mount is named differently.
 */
export function getShareFileId(shareUrl: string): string | null {
    if (!shareUrl) return null;
    try {
        return new URL(shareUrl).searchParams.get("fileid");
    } catch {
        // Values predating this format are not necessarily valid URLs.
        return null;
    }
}

/**
 * The same stored share value, carrying the given file id.
 *
 * Kept as a URL string rather than promoted to a richer object on purpose: the
 * value lives in room state and is read by every client version in the wild.
 * Older clients do `new URL(value)` and would throw on anything else, whereas an
 * extra query parameter is simply ignored by them. Forward-compatible, and it
 * needs no migration of the existing estate.
 */
export function withFileId(shareUrl: string, fileId: string | number): string {
    const url = new URL(shareUrl);
    url.searchParams.set("fileid", String(fileId));
    return url.toString();
}

export function getDocumentWidgetUrl(shareUrl: string, refineTargets: RefineTargets[] = [], skipDirParam = true) {
    let path = "/";
    let fileId = null;
    if (shareUrl) {
        const url = new URL(shareUrl);
        path = url.searchParams.get("dir")!;
        fileId = url.searchParams.get("fileid");
    }
    const appName = AppNames.Files;
    const searchParams = new Map([["dir", path]]);
    if (fileId) {
        searchParams.set("fileid", fileId);
    }
    return getWidgetUrl(appName, searchParams, refineTargets, skipDirParam);
}

export function getWidgetUrl(
    appName: AppNames,
    searchParams = new Map<string, string>(),
    refineTargets: RefineTargets[] = [],
    skipDirParam = false,
) {
    refineTargets = [RefineTargets.Widget, ...refineTargets];
    return getIframeUrl(appName, searchParams, refineTargets, skipDirParam);
}

function getIframeUrl(
    appName: AppNames,
    searchParams = new Map<string, string>(),
    refineTargets: RefineTargets[] = [],
    skipDirParam = false,
) {
    const url = getNextcloudBaseUrl();
    url.pathname += `apps/${appName}`;
    for (const [key, value] of searchParams.entries()) {
        // watcha+
        // Prefer the file id and drop `dir` entirely when we have one. `dir` is
        // the folder path as seen by whoever selected the folder, which is not
        // the path it is mounted at for other members — each recipient may rename
        // their own mount and Nextcloud appends a suffix on collision. Sending a
        // `dir` that does not exist for the current user is what made the Files
        // app answer "folder not found"; given a `fileid` it resolves the path
        // itself. `dir` is still sent when no file id is known, so rooms that
        // have not been migrated yet keep working exactly as before.
        if (key == "dir" && skipDirParam && searchParams.get("fileid")) {
            continue;
        }
        // +watcha
        url.searchParams.append(key, value);
    }
    for (const target of refineTargets) {
        url.searchParams.append(target, "");
    }
    return url.toString();
}
