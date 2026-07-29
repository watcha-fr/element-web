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

import { parseAddressList } from "../../../src/utils/watcha_emailAddressList";

describe("parseAddressList", () => {
    it("returns nothing for an empty input", () => {
        expect(parseAddressList("")).toEqual({ addresses: [], malformed: [] });
        expect(parseAddressList("   \n\t ")).toEqual({ addresses: [], malformed: [] });
    });

    it("reads a single address", () => {
        expect(parseAddressList("  joe@example.com  ")).toEqual({
            addresses: ["joe@example.com"],
            malformed: [],
        });
    });

    it.each([
        ["semicolons", "joe@example.com;jane@example.com"],
        ["semicolons and spaces", "joe@example.com; jane@example.com"],
        ["commas", "joe@example.com, jane@example.com"],
        ["spaces", "joe@example.com jane@example.com"],
        ["line breaks", "joe@example.com\njane@example.com"],
        ["CRLF line breaks", "joe@example.com\r\njane@example.com"],
        ["tabs", "joe@example.com\tjane@example.com"],
        ["mixed separators", "joe@example.com ;\n , jane@example.com"],
    ])("splits addresses separated by %s", (_label, input) => {
        expect(parseAddressList(input).addresses).toEqual(["joe@example.com", "jane@example.com"]);
    });

    it("reads a column pasted from a spreadsheet", () => {
        const input = "joe@example.com\njane@example.com\r\nbob@example.com\n";
        expect(parseAddressList(input)).toEqual({
            addresses: ["joe@example.com", "jane@example.com", "bob@example.com"],
            malformed: [],
        });
    });

    it("reads several columns pasted from a spreadsheet, ignoring the other cells", () => {
        const input = "Doe\tJohn\tjoe@example.com\nRoe\tJane\tjane@example.com";
        expect(parseAddressList(input)).toEqual({
            addresses: ["joe@example.com", "jane@example.com"],
            malformed: [],
        });
    });

    it("reads addresses pasted from a mail client recipient field", () => {
        const input = '"Doe, John" <joe@example.com>, Jane Roe <jane@example.com>';
        expect(parseAddressList(input)).toEqual({
            addresses: ["joe@example.com", "jane@example.com"],
            malformed: [],
        });
    });

    it("strips the mailto scheme and the surrounding punctuation", () => {
        expect(parseAddressList("- mailto:joe@example.com,\n- jane@example.com.").addresses).toEqual([
            "joe@example.com",
            "jane@example.com",
        ]);
    });

    it("discards duplicates, whatever their case", () => {
        expect(parseAddressList("joe@example.com\nJoe@Example.com\njoe@example.com").addresses).toEqual([
            "joe@example.com",
        ]);
    });

    it("reports the addresses that are not usable, and ignores the display names", () => {
        expect(parseAddressList("Jean Dupont\njoe@example.com\njane@\nnot.an.address")).toEqual({
            addresses: ["joe@example.com"],
            malformed: ["jane@", "not.an.address"],
        });
    });

    it("keeps the order of the input", () => {
        expect(parseAddressList("c@example.com\na@example.com\nb@example.com").addresses).toEqual([
            "c@example.com",
            "a@example.com",
            "b@example.com",
        ]);
    });
});
