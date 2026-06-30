/*
Copyright 2026 Watcha SAS.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// watcha+
// STUB Watcha : l'ancien Tooltip d'element-web a été remplacé par
// `@vector-im/compound-web`'s Tooltip. Stub temporaire pour permettre la
// compilation de watcha_InviteDialog.tsx en attendant un refactor vers compound-web.
// TODO refactor : utiliser Tooltip de @vector-im/compound-web dans watcha_InviteDialog.tsx

import React, { type ReactNode } from "react";

export enum Alignment {
    Natural,
    Left,
    Right,
    Top,
    Bottom,
    InnerBottom,
}

interface ITooltipProps {
    label?: ReactNode;
    alignment?: Alignment;
    visible?: boolean;
    className?: string;
    tooltipClassName?: string;
    children?: ReactNode;
}

class Tooltip extends React.Component<ITooltipProps> {
    public static readonly Alignment = Alignment;

    public render(): ReactNode {
        return this.props.children ?? null;
    }
}

export default Tooltip;
// +watcha
