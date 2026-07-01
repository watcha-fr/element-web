// watcha+
declare module "another-json" {
    function stringify(value: unknown): string;
    function parse(text: string): unknown;
    const _default: {
        stringify: typeof stringify;
        parse: typeof parse;
    };
    export default _default;
    export { stringify, parse };
}
// +watcha
