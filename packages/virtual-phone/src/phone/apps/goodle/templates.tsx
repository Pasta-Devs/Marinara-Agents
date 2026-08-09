import React from "react";
import { SITE_TEMPLATES, parseMediaItem, parsePageSection, type SiteKind } from "./sites";

/**
 * One layout per kind of site. Every page used to be a masthead and a stack of headed paragraphs,
 * with a shop grid bolted on inside the renderer — so a newspaper, a council notice and a forum
 * thread were the same object with different words in it. These are deliberately shallow: the
 * point is that a news page reads as a news page at a glance, not that any of them is a faithful
 * copy of a real site.
 */

export interface SitePage {
  site: string;
  title: string;
  tagline: string;
  kind: string;
  meta: string;
  links: string[];
  sections: string[];
  media: string[];
}

interface TemplateProps {
  page: SitePage;
  /** Renders body text with its [[links]] wired up. */
  body: (text: string) => React.ReactNode;
}

/** The grey box standing in for a picture until real images exist. */
export function MediaBox({ glyph, caption, size = "md" }: { glyph: string; caption?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <figure className={`vp-media vp-media--${size}`}>
      <span className={`vp-emoji-thumb vp-emoji-thumb--${size === "sm" ? "sm" : size}`} aria-hidden="true">{glyph}</span>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function media(page: SitePage, index: number) {
  const raw = page.media[index];
  if (!raw) return null;
  return parseMediaItem(raw, SITE_TEMPLATES[page.kind as SiteKind]?.glyph ?? "🖼️");
}

function Hero({ page, size = "lg" }: { page: SitePage; size?: "md" | "lg" }) {
  const lead = media(page, 0);
  return lead ? <MediaBox glyph={lead.glyph} caption={lead.caption} size={size} /> : null;
}

function Gallery({ page, from = 1 }: { page: SitePage; from?: number }) {
  const rest = page.media.slice(from).map((item) => parseMediaItem(item, SITE_TEMPLATES[page.kind as SiteKind]?.glyph ?? "🖼️"));
  if (!rest.length) return null;
  return (
    <div className="vp-media-row">
      {rest.map((item, index) => <MediaBox key={index} glyph={item.glyph} caption={item.caption} size="sm" />)}
    </div>
  );
}

function News({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  const [lede, ...rest] = sections;
  return (
    <article className="vp-site-article">
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      <Hero page={page} />
      {lede ? <p className="vp-lede">{body(lede.body)}</p> : null}
      {rest.map((section, index) => (
        <section key={index} className="vp-site-section">
          {section.heading ? <h4>{section.heading}</h4> : null}
          <p>{body(section.body)}</p>
        </section>
      ))}
      <Gallery page={page} />
    </article>
  );
}

function Shop({ page, body }: TemplateProps) {
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      <div className="vp-site-grid">
        {page.sections.map(parsePageSection).map((section, index) => {
          const shot = media(page, index);
          return (
            <article key={index} className="vp-site-card vp-product">
              <span className="vp-emoji-thumb vp-emoji-thumb--md" aria-hidden="true">{shot?.glyph ?? "🛍️"}</span>
              <h4>{section.heading || "Item"}</h4>
              {section.meta ? <span className="vp-price">{section.meta}</span> : null}
              <p>{body(section.body)}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}

function Forum({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  const [op, ...replies] = sections;
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {op ? (
        <article className="vp-thread-post vp-thread-post--op">
          <span className="vp-post-avatar" aria-hidden="true">{(op.heading || "?")[0]!.toUpperCase()}</span>
          <div><span className="vp-post-author">{op.heading || "anonymous"}</span><p>{body(op.body)}</p></div>
        </article>
      ) : null}
      {replies.map((section, index) => (
        <article key={index} className="vp-thread-post">
          <span className="vp-post-avatar" aria-hidden="true">{(section.heading || "?")[0]!.toUpperCase()}</span>
          <div><span className="vp-post-author">{section.heading || "anonymous"}</span><p>{body(section.body)}</p></div>
        </article>
      ))}
    </>
  );
}

function Wiki({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  const lead = media(page, 0);
  return (
    <>
      <h3 className="vp-page-heading vp-wiki-title">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {lead ? (
        <aside className="vp-infobox">
          <span className="vp-emoji-thumb vp-emoji-thumb--md" aria-hidden="true">{lead.glyph}</span>
          <span className="vp-infobox-caption">{lead.caption}</span>
        </aside>
      ) : null}
      {sections.length > 1 ? (
        <nav className="vp-toc" aria-label="Contents">
          <span className="vp-section-label">Contents</span>
          <ol>{sections.map((section, index) => <li key={index}>{section.heading || `Section ${index + 1}`}</li>)}</ol>
        </nav>
      ) : null}
      {sections.map((section, index) => (
        <section key={index} className="vp-site-section vp-wiki-section">
          {section.heading ? <h4>{section.heading}</h4> : null}
          <p>{body(section.body)}</p>
        </section>
      ))}
    </>
  );
}

function Profile({ page, body }: TemplateProps) {
  const lead = media(page, 0);
  return (
    <>
      <header className="vp-profile-head">
        <span className="vp-emoji-thumb vp-emoji-thumb--sm" aria-hidden="true">{lead?.glyph ?? "👤"}</span>
        <div>
          <h3>{page.title}</h3>
          {page.meta ? <span className="vp-byline">{page.meta}</span> : null}
        </div>
      </header>
      {page.sections.map(parsePageSection).map((section, index) => (
        <section key={index} className="vp-site-section">
          {section.heading ? <h4>{section.heading}</h4> : null}
          <p>{body(section.body)}</p>
        </section>
      ))}
      <Gallery page={page} />
    </>
  );
}

function Blog({ page, body }: TemplateProps) {
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {page.sections.map(parsePageSection).map((section, index) => (
        <article key={index} className="vp-blog-post">
          <h4>{section.heading}</h4>
          {section.meta ? <span className="vp-byline">{section.meta}</span> : null}
          <p>{body(section.body)}</p>
        </article>
      ))}
    </>
  );
}

function Directory({ page, body }: TemplateProps) {
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      <div className="vp-list vp-list--inset-rules">
        {page.sections.map(parsePageSection).map((section, index) => {
          const shot = media(page, index);
          return (
            <div key={index} className="vp-thread-row">
              <span className="vp-emoji-thumb vp-emoji-thumb--sm" aria-hidden="true">{shot?.glyph ?? "📍"}</span>
              <span className="vp-thread-body">
                <span className="vp-thread-name">{section.heading}</span>
                {section.meta ? <span className="vp-listing-meta">{section.meta}</span> : null}
                <span className="vp-thread-preview" style={{ whiteSpace: "normal" }}>{body(section.body)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Official({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-notice">{page.meta}</p> : null}
      <div className="vp-group">
        {sections.map((section, index) => (
          <section key={index} className="vp-official-row">
            {section.heading ? <h4>{section.heading}</h4> : null}
            <p>{body(section.body)}</p>
          </section>
        ))}
      </div>
    </>
  );
}

function Video({ page, body }: TemplateProps) {
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {page.sections.map(parsePageSection).map((section, index) => {
        const shot = media(page, index);
        return (
          <article key={index} className="vp-video-row">
            <span className="vp-emoji-thumb vp-video-thumb" aria-hidden="true">
              {shot?.glyph ?? "▶️"}
              {section.meta ? <span className="vp-video-duration">{section.meta}</span> : null}
            </span>
            <span className="vp-video-body">
              <span className="vp-thread-name">{section.heading}</span>
              <span className="vp-thread-preview" style={{ whiteSpace: "normal" }}>{body(section.body)}</span>
            </span>
          </article>
        );
      })}
    </>
  );
}

const TEMPLATES: Record<SiteKind, (props: TemplateProps) => React.ReactElement> = {
  news: News, shop: Shop, forum: Forum, wiki: Wiki, profile: Profile,
  blog: Blog, directory: Directory, official: Official, video: Video,
};

export function SiteBody(props: TemplateProps) {
  const Template = TEMPLATES[props.page.kind as SiteKind] ?? Official;
  return <Template {...props} />;
}
