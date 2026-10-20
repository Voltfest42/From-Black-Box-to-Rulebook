# Research brief: getting rules out of machine learning models

*Compiled 20 Oct 2026 as reference material for this project. Facts marked "(abstract)" were checked against the paper's abstract; facts marked "(paper)" against its full text. Links are in [Sources](#sources).*

## TL;DR

A trained model makes decisions that nobody wrote down. **Rule extraction** turns those decisions into IF–THEN rules that a person can read, check and argue with. The field is almost 40 years old, and its methods fall into a few families:

| | Strategy | The idea | Landmark | Its limit |
|---|---|---|---|---|
| **A** | **Open the box** (*decompositional*) | Read rules straight off the weights, one neuron at a time | KT (Fu, 1991), M-of-N (Towell & Shavlik, 1993) | The search explodes: a neuron with n inputs has 2ⁿ input combinations |
| **B** | **Question the box** (*pedagogical*) | Treat the model as an oracle: ask it questions and learn a small model of its answers | TREPAN (Craven & Shavlik, 1996) | The rules are a *different* model: faithful on average, not everywhere |
| **C** | **Explain one decision** (*local*) | Find a short rule that holds near one particular case | Anchors (Ribeiro, Singh & Guestrin, 2018) | Says nothing about the rest of the model, and can be fooled |
| **D** | **Build the box from rules** (*interpretable by design*) | Skip the black box: learn a rule list or tree directly, as accurate as possible | CORELS (Angelino et al., 2017); Rudin's 2019 manifesto | Needs good features: hard for images, text and giant models |

**The unifying tension** is *fidelity versus comprehensibility*. A rule set small enough to read is rarely exactly the model; a rule set that is exactly the model is rarely small enough to read. Every method strikes a different bargain.

**The modern twist (2023–2026):** giant language models revived all four strategies. Mechanistic interpretability opens the box again, at scale (Anthropic's circuit tracing, 2025). LLMs now *write* rules: a September 2026 preprint has a coding LLM propose rules as Python functions inside a classic boosting loop, matching or beating dedicated rule learners. A KDD 2026 paper ties extracted rules to the individual neurons that implement them.

**Why it matters now:** the EU AI Act (2024) gives people affected by high-risk AI decisions a right to an explanation (Article 86). The 2026 "Digital Omnibus" amendment moved most high-risk obligations to 2 December 2027.

---

## 1. Background in two minutes

- **Rule:** `IF <conditions> THEN <prediction>`. The conditions (the *antecedent*) are tests on input features, joined by AND: `IF light > 60% AND distance < 8 m THEN spotted`.
- **Coverage:** the fraction of cases where the conditions hold. **Precision** (also called confidence): among those cases, the fraction where the prediction is right.
- **Rule set:** unordered rules, usually "predict yes if *any* rule fires" (disjunctive normal form, DNF). **Rule list** (decision list): ordered `IF … ELSE IF … ELSE …`, where the first matching rule wins. **Decision tree:** every root-to-leaf path is a rule; a tree can always be flattened into a rule set.
- **M-of-N rule:** `IF at least M of these N conditions hold THEN …`. Compact for "vote-like" concepts that plain AND/OR rules describe very clumsily.
- **Black box:** a model whose internal logic people can't follow: a neural network, a 500-tree forest, a support vector machine, an LLM.
- **Global vs local:** a global explanation describes the model everywhere; a local one describes it around one case.
- **The three classic quality measures** (Andrews, Diederich & Tickle, 1995):
  - **Accuracy:** how often the rules are right about the *real world* (agree with the true labels).
  - **Fidelity:** how often the rules agree with the *model*. This is what extraction is really about. A rule can be faithful and wrong: it then tells you, correctly, that the model is wrong.
  - **Comprehensibility:** how much there is to read: number of rules, number of conditions.
- **Translucency** (same survey): *decompositional* methods look inside the model (weights, neurons); *pedagogical* methods only query its inputs and outputs; *eclectic* methods mix both.

---

## 2. Why extract rules? The asthma rule

The field's favourite cautionary tale, from Caruana et al. (KDD 2015), checked in the paper:

- In the mid-1990s, a large multi-institutional project funded by Cost-Effective HealthCare (CEHC) tried machine learning for predicting the risk of death of pneumonia patients, to decide who could safely be treated at home. (The model comparison was published by Cooper et al., *Artificial Intelligence in Medicine*, 1997: eight methods, 9,847 training and 4,352 test cases.)
- **Neural networks were the most accurate models** (multitask neural nets; on one dataset AUC 0.86 against 0.77 for logistic regression). But a *rule-based* system trained on the same data learned the rule **HasAsthma(x) ⇒ LowerRisk(x)**: pneumonia patients with asthma were *less* likely to die.
- The pattern was real in the data: asthmatics who came in with pneumonia were usually admitted straight to the intensive-care unit, and that aggressive care worked. A model that sent them home on the strength of it would have harmed them.
- The team's reasoning: if the rule-based system learned it, the neural network had surely learned it too, **but nobody could see it in the network**, or know what *other* dangerous patterns it held (the paper's example: pregnancy might look "protective" for the same reason). So the most accurate model was never used on patients; the team went ahead only with intelligible models.

Other standard motivations:
- **Debugging:** LIME's "husky vs wolf" demonstration (2016) showed a classifier that was really a snow detector.
- **Trust and adoption:** domain experts (doctors, credit officers, game designers) will only use what they can check.
- **Discovery:** the rules may teach *people* something new about the data.
- **Regulation:** GDPR (adopted 2016, applies since 2018) requires "meaningful information about the logic involved" in automated decisions; the EU AI Act adds an explicit right to explanation (§10).

---

## 3. Strategy A: open the box (1988–2021)

In the late 1980s and 1990s, neural networks were small (tens of units) and often *built from* expert rules (knowledge-based neural networks: insert rules, train, then extract the refined rules back out).

### 3.1 Reading a neuron
A sigmoid neuron with weights wᵢ and bias b is "on" when Σ wᵢxᵢ + b > 0. With yes/no inputs, a rule for the neuron is a set of inputs whose "yes" **guarantees** the neuron fires, whatever the other inputs do. Searching for such sets is the heart of the **subset** / **KT** algorithms (Saito & Nakano, 1988; Fu, 1991 "Rule learning by searching on adapted nets", AAAI). KT then works layer by layer: rules for hidden units in terms of inputs, rules for outputs in terms of hidden units, then substitutes. The catch: n inputs have 2ⁿ subsets, and substituting across layers multiplies the rule count.

### 3.2 M-of-N (Towell & Shavlik, 1993)
Towell and Shavlik (*Machine Learning* 13(1), 1993) cluster a unit's weights into groups of similar value, drop groups that can't matter, and read the unit as "at least M of these N antecedents". The extracted rules nearly matched the network's accuracy and were more comprehensible (abstract). This works because trained knowledge-based networks tend to have a few distinct weight levels.

### 3.3 Prune first, then read (Setiono & Liu, 1995)
NeuroRule (IJCAI 1995, "Understanding neural networks via rule extraction"): prune the network hard, cluster each hidden unit's activation values into a few levels, then read rules off the small discrete network.

### 3.4 Recurrent networks → automata
Networks that read sequences can be turned into finite-state machines:
- **Giles et al. (1992)** trained second-order RNNs on regular languages (the classic "Tomita grammars") and extracted automata from them.
- **Omlin & Giles (1996, *Neural Networks* 9(1))**: cluster the network's hidden-state vectors; each cluster is a state, and the observed transitions between clusters give a deterministic finite automaton (DFA). Several consistent automata can be extracted from one network, plus a heuristic for choosing among them (abstract).
- **Weiss, Goldberg & Yahav (ICML 2018; extended in *Machine Learning*, 2024)** made it pedagogical: Angluin's L\* algorithm learns the automaton by asking the RNN membership queries, and answers equivalence queries with an abstraction of the RNN's state space, refined only as needed (abstract).

### 3.5 Deep networks
- **DeepRED** (Zilke, Loza Mencía & Janssen, Discovery Science 2016) extended the earlier CRED approach to multiple hidden layers, using decision trees between consecutive layers and substituting. It handled deep networks but at a large computational cost (survey).
- **ECLAIRE** (Espinosa Zarlenga, Shams & Jamnik, NeurIPS 2021 XAI workshop): a polynomial-time decompositional method that maps each hidden layer straight to the output, in parallel, scaling to large networks and datasets with "orders of magnitude" less compute than earlier methods (abstract).

**Takeaway:** opening the box gives rules tied to the actual mechanism, but the search explodes. That's why the field turned to querying.

---

## 4. Strategy B: question the box (1994–2021)

### 4.1 Rule extraction as learning (Craven & Shavlik, 1994)
"Using sampling and queries to extract rules from trained neural networks" (ICML 1994) reframed extraction as an ordinary learning problem whose *target concept is the network itself*, with the bonus that the network can be asked about any input.

### 4.2 TREPAN (Craven & Shavlik, NIPS 1995 proceedings, published 1996) — details from the paper
- **The oracle.** The network labels the training examples, and also *new* query instances. Queries can be partial: "an instance that satisfies these constraints" (the tests on the path to a tree node). The oracle fills in the other features by sampling from each feature's marginal distribution in the training data: frequency counts for discrete features, kernel density estimates for continuous ones.
- **Best-first growth.** The next node to split is the one with the highest **reach(n) × (1 − fidelity(n))**: the most cases × the most disagreement with the network.
- **m-of-n splits.** Internal nodes test m-of-n expressions, built by hill climbing from the best single-feature split (gain ratio), adding conditions with the m-of-(n+1) and (m+1)-of-(n+1) operators.
- **Enough data everywhere.** Each split is chosen from at least S_min instances (training examples plus fresh queries; 1,000 in the experiments). Ordinary trees run out of data deep down; TREPAN never does.
- **Stopping.** A node becomes a leaf when, with high confidence, it covers only one class (ε = δ = 0.05), or when the tree hits a size limit (15 internal nodes in the experiments).
- **Results** (four domains, test sets): fidelity to the network of 85.7–95.9%. The TREPAN trees were *more accurate than C4.5 trees learned directly from the data* in all four domains, with fewer internal nodes. The network was more accurate still.
- **Generality:** nothing about the network's architecture is assumed; "TREPAN could be used to extract decision-trees from other types of opaque learning systems."

> **Story hook: the student beats the textbook.** A tree learned from the *network* was more accurate than a tree learned from the *data*. The network smooths away noise, and it can answer as many questions as you like. The same idea returned as **model compression** (Bucilă, Caruana & Niculescu-Mizil, KDD 2006) and **knowledge distillation** (Hinton, Vinyals & Dean, 2015).

### 4.3 Beyond networks
- **Support vector machines** (2002–2007): Núñez et al. (2002), Barakat & Diederich (2005), Martens et al. (2007, credit scoring) extracted rules from SVMs, both decompositionally (from support vectors) and pedagogically.
- **Born again trees** (Breiman & Shang, 1996 technical report): replace a forest by one tree trained on data labelled by the forest.

### 4.4 Forests are made of rules (2008–2021)
Every node of every tree in a forest *is* a rule, so a forest is a huge rule set. The question becomes which few to keep.
- **RuleFit** (Friedman & Popescu, *Annals of Applied Statistics*, 2008): generate rules from a tree ensemble (each node = the conjunction of cuts leading to it), then fit a **lasso** (L1-penalized) linear model on the rules' 0/1 indicators, which keeps only a handful. Accuracy comparable to the best methods (abstract).
- **inTrees** (Deng, 2014): extract, prune and summarize the rules of a tree ensemble.
- **SIRUS** (Bénard, Biau, Da Veiga & Scornet, *Electronic Journal of Statistics*, 2021): rule *stability*. Restrict splits to quantiles of each feature (so trees share split points), keep the rules that occur in at least a fraction p₀ of the trees, and average them. Much more stable under data perturbation than earlier methods, with accuracy close to the forest (abstract).
- **Born-again tree ensembles** (Vidal, Pacheco & Schiffer, ICML 2020): an exact dynamic-programming algorithm for the *smallest* single tree that reproduces a tree ensemble **everywhere in feature space**: 100% fidelity, by construction (abstract).

### 4.5 Policy extraction: rules from game-playing agents
- **VIPER** (Bastani, Pu & Solar-Lezama, NeurIPS 2018): train a deep reinforcement-learning agent, then extract a **decision-tree policy** by imitation learning: run the tree, ask the neural "oracle" what it would do in the states the tree visits (DAgger), and weight each state by how much the action matters, using the oracle's Q-function. Results: a tree for a symbolic Atari Pong, a tree for a Pong-like game that *provably never loses*, and a provably stable cart-pole controller, each as good as the original network (abstract). Small trees can be **formally verified**, which networks can't.
- Related: PIRL (Verma et al., ICML 2018) extracts programmatic policies for the TORCS racing-car simulator.

**Takeaway:** querying scales to any model and gives compact rules, but the rules are a separate model. They can be unfaithful exactly where it matters, and nothing guarantees otherwise (§7).

---

## 5. Strategy C: explain one decision (2016–2020)

When the whole model is too complex for one readable rule set, explain one decision at a time.

- **LIME** (Ribeiro, Singh & Guestrin, KDD 2016): perturb the input, query the model, fit a *weighted linear* model nearby. Not rules, and its **coverage is unclear**: a reader can't tell where the explanation stops applying.
- **SHAP** (Lundberg & Lee, NIPS 2017): feature attributions from Shapley values. Also not rules; context only.
- **Anchors** (Ribeiro, Singh & Guestrin, AAAI 2018) — details from the paper:
  - An **anchor** is a rule A that holds for the instance x and *anchors* the prediction: for perturbed samples z that satisfy A, the model predicts f(z) = f(x) with probability at least τ (**τ = 0.95**). Text example: for "This movie is not bad.", the anchor {"not", "bad"} virtually guarantees a positive prediction.
  - Among anchors, prefer the one with the highest **coverage** (the share of the perturbation distribution it applies to).
  - **Search:** start from the empty rule and add one predicate at a time. Each candidate is an "arm" of a pure-exploration **multi-armed bandit**: **KL-LUCB** samples the candidates adaptively until it is confident which are best. The final version is a **beam search** (B = 10, δ = 0.05, ε = 0.1) that returns the highest-coverage anchor found.
  - **User study:** with anchors, users predicted the model's behaviour on unseen instances with about 95% precision and less effort than with LIME; 21 of 26 preferred anchors.
  - Known weakness: near a decision boundary, anchors become very specific and cover almost nothing.
- **LORE** (Guidotti et al., 2018; *IEEE Intelligent Systems*, 2019): grow a synthetic neighbourhood around the instance with a **genetic algorithm** (aimed at the decision boundary), fit a local decision tree, and return a **factual rule** plus **counterfactual rules**: the smallest changes that would flip the decision ("if light were below 30%, you would not have been spotted").
- **Counterfactual explanations** (Wachter, Mittelstadt & Russell, 2017; *Harvard Journal of Law & Technology*, 2018): argued that "what would have to change" is what people affected by automated decisions need, and can be given without opening the black box.

---

## 6. Strategy D: build the box from rules (2015–2023)

### 6.1 Rule lists and sets, learned directly
- **Bayesian Rule Lists** (Letham, Rudin, McCormick & Madigan, *AoAS* 2015): a posterior over decision lists with a prior favouring short ones. A stroke-risk model as interpretable as the clinical CHADS₂ score, but more accurate (abstract).
- **Interpretable Decision Sets** (Lakkaraju, Bach & Leskovec, KDD 2016): unordered, non-overlapping rules optimized jointly for accuracy and simplicity.
- **CORELS** (Angelino, Larus-Stone, Alabi, Seltzer & Rudin, KDD 2017; *JMLR* 2018) — details from the paper:
  - Objective: **R = (fraction misclassified) + λ × (number of rules)**; λ = 0.01 makes one extra rule cost as much as 1% more errors.
  - **Branch and bound** over rule-list prefixes, with lower bounds that prune almost everything, returning the optimum *and a certificate that it's optimal*.
  - On the ProPublica COMPAS data (two-year recidivism, Broward County, Florida), it found this list, about as accurate as the proprietary COMPAS tool:
    ```
    if (age = 18–20) and (sex = male) then predict yes
    else if (age = 21–23) and (priors = 2–3) then predict yes
    else if (priors > 3) then predict yes
    else predict no
    ```
- **Boolean rules via column generation** (Dash, Günlük & Wei, NeurIPS 2018), part of IBM's AIX360 toolkit.

### 6.2 Rudin's challenge (2019)
"Stop explaining black box machine learning models for high stakes decisions and use interpretable models instead" (*Nature Machine Intelligence* 1, 2019). Explanations of black boxes are by definition not fully faithful, so in high-stakes settings build models that are interpretable to begin with. On tabular data they typically lose little or no accuracy. Examples from criminal justice, healthcare and computer vision.

### 6.3 Optimal trees and the Rashomon set
- **Optimal sparse decision trees:** OSDT (Hu, Rudin & Seltzer, NeurIPS 2019) and GOSDT (Lin et al., ICML 2020) find provably optimal trees for a size penalty.
- **The Rashomon effect:** many different models are almost equally accurate. Semenova, Rudin & Parr (FAccT 2022) argue that when this set is large, a simple model is likely to be in it. **TreeFARMS** (Xin et al., NeurIPS 2022) enumerates the whole Rashomon set of sparse trees.
- Consequence for extraction: when there are many equally good rule sets, which one an extractor returns is partly luck. That's the instability SIRUS tackles.

### 6.4 Neural networks that *are* rules (2018–2023)
Train with gradient descent, but constrain the architecture so the trained model reads as rules:
- **∂ILP** (Evans & Grefenstette, *JAIR* 2018): differentiable inductive logic programming.
- **DR-Net** (Qiao, Wang & Lin, AAAI 2021): a two-layer network whose hidden neurons are rules and whose output is their OR; reported more accurate than other rule learners and comparable to random forests (abstract).
- **RRL** (Wang, Zhang, Liu & Wang, NeurIPS 2021): a hierarchical rule-based representation learner with discretization, conjunction and disjunction layers, trained with "gradient grafting" (abstract).
- **Logic Explained Networks** (Ciravegna et al., *Artificial Intelligence* 314, 2023): networks over human-understandable concepts that output first-order-logic explanations.

---

## 7. The fine print: when rules mislead

- **Fidelity isn't guaranteed.** A global surrogate can agree with the model 95% of the time and disagree on exactly the cases you care about.
- **Fairwashing** (Aïvodji et al., ICML 2019): LaundryML searches for rule lists that have **high fidelity to an unfair black box but look much fairer**. An explanation can rationalize a model rather than reveal it.
- **Fooling LIME and SHAP** (Slack, Hilgard, Jia, Singh & Lakkaraju, AIES 2020): perturbation-based explainers query points that don't look like real data. A model can detect those queries and answer them innocently while staying biased on real inputs, so the explanation looks harmless.
- **Instability:** retrain on slightly different data and a tree or rule set can change completely (the Rashomon effect).
- **Comprehensibility has limits too:** 200 rules of 5 conditions each is "readable" in theory only.

---

## 8. Rules for giant models (2023–2026)

Classic methods assume tabular inputs and models of modest size. LLMs read text and have billions of parameters, so the field has gone in new directions.

### 8.1 Open the box, at scale: mechanistic interpretability
- **Grokking reverse-engineered** (Nanda, Chan, Lieberum, Smith & Steinhardt, ICLR 2023): a small transformer trained on modular addition was found to implement a Fourier "clock" algorithm, rotating around a circle, verified by ablations (abstract). A complete "rule" recovered from weights.
- **Compiling and decompiling programs:** Tracr (Lindner et al., NeurIPS 2023) compiles RASP programs (Weiss, Goldberg & Yahav, 2021) into transformer weights. **Learning Transformer Programs** (Friedman, Wettig & Chen, NeurIPS 2023 oral) trains modified transformers that convert automatically into discrete, human-readable Python programs, performing on par with standard transformers of similar size (abstract).
- **Features and circuits:** sparse autoencoders split a model's activations into interpretable "features" (Anthropic: *Towards Monosemanticity*, 2023; *Scaling Monosemanticity*, 2024). **Circuit tracing** (Ameisen et al.; Lindsey et al., *On the Biology of a Large Language Model*, March 2025) builds **attribution graphs** for Claude 3.5 Haiku, partly tracing intermediate steps: for example, a "Texas" representation becomes active on the way from "Dallas" to "Austin", and the model plans rhymes ahead. The authors present case studies, not a general theory.

### 8.2 LLMs as explainers and rule writers
- **LLMs explain neurons** (Bills et al., OpenAI, May 2023): GPT-4 wrote and scored natural-language explanations for all 307,200 neurons in GPT-2. Over 1,000 got good scores, but most interesting neurons weren't well explained.
- **LLMs can learn rules** (Zhu et al., 2023, "Hypotheses-to-Theories"): generate candidate rules, keep those verified on examples.
- **CLIPPER** (Kumar, Cohen & Cohen, CMU, arXiv preprint, 28 Sept 2026; not yet peer-reviewed): keeps the boosting loop of the classic SLIPPER rule learner (Cohen & Singer, AAAI 1999, itself built on Cohen's RIPPER, ICML 1995) but has a **coding LLM write each rule as a Python function**. A co-author, William W. Cohen, is the author of RIPPER and SLIPPER: the same researcher revisiting his own rule learner 27 years later. Each rule is scored on the full training set and kept or rejected. The final model is a small set of executable rules (median 4.5–13.5 rules) and needs no LLM at prediction time. On eight tabular benchmarks (including Adult, COMPAS, HELOC) it beats SLIPPER at every training size tested; on text it wins by large margins. Swapping the LLM changes little: "the harness matters more than the model".
- **Zero-shot rule induction** (Phua, arXiv preprint, May 2026): a "foundation model" pretrained only on synthetic DNF formulas outputs rules for new tables without retraining. Robust to label noise, but still about 13 points below a per-dataset trained baseline on average. Early days.
- **NeuroRule** (Kodavanti, Shahrzad & Miikkulainen, arXiv preprint, Sept 2026): evolves concise rule sets that mimic a trained network (rule-set evolution as distillation), without needing the original training data (abstract; no numbers checked).

### 8.3 Rules tied to neurons
**MechaRule** (Sovrano, Dominici & Langheinrich, KDD 2026): find sparse sets of LLM neurons whose ablation disrupts a behaviour, then learn a Boolean rule over prompt features that predicts when ablating a neuron flips the output. It connects classic rule extraction (readable, but only a surrogate) with mechanistic interpretability (real mechanism, but hand-crafted hypotheses).

---

## 9. Timeline

**Bold** rows are the landmarks the story is built around.

| Year | What | Who | Venue |
|---|---|---|---|
| 1988 | Rules from a trained diagnosis network | Saito, Nakano | IEEE ICNN |
| 1988 | Connectionist expert systems | Gallant | CACM 31(2) |
| 1991 | KT: searching subsets of weights | Fu | AAAI |
| 1991 | The MONK's problems (benchmark with known rules) | Thrun et al. | CMU tech report |
| 1992 | Automata from recurrent networks | Giles et al. | Neural Computation |
| 1993 | M-of-N rules from knowledge-based networks | Towell, Shavlik | Machine Learning |
| 1994 | Extraction as learning, with queries | Craven, Shavlik | ICML |
| 1995 | RIPPER: fast rule induction (learned from data) | Cohen | ICML |
| **1995** | **Taxonomy: decompositional / pedagogical / eclectic; fidelity** | **Andrews, Diederich, Tickle** | **Knowledge-Based Systems** |
| 1995 | NeuroRule: prune, then extract | Setiono, Liu | IJCAI |
| **1996** | **TREPAN: query the network, grow a tree** | **Craven, Shavlik** | **NIPS** |
| 1996 | Born again trees | Breiman, Shang | Berkeley tech report |
| 1996 | Automata by clustering hidden states | Omlin, Giles | Neural Networks |
| 1997 | Pneumonia mortality: eight methods compared | Cooper et al. | AI in Medicine |
| 1999 | SLIPPER: boosted rule learning | Cohen, Singer | AAAI |
| 2002–07 | Rules from support vector machines | Núñez et al.; Barakat, Diederich; Martens et al. | various |
| 2006 | Model compression | Bucilă, Caruana, Niculescu-Mizil | KDD |
| **2008** | **RuleFit: rules from trees + lasso** | **Friedman, Popescu** | **Annals of Applied Statistics** |
| 2015 | Bayesian Rule Lists | Letham, Rudin, McCormick, Madigan | AoAS |
| 2015 | The asthma rule retold; intelligible models | Caruana et al. | KDD |
| 2015 | Knowledge distillation | Hinton, Vinyals, Dean | NIPS workshop |
| 2016 | LIME | Ribeiro, Singh, Guestrin | KDD |
| 2016 | Interpretable Decision Sets | Lakkaraju, Bach, Leskovec | KDD |
| 2016 | DeepRED | Zilke, Loza Mencía, Janssen | Discovery Science |
| **2017** | **CORELS: certifiably optimal rule lists** | **Angelino, Larus-Stone, Alabi, Seltzer, Rudin** | **KDD; JMLR 2018** |
| **2018** | **Anchors** | **Ribeiro, Singh, Guestrin** | **AAAI** |
| 2018 | LORE: local + counterfactual rules | Guidotti et al. | arXiv; IEEE IS 2019 |
| 2018 | Automata from RNNs with L\* | Weiss, Goldberg, Yahav | ICML |
| **2018** | **VIPER: decision-tree policies from deep RL** | **Bastani, Pu, Solar-Lezama** | **NeurIPS** |
| 2018 | GDPR applies | EU | — |
| **2019** | **"Stop explaining black boxes"** | **Rudin** | **Nature Machine Intelligence** |
| 2019 | Fairwashing | Aïvodji et al. | ICML |
| 2019–20 | Optimal sparse trees (OSDT, GOSDT) | Hu, Rudin, Seltzer; Lin et al. | NeurIPS; ICML |
| 2020 | Fooling LIME and SHAP | Slack et al. | AIES |
| 2020 | Born-again tree ensembles | Vidal, Pacheco, Schiffer | ICML |
| 2021 | SIRUS: stable rules from forests | Bénard, Biau, Da Veiga, Scornet | EJS; AISTATS |
| 2021 | DR-Net; RRL | Qiao, Wang, Lin; Wang et al. | AAAI; NeurIPS |
| 2021 | ECLAIRE | Espinosa Zarlenga, Shams, Jamnik | NeurIPS workshop |
| 2022 | Rashomon sets of trees; the Rashomon ratio | Xin et al.; Semenova, Rudin, Parr | NeurIPS; FAccT |
| 2023 | Logic Explained Networks | Ciravegna et al. | Artificial Intelligence |
| 2023 | Grokking reverse-engineered | Nanda et al. | ICLR |
| 2023 | Learning Transformer Programs; Tracr | Friedman, Wettig, Chen; Lindner et al. | NeurIPS |
| 2023 | LLMs explain neurons | Bills et al. | OpenAI |
| 2024 | EU AI Act (Art. 86: right to explanation) | EU | Reg. 2024/1689 |
| **2025** | **Circuit tracing in a production LLM** | **Ameisen et al.; Lindsey et al.** | **Anthropic** |
| 2026 | Zero-shot rule induction | Phua | arXiv preprint |
| 2026 | MechaRule: rules tied to LLM neurons | Sovrano, Dominici, Langheinrich | KDD |
| 2026 | Digital Omnibus: AI Act high-risk duties to Dec 2027 | EU | Reg. 2026/1744 |
| **2026** | **CLIPPER: a coding LLM writes the rules** | **Kumar, Cohen, Cohen** | **arXiv preprint** |

---

## 10. Law and regulation (as of Oct 2026)

- **GDPR** (Regulation 2016/679, applies since 25 May 2018): Articles 13–15 require "meaningful information about the logic involved" in automated decisions; Article 22 restricts solely automated decisions with legal or similarly significant effects. Whether this amounts to a "right to explanation" was debated (Goodman & Flaxman, 2017; Wachter, Mittelstadt & Floridi, 2017).
- **EU AI Act** (Regulation 2024/1689, published 12 July 2024): **Article 86** gives a person affected by a decision based on a high-risk AI system (Annex III) the right to "clear and meaningful explanations" of the system's role and the main elements of the decision. No obligation to disclose source code.
- **Digital Omnibus on AI** (Regulation 2026/1744, in the Official Journal 24 July 2026, according to law-firm commentary; not checked against the OJ itself): high-risk obligations for stand-alone Annex III systems deferred to **2 December 2027**, and for AI in regulated products (Annex I) to **2 August 2028**. Transparency duties (Article 50) applied from 2 August 2026.

---

## 11. Glossary

- **Rule / antecedent / consequent:** IF (antecedent: conditions) THEN (consequent: prediction).
- **Coverage, precision:** how often a rule applies; how often it's right when it does.
- **Rule set, rule list, decision tree:** unordered rules (any can fire); ordered rules (first match wins); nested tests (each leaf is a rule).
- **M-of-N rule:** true when at least M of N listed conditions hold.
- **Black box / surrogate:** the opaque model / the simple model that imitates it.
- **Fidelity:** agreement between the rules and the model (not reality).
- **Decompositional / pedagogical / eclectic:** looks inside / only asks questions / both.
- **Global / local:** about the whole model / about one decision.
- **Oracle, query:** the model, used as an answering machine; one question to it.
- **Anchor:** a local rule that keeps the model's prediction the same with high probability.
- **Counterfactual:** the smallest change to the input that changes the decision.
- **Lasso (L1 penalty):** a regression method that sets most coefficients to exactly zero, so only a few rules survive.
- **Branch and bound:** a search that skips whole families of candidates once a bound proves they can't beat the best found so far.
- **Rashomon set:** all models that are almost as good as the best one.
- **Finite automaton (DFA):** a machine with a few states that reads a sequence one symbol at a time.
- **Policy:** in reinforcement learning, the rule an agent uses to pick an action in each state.
- **Distillation:** training a small model to imitate a big one.
- **Mechanistic interpretability:** reverse-engineering the algorithm a network actually implements.

---

## 12. Questions you might get

- **"Isn't this just SHAP?"** No. SHAP and LIME give *importance scores*; rules give *conditions with clear coverage*. Anchors was designed to fix exactly the "where does this explanation apply?" problem.
- **"Do extracted rules show how the model really works?"** Decompositional rules do, but they get huge. Pedagogical rules show what the model *does*, approximately, and fidelity says how approximately.
- **"Why not always use an interpretable model?"** For tabular, high-stakes problems Rudin argues you often should, and CORELS-style results back her up. For images, audio, text and LLMs, the best models are still black boxes.
- **"Can extracted rules be trusted?"** Check the fidelity, and remember they can be gamed (fairwashing; fooling LIME/SHAP).
- **"What does this have to do with games?"** Behaviour trees and decision trees are rule systems. VIPER-style extraction turns a trained agent into a tree that designers can read, tweak, and even verify.
- **"Do LLMs make rule extraction obsolete?"** The opposite: LLMs are now being used to *write* rules (CLIPPER, 2026), and mechanistic interpretability is decompositional extraction at a vastly bigger scale.

---

## Sources

**Surveys and foundations**
- Andrews, Diederich, Tickle: *Survey and critique of techniques for extracting rules from trained artificial neural networks*, Knowledge-Based Systems 8(6), 1995. <https://doi.org/10.1016/0950-7051(96)81920-4>
- Thrun et al.: *The MONK's Problems: A Performance Comparison of Different Learning Algorithms*, CMU-CS-91-197, 1991. Dataset: <https://archive.ics.uci.edu/dataset/70/monk+s+problems>
- Caruana, Lou, Gehrke, Koch, Sturm, Elhadad: *Intelligible Models for HealthCare: Predicting Pneumonia Risk and Hospital 30-day Readmission*, KDD 2015. <https://doi.org/10.1145/2783258.2788613>
- Cooper et al.: *An evaluation of machine-learning methods for predicting pneumonia mortality*, Artificial Intelligence in Medicine 9(2), 1997. <https://pubmed.ncbi.nlm.nih.gov/9040894/>

**Open the box**
- Gallant: *Connectionist expert systems*, CACM 31(2), 1988. <https://doi.org/10.1145/42372.42377>
- Fu: *Rule learning by searching on adapted nets*, AAAI 1991.
- Towell, Shavlik: *Extracting refined rules from knowledge-based neural networks*, Machine Learning 13(1), 1993. <https://doi.org/10.1007/BF00993103>
- Setiono, Liu: *Understanding neural networks via rule extraction*, IJCAI 1995.
- Omlin, Giles: *Extraction of rules from discrete-time recurrent neural networks*, Neural Networks 9(1), 1996. <https://clgiles.ist.psu.edu/papers/NN-1996-rule-extraction.pdf>
- Weiss, Goldberg, Yahav: *Extracting Automata from Recurrent Neural Networks Using Queries and Counterexamples*, ICML 2018. <https://arxiv.org/abs/1711.09576>
- Zilke, Loza Mencía, Janssen: *DeepRED – Rule Extraction from Deep Neural Networks*, Discovery Science 2016.
- Espinosa Zarlenga, Shams, Jamnik: *Efficient Decompositional Rule Extraction for Deep Neural Networks*, NeurIPS 2021 workshop. <https://arxiv.org/abs/2111.12628>

**Question the box**
- Craven, Shavlik: *Using sampling and queries to extract rules from trained neural networks*, ICML 1994.
- Craven, Shavlik: *Extracting Tree-Structured Representations of Trained Networks*, NIPS 8 (1995, published 1996). <https://proceedings.neurips.cc/paper/1995/hash/45f31d16b1058d586fc3be7207b58053-Abstract.html>
- Breiman, Shang: *Born again trees*, UC Berkeley technical report, 1996. <https://www.stat.berkeley.edu/~breiman/BAtrees.pdf>
- Bucilă, Caruana, Niculescu-Mizil: *Model compression*, KDD 2006. <https://www.cs.cornell.edu/~caruana/compression.kdd06.pdf>
- Friedman, Popescu: *Predictive learning via rule ensembles*, Annals of Applied Statistics 2(3), 2008. <https://arxiv.org/abs/0811.1679>
- Bénard, Biau, Da Veiga, Scornet: *SIRUS: Stable and Interpretable RUle Set for Classification*, EJS 15(1), 2021. <https://arxiv.org/abs/1908.06852>
- Vidal, Pacheco, Schiffer: *Born-Again Tree Ensembles*, ICML 2020. <https://arxiv.org/abs/2003.11132>
- Bastani, Pu, Solar-Lezama: *Verifiable Reinforcement Learning via Policy Extraction*, NeurIPS 2018. <https://arxiv.org/abs/1805.08328>

**Explain one decision**
- Ribeiro, Singh, Guestrin: *"Why Should I Trust You?": Explaining the Predictions of Any Classifier* (LIME), KDD 2016. <https://arxiv.org/abs/1602.04938>
- Ribeiro, Singh, Guestrin: *Anchors: High-Precision Model-Agnostic Explanations*, AAAI 2018. <https://ojs.aaai.org/index.php/AAAI/article/view/11491>
- Guidotti et al.: *Local Rule-Based Explanations of Black Box Decision Systems* (LORE), 2018. <https://arxiv.org/abs/1805.10820>
- Wachter, Mittelstadt, Russell: *Counterfactual Explanations without Opening the Black Box: Automated Decisions and the GDPR*, 2017. <https://arxiv.org/abs/1711.00399>
- Lundberg, Lee: *A Unified Approach to Interpreting Model Predictions* (SHAP), NIPS 2017. <https://arxiv.org/abs/1705.07874>

**Build the box from rules**
- Cohen: *Fast Effective Rule Induction* (RIPPER), ICML 1995. <https://mlanthology.org/icml/1995/cohen1995icml-fast>
- Cohen, Singer: *A Simple, Fast, and Effective Rule Learner* (SLIPPER), AAAI 1999. <https://cdn.aaai.org/AAAI/1999/AAAI99-049.pdf>
- Letham, Rudin, McCormick, Madigan: *Interpretable classifiers using rules and Bayesian analysis*, AoAS 9(3), 2015. <https://arxiv.org/abs/1511.01644>
- Lakkaraju, Bach, Leskovec: *Interpretable Decision Sets: A Joint Framework for Description and Prediction*, KDD 2016.
- Angelino, Larus-Stone, Alabi, Seltzer, Rudin: *Learning Certifiably Optimal Rule Lists for Categorical Data*, JMLR 18, 2018. <https://arxiv.org/abs/1704.01701>
- Rudin: *Stop explaining black box machine learning models for high stakes decisions and use interpretable models instead*, Nature Machine Intelligence 1, 2019. <https://arxiv.org/abs/1811.10154>
- Xin et al.: *Exploring the Whole Rashomon Set of Sparse Decision Trees*, NeurIPS 2022. <https://arxiv.org/abs/2209.08040>
- Semenova, Rudin, Parr: *On the Existence of Simpler Machine Learning Models*, FAccT 2022. <https://arxiv.org/abs/1908.01755>
- Qiao, Wang, Lin: *Learning Accurate and Interpretable Decision Rule Sets from Neural Networks*, AAAI 2021. <https://arxiv.org/abs/2103.02826>
- Wang, Zhang, Liu, Wang: *Scalable Rule-Based Representation Learning for Interpretable Classification*, NeurIPS 2021. <https://arxiv.org/abs/2109.15103>
- Ciravegna et al.: *Logic Explained Networks*, Artificial Intelligence 314, 2023. <https://arxiv.org/abs/2108.05149>

**When rules mislead**
- Aïvodji et al.: *Fairwashing: the risk of rationalization*, ICML 2019. <https://arxiv.org/abs/1901.09749>
- Slack, Hilgard, Jia, Singh, Lakkaraju: *Fooling LIME and SHAP: Adversarial Attacks on Post hoc Explanation Methods*, AIES 2020. <https://arxiv.org/abs/1911.02508>

**Giant models**
- Nanda, Chan, Lieberum, Smith, Steinhardt: *Progress measures for grokking via mechanistic interpretability*, ICLR 2023. <https://arxiv.org/abs/2301.05217>
- Friedman, Wettig, Chen: *Learning Transformer Programs*, NeurIPS 2023. <https://arxiv.org/abs/2306.01128>
- Bills et al.: *Language models can explain neurons in language models*, OpenAI, 2023. <https://openai.com/index/language-models-can-explain-neurons-in-language-models/>
- Lindsey et al.: *On the Biology of a Large Language Model*, Transformer Circuits, 2025. <https://transformer-circuits.pub/2025/attribution-graphs/biology.html>
- Zhu et al.: *Large Language Models can Learn Rules*, 2023. <https://arxiv.org/abs/2310.07064>
- Kumar, Cohen, Cohen: *Coding LLMs Can Be Harnessed to Learn Interpretable Models from Data*, arXiv preprint, 2026. <https://arxiv.org/abs/2610.14006>
- Phua: *A Foundation Model for Zero-Shot Logical Rule Induction*, arXiv preprint, 2026. <https://arxiv.org/abs/2605.04916>
- Kodavanti, Shahrzad, Miikkulainen: *NeuroRule: Making Black-Box Neural Networks Explainable through Rule-set Evolution*, arXiv preprint, 2026. <https://arxiv.org/abs/2609.26841>
- Sovrano, Dominici, Langheinrich: *Neuron-Anchored Rule Extraction for Large Language Models via Contrastive Hierarchical Ablation*, KDD 2026. <https://arxiv.org/abs/2605.03058>

**Law**
- EU AI Act, Article 86 (AI Act Service Desk): <https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-86>
- Gibson Dunn, *EU AI Act Omnibus Agreement — Postponed High-Risk Deadlines*: <https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/>
