import type { AnyJson, Registry, TypeDef } from "@polkadot/types/types";
import type { Bytes } from "@polkadot/types";
import { toPlain } from "./codec";

function getReturnTypeName(type: TypeDef | null | undefined): string {
    return type?.lookupName || type?.type || "";
}

export function decodeReturnValue(
    returnType: TypeDef | null | undefined,
    data: Bytes,
    registry: Registry,
): AnyJson {
    let returnTypeName = getReturnTypeName(returnType);

    const errPrefix = "Result<";
    const errSuffix = ", InkPrimitivesLangError>";
    if (
        returnTypeName.startsWith(errPrefix) &&
        returnTypeName.endsWith(errSuffix)
    ) {
        returnTypeName = returnTypeName.slice(
            errPrefix.length,
            returnTypeName.length - errSuffix.length,
        );
    }

    if (!returnType) {
        return "()";
    }

    // console.log("Decoding return value of type:", returnTypeName);
    try {
        const codec = registry.createTypeUnsafe(returnTypeName, [data]);
        const plain = toPlain(codec);
        // console.log("Decoding value of type:", returnTypeName);
        // console.log("Decoding value:", plain);
        return plain as AnyJson;
    } catch (err) {
        console.error("Decode error:", err);
        return "Decoding error";
    }
}
