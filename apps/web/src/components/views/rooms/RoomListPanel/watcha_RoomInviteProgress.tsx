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

import React, { type JSX, useEffect, useState } from "react";

import ProgressBar from "../../elements/ProgressBar";
import { _t } from "../../../../languageHandler";
import {
    getRoomInviteProgress,
    subscribeToInviteProgress,
    type IRoomInviteProgress,
} from "../../../../utils/watcha_backgroundInvite";

const sameProgress = (a: IRoomInviteProgress | null, b: IRoomInviteProgress | null): boolean =>
    a === b || (!!a && !!b && a.sent === b.sent && a.total === b.total && a.started === b.started);

interface IProps {
    roomId: string;
}

/**
 * La progression d'un envoi d'invitations, sous le nom du salon concerné.
 *
 * Le toast ne montre qu'un envoi à la fois et se ferme ; la liste des salons,
 * elle, dit en permanence où en est chaque salon — y compris ceux dont le lot
 * attend encore son tour. Rend `null` quand le salon n'a rien en cours, ce qui
 * est le cas de la quasi-totalité des lignes.
 */
export const WatchaRoomInviteProgress: React.FC<IProps> = ({ roomId }): JSX.Element | null => {
    const [progress, setProgress] = useState<IRoomInviteProgress | null>(() => getRoomInviteProgress(roomId));

    useEffect(() => {
        const refresh = (): void => {
            const next = getRoomInviteProgress(roomId);
            // Garder l'objet précédent quand rien n'a bougé : toutes les lignes
            // affichées sont abonnées, et chaque invitation qui part les
            // réveille toutes. React s'arrête là si l'état est inchangé.
            setProgress((previous) => (sameProgress(previous, next) ? previous : next));
        };
        // La ligne peut être montée alors qu'un envoi tourne déjà (défilement
        // d'une liste virtualisée, changement d'espace).
        refresh();
        return subscribeToInviteProgress(refresh);
    }, [roomId]);

    if (!progress) return null;

    const { sent, total, started } = progress;
    const label = started
        ? _t("watcha|invite_progress", { sent, total })
        : _t("watcha|invite_progress_pending", { total });

    return (
        <div className="watcha_RoomInviteProgress" title={label} aria-label={label}>
            {/* Sans animation : la ligne est remontée à chaque recyclage de la
                liste virtualisée, et la barre repartirait de zéro à l'écran. */}
            <ProgressBar value={sent} max={total} animated={false} />
            <span className="watcha_RoomInviteProgress_count">{`${sent}/${total}`}</span>
        </div>
    );
};

export default WatchaRoomInviteProgress;
