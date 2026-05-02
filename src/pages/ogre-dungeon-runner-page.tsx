import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Coins,
  Flame,
  Gem,
  Heart,
  Map,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionId = "sneak" | "bargain" | "lantern" | "decode" | "rest";
type SceneId = "gate" | "market" | "bridge" | "vault" | "throne" | "escape" | "lost";
type OutcomeTone = "neutral" | "good" | "warn" | "bad" | "win";
type RelicId = "mossKey" | "silverSap" | "ogreBadge";

type Outcome = {
  title: string;
  body: string;
  tone: OutcomeTone;
  changes: string[];
};

type RunState = {
  hp: number;
  torch: number;
  danger: number;
  depth: number;
  coins: number;
  clues: number;
  score: number;
  turn: number;
  sceneId: SceneId;
  relics: RelicId[];
  log: string[];
  lastOutcome: Outcome;
};

type Scene = {
  kicker: string;
  title: string;
  body: string;
  threat: string;
};

type Action = {
  id: ActionId;
  label: string;
  detail: string;
  cost: string;
  risk: string;
};

type Relic = {
  name: string;
  detail: string;
};

const maxDepth = 10;
const maxDanger = 6;
const requiredClues = 3;

const initialOutcome: Outcome = {
  title: "The stone moves.",
  body: "A stairwell opens under the footer. Reach room 10 with three route clues before danger fills the hall.",
  tone: "neutral",
  changes: ["Goal: 10 rooms", "Need: 3 clues"],
};

const initialRun: RunState = {
  hp: 6,
  torch: 6,
  danger: 1,
  depth: 0,
  coins: 2,
  clues: 0,
  score: 0,
  turn: 0,
  sceneId: "gate",
  relics: [],
  log: ["You pressed the loose footer stone and found a stairwell under BinderNotes."],
  lastOutcome: initialOutcome,
};

const scenes: Record<SceneId, Scene> = {
  gate: {
    kicker: "Moss Gate",
    title: "A chalky arch hums under the homepage.",
    body: "Goblin runners dart between old study banners while an ogre porter counts torch sparks at the gate.",
    threat: "The early rooms are forgiving. Build clues before the court starts watching.",
  },
  market: {
    kicker: "Goblin Market",
    title: "Tiny stalls trade riddles for stolen margins.",
    body: "A goblin with ink-black fingers offers a shortcut, but every answer costs either a coin or a little courage.",
    threat: "Bargains are strongest here, especially while you still have coins.",
  },
  bridge: {
    kicker: "Bone Bridge",
    title: "The runner path crosses a swinging bridge.",
    body: "Below, lantern fish flash like footnotes. Above, scouts listen for heavy ogre steps.",
    threat: "Noise matters now. Let danger climb too high and the bridge calls the guards.",
  },
  vault: {
    kicker: "Mushroom Vault",
    title: "A violet door breathes behind shelf-sized mushrooms.",
    body: "The ogre's lock is bored, ancient, and fond of confident answers. Your torch hisses in the damp air.",
    threat: "Decode runes before the final hall if you are short on route clues.",
  },
  throne: {
    kicker: "Ogre Court",
    title: "The final hall is one enormous desk.",
    body: "The ogre king taps a pencil like a club. He wants proof that you learned the hidden route.",
    threat: "Three clues open the exit. Anything less turns into a very loud argument.",
  },
  escape: {
    kicker: "Secret Exit",
    title: "You burst out behind the footer with a pocket full of dungeon dust.",
    body: "The route folds itself back into a tiny link. Somewhere below, the ogre court stamps your scorecard.",
    threat: "Reset for a cleaner run and a higher rank.",
  },
  lost: {
    kicker: "Run Lost",
    title: "The dungeon eats the path back.",
    body: "Your route collapses into smoke, scribbles, and one smug gate clerk.",
    threat: "Reset and try balancing torch, danger, and clue-gathering.",
  },
};

const actions: Action[] = [
  {
    id: "sneak",
    label: "Sneak forward",
    detail: "Move one room with a fair clue chance.",
    cost: "-1 torch",
    risk: "Scout noise",
  },
  {
    id: "bargain",
    label: "Trade riddle",
    detail: "Spend coins or bluff for route clues.",
    cost: "-1 coin",
    risk: "Bad deal",
  },
  {
    id: "lantern",
    label: "Burst lantern",
    detail: "Rush deeper and push danger down.",
    cost: "-2 torch",
    risk: "Hard stumble",
  },
  {
    id: "decode",
    label: "Read wall runes",
    detail: "Pause for a strong clue chance.",
    cost: "-1 torch",
    risk: "Danger rises",
  },
  {
    id: "rest",
    label: "Patch wounds",
    detail: "Recover health and maybe find supplies.",
    cost: "-1 torch",
    risk: "Ambush",
  },
];

const relics: Record<RelicId, Relic> = {
  mossKey: {
    name: "Moss Key",
    detail: "Adds a score bonus from quiet recovery.",
  },
  silverSap: {
    name: "Silver Sap Map",
    detail: "Marks a safer shortcut through the vault.",
  },
  ogreBadge: {
    name: "Ogre Badge",
    detail: "Proof that a guard got outwitted.",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sceneForDepth(depth: number): SceneId {
  if (depth >= 9) {
    return "throne";
  }

  if (depth >= 7) {
    return "vault";
  }

  if (depth >= 4) {
    return "bridge";
  }

  if (depth >= 2) {
    return "market";
  }

  return "gate";
}

function isTerminal(sceneId: SceneId) {
  return sceneId === "escape" || sceneId === "lost";
}

function addRelic(relicList: RelicId[], relicId: RelicId) {
  return relicList.includes(relicId) ? relicList : [...relicList, relicId];
}

function rankForRun(run: RunState) {
  if (run.sceneId === "lost") {
    return "Lost in the margins";
  }

  if (run.sceneId === "escape" && run.score >= 420) {
    return "Footer legend";
  }

  if (run.score >= 300) {
    return "Ogre court regular";
  }

  if (run.score >= 180) {
    return "Goblin-route scout";
  }

  return "Loose-stone rookie";
}

function applyTerminalState(run: RunState, message: string): RunState {
  let sceneId = sceneForDepth(run.depth);
  let terminalMessage = message;
  let tone = run.lastOutcome.tone;
  let changes = run.lastOutcome.changes;
  let score = run.score;

  if (run.hp <= 0) {
    sceneId = "lost";
    tone = "bad";
    terminalMessage = `${message} You are too battered to outrun the last gate.`;
    changes = ["Run lost", "HP hit zero"];
  } else if (run.torch <= 0) {
    sceneId = "lost";
    tone = "bad";
    terminalMessage = `${message} The torch goes out, and the route disappears.`;
    changes = ["Run lost", "Torch hit zero"];
  } else if (run.danger >= maxDanger) {
    sceneId = "lost";
    tone = "bad";
    terminalMessage = `${message} The danger bell fills the hollow.`;
    changes = ["Run lost", "Danger maxed"];
  } else if (run.depth >= maxDepth && run.clues >= requiredClues) {
    sceneId = "escape";
    tone = "win";
    score += 120 + run.hp * 8 + run.torch * 7 + run.relics.length * 30;
    terminalMessage = `${message} Three route clues flash on the ogre desk, and the secret exit unlocks.`;
    changes = ["Escape", `Final score ${score}`];
  } else if (run.depth >= maxDepth) {
    tone = "warn";
    terminalMessage = `${message} The court blocks the exit until you carry three route clues.`;
    changes = ["At final hall", `${run.clues}/${requiredClues} clues`];
  }

  return {
    ...run,
    score,
    sceneId,
    lastOutcome: {
      title:
        tone === "win"
          ? "Clean escape."
          : sceneId === "lost"
            ? "Run broken."
            : tone === "bad"
              ? "That hurt."
              : tone === "warn"
                ? "Close call."
                : "Good move.",
      body: terminalMessage,
      tone,
      changes,
    },
    log: [`Turn ${run.turn}: ${terminalMessage}`, ...run.log].slice(0, 6),
  };
}

function resolveRunAction(current: RunState, action: ActionId, roll: number): RunState {
  if (isTerminal(current.sceneId)) {
    return current;
  }

  let hp = current.hp;
  let torch = current.torch;
  let danger = current.danger;
  let coins = current.coins;
  let clues = current.clues;
  let depth = current.depth;
  let score = current.score;
  let relicList = current.relics;
  let message = "";
  let tone: OutcomeTone = "good";
  let changes: string[] = [];

  if (action === "sneak") {
    depth += 1;
    torch -= 1;
    score += 24;
    changes = ["+1 depth", "-1 torch"];

    if (roll > 0.76) {
      hp -= 1;
      danger += 2;
      coins += 1;
      tone = "warn";
      changes.push("-1 HP", "+2 danger", "+1 coin");
      message = "A scout hears your notebook snap shut. You dive under a chain, scrape a shoulder, and grab a loose coin.";
    } else if (roll > 0.36) {
      clues += 1;
      score += 28;
      changes.push("+1 clue");
      message = "You slip between chalk-marked pillars and catch a trail sign scratched into the stone.";
    } else {
      danger += 1;
      changes.push("+1 danger");
      message = "You ghost past the porter, but the gate chain rattles behind you.";
    }
  }

  if (action === "bargain") {
    changes = coins > 0 ? ["-1 coin"] : ["Bluff"];

    if (coins > 0) {
      coins -= 1;
      depth += roll > 0.3 ? 1 : 0;

      if (roll > 0.68) {
        clues += 1;
        score += 52;
        relicList = addRelic(relicList, "ogreBadge");
        changes.push("+1 depth", "+1 clue", "+relic");
        message = "A riddle-merchant takes the coin, laughs, and slides you a stamped ogre badge with the route scratched inside.";
      } else if (roll > 0.24) {
        clues += 1;
        score += 34;
        changes.push("+1 depth", "+1 clue");
        message = "The goblin trader points at the safe rune and refuses to explain why it is sticky.";
      } else {
        danger += 1;
        tone = "warn";
        changes.push("+1 danger");
        message = "The coin vanishes into a bad deal. The shortcut loops back past a louder guard.";
      }
    } else if (roll > 0.58) {
      clues += 1;
      hp -= 1;
      danger += 1;
      score += 32;
      changes.push("+1 clue", "-1 HP", "+1 danger");
      message = "You bluff the riddle, win a route clue, and take a bruising stamp from the court clerk.";
    } else {
      hp -= 1;
      torch -= 1;
      danger += 1;
      tone = "bad";
      changes.push("-1 HP", "-1 torch", "+1 danger");
      message = "No coin, no mercy. The traders heckle you into a thorny side passage.";
    }
  }

  if (action === "lantern") {
    depth += roll > 0.25 ? 2 : 1;
    torch -= 2;
    danger -= 1;
    score += 36;
    changes = [roll > 0.25 ? "+2 depth" : "+1 depth", "-2 torch", "-1 danger"];

    if (roll > 0.78) {
      hp -= 1;
      danger += 2;
      tone = "warn";
      changes.push("-1 HP", "+2 danger");
      message = "The lantern flare opens a fast lane, then throws an ogre shadow across your path.";
    } else if (roll > 0.42) {
      clues += 1;
      score += 22;
      changes.push("+1 clue");
      message = "Lantern light scatters the scouts and reveals a route mark painted in silver sap.";
    } else {
      message = "The burst burns clean. You sprint through smoke before the gate can breathe.";
    }
  }

  if (action === "decode") {
    torch -= 1;
    danger += roll > 0.7 ? 1 : 0;
    score += 16;
    changes = ["-1 torch"];

    if (roll > 0.72) {
      clues += 1;
      score += 44;
      relicList = addRelic(relicList, "silverSap");
      changes.push("+1 clue", "+1 danger", "+relic");
      message = "You read the wall runes aloud. The vault answers with a silver sap map and one very suspicious echo.";
    } else if (roll > 0.18) {
      clues += 1;
      score += 28;
      changes.push("+1 clue");
      message = "The runes line up into a route clue: three left turns, one low crawl, no eye contact.";
    } else {
      danger += 1;
      tone = "warn";
      changes.push("+1 danger");
      message = "The wall runes rearrange themselves into an insult. The delay makes the hall louder.";
    }
  }

  if (action === "rest") {
    hp += 2;
    torch -= 1;
    danger += 1;
    score += 10;
    changes = ["+2 HP", "-1 torch", "+1 danger"];

    if (roll > 0.74) {
      hp -= 2;
      coins = Math.max(0, coins - 1);
      danger += 1;
      tone = "bad";
      changes.push("-2 HP", "-1 coin", "+1 danger");
      message = "The moss is soft until it coughs. You wake sore, lighter by a coin, and deeply offended.";
    } else if (roll > 0.38) {
      coins += 1;
      relicList = addRelic(relicList, "mossKey");
      score += 24;
      changes.push("+1 coin", "+relic");
      message = "You bind a scrape, find a moss key under a warm stone, and pocket one abandoned coin.";
    } else {
      message = "You patch your sleeve, breathe slowly, and listen to the hollow rearrange itself.";
    }
  }

  hp = clamp(hp, 0, 8);
  torch = clamp(torch, 0, 8);
  danger = clamp(danger, 0, maxDanger);
  coins = clamp(coins, 0, 9);
  clues = clamp(clues, 0, 5);
  depth = clamp(depth, 0, maxDepth);
  score = clamp(score, 0, 999);

  return applyTerminalState(
    {
      hp,
      torch,
      danger,
      coins,
      clues,
      depth,
      score,
      relics: relicList,
      sceneId: sceneForDepth(depth),
      turn: current.turn + 1,
      log: current.log,
      lastOutcome: {
        title: tone === "bad" ? "That hurt." : tone === "warn" ? "Close call." : "Good move.",
        body: message,
        tone,
        changes,
      },
    },
    message,
  );
}

export function OgreDungeonRunnerPage() {
  const [run, setRun] = useState<RunState>(initialRun);
  const scene = scenes[run.sceneId];
  const terminal = isTerminal(run.sceneId);
  const progress = useMemo(() => Math.round((run.depth / maxDepth) * 100), [run.depth]);
  const rank = rankForRun(run);

  const takeAction = (action: ActionId) => {
    setRun((current) => resolveRunAction(current, action, Math.random()));
  };

  const resetRun = () => {
    setRun(initialRun);
  };

  return (
    <main className="ogre-game-page">
      <div className="ogre-game-shell">
        <header className="ogre-game-topbar">
          <Link className="ogre-game-back" to="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to BinderNotes
          </Link>
          <span className="ogre-game-badge">
            <Sparkles aria-hidden="true" size={15} />
            Footer hollow
          </span>
        </header>

        <section className="ogre-game-hero" aria-labelledby="ogre-game-title">
          <div>
            <p className="ogre-game-kicker">{scene.kicker}</p>
            <h1 id="ogre-game-title">The Hollow Under BinderNotes</h1>
            <p>{scene.body}</p>
          </div>
          <div className="ogre-game-threat" aria-live="polite">
            <Shield aria-hidden="true" size={18} />
            {scene.threat}
          </div>
        </section>

        <section className="ogre-game-board" aria-label="Dungeon runner">
          <div className="ogre-game-panel ogre-game-panel--scene">
            <div className="ogre-game-hud" aria-label="Run status">
              <StatusPill icon={<Heart aria-hidden="true" size={16} />} label={`HP ${run.hp}`} tone="heart" />
              <StatusPill icon={<Flame aria-hidden="true" size={16} />} label={`Torch ${run.torch}`} tone="torch" />
              <StatusPill icon={<Map aria-hidden="true" size={16} />} label={`Depth ${run.depth}`} tone="map" />
              <StatusPill icon={<Coins aria-hidden="true" size={16} />} label={`Coins ${run.coins}`} tone="coin" />
              <StatusPill
                icon={<Shield aria-hidden="true" size={16} />}
                label={`Danger ${run.danger}/${maxDanger}`}
                tone="danger"
              />
              <StatusPill icon={<Trophy aria-hidden="true" size={16} />} label={`Score ${run.score}`} tone="score" />
            </div>

            <div className="ogre-game-progress" aria-label={`Dungeon progress ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <article className={cn("ogre-game-outcome", `ogre-game-outcome--${run.lastOutcome.tone}`)}>
              <div>
                <strong>{run.lastOutcome.title}</strong>
                <p>{run.lastOutcome.body}</p>
              </div>
              <div className="ogre-game-outcome__changes" aria-label="Last move changes">
                {run.lastOutcome.changes.map((change) => (
                  <span key={change}>{change}</span>
                ))}
              </div>
            </article>

            <article className="ogre-game-scene-card">
              <div>
                <span>Current room</span>
                <p>{scene.title}</p>
              </div>
              <div className="ogre-game-clue-stack">
                <strong>
                  Clues {Math.min(run.clues, requiredClues)}/{requiredClues}
                </strong>
                <div className="ogre-game-clues" aria-label={`${run.clues} route clues`}>
                  {Array.from({ length: requiredClues }).map((_, index) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={index}
                      className={cn(index < run.clues && "is-found")}
                    />
                  ))}
                </div>
              </div>
            </article>

            <div className="ogre-game-actions" aria-label="Runner actions">
              {actions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant="secondary"
                  className="ogre-game-action"
                  disabled={terminal}
                  onClick={() => takeAction(action.id)}
                >
                  <span>{action.label}</span>
                  <small>{action.detail}</small>
                  <span className="ogre-game-action__meta">
                    <em>{action.cost}</em>
                    <em>{action.risk}</em>
                  </span>
                </Button>
              ))}
              <Button type="button" variant="outline" className="ogre-game-reset" onClick={resetRun}>
                <RotateCcw aria-hidden="true" size={16} />
                Reset run
              </Button>
            </div>
          </div>

          <aside className="ogre-game-panel ogre-game-panel--log" aria-label="Run log">
            <div className="ogre-game-scorecard">
              <span>Rank</span>
              <strong>{rank}</strong>
              <p>Reach room 10 with three clues. Spare torch, HP, and relics all boost the final score.</p>
            </div>

            <div className="ogre-game-relics" aria-label="Relics found">
              <div>
                <Gem aria-hidden="true" size={16} />
                <span>Relics</span>
              </div>
              {run.relics.length > 0 ? (
                run.relics.map((relicId) => (
                  <span className="ogre-game-relic" key={relicId} title={relics[relicId].detail}>
                    {relics[relicId].name}
                  </span>
                ))
              ) : (
                <span className="ogre-game-empty-relic">None yet</span>
              )}
            </div>

            <h2>Dungeon Log</h2>
            <ol aria-live="polite">
              {run.log.map((entry, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="ogre-art-strip" aria-label="Dungeon images">
          <article className="ogre-art-card">
            <GoblinScoutArt />
            <span>Goblin Scout</span>
          </article>
          <article className="ogre-art-card">
            <OgreGateArt />
            <span>Ogre Gate</span>
          </article>
          <article className="ogre-art-card">
            <MushroomVaultArt />
            <span>Mushroom Vault</span>
          </article>
        </section>
      </div>
    </main>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: "heart" | "torch" | "map" | "coin" | "danger" | "score";
}) {
  return (
    <span className={cn("ogre-game-status", `ogre-game-status--${tone}`)}>
      {icon}
      {label}
    </span>
  );
}

function GoblinScoutArt() {
  return (
    <svg viewBox="0 0 260 170" role="img" aria-label="Goblin scout illustration">
      <rect width="260" height="170" rx="18" fill="#18251e" />
      <path d="M28 132 C68 94, 112 116, 152 82 S228 72, 238 128" fill="none" stroke="#8ee1a0" strokeWidth="10" strokeLinecap="round" />
      <path d="M82 80 L51 52 L92 61 Z" fill="#8bd17c" />
      <path d="M148 80 L188 50 L176 96 Z" fill="#8bd17c" />
      <ellipse cx="121" cy="88" rx="52" ry="42" fill="#67b96d" />
      <circle cx="101" cy="84" r="8" fill="#101510" />
      <circle cx="141" cy="84" r="8" fill="#101510" />
      <path d="M103 111 Q121 123 142 111" fill="none" stroke="#101510" strokeWidth="6" strokeLinecap="round" />
      <path d="M75 38 Q121 10 169 39" fill="none" stroke="#f2c15d" strokeWidth="7" strokeLinecap="round" />
      <rect x="194" y="94" width="18" height="44" rx="9" fill="#f2c15d" />
      <circle cx="203" cy="87" r="18" fill="#ffe08a" opacity="0.9" />
    </svg>
  );
}

function OgreGateArt() {
  return (
    <svg viewBox="0 0 260 170" role="img" aria-label="Ogre gate illustration">
      <rect width="260" height="170" rx="18" fill="#1b2026" />
      <path d="M42 142 V86 C42 48 72 24 129 24 C187 24 218 49 218 87 V142" fill="#50646e" />
      <path d="M70 142 V88 C70 64 91 49 129 49 C168 49 190 65 190 90 V142" fill="#111820" />
      <path d="M92 74 L74 42 L113 61 Z" fill="#7f9782" />
      <path d="M166 61 L205 42 L187 75 Z" fill="#7f9782" />
      <circle cx="112" cy="89" r="8" fill="#f5d06a" />
      <circle cx="149" cy="89" r="8" fill="#f5d06a" />
      <path d="M105 119 Q130 105 156 119" fill="none" stroke="#d8e6d0" strokeWidth="7" strokeLinecap="round" />
      <path d="M24 145 H236" stroke="#e3aa5e" strokeWidth="9" strokeLinecap="round" />
      <path d="M56 145 L84 118 L112 145 L142 118 L170 145 L200 118" fill="none" stroke="#91d7c5" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function MushroomVaultArt() {
  return (
    <svg viewBox="0 0 260 170" role="img" aria-label="Mushroom vault illustration">
      <rect width="260" height="170" rx="18" fill="#211d27" />
      <path d="M33 137 C59 92, 98 101, 126 64 C156 24, 214 43, 230 137 Z" fill="#31493d" />
      <path d="M72 91 C76 57, 105 44, 132 54 C159 64, 167 88, 157 104 Z" fill="#c987d9" />
      <rect x="101" y="93" width="34" height="47" rx="13" fill="#e2d0a4" />
      <path d="M148 78 C153 47, 183 39, 204 51 C226 64, 228 88, 212 103 Z" fill="#7ed6be" />
      <rect x="172" y="94" width="26" height="43" rx="12" fill="#d8c28f" />
      <circle cx="101" cy="69" r="6" fill="#fff2a6" />
      <circle cx="131" cy="76" r="7" fill="#fff2a6" />
      <circle cx="185" cy="62" r="6" fill="#15372f" />
      <circle cx="204" cy="82" r="5" fill="#15372f" />
      <path d="M48 139 H218" stroke="#f1b56b" strokeWidth="7" strokeLinecap="round" />
      <path d="M62 123 L91 109 L118 125 L150 108 L190 122" fill="none" stroke="#a7e38e" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
