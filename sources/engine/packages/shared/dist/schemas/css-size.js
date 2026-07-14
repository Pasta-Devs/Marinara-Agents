// Shared CSS payload limits for user-authored page-injected CSS.
export const MAX_USER_CSS_BYTES = 256 * 1024; // 256 KiB
// `z.string().max(n)` counts UTF-16 code units, so a CSS file full of
// multi-byte characters can exceed the intended storage/network budget while
// still passing validation. Measure actual UTF-8 bytes instead.
export function utf8ByteLength(value) {
    let bytes = 0;
    for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);
        if (code < 0x80)
            bytes += 1;
        else if (code < 0x800)
            bytes += 2;
        else if (code >= 0xd800 && code < 0xdc00) {
            bytes += 4;
            i += 1;
        }
        else
            bytes += 3;
    }
    return bytes;
}
export const cssByteLimit = (value) => value == null || utf8ByteLength(value) <= MAX_USER_CSS_BYTES;
export const cssByteMessage = `CSS must be at most ${MAX_USER_CSS_BYTES} bytes`;
//# sourceMappingURL=css-size.js.map