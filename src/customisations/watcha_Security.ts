import { IMatrixClientCreds } from "matrix-react-sdk/src/MatrixClientPeg";

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function examineLoginResponse(response: any, credentials: IMatrixClientCreds): void {
    // E.g. add additional data to the persisted credentials
    // eslint-disable-next-line camelcase
    const { is_partner: isPartner } = response;
    if (isPartner) {
        credentials.partner = isPartner;
    }
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function persistCredentials(credentials: IMatrixClientCreds): void {
    // E.g. store any additional credential fields
    localStorage.setItem("watcha_is_partner", JSON.stringify(credentials.partner));
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface ISecurityCustomisations {
    examineLoginResponse?: typeof examineLoginResponse;
    persistCredentials?: typeof persistCredentials;
}

// A real customisation module will define and export one or more of the
// customisation points that make up `ISecurityCustomisations`.
export default {
    examineLoginResponse,
    persistCredentials,
} as ISecurityCustomisations;
