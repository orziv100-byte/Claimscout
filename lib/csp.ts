export function frameAncestorsDirective(nodeEnv = process.env.NODE_ENV): "'none'" | "*" {
  return nodeEnv === "production" ? "'none'" : "*";
}

export function contentSecurityPolicy(nodeEnv = process.env.NODE_ENV): string {
  return `frame-ancestors ${frameAncestorsDirective(nodeEnv)};`;
}
