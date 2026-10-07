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

import { _t } from "../../../languageHandler";
import { Key } from "../../../Keyboard";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import * as Email from "../../../email";
import { parseAddressList } from "../../../utils/watcha_emailAddressList";
import { MAX_INVITATIONS_PER_BATCH } from "../../../utils/watcha_inviteLimits";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import { IUser } from "./watcha_InviteDialog";

/** Temps laissé à la frappe avant d'interroger l'annuaire sur les adresses saisies. */
const LOOKUP_DELAY_MS = 400;
/** Requêtes d'annuaire menées de front : un collage de 50 adresses ne doit pas en lancer 50 d'un coup. */
const LOOKUP_CONCURRENCY = 5;

interface IProps {
    room?: Room;
    originalList: IUser[];
    suggestedList: IUser[];
    selectedList: IUser[];
    // `knownUsers` : les comptes trouvés pour les adresses retenues, pour qu'ils
    // soient invités par leur identifiant plutôt que par leur adresse.
    addEmailAddressesToSelectedList: (emailAddresses: string[], knownUsers?: IUser[]) => void;
    onFinished(): void;
}

interface IState {
    input: string;
    // The email addresses bound to the account of the current user. `null` until
    // they have been fetched from the homeserver.
    ownEmailAddresses: string[] | null;
    // Résultat de la recherche dans l'annuaire, par adresse en minuscules : le
    // compte trouvé, ou `null` si l'annuaire n'en connaît aucun.
    lookedUp: Record<string, IUser | null>;
    // Vrai tant que des adresses saisies n'ont pas encore été cherchées.
    lookupPending: boolean;
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
    private lookupTimer?: number;
    private unmounted = false;

    constructor(props: IProps) {
        super(props);
        this.state = {
            input: "",
            ownEmailAddresses: null,
            lookedUp: {},
            lookupPending: false,
        };
    }

    public componentDidMount() {
        this.fieldRef.current?.focus();
        this.fetchOwnEmailAddresses();
        // Les membres d'un salon sont chargés à la demande : sans eux, un membre
        // déjà présent ne serait pas reconnu comme tel.
        void this.props.room?.loadMembersIfNeeded();
    }

    public componentWillUnmount() {
        this.unmounted = true;
        window.clearTimeout(this.lookupTimer);
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
        const input = event.target.value;
        this.setState({ input, lookupPending: this.addressesToLookUp(input).length > 0 });
        window.clearTimeout(this.lookupTimer);
        this.lookupTimer = window.setTimeout(() => void this.lookUpAddresses(), LOOKUP_DELAY_MS);
    };

    /** Les adresses saisies dont on ignore encore si elles correspondent à un compte. */
    private addressesToLookUp = (input: string): string[] => {
        const { lookedUp } = this.state;
        return parseAddressList(input).addresses.filter(
            (address) => !(address.toLowerCase() in lookedUp) && !this.getListedUser(address),
        );
    };

    /**
     * Cherche dans l'annuaire chaque adresse saisie. Les listes du dialogue
     * d'invitation ne suffisent pas : elles ne portent que la première page de
     * l'annuaire, si bien qu'un membre du salon pouvait passer pour une adresse
     * inconnue, recevoir une invitation par e-mail, et la voir refusée par le
     * serveur.
     */
    private lookUpAddresses = async (): Promise<void> => {
        const pending = this.addressesToLookUp(this.state.input);
        if (!pending.length) {
            this.setState({ lookupPending: false });
            return;
        }

        const client = MatrixClientPeg.get();
        const found: Record<string, IUser | null> = {};
        for (let start = 0; start < pending.length; start += LOOKUP_CONCURRENCY) {
            await Promise.all(
                pending.slice(start, start + LOOKUP_CONCURRENCY).map(async (address) => {
                    found[address.toLowerCase()] = client ? await this.searchDirectory(address) : null;
                }),
            );
        }
        if (this.unmounted) {
            return;
        }

        this.setState(({ lookedUp, input }) => {
            const merged = { ...lookedUp, ...found };
            const stillPending = parseAddressList(input).addresses.some(
                (address) => !(address.toLowerCase() in merged) && !this.getListedUser(address),
            );
            return { lookedUp: merged, lookupPending: stillPending };
        });
    };

    private searchDirectory = async (address: string): Promise<IUser | null> => {
        const lower = address.toLowerCase();
        try {
            const { results } = await MatrixClientPeg.get()!.searchUserDirectory({ term: address, limit: 10 });
            const match = results.find((result) => (result as { email?: string }).email?.toLowerCase() === lower);
            if (!match) {
                return null;
            }
            const email = (match as { email?: string }).email;
            return {
                address: match.user_id,
                addressType: email ? "email" : "mx-user-id",
                displayName: match.display_name || email || match.user_id,
                avatarUrl: match.avatar_url,
                email,
                isKnown: true,
            };
        } catch (error) {
            // Faute de réponse, l'adresse reste traitée comme inconnue : le
            // serveur refusera de toute façon d'inviter un membre déjà présent.
            console.error("Error whilst looking up an email address in the user directory: ", error);
            return null;
        }
    };

    private onOk = () => {
        if (this.state.lookupPending) {
            return;
        }
        const { accepted } = this.review();
        if (!accepted.length) {
            return;
        }
        const knownUsers = accepted
            .map((address) => this.getUserFromEmailAddress(address))
            .filter((user): user is IUser => !!user);
        this.props.addEmailAddressesToSelectedList(accepted, knownUsers);
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
        const { selectedList, room } = this.props;
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
            const knownUser = this.getUserFromEmailAddress(address);
            const membership = room && knownUser ? room.getMember(knownUser.address)?.membership : undefined;

            if (ownEmailAddresses?.includes(address)) {
                reject(_t("watcha|email_already_bound"));
            } else if (selectedList.some(user => user.address === address)) {
                reject(_t("watcha|email_already_add"));
            } else if (selectedList.some(user => user.email === address)) {
                reject(_t("watcha|user_already_add"));
            } else if (knownUser && membership === "join") {
                reject(_t("watcha|user_already_room_member", { name: knownUser.displayName }));
            } else if (knownUser && membership === "invite") {
                reject(_t("watcha|user_already_inivte_room", { name: knownUser.displayName }));
            } else if (
                // A known user keeps being invitable whatever its email domain.
                !knownUser &&
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

    /** Le compte d'une adresse parmi ceux que le dialogue d'invitation a déjà affichés. */
    private getListedUser = (emailAddress: string): IUser | undefined => {
        const lower = emailAddress.toLowerCase();
        const { suggestedList, originalList } = this.props;
        return [...suggestedList, ...originalList].find((user) => user.email?.toLowerCase() === lower);
    };

    /** Le compte d'une adresse, affiché par le dialogue ou trouvé dans l'annuaire. */
    private getUserFromEmailAddress = (emailAddress: string): IUser | undefined => {
        return this.getListedUser(emailAddress) ?? this.state.lookedUp[emailAddress.toLowerCase()] ?? undefined;
    };

    public render() {
        const { onFinished } = this.props;
        const { input, lookupPending } = this.state;
        const { accepted, rejected, overflow } = this.review();
        // Ce que pèsera l'envoi : la liste d'invitation déjà constituée, plus ce
        // que la saisie courante y ajouterait.
        const used = this.props.selectedList.length + accepted.length;

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
                    { /* Le plafond est annoncé dès l'ouverture, et pas seulement
                         quand il mord : on doit pouvoir doser sa liste avant de
                         coller, pas après s'être fait tronquer. */ }
                    <div
                        className={
                            "watcha_InvitePartnerDialog_budget" +
                            (used >= MAX_INVITATIONS_PER_BATCH ? " watcha_InvitePartnerDialog_budget_full" : "")
                        }
                    >
                        { _t("watcha|email_addresses_budget", {
                            used,
                            max: MAX_INVITATIONS_PER_BATCH,
                        }) }
                    </div>
                    { /* Tant qu'une adresse n'a pas été cherchée, on ne sait pas
                         si elle appartient à un membre du salon : l'ajout attend. */ }
                    { lookupPending && (
                        <div className="watcha_InvitePartnerDialog_checking">
                            { _t("watcha|email_addresses_checking") }
                        </div>
                    ) }
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
                    primaryDisabled={!accepted.length || lookupPending}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={onFinished}
                />
            </BaseDialog>
        );
    }
}
