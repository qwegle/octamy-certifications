import { Fragment, type ReactNode } from "react";
import { Link } from "wouter";

const markdownLink = /\[([^\]\n]{1,160})\]\(([^)\s]{1,2048})\)/g;

export function safeBodyHref(value: string): string | null {
  const href = value.trim();
  if (!href || href.length > 2048 || href.includes("\\") || /[\u0000-\u001f\u007f]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inlineNodes(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  const matches = Array.from(line.matchAll(markdownLink));
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(line.slice(cursor, start));
    const href = safeBodyHref(match[2]);
    if (!href) {
      nodes.push(match[0]);
    } else if (href.startsWith("/")) {
      nodes.push(<Link key={`${keyPrefix}-link-${index}`} href={href} className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4 hover:text-violet-900">{match[1]}</Link>);
    } else {
      nodes.push(<a key={`${keyPrefix}-link-${index}`} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4 hover:text-violet-900">{match[1]}<span className="sr-only"> (opens in a new tab)</span></a>);
    }
    cursor = start + match[0].length;
  });
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

export function SafeBlogBody({ body }: { body: string }) {
  return (
    <div className="space-y-5 text-base leading-8 text-slate-700 sm:text-lg">
      {body.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
        <p key={`paragraph-${paragraphIndex}`}>
          {paragraph.split("\n").map((line, lineIndex) => (
            <Fragment key={`line-${lineIndex}`}>
              {lineIndex > 0 && <br />}
              {inlineNodes(line, `${paragraphIndex}-${lineIndex}`)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
