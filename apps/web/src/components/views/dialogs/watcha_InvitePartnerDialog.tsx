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

import React, { createRef } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { _t } from "../../../languageHandler";
import { Key } from "../../../Keyboard";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import * as Email from "../../../email";
import { parseAddressList } from "../../../utils/watcha_emailAddressList";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import { IUser } from "./watcha_InviteDialog";

/**
 * Plafond du nombre d'invitations d'un même envoi. Garde-fou contre le collage
 * d'une colonne entière de tableur, et alignement sur le `burst_count` de
 * `rc_third_party_invite` côté serveur : au-delà, les invitations ne partent
 * plus d'un bloc mais s'étalent au rythme du limiteur.
 */
export const MAX_INVITATIONS_PER_BATCH = 50;

interface IProps {
    room?: Room;
    originalList: IUser[];
    suggestedList: IUser[];
    selectedList: IUser[];
    addEmailAddressesToSelectedList: (emailAddresses: string[]) => void;
    onFinished(): void;
}

interface IState {
    input: string;
    // The email addresses bound to the account of the current user. `null` until
    // they have been fetched from the homeserver.
    ownEmailAddresses: string[] | null;
}

interface IRejectedAddress {
    address: string;
    reason: string;
}

interface IReview {
    accepted: string[];
    rejected: IRejectedAddress[];
    // Adresses valides écartées faute de place sous le plafond. Comptées à
    // part : un collage trop gros en produirait des centaines, qui noieraient
    // les adresses réellement en faute dans le récapitulatif.
    overflow: string[];
}

export default class InvitePartnerDialog extends React.Component<IProps, IState> {
    private fieldRef: React.RefObject<Field | null> = createRef();

    constructor(props: IProps) {
        super(props);
        this.state = {
            input: "",
            ownEmailAddresses: null,
        };
    }

    public componentDidMount() {
        this.fieldRef.current?.focus();
        this.fetchOwnEmailAddresses();
    }

    private fetchOwnEmailAddresses = async () => {
        try {
            const { threepids } = await MatrixClientPeg.get()!.getThreePids();
            this.setState({
                ownEmailAddresses: threepids
                    .filter(threepid => threepid.medium === "email")
                    .map(threepid => threepid.address),
            });
        } catch (error) {
            console.error("Error whilst fetching the email addresses of the user: ", error);
            this.setState({ ownEmailAddresses: [] });
        }
    };

    private onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ input: event.target.value });
    };

    private onOk = () => {
        const { accepted } = this.review();
        if (!accepted.length) {
            return;
        }
        this.props.addEmailAddressesToSelectedList(accepted);
        this.props.onFinished();
    };

    private onKeyDown = (event: KeyboardEvent | React.KeyboardEvent<Element>) => {
        // A bare `Enter` inserts a line break, as the field holds a list of
        // addresses spread over several lines.
        if (event.key === Key.ENTER && (event.ctrlKey || event.metaKey)) {
            this.onOk();
            event.preventDefault();
            event.stopPropagation();
        }
    };

    /**
     * Sorts the addresses of the input between the ones that can be invited and
     * the ones that must be discarded, along with the reason why.
     */
    private review = (): IReview => {
        const { originalList, suggestedList, selectedList, room } = this.props;
        const { ownEmailAddresses } = this.state;
        const { addresses, malformed } = parseAddressList(this.state.input);

        const accepted: string[] = [];
        const overflow: string[] = [];
        const rejected: IRejectedAddress[] = malformed.map(address => ({
            address,
            reason: _t("watcha|enter_valid_email"),
        }));

        // Les personnes déjà dans la liste d'invitation consomment le plafond :
        // c'est bien le nombre d'invitations de l'envoi qui est borné, pas le
        // nombre d'adresses collées d'un coup.
        const remaining = Math.max(0, MAX_INVITATIONS_PER_BATCH - selectedList.length);

        for (const address of addresses) {
            const reject = (reason: string) => rejected.push({ address, reason });

            if (ownEmailAddresses?.includes(address)) {
                reject(_t("watcha|email_already_bound"));
            } else if (selectedList.some(user => user.address === address)) {
                reject(_t("watcha|email_already_add"));
            } else if (selectedList.some(user => user.email === address)) {
                reject(_t("watcha|user_already_add"));
            } else if (room && this.isMemberWithMembership(address, "join")) {
                reject(_t("watcha|user_already_room_member"));
            } else if (room && this.isMemberWithMembership(address, "invite")) {
                reject(_t("watcha|user_already_inivte_room"));
            } else if (
                // A known user keeps being invitable whatever its email domain.
                !suggestedList.some(user => user.email === address) &&
                !originalList.some(user => user.email === address) &&
                Email.hasForbiddenDomainForPartner(address)
            ) {
                reject(_t("watcha|error_email_domain", { domain: address.split("@")[1] }));
            } else if (accepted.length >= remaining) {
                // Le plafond s'applique en dernier : une adresse en faute est
                // signalée pour ce qu'elle est, pas comme étant « en trop ».
                overflow.push(address);
            } else {
                accepted.push(address);
            }
        }

        return { accepted, rejected, overflow };
    };

    private isMemberWithMembership = (emailAddress: string, membership: "join" | "invite"): boolean => {
        const user = this.getUserFromEmailAddress(emailAddress);
        if (!user) {
            return false;
        }
        const { room } = this.props;
        if (!room) throw new Error("Room ID given to InviteDialog does not look like a room");
        const members = room.getMembersWithMembership(membership);
        return members.some((member: RoomMember) => member.userId === user.address);
    };

    private getUserFromEmailAddress = (emailAddress: string) => {
        const { originalList } = this.props;
        for (const user of originalList) {
            if (user.email === emailAddress) {
                return user;
            }
        }
    };

    public render() {
        const { onFinished } = this.props;
        const { input } = this.state;
        const { accepted, rejected, overflow } = this.review();

        return (
            <BaseDialog
                className="watcha_InvitePartnerDialog"
                title={_t("invite|email_caption")}
                onKeyDown={this.onKeyDown}
                onFinished={onFinished}
            >
                <div className="mx_Dialog_content">
                    <Field
                        id="emailAddresses"
                        element="textarea"
                        rows={6}
                        ref={this.fieldRef}
                        label={_t("watcha|email_addresses_field_label")}
                        placeholder={_t("watcha|email_addresses_placeholder")}
                        value={input}
                        onChange={this.onChange}
                    />
                    <div className="watcha_InvitePartnerDialog_hint">{ _t("watcha|email_addresses_hint") }</div>
                    { rejected.length > 0 && (
                        <div className="watcha_InvitePartnerDialog_rejected">
                            <span>{ _t("watcha|ignored_email_addresses") }</span>
                            <ul>
                                { rejected.map(({ address, reason }) => (
                                    <li key={address}>
                                        <span className="watcha_InvitePartnerDialog_rejected_address">{ address }</span>
                                        { ` — ${reason}` }
                                    </li>
                                )) }
                            </ul>
                        </div>
                    ) }
                    { overflow.length > 0 && (
                        <div className="watcha_InvitePartnerDialog_overLimit">
                            { _t("watcha|email_addresses_over_limit", {
                                count: overflow.length,
                                max: MAX_INVITATIONS_PER_BATCH,
                            }) }
                        </div>
                    ) }
                </div>
                <DialogButtons
                    primaryButton={
                        accepted.length
                            ? _t("watcha|add_email_addresses", { count: accepted.length })
                            : _t("action|add")
                    }
                    primaryDisabled={!accepted.length}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={onFinished}
                />
            </BaseDialog>
        );
    }
}
