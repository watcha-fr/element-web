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

import { type MatrixClient, Method } from "matrix-js-sdk/src/matrix";
import { WatchaPrefix } from "matrix-js-sdk/src/http-api";
import * as utils from "matrix-js-sdk/src/utils";

/**
 * Client access to the room document space, through Synapse.
 *
 * These go through the homeserver rather than straight to Nextcloud: the Watcha
 * Nextcloud app restricts every one of its routes to the service account (see its
 * SecurityMiddleware), and Synapse is also the only party that can authorise the
 * request properly — it checks that the caller is actually a member of the room
 * before resolving anything.
 *
 * Defined here rather than as matrix-js-sdk methods because the SDK is pinned to
 * a git revision; adding methods there would mean re-pinning it for every change.
 */

/**
 * Why a room folder is or is not reachable for the current user.
 *
 * Note there is deliberately no "share not accepted yet" state. Access is carried
 * by the parent group share; Nextcloud only materialises a per-recipient child
 * row lazily, when the recipient renames, moves or rejects their mount. A missing
 * child row is the normal state of a perfectly reachable folder, and reading it as
 * a defect once led to a whole fix being built on a wrong diagnosis.
 */
export enum RoomFolderStatus {
    /** Reachable; `fileId` and `path` are usable. */
    Ok = "ok",
    /** The recipient explicitly dismissed this share, so their mount was removed. */
    Rejected = "rejected",
    /** The user does not belong to the room's Nextcloud group. */
    NotMember = "not-member",
    /** The folder itself is gone. */
    Deleted = "deleted",
    /** No folder is bound to this room. */
    NoShare = "no-share",
}

export interface IRoomFolder {
    roomId: string;
    userId: string;
    groupId: string | null;
    status: RoomFolderStatus;
    /** Stable identifier of the folder. Never resolve a room folder by name. */
    fileId: number | null;
    /** The path as currently mounted for the calling user; per-recipient. */
    path: string | null;
    shareId: string | null;
}

/**
 * Resolve the calling user's view of a room's document folder.
 */
export function getRoomFolder(client: MatrixClient, roomId: string): Promise<IRoomFolder> {
    const path = utils.encodeUri("/rooms/$roomId/folder", { $roomId: roomId });
    return client.http.authedRequest(Method.Get, path, undefined, undefined, {
        prefix: WatchaPrefix.NEXTCLOUD,
    });
}
