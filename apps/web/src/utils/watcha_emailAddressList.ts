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

import * as Email from "../email";

// Characters that may sit between two addresses when the list is pasted from a
// spreadsheet column (newlines, tabs), from a mail client recipient field
// (comma, semicolon, angle brackets and quotes of `"John Doe" <joe@example.com>`)
// or simply typed by hand (spaces).
const SEPARATOR_REGEX = /[\s,;:<>"'()[\]|]+/;

// Punctuation that may trail or lead an address in a sentence or a bullet list.
const LEADING_PUNCTUATION_REGEX = /^[.,;:!?-]+/;
const TRAILING_PUNCTUATION_REGEX = /[.,;:!?-]+$/;

const MAILTO_REGEX = /mailto:/gi;

export interface IAddressListParseResult {
    // Valid addresses, in the order they appear, without duplicates.
    addresses: string[];
    // Tokens that were meant to be an address but are not usable, e.g. `joe@`.
    malformed: string[];
}

/**
 * Splits a free form input into the tokens that are worth being considered as
 * an email address. Tokens that are obviously part of a display name pasted
 * along with the addresses (`John`, `Doe`) are dropped, while tokens holding an
 * `@` or looking like a domain are kept so that typos can be reported.
 */
function tokenize(input: string): string[] {
    return input
        .replace(MAILTO_REGEX, "")
        .split(SEPARATOR_REGEX)
        .map((token) => token.replace(LEADING_PUNCTUATION_REGEX, "").replace(TRAILING_PUNCTUATION_REGEX, ""))
        .filter((token) => token.includes("@") || token.includes("."));
}

/**
 * Extracts the email addresses of a list pasted or typed by the user, whatever
 * the separators used: line breaks, tabs, spaces, commas or semicolons. This
 * allows a column of an Excel sheet to be pasted as is.
 */
export function parseAddressList(input: string): IAddressListParseResult {
    const addresses: string[] = [];
    const malformed: string[] = [];
    const seen = new Set<string>();

    for (const token of tokenize(input)) {
        const key = token.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        if (Email.looksValid(token)) {
            addresses.push(token);
        } else {
            malformed.push(token);
        }
    }

    return { addresses, malformed };
}
