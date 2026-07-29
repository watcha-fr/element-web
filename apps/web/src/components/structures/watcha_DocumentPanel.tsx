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

import React, { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../languageHandler";
import { UIFeature } from "../../settings/UIFeature";
import { useSettingValue } from "../../hooks/useSettings";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import Spinner from "../views/elements/Spinner";
import AccessibleButton from "../views/elements/AccessibleButton";
import { getDocumentWidgetUrl, getShareFileId, withFileId, withPath } from "../../utils/watcha_nextcloudUtils";
import { getRoomFolder, RoomFolderStatus } from "../../utils/watcha_nextcloudApi";

interface IProps {
    roomId: string;
    initialTabId: string;
    empty: ReactNode;
    emptyClass: string;
    onClose?: () => void;
}

/** What to show instead of the folder, when it cannot be reached. */
type Problem =
    | { kind: "notMember" }
    | { kind: "deleted" }
    | { kind: "rejected" }
    | { kind: "network"; retry: () => void };

const WatchaDocumentPanel: React.FC<IProps> = ({ roomId, initialTabId, empty, emptyClass, onClose }) => {
    const client = useMatrixClientContext();
    const [iframeLoading, setIframeLoading] = useState(true);
    const [resolving, setResolving] = useState(false);
    const [problem, setProblem] = useState<Problem | null>(null);
    /**
     * The folder as resolved for *this* user: its stable file id, and the path it
     * is actually mounted at for them. Both are needed — see `withPath`.
     */
    const [resolved, setResolved] = useState<{ fileId: number | null; path: string | null } | null>(null);
    const nextcloudShare = useSettingValue("nextcloudShare", roomId) as string | undefined;

    useEffect(() => {
        if (nextcloudShare) {
            setIframeLoading(true);
        }
    }, [nextcloudShare]);

    /**
     * Persist the resolved file id back into the room setting, so the folder is
     * addressed by a stable identifier from now on and no one has to migrate the
     * existing estate by hand.
     *
     * Silent on failure: most members cannot write room state, and the panel works
     * regardless — it just resolves again next time.
     */
    const rememberFileId = useCallback(
        (shareUrl: string, fileId: number) => {
            if (!SettingsStore.canSetValue("nextcloudShare", roomId, SettingLevel.ROOM)) return;
            if (getShareFileId(shareUrl) === String(fileId)) return;
            SettingsStore.setValue("nextcloudShare", roomId, SettingLevel.ROOM, withFileId(shareUrl, fileId)).catch(
                (error) => {
                    logger.warn("Could not record the Nextcloud file id on the room setting", error);
                },
            );
        },
        [roomId],
    );

    /**
     * Resolve the folder server-side, and act on *why* it is unreachable rather
     * than showing one dead end for every cause.
     */
    const resolve = useCallback(
        async (shareUrl: string): Promise<void> => {
            setResolving(true);
            try {
                const folder = await getRoomFolder(client, roomId);
                switch (folder.status) {
                    case RoomFolderStatus.Ok:
                    case RoomFolderStatus.NoShare:
                        setProblem(null);
                        setResolved({ fileId: folder.fileId, path: folder.path });
                        if (folder.fileId !== null) {
                            rememberFileId(shareUrl, folder.fileId);
                        }
                        return;

                    case RoomFolderStatus.Rejected:
                        setProblem({ kind: "rejected" });
                        return;

                    case RoomFolderStatus.NotMember:
                        setProblem({ kind: "notMember" });
                        return;

                    case RoomFolderStatus.Deleted:
                        setProblem({ kind: "deleted" });
                        return;
                }
            } catch (error) {
                logger.warn("Could not resolve the Nextcloud folder of this room", error);
                setProblem({ kind: "network", retry: () => void resolve(shareUrl) });
            } finally {
                setResolving(false);
            }
        },
        [client, roomId, rememberFileId],
    );

    // Resolve on every mount, and whenever the bound folder changes.
    //
    // Not only when the stored value lacks a file id: the *path* is per-user and
    // cannot be inferred from the room setting at all. Skipping this call was what
    // made the panel fall back to the stored path — or, worse, to the user's root.
    // It is a small authenticated GET, next to an iframe load.
    const resolveRef = useRef(resolve);
    resolveRef.current = resolve;
    useEffect(() => {
        setProblem(null);
        setResolved(null);
        if (nextcloudShare) {
            void resolveRef.current(nextcloudShare);
        }
    }, [nextcloudShare]);

    const onRoomSettingsClick = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: initialTabId,
        });
    };

    const problemView = (message: string, retry?: () => void): ReactNode => (
        <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper">
            <div className="mx_RoomView_empty">
                <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                    <h2>{_t("watcha|folder_unavailable")}</h2>
                    <p>{message}</p>
                    {retry && (
                        <AccessibleButton kind="primary_outline" onClick={retry} disabled={resolving}>
                            {_t("action|retry")}
                        </AccessibleButton>
                    )}
                </div>
            </div>
        </div>
    );

    let panel: ReactNode = null;
    if (SettingsStore.getValue(UIFeature.watcha_Nextcloud)) {
        if (problem) {
            switch (problem.kind) {
                case "notMember":
                    panel = problemView(_t("watcha|folder_not_member"));
                    break;
                case "deleted":
                    panel = problemView(_t("watcha|folder_deleted"));
                    break;
                case "rejected":
                    panel = problemView(_t("watcha|folder_rejected"));
                    break;
                case "network":
                    panel = problemView(_t("watcha|folder_unreachable"), problem.retry);
                    break;
            }
        } else if (nextcloudShare) {
            // Point the Files app at the folder as *this* user sees it: the path it
            // is mounted at for them, plus the stable file id so the folder stays
            // highlighted. Both come from the resolution above.
            //
            // Until it answers, fall back to the value stored in the room — the
            // pre-existing behaviour, correct for whoever picked the folder. Never
            // omit the path: without it the Files app opens the user's root.
            let shareUrl = nextcloudShare;
            if (resolved?.path) {
                shareUrl = withPath(shareUrl, resolved.path);
            }
            if (resolved?.fileId !== null && resolved?.fileId !== undefined) {
                shareUrl = withFileId(shareUrl, resolved.fileId);
            }
            panel = (
                <>
                    {(iframeLoading || resolving) && <Spinner />}
                    <iframe
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": iframeLoading,
                        })}
                        src={getDocumentWidgetUrl(shareUrl)}
                        onLoad={() => {
                            setIframeLoading(false);
                        }}
                        title={_t("watcha|document_sharing")}
                    />
                </>
            );
        } else {
            let hint: ReactNode;
            if (SettingsStore.canSetValue("nextcloudShare", roomId, "room" as any)) {
                hint = _t(
                    "watcha|share_resource_from_room_settings",
                    {},
                    {
                        span: (sub: ReactNode) => (
                            <span className="watcha_NextcloudPanel_settingsIcon-noWrap" onClick={onRoomSettingsClick}>
                                {sub}
                            </span>
                        ),
                    },
                );
            }
            panel = (
                <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper">
                    <div className="mx_RoomView_empty">
                        <div className={classNames("mx_RightPanel_empty", emptyClass)}>
                            <h2>{empty}</h2>
                            <p>{hint}</p>
                        </div>
                    </div>
                </div>
            );
        }
    }
    return (
        <BaseCard className="mx_FilePanel" withoutScrollContainer onClose={onClose}>
            {panel}
        </BaseCard>
    );
};

export default WatchaDocumentPanel;
