// Publik bildreferens: bara filer under /public/images med ofarligt namn.
// Fri sträng gav path-traversal mot existsSync, next/image-optimizer mot
// interna routes, och externa URL:er (spårning/SSRF).

export const IMAGE_REF_RE = /^\/images\/[a-z0-9-]+\.(jpe?g|png|webp)$/;

export function isSafeImageRef(src: string | null | undefined): src is string {
  return typeof src === "string" && IMAGE_REF_RE.test(src);
}
