/** Vite manifest 条目子集（客户端构建 build.manifest: true 生成）。 */
export interface ManifestEntry {
    file: string;
    imports?: string[];
    dynamicImports?: string[];
    css?: string[];
}
