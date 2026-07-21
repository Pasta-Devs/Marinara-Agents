// ──────────────────────────────────────────────
// Pasta Phone — placeholder app screens
// Every screen is hardcoded mock data. No feed
// generation, no chat data, no persistence: this
// exists so the layout can be judged, nothing else.
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { ChevronLeft, Heart, MessageSquare, Repeat2 } from "lucide-react";

interface AppScreenProps {
  title: string;
  accent: string;
  onBack: () => void;
  children: ReactNode;
}

function AppScreen({ title, accent, onBack, children }: AppScreenProps) {
  return (
    <div data-pasta-phone-app-screen>
      <header data-pasta-phone-app-header>
        <button type="button" data-pasta-phone-back onClick={onBack} aria-label="Back to home screen">
          <ChevronLeft size="1.1rem" />
        </button>
        <h3 data-pasta-phone-app-title>{title}</h3>
        <span data-pasta-phone-preview-badge style={{ backgroundColor: accent }}>
          Preview
        </span>
      </header>
      <div data-pasta-phone-app-body>{children}</div>
    </div>
  );
}

function PlaceholderNote() {
  return <p data-pasta-phone-note>Placeholder content — real data is not wired up in this build.</p>;
}

const NOODLE_POSTS = [
  {
    id: "1",
    author: "Lorem Ipsum",
    handle: "@lorem",
    time: "12m",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sample post body standing in for a generated feed entry.",
    stats: ["18", "4", "2"],
  },
  {
    id: "2",
    author: "Dolor Sit",
    handle: "@dolorsit",
    time: "1h",
    body: "Curabitur non nulla sit amet nisl tempus convallis quis ac lectus. Placeholder text only.",
    stats: ["7", "1", "0"],
  },
  {
    id: "3",
    author: "Amet Consectetur",
    handle: "@ametc",
    time: "3h",
    body: "Vivamus suscipit tortor eget felis porttitor volutpat. Second sample body to show spacing between entries.",
    stats: ["42", "11", "6"],
  },
];

export function NoodleAppScreen({ onBack }: { onBack: () => void }) {
  return (
    <AppScreen title="Noodle" accent="#e0523f" onBack={onBack}>
      <div data-pasta-phone-stack>
        {NOODLE_POSTS.map((post) => (
          <article key={post.id} data-pasta-phone-card>
            <div data-pasta-phone-row>
              <span data-pasta-phone-avatar aria-hidden />
              <span data-pasta-phone-byline>
                {post.author} <span data-pasta-phone-muted>{post.handle} · {post.time}</span>
              </span>
            </div>
            <p data-pasta-phone-body-text>{post.body}</p>
            <div data-pasta-phone-stats aria-hidden>
              <span>
                <Heart size="0.7rem" /> {post.stats[0]}
              </span>
              <span>
                <Repeat2 size="0.7rem" /> {post.stats[1]}
              </span>
              <span>
                <MessageSquare size="0.7rem" /> {post.stats[2]}
              </span>
            </div>
          </article>
        ))}
      </div>
      <PlaceholderNote />
    </AppScreen>
  );
}

const THREAD_REPLIES = [
  { id: "1", author: "Lorem Ipsum", handle: "@lorem", body: "Nulla facilisi. Top-level sample reply in this mock thread.", depth: 0 },
  { id: "2", author: "Sed Do", handle: "@seddo", body: "Eiusmod tempor incididunt ut labore. Nested reply at depth one.", depth: 1 },
  { id: "3", author: "Magna Aliqua", handle: "@magna", body: "Ut enim ad minim veniam, quis nostrud. Another nested reply.", depth: 1 },
  { id: "4", author: "Quis Nostrud", handle: "@quisn", body: "Duis aute irure dolor. Deepest sample reply to show indentation.", depth: 2 },
];

export function NoodleRAppScreen({ onBack }: { onBack: () => void }) {
  return (
    <AppScreen title="NoodleR" accent="#4f7bd8" onBack={onBack}>
      <article data-pasta-phone-card>
        <span data-pasta-phone-byline>r/placeholder · sample thread</span>
        <p data-pasta-phone-body-text>
          Lorem ipsum dolor sit amet — this is a stand-in for the thread's opening post.
        </p>
      </article>

      <div data-pasta-phone-stack style={{ marginTop: "0.75rem", gap: "0.5rem" }}>
        {THREAD_REPLIES.map((reply) => (
          <div key={reply.id} data-pasta-phone-reply style={{ marginInlineStart: `${reply.depth * 0.875}rem` }}>
            <p data-pasta-phone-reply-author>
              {reply.author} <span data-pasta-phone-muted>{reply.handle}</span>
            </p>
            <p data-pasta-phone-body-text style={{ marginTop: "0.125rem" }}>
              {reply.body}
            </p>
          </div>
        ))}
      </div>
      <PlaceholderNote />
    </AppScreen>
  );
}

const CHATS = [
  { id: "1", name: "Lorem Ipsum", preview: "Sample last message preview…", time: "12m", unread: 2 },
  { id: "2", name: "Dolor Sit", preview: "Consectetur adipiscing elit.", time: "1h", unread: 0 },
  { id: "3", name: "Amet Group", preview: "Placeholder group conversation.", time: "4h", unread: 7 },
  { id: "4", name: "Sed Eiusmod", preview: "Tempor incididunt ut labore.", time: "yesterday", unread: 0 },
];

export function ChatsAppScreen({ onBack }: { onBack: () => void }) {
  return (
    <AppScreen title="Chats" accent="#1f9d68" onBack={onBack}>
      <ul data-pasta-phone-chat-list>
        {CHATS.map((chat) => (
          <li key={chat.id}>
            <span data-pasta-phone-avatar="lg" aria-hidden />
            <span data-pasta-phone-chat-lines>
              <span data-pasta-phone-chat-name>{chat.name}</span>
              <span data-pasta-phone-chat-preview>{chat.preview}</span>
            </span>
            <span data-pasta-phone-chat-meta>
              <span>{chat.time}</span>
              {chat.unread > 0 ? <span data-pasta-phone-unread>{chat.unread}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <PlaceholderNote />
    </AppScreen>
  );
}

const STORE_TILES = [
  { id: "1", name: "Lorem", tag: "Utilities", accent: "#e0523f" },
  { id: "2", name: "Ipsum", tag: "Social", accent: "#4f7bd8" },
  { id: "3", name: "Dolor", tag: "Photos", accent: "#1f9d68" },
  { id: "4", name: "Sit", tag: "Music", accent: "#8b5cf6" },
  { id: "5", name: "Amet", tag: "Games", accent: "#d97706" },
  { id: "6", name: "Elit", tag: "News", accent: "#0891b2" },
];

export function AppStoreAppScreen({ onBack }: { onBack: () => void }) {
  return (
    <AppScreen title="App Store" accent="#8b5cf6" onBack={onBack}>
      <p data-pasta-phone-store-heading>More apps</p>
      <div data-pasta-phone-store-grid>
        {STORE_TILES.map((tile) => (
          <div key={tile.id} data-pasta-phone-store-tile>
            <span data-pasta-phone-store-icon aria-hidden style={{ backgroundColor: tile.accent }} />
            <span data-pasta-phone-store-lines>
              <span data-pasta-phone-store-name>{tile.name}</span>
              <span data-pasta-phone-store-tag>{tile.tag}</span>
            </span>
          </div>
        ))}
      </div>
      <PlaceholderNote />
    </AppScreen>
  );
}
