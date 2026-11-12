import type { Registry } from "@polkadot/types/types";

/** Transform user-friendly input to SCALE-encoded params
 *
 * Maps input values by argument name, ensuring correct ABI order.
 * ABI args use camelCase names (auto-converted from snake_case by @polkadot/api-contract).
 */
export function transformUserInput(
    _registry: Registry,
    args: { name: string }[],
    input: Record<string, unknown>,
): unknown[] {
    return args.map((arg) => {
        const val = input[arg.name];
        if (val === undefined) {
            console.warn(`Missing argument: ${arg.name}, available keys:`, Object.keys(input));
        }
        return val;
    });
}
