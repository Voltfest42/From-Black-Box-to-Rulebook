# Project plan: "From Black Box to Rulebook"

*Drafted 20 Oct 2026 and updated after your answers. The companion to [research.md](research.md), which has the facts and sources. It follows the structure, stack and conventions of the Beyond Dijkstra project (`D:\Software Projects\Dijkstra Demo`), which is the model for this one.*

> **The brief, from you:** a self-guided, interactive demonstration and story about how rules are extracted from machine-learning models, and how the techniques evolved. Cover the most important techniques, not all of them.

## Status

**Approved; building.** Stages 1–3 are done (Chapters 1 and 2 are live).

## Decisions so far

| Topic | Decision |
|---|---|
| Name | **From Black Box to Rulebook** |
| Audience and use | Readers explore **on their own, in their own time**, as with Beyond Dijkstra. They know roughly what machine learning is, but don't follow explainability research. *(My default.)* |
| Tone | Intuition and pictures first, game-dev analogies where they fit, formulas only when they earn their place. *(Same as Beyond Dijkstra.)* |
| Scope | **The full plan:** 6 chapters, about 22 live figures, plus a **Lab** (the playground). Stretch items are marked. |
| Stack | The Beyond Dijkstra stack: TypeScript, React, Vite and MDX. The site shell, figure frame, step player, glossary, tests and AWS setup are reused from it. |
| Machine learning | **Everything runs in the reader's browser**, written from scratch in TypeScript: the neural networks, trees, forests and every extraction algorithm. No ML libraries, no server. |
| Hosting | **A new S3 + CloudFront stack** (`RuleExtractionSite`, `default` profile, `us-east-1`), deployed after every stage. |
| Git | One commit per stage, pushed to `git@github.com:Voltfest42/From-Black-Box-to-Rulebook.git`. |
| Look | Same visual language as Beyond Dijkstra: clean and light, automatic dark mode, colour-blind-safe palette. |

---

## 1. What we're building

A self-guided **interactive article in chapters** (an "explorable explanation"), hosted on the web. Readers follow the story chapter by chapter and play with live demos of every technique. A **Lab** lets them pick any dataset, any black-box model and any extraction method.

**The story in one breath:**

> *Machine-learning models make decisions nobody wrote down. For almost 40 years, researchers have tried to turn those decisions back into rules people can read and check. Four strategies emerged: open the box, question the box, explain one decision at a time, or build the box out of rules in the first place. Each one strikes a different bargain between being faithful to the model and being short enough to read, and giant language models have now revived all four.*

**The thread that ties it together: fidelity versus size.** A rule set that is short enough to read is rarely exactly the model, and one that is exactly the model is rarely short. Every figure shows both numbers, so readers can watch each method strike its bargain.

**Principles** *(inherited from Beyond Dijkstra)*
- **Self-explanatory.** Every figure has a caption, a legend and a "Try this" prompt. Technical depth lives in optional "Deep dive" boxes.
- **Intuition over formulas.**
- **Real algorithms, not canned animations.** The demos train real models and run real extraction algorithms in the browser. Where we simplify, the app says so (§9).
- **Honest.** Extracted rules can be wrong, unstable, or gamed. The story shows that too.
- **Robust for strangers.** Fast to load, no server, works in every modern browser, can't be broken by unusual input, and every demo has a reset.

**Out of scope:** an ML library, uploading your own datasets, a backend, accounts, real LLMs running in the page.

---

## 2. Site structure

```
Landing      the asthma story, the four strategies as a chapter map, how to use the demos
├─ Ch 1      Rules, and why we want them
├─ Ch 2      Opening the box            (1988–2021)
├─ Ch 3      Questioning the box        (1994–2021)
├─ Ch 4      Explaining one decision    (2016–2020)
├─ Ch 5      Building the box from rules (2015–2023)
├─ Ch 6      Giant models, and what it all means (2023–2026)
├─ Lab       any dataset × any black box × any extraction method
└─ About     what's simplified, how it's tested, sources
```

Navigation, routing (hash URLs such as `/#/opening-the-box/a-neuron-is-a-weighted-vote`), reading progress, lazy-loaded chapters and the error boundaries work exactly as in Beyond Dijkstra.

---

## 3. The running examples

Four small worlds recur through the story, so readers don't have to learn a new dataset for every figure. All of them are generated in the browser from published definitions or our own rules, so nothing needs downloading.

| World | What it is | Why it's good here |
|---|---|---|
| **The robots** | The **MONK's problems** (Thrun et al., 1991), a classic benchmark for rule learners. 432 possible robots, each with 6 traits: head and body shape (round, square, octagon), smiling, holding (sword, balloon, flag), jacket colour (red, yellow, green, blue), tie. A **hidden rule** decides which robots are "friendly". MONK-1: *head = body, or the jacket is red*. MONK-2: *exactly two traits have their first value*. MONK-3: *(green jacket and sword) or (not blue and body not octagon)*, with 5% label noise. | The true rule is **known**, so readers can check whether an extraction method found it. There are only 432 robots, so fidelity can be computed exactly over *every* possible input. Drawn as little SVG characters, it is also fun. |
| **The guard** | A stealth-game guard: "will the guard spot you?", from your **distance** (0–20 m) and the **light level** (0–100%). The game's real logic: spotted if closer than 3 m, or if the light is above a line that rises with distance. "Playtest logs" sample it with 8% label noise. | Two features, so the network's decision boundary and the extracted rules can be **drawn as a map**: smooth curves against axis-aligned boxes. The diagonal boundary shows why short rules lose fidelity. |
| **The combo detector** | A fighting-game input buffer: a recurrent network watches a stream of ↓, → and P presses and fires when the special move **↓ → P** is completed. | The ideal answer is a 4-state machine that a game developer would write by hand. Watching it fall out of a trained network is the point of Section 2.4. |
| **The pole** | The classic cart-pole balancing game, with a neural-network agent (trained ahead of time by a script in the repo). | The reader can play it themselves, then watch the network and a 3-rule decision tree extracted from it play too (Section 3.4). |

Each chapter also tells one **real-world story**: the asthma rule (Ch 1), knowledge-based networks in the 1990s (Ch 2), TREPAN beating trees learned from data (Ch 3), Anchors' user study (Ch 4), the COMPAS rule list (Ch 5), and circuit tracing and CLIPPER (Ch 6). These are told in prose, with sources, and not simulated.

---

## 4. The story: chapters, sections and figures

Each section is a few short paragraphs plus, usually, one interactive figure. ★ marks the key figures. *(stretch)* marks figures that are built only if time allows.

### Landing page
- **Hook:** "The most accurate model was never used." The mid-1990s pneumonia project: neural networks were the most accurate, but a rule learner revealed that the data said *asthma lowers your risk*. If the rules learned that, so had the networks, and nobody could see what else they had learned.
- **The four strategies,** as a chapter map shown as cards.
- **How to use the demos:** colour legend and step controls, readable in 30 seconds.

### Chapter 1 · Rules, and why we want them
| § | Content | Figure |
|---|---|---|
| 1.1 | **The asthma rule.** The story in full. A rule is something a doctor can read, doubt and fix. | A "rule card" illustration |
| 1.2 | **What a rule is:** conditions, coverage and precision. Rule lists, rule sets and trees. | ★ **Guess the rule.** All 432 robots. Build a rule from condition chips ("jacket = red", "head = body"…) and watch which robots it covers and how often it's right. Reveal the hidden rule. |
| 1.3 | **A black box learns the robots.** A neural network trained on 124 robots gets all 432 right, but its "reasoning" is a few hundred numbers. | ★ **Train the black box.** Train a small network live (watch the error fall), see its predictions on every robot, then look at its weights: unreadable. |
| 1.4 | **Four ways to get the rule out:** open it, question it, explain one decision, or build a model that is rules. Plus global versus local. | A diagram of the four strategies, linking to their chapters |
| 1.5 | **Grading a rule:** fidelity (agrees with the model), accuracy (agrees with reality) and size. The asthma rule was *faithful* to the data and *wrong* medically, and that is exactly what extraction is for. | **The scorecard.** Three candidate rules for the trained network, each scored for fidelity, accuracy and size. The same scorecard appears in every later figure. |

### Chapter 2 · Opening the box (1988–2021)
| § | Content | Figure |
|---|---|---|
| 2.1 | **A neuron is a weighted vote.** Reading rules straight off its weights: the subset search of Saito & Nakano (1988) and KT (Fu, 1991). M-of-N rules (Towell & Shavlik, 1993). | ★ **Read a neuron.** One neuron with five yes/no inputs. Drag its weights and bias, and see its truth table and the rules the subset search finds ("IF smiling AND has a tie THEN fire"). Toggle M-of-N to see "IF at least 2 of {A, B, C}". |
| 2.2 | **From one neuron to a whole network:** rules for each hidden unit, rules for the output in terms of those, then substitute. | ★ **Extract the robot network.** Run the layer-by-layer extraction on the network from Figure 1.2. Compare the result with the hidden rule, and watch the rule count grow. |
| 2.3 | **The wall: too many combinations.** n inputs have 2ⁿ subsets. Fine for 1990s networks with 20 inputs, hopeless for millions. DeepRED (2016) and ECLAIRE (2021) push it further. | A chart: subsets to check against the number of inputs, with 1990s and modern networks marked |
| 2.4 | **Networks with memory become machines:** clustering a recurrent network's hidden states gives a finite automaton (Giles et al., 1992; Omlin & Giles, 1996). Weiss et al. (2018) ask the network questions instead (L\*). | ★ **The combo detector.** Train a small recurrent network on ↓ → P (a second or two), see its hidden states as a cloud of points, cluster them, and get the 4-state automaton back. Check it against the network on thousands of random input streams. Re-train with another seed: different weights, same machine. |
| Deep dive | The KT algorithm, Towell & Shavlik's M-of-N steps, and how the automaton is minimized | — |

### Chapter 3 · Questioning the box (1994–2021)
| § | Content | Figure |
|---|---|---|
| 3.1 | **The network as an oracle.** TREPAN (Craven & Shavlik, 1996): grow a decision tree to imitate the network, best-first, and ask the network about fresh made-up cases wherever data runs thin. | ★ **Grow a tree that imitates the network.** The guard map: the network's decision as shading, the tree's boxes on top, disagreements marked. Step through the growth; switch queries on and off; read the rules in plain English. |
| 3.2 | **Asking better questions: m-of-n splits.** On MONK-2 ("exactly two"), ordinary splits need a huge tree. Two m-of-n tests capture it exactly. | **m-of-n versus ordinary splits** on MONK-2, side by side |
| 3.3 | **The student beats the textbook.** In 1996, trees learned from the network were more accurate than trees learned from the data. The same idea later became model compression (2006) and distillation (2015). | **Fidelity against size.** Curves of fidelity and accuracy against the number of rules, for a tree learned from the data and one learned from the network, with a noise slider |
| 3.4 | **Turning a game agent into a rulebook.** VIPER (Bastani et al., 2018) extracts decision-tree policies from neural agents, small enough to verify. | ★ **Balance the pole.** Play it yourself with the arrow keys, then watch the network and the extracted tree. Choose the tree depth, step through the imitation-learning rounds, and read the policy as rules. |
| 3.5 | **Forests are rules already.** A random forest is thousands of rules. RuleFit (2008) keeps a handful with the lasso; SIRUS (2021) keeps the ones most trees agree on, so they survive retraining; born-again trees (2020) rebuild one exact tree. | ★ **From a forest to a few rules.** A 100-tree forest on the guard data: slide the lasso penalty and watch thousands of rules shrink to five. Then re-train on a fresh sample: which rules survive? |
| 3.6 | **The catch: a copy is not the original.** 95% fidelity still means 1 case in 20 is explained wrongly. Sets up Chapter 4. | Narrative |

### Chapter 4 · Explaining one decision (2016–2020)
| § | Content | Figure |
|---|---|---|
| 4.1 | **One decision at a time.** LIME (2016) explains a single prediction with a straight line, but nobody can tell how far the line applies. | **A straight line is not a rule.** Click a spot on the guard map, see LIME's local line, and see where it stops matching the network. |
| 4.2 | **Anchors** (Ribeiro et al., 2018): a short rule that pins the prediction, with 95% precision guaranteed and clear coverage. | ★ **Find the anchor.** Pick a robot. Step through the search: candidate rules, samples drawn, precision estimates with their confidence bounds, the beam. The result is a rule with its precision and coverage, checked exactly against all 432 robots. |
| 4.3 | **What would change the decision?** LORE (2018): a local tree and *counterfactual* rules ("if the light were below 30%, you'd stay hidden"). | ★ **Counterfactual rules.** Click a spot on the guard map: the generated neighbourhood, the local tree, the factual rule, and arrows to the nearest ways to flip the decision. |
| 4.4 | **Can explanations lie?** Fairwashing (2019) and fooling LIME and SHAP (2020): a model that behaves well whenever it suspects it's being questioned. | *(stretch)* **The rigged guard.** A guard model that secretly uses a hidden feature, and fools the local explainer, until you switch on "only ask realistic questions" |

### Chapter 5 · Building the box from rules (2015–2023)
| § | Content | Figure |
|---|---|---|
| 5.1 | **"Stop explaining black boxes."** Rudin (2019): for high-stakes decisions, use a model that is rules. The COMPAS example: a 3-rule list as accurate as a proprietary risk tool. | The COMPAS rule list, quoted |
| 5.2 | **Searching for the best rule list.** CORELS (2017): branch and bound with a proof of optimality. | ★ **Branch and bound.** On the noisy MONK-3 robots: watch the search tree, see whole branches pruned by the bounds, and get the provably best list (the hidden rule, despite the noise). |
| 5.3 | **Many equally good answers.** The Rashomon set (2022): when many models are almost equally good, which rules you get is partly luck. | **The Rashomon set.** Every small tree for the guard data, scored and plotted. Select the near-best ones and see how differently they read. |
| 5.4 | **Neural networks that learn rules.** DR-Net and RRL (2021), Logic Explained Networks (2023): train with gradient descent, read out rules. | ★ **A network that is a rule.** Train a tiny AND/OR network on MONK-1 and watch fuzzy weights harden into "head = body, or jacket is red". |
| 5.5 | **Where rules run out:** pixels, words and giant models have no ready-made features to write rules about. | Narrative |

### Chapter 6 · Giant models, and what it all means (2023–2026)
| § | Content | Figure |
|---|---|---|
| 6.1 | **Billions of weights, no features.** Why the classic methods don't apply directly to LLMs. | Narrative |
| 6.2 | **Reverse-engineering the algorithm.** Grokking (2023): a network found to do clock arithmetic. Transformer programs (2023). Features and circuit tracing (2023–2025). MechaRule (2026): rules tied to neurons. | *(stretch)* **The clock inside.** A small network trained on modular addition, with its learned number embeddings drawn as circles |
| 6.3 | **Language models as rule writers.** LLMs explaining neurons (2023); CLIPPER (2026): a coding LLM writes rules as Python inside the 1999 SLIPPER loop, co-authored by SLIPPER's own creator. | **The CLIPPER loop,** as a step-through diagram |
| 6.4 | **The law catches up.** GDPR (2018), the EU AI Act's right to explanation (2024), and the 2027 deadline. | Narrative |
| 6.5 | **The whole story on one page.** | ★ **Timeline 1988–2026,** filterable by strategy |
| 6.6 | **Which method when?** A practical guide, including for game developers. | A comparison table: needs internals? global or local? fidelity? size? |
| 6.7 | **Open questions and further reading.** | Links |

### The Lab
Pick a **dataset** (the guard, two moons, spiral, XOR, *(stretch)* draw your own, or the robots), a **black box** (neural network, random forest, nearest neighbours) and an **extraction method** (surrogate tree, TREPAN, RuleFit, CORELS on the model's labels, or anchors and counterfactuals at a clicked point). See the map, the rules, and the scorecard.

---

## 5. Interactive building blocks

Built once, reused everywhere. The first five come from Beyond Dijkstra.

| Component | What it does |
|---|---|
| **Figure frame, caption, legend, "Try this", reset** | From Beyond Dijkstra |
| **Step player** | From Beyond Dijkstra: play/pause, step forward and back, scrubber, speed, keyboard |
| **Glossary tooltips, callouts, deep dives** | From Beyond Dijkstra |
| **Timeline** | From Beyond Dijkstra, with the four strategies as tracks |
| **Site shell** | From Beyond Dijkstra: sidebar, routing, progress, error boundaries, About |
| **Robot** | SVG drawing of one robot from its 6 traits. Jacket colours also carry a pattern and a label, so they don't rely on colour. |
| **Robot grid** | All 432 robots, highlighted by any rule, with the model's or the truth's verdict per robot |
| **Decision map** | A canvas heat map of a model's decision over the two guard features, with data points, rule boxes, anchors and counterfactual arrows layered on top in SVG |
| **Rule view** | Rules as readable sentences with condition chips, in list, set and tree form |
| **Tree view** | A node-link drawing of a decision tree, linked to the map (hover a leaf, see its box) |
| **Scorecard** | Fidelity, accuracy, number of rules and conditions, plus "global / local" and "needs internals?" badges |
| **Neuron view** | Inputs, weight sliders, bias, truth table |
| **Training panel** | Live training with a loss chart, pause and re-train with a new seed |
| **Automaton view** | A small state machine drawn as a graph, with the current state highlighted as inputs stream in |
| **Cart-pole** | A canvas game with keyboard control, used for both players and agents |
| **Charts** | Line charts (fidelity against size, lasso path) and a scatter (the Rashomon set) |

**Visual language.** These rules hold everywhere, the palette is colour-blind-safe, and colour is never the only cue.
- "Yes" (friendly robot, spotted) is **orange**; "no" is **blue**, the same validated pair as Beyond Dijkstra's chart colours.
- The black box's decision is soft **shading**; extracted rules are **outlined boxes** or **chips**; places where the rules and the model disagree are marked with a red **×**.
- Training examples are dots; made-up query points are small rings.

---

## 6. Tech stack

The same as Beyond Dijkstra, for the same reasons: the site is completely static, the demos dominate, and you know the stack.

| Piece | Choice |
|---|---|
| Language, build, UI | TypeScript (strict), Vite, React, MDX for chapter text |
| Routing | Hash router |
| Graphics | SVG for diagrams; Canvas for heat maps, the robot grid and the cart-pole |
| Styling | CSS modules and the same design tokens (light/dark, colour-blind-safe) |
| Machine learning | Our own small TypeScript implementations (§7). No TensorFlow.js or similar: the models are tiny, and our own code can emit step-by-step traces. |
| Heavy work | A Web Worker where a job takes more than about 100 ms (forests, the RuleFit path, CORELS in the Lab) |
| Tests | Vitest and fast-check (property tests against brute-force references), plus Playwright and axe (every page, every figure, keyboard use, WCAG 2.1 AA in both themes) |
| Infrastructure | AWS CDK in TypeScript: a private S3 bucket behind CloudFront, copied from Beyond Dijkstra |

---

## 7. Architecture

As in Beyond Dijkstra, **the algorithms know nothing about the UI**. Each takes an optional `emit` callback and reports what it does as typed **trace events**; a figure records them once and replays them, which makes stepping backwards easy. Every random choice comes from a **seeded generator**, so a figure shows the same run every time until the reader presses "Re-roll".

```ts
// core/trace.ts (sketch)
export type Emit<E> = (event: E) => void;
export function record<E, R>(run: (emit: Emit<E>) => R): { events: E[]; result: R };

// extract/anchors.ts
type AnchorEvent =
  | { kind: 'candidates'; rules: Rule[] }
  | { kind: 'sample'; rule: number; agreed: boolean }
  | { kind: 'bounds'; rule: number; lower: number; upper: number; mean: number }
  | { kind: 'beam'; kept: number[] }
  | { kind: 'anchor'; rule: Rule; precision: number; coverage: number };
export function anchors(model: Classifier, x: Instance, options: AnchorOptions, emit?: Emit<AnchorEvent>): AnchorResult;
```

Every model implements one interface, so every extraction method works with every model:

```ts
interface Classifier { predict(x: Instance): number /* P(yes) */ }
```

```
src/
  core/                      pure TypeScript, no UI, fully unit-tested
    random.ts  trace.ts
    data/      robots.ts (MONK)  guard.ts  toy2d.ts  combo.ts
    models/    mlp.ts  tree.ts (CART)  forest.ts  knn.ts  rnn.ts  linear.ts (lasso)
    rules/     rule.ts  metrics.ts (fidelity, accuracy, coverage, precision)
    extract/   subsets.ts (KT)  mofn.ts  trepan.ts  automaton.ts  viper.ts  rulefit.ts  sirus.ts
               lime.ts  anchors.ts  lore.ts
    learn/     corels.ts  rashomon.ts  dnfNet.ts
    sim/       cartpole.ts
  viz/                       figure frame, player, robot, decision map, rule/tree/automaton views, charts
  figures/                   the figures used in the chapters
  content/                   chapter MDX, timeline
  site/                      shell, routing, glossary, pages (from Beyond Dijkstra)
  lab/                       the Lab
  workers/                   compute worker
scripts/                     train-cartpole.ts (pre-trains the agent; its weights are committed)
tests/  e2e/  infra/  docs/
```

---

## 8. Hosting

Exactly like Beyond Dijkstra (see its plan, §7): a private, encrypted S3 bucket readable only by CloudFront through Origin Access Control; HTTPS only; hashed assets cached for a year and `index.html` never cached; `npm run deploy` builds, uploads and invalidates. It would be a **separate stack** (working name `RuleExtractionSite`) in the same account and region (`default` profile, `us-east-1`, already bootstrapped), with its own `*.cloudfront.net` URL. Cost: effectively $0.

---

## 9. Faithfulness: what's exact and what's simplified

| Method | Plan |
|---|---|
| Neural network, decision tree (CART), random forest, k-NN, lasso | Exact textbook versions (small networks trained with Adam; Gini trees; coordinate-descent lasso) |
| Subset search (KT) and M-of-N | Exact subset search for yes/no inputs. M-of-N follows Towell & Shavlik's cluster, eliminate and read steps, without their final retraining of biases. |
| Automaton extraction | A real recurrent network, trained in the browser. Omlin & Giles-style clustering of hidden states, then standard automaton minimization. L\* is described, not run. |
| TREPAN | The paper's oracle (sampling from per-feature distributions under the path's constraints), best-first growth by reach × (1 − fidelity), the S_min rule and the stopping test. m-of-n split search on yes/no features. |
| VIPER | The paper's loop: imitation rounds with the network as oracle, states weighted by how much the action matters (estimated from rollouts of the network), keep the best tree. The agent is a small network pre-trained by a script in the repo. |
| RuleFit, SIRUS | RuleFit's rule generation plus an L1-penalized logistic model, using rules from a random forest rather than RuleFit's own ensemble. SIRUS's quantile splits and frequency threshold, without its final redundancy filter. |
| LIME, Anchors, LORE | LIME's weighted local linear fit. Anchors: the paper's beam search with KL-LUCB and its parameters. LORE: a simplified genetic neighbourhood, a local tree, and factual and counterfactual rules. |
| CORELS | Branch and bound with the paper's objective and several of its bounds (enough to prove optimality, but not all of its speed-ups) |
| Neural rule learner | A small AND/OR network in the spirit of DR-Net and RRL, not a reimplementation of either |
| Giant models | Narrative and diagrams. No LLM runs in the page. |

Every simplified figure gets a short **"What's simplified here?"** note. Every algorithm is tested: models and extractors against brute-force references on small inputs, extracted rules for fidelity on all 432 robots, and the papers' guarantees (anchors' precision ≥ 95%, CORELS' optimality) checked directly.

---

## 10. Stages

As with Beyond Dijkstra, each stage ends with tests passing, a commit ("Stage N: …") and, once hosting is approved, a deploy, so there's always a working site.

| Stage | Focus | Done when |
|---|---|---|
| 1 | **Foundations.** Project scaffold (copied from Beyond Dijkstra and renamed) under git. Seeded randomness, the robots, the guard and the toy datasets, the neural network, decision trees, rules and metrics, all with tests. The CDK stack and a first deploy. | A placeholder site is live, and the core tests pass |
| 2 | **Visual core and Chapter 1.** Robot drawings and grid, decision map, rule, tree and scorecard views, the training panel. The landing page. All of **Chapter 1**. | Chapter 1 is complete and live |
| 3 | **Chapter 2.** Subset search and M-of-N, whole-network extraction, the recurrent network and automaton extraction. | Chapter 2 is complete |
| 4 | **Chapter 3.** TREPAN, m-of-n splits, the fidelity curves, cart-pole and VIPER, the forest, RuleFit and SIRUS. | Chapter 3 is complete |
| 5 | **Chapter 4.** LIME, Anchors, LORE. | Chapter 4 is complete |
| 6 | **Chapters 5 and 6, and About.** CORELS, the Rashomon set, the neural rule learner; the giant-model chapter, the timeline, the method guide; the About page. | Every chapter is live |
| 7 | **The Lab, polish and ship.** The Lab. An accuracy and copy pass, responsive and cross-browser checks, accessibility, end-to-end tests, performance, final deploy. Then stretch items, if time allows. | Done |

**If a stage overruns:** Chapters 2 and 3 carry the most risk (the recurrent network and VIPER). Each is timeboxed; the fallback for the recurrent network is pre-trained weights from a script, and for VIPER a fixed number of imitation rounds. Stretch items wait until Stage 7 is done.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Training in the browser is slow or flaky on some machines | Tiny models, seeded runs, tests that pin the outcome for the default seeds, work chunked across frames or moved to a worker, and pre-trained fallbacks |
| Subtle bugs in intricate algorithms (KL-LUCB, CORELS' bounds, VIPER) | Build from the papers, test against brute force on small inputs, and check the papers' guarantees in tests |
| Too much for one story | Stretch items are marked, and the Lab can shrink to fewer options |
| Statistical ideas (precision, coverage, fidelity) lose non-specialists | One scorecard, the same three numbers everywhere, glossary tooltips, and pictures of each number on the robot grid and the guard map |
| Colour-blind readers can't tell red and green jackets apart | Jackets carry a pattern and a label as well as a colour |
| Sensitive real-world examples (medicine, criminal justice) | Told in prose with sources and a neutral tone; never simulated |
| Unusual input in the Lab | Validated inputs, size caps, friendly messages, a reset on every figure |

---

## 12. Settled details

- **Hosting:** a new stack, `RuleExtractionSite`, deployed after each stage (approved 20 Oct 2026).
- **GitHub:** commits at the end of each stage, pushed to `git@github.com:Voltfest42/From-Black-Box-to-Rulebook.git`.
- **Scope:** the full plan.
- **Name:** From Black Box to Rulebook.
