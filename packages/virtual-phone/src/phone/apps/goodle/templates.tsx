import React from "react";
import { pageMedia, parsePageSection, type PageMedia, type SiteKind } from "./sites";

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

/**
 * The grey box standing in for a picture until real images exist: the emoji says what it is of,
 * and the caption under it is the alt text. Both are always drawn — a placeholder that does not
 * say what it is standing in for is just a hole in the page.
 */
export function MediaBox({ glyph, alt, caption = alt, size = "md", inline = false }: {
  glyph: string;
  /** Always announced. */
  alt: string;
  /**
   * Shown under the box. Pass "" where the page already prints it right next to the picture — an
   * explicit `undefined` would fall back to the default and print it anyway, which is how the
   * captions under blog thumbnails ended up repeating the post titles beside them.
   */
  caption?: string;
  size?: "sm" | "md" | "lg" | "wide";
  inline?: boolean;
}) {
  return (
    <figure className={`vp-media vp-media--${size}${inline ? " vp-media--inline" : ""}`}>
      <span className={`vp-emoji-thumb vp-emoji-thumb--${size}`} role="img" aria-label={`Picture: ${alt}`}>{glyph}</span>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Every picture the page shows, gaps filled from the sections they illustrate.
 *
 * `lead` is for templates whose first picture belongs to the page rather than to a section — a
 * hero, an infobox, a crest. Without it the list shifts by one and each section's picture is
 * described by the next section's text, so the Origins paragraph came with a caption about the
 * bridge.
 */
function useMedia(page: SitePage, lead = false): PageMedia[] {
  return pageMedia(page.kind as SiteKind, page.media, lead ? [page.title, ...page.sections] : page.sections);
}

function Gallery({ shots }: { shots: PageMedia[] }) {
  if (!shots.length) return null;
  return (
    <div className="vp-media-row">
      {shots.map((item, index) => <MediaBox key={index} glyph={item.glyph} alt={item.caption} size="sm" />)}
    </div>
  );
}

function News({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  const shots = useMedia(page, true);
  const [lede, ...rest] = sections;
  const lead = shots[0];
  return (
    <article className="vp-site-article">
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {/* The headline sits directly above, so the lead image does not repeat it. */}
      {lead ? <MediaBox glyph={lead.glyph} alt={lead.caption} caption="" size="wide" /> : null}
      {lede ? <p className="vp-lede">{body(lede.body)}</p> : null}
      {rest.map((section, index) => {
        const shot = shots[index + 1];
        return (
          <section key={index} className="vp-site-section">
            {section.heading ? <h4>{section.heading}</h4> : null}
            {shot ? <MediaBox glyph={shot.glyph} alt={shot.caption} caption={shot.caption === section.heading ? "" : shot.caption} size="sm" inline /> : null}
            <p>{body(section.body)}</p>
          </section>
        );
      })}
    </article>
  );
}

function Shop({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  const shots = useMedia(page);
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      <div className="vp-site-grid">
        {sections.map((section, index) => {
          const shot = shots[index];
          return (
            <article key={index} className="vp-site-card vp-product">
              <span className="vp-emoji-thumb vp-emoji-thumb--md" role="img" aria-label={`Picture: ${shot?.caption ?? section.heading}`}>{shot?.glyph ?? "🛍️"}</span>
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
  const shots = useMedia(page);
  const [op, ...replies] = sections;
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {op ? (
        <article className="vp-thread-post vp-thread-post--op">
          <span className="vp-post-avatar" aria-hidden="true">{(op.heading || "?")[0]!.toUpperCase()}</span>
          <div>
            <span className="vp-post-author">{op.heading || "anonymous"}</span>
            <p>{body(op.body)}</p>
            {shots[0] ? <MediaBox glyph={shots[0].glyph} alt={shots[0].caption} caption={shots[0].caption === op.heading ? "" : shots[0].caption} size="md" /> : null}
          </div>
        </article>
      ) : null}
      {replies.map((section, index) => {
        const shot = shots[index + 1];
        return (
          <article key={index} className="vp-thread-post">
            <span className="vp-post-avatar" aria-hidden="true">{(section.heading || "?")[0]!.toUpperCase()}</span>
            <div>
              <span className="vp-post-author">{section.heading || "anonymous"}</span>
              <p>{body(section.body)}</p>
              {shot ? <MediaBox glyph={shot.glyph} alt={shot.caption} caption={shot.caption === section.heading ? "" : shot.caption} size="sm" inline /> : null}
            </div>
          </article>
        );
      })}
    </>
  );
}

function Wiki({ page, body }: TemplateProps) {
  const sections = page.sections.map(parsePageSection);
  const shots = useMedia(page, true);
  const lead = shots[0];
  return (
    <>
      <h3 className="vp-page-heading vp-wiki-title">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {lead ? (
        <aside className="vp-infobox">
          <span className="vp-emoji-thumb vp-emoji-thumb--md" role="img" aria-label={`Picture: ${lead.caption}`}>{lead.glyph}</span>
          <span className="vp-infobox-caption">{lead.caption}</span>
        </aside>
      ) : null}
      {sections.length > 1 ? (
        <nav className="vp-toc" aria-label="Contents">
          <span className="vp-section-label">Contents</span>
          <ol>{sections.map((section, index) => <li key={index}>{section.heading || `Section ${index + 1}`}</li>)}</ol>
        </nav>
      ) : null}
      {sections.map((section, index) => {
        const shot = shots[index + 1];
        return (
          <section key={index} className="vp-site-section vp-wiki-section">
            {section.heading ? <h4>{section.heading}</h4> : null}
            <p>{body(section.body)}</p>
            {shot ? <MediaBox glyph={shot.glyph} alt={shot.caption} caption={shot.caption === section.heading ? "" : shot.caption} size="wide" /> : null}
          </section>
        );
      })}
    </>
  );
}

function Profile({ page, body }: TemplateProps) {
  const shots = useMedia(page, true);
  const lead = shots[0];
  return (
    <>
      <header className="vp-profile-head">
        <span className="vp-emoji-thumb vp-emoji-thumb--sm" role="img" aria-label={`Picture: ${lead?.caption ?? page.title}`}>{lead?.glyph ?? "👤"}</span>
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
      <Gallery shots={shots.slice(1)} />
    </>
  );
}

function Blog({ page, body }: TemplateProps) {
  const shots = useMedia(page);
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {page.sections.map(parsePageSection).map((section, index) => {
        const shot = shots[index];
        return (
          <article key={index} className="vp-blog-post">
            <h4>{section.heading}</h4>
            {section.meta ? <span className="vp-byline">{section.meta}</span> : null}
            {shot ? <MediaBox glyph={shot.glyph} alt={shot.caption} caption={shot.caption === section.heading ? "" : shot.caption} size="sm" inline /> : null}
            <p>{body(section.body)}</p>
          </article>
        );
      })}
    </>
  );
}

function Directory({ page, body }: TemplateProps) {
  const shots = useMedia(page);
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      <div className="vp-list vp-list--inset-rules">
        {page.sections.map(parsePageSection).map((section, index) => {
          const shot = shots[index];
          return (
            <div key={index} className="vp-thread-row">
              <span className="vp-emoji-thumb vp-listing-thumb" role="img" aria-label={`Picture: ${shot?.caption ?? section.heading}`}>{shot?.glyph ?? "📍"}</span>
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
  const shots = useMedia(page, true);
  const crest = shots[0];
  return (
    <>
      <div className="vp-official-head">
        {crest ? <MediaBox glyph={crest.glyph} alt={crest.caption} size="sm" /> : null}
        <h3 className="vp-page-heading">{page.title}</h3>
      </div>
      {page.meta ? <p className="vp-notice">{page.meta}</p> : null}
      {shots[1] ? <MediaBox glyph={shots[1].glyph} alt={shots[1].caption} size="wide" /> : null}
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
  const shots = useMedia(page);
  return (
    <>
      <h3 className="vp-page-heading">{page.title}</h3>
      {page.meta ? <p className="vp-byline">{page.meta}</p> : null}
      {page.sections.map(parsePageSection).map((section, index) => {
        const shot = shots[index];
        return (
          <article key={index} className="vp-video-row">
            <span className="vp-emoji-thumb vp-video-thumb" role="img" aria-label={`Thumbnail: ${shot?.caption ?? section.heading}`}>
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
