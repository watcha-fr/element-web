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

import React, { type ReactNode, useContext, useEffect, useState } from "react";
import classNames from "classnames";
import { type MatrixEvent, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../languageHandler";
import { UIFeature } from "../../settings/UIFeature";
import BaseCard from "../views/right_panel/BaseCard";
import defaultDispatcher from "../../dispatcher/dispatcher";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import SettingsStore from "../../settings/SettingsStore";
import Spinner from "../views/elements/Spinner";
import { type AppNames, CALENDAR_EVENT_TYPE, StateKeys, getWidgetUrl } from "../../utils/watcha_nextcloudUtils";

const getCalendarId = (room: Room, stateKey: string): string | undefined =>
    room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, stateKey)?.getContent()?.id ||
    room.currentState.getStateEvents(CALENDAR_EVENT_TYPE, StateKeys.VEVENT_VTODO)?.getContent()?.id;

interface IProps {
    roomId: string;
    appName: AppNames;
    stateKey: string;
    initialTabId: string;
    empty: ReactNode;
    emptyClass: string;
    onClose?: () => void;
}

const WatchaCalendarPanel: React.FC<IProps> = ({ roomId, appName, stateKey, initialTabId, empty, emptyClass, onClose }) => {
    const client = useContext(MatrixClientContext);
    const room = client.getRoom(roomId)!;

    const [calendarsReordering, setCalendarsReordering] = useState(true);
    const [iframeLoading, setIframeLoading] = useState(true);
    const [calendarId, setCalendarId] = useState<string | undefined>(getCalendarId(room, stateKey));

    const canSetCalendar = room.currentState.maySendStateEvent(CALENDAR_EVENT_TYPE, client.getUserId()!);

    useEffect(() => {
        const onRoomStateEvents = (event: MatrixEvent): void => {
            if (event.getRoomId() === roomId && event.getType() === CALENDAR_EVENT_TYPE) {
                setCalendarId(getCalendarId(room, stateKey));
            }
        };
        client.on(RoomStateEvent.Events, onRoomStateEvents);
        return () => {
            client.removeListener(RoomStateEvent.Events, onRoomStateEvents);
        };
    }, [roomId, room, stateKey, client]);

    useEffect(() => {
        if (calendarId) {
            setCalendarsReordering(true);
            setIframeLoading(true);
            client.reorderCalendars(calendarId).then(() => {
                setCalendarsReordering(false);
            });
        }
    }, [client, calendarId]);

    const onRoomSettingsClick = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: initialTabId,
        });
    };

    let panel: ReactNode = null;
    if (SettingsStore.getValue(UIFeature.watcha_Nextcloud)) {
        if (calendarId && calendarsReordering) {
            panel = <Spinner />;
        } else if (calendarId) {
            panel = (
                <>
                    {iframeLoading && <Spinner />}
                    <iframe
                        key={calendarId}
                        id="watcha_NextcloudPanel"
                        className={classNames("watcha_NextcloudPanel", {
                            "watcha_NextcloudPanel-hidden": iframeLoading,
                        })}
                        src={getWidgetUrl(appName)}
                        onLoad={() => {
                            setIframeLoading(false);
                        }}
                        title={appName}
                    />
                </>
            );
        } else {
            let hint: ReactNode;
            if (canSetCalendar) {
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

export default WatchaCalendarPanel;
