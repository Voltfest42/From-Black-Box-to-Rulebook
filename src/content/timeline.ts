/**
 * Results for the timeline in Chapter 6 and the sources on the About page.
 * See docs/research.md for how each was checked.
 */
export type Track = 'open' | 'question' | 'local' | 'design' | 'giant';

export interface TimelineEntry {
  year: string;
  track: Track;
  title: string;
  who: string;
  venue: string;
  detail: string;
  /** The landmark results of the story. */
  landmark?: boolean;
  /** Not yet peer-reviewed. */
  preprint?: boolean;
  link?: string;
}

export const TRACK_LABELS: Record<Track, string> = {
  open: 'Opening the box',
  question: 'Questioning the box',
  local: 'One decision at a time',
  design: 'Building with rules',
  giant: 'Giant models',
};

export const TIMELINE: readonly TimelineEntry[] = [
  { year: '1988', track: 'open', title: 'Rules from a trained diagnosis network', who: 'Kazumi Saito and Ryohei Nakano', venue: 'IEEE ICNN', detail: 'One of the first methods to read IF–THEN rules off a trained network, for medical diagnosis.' },
  { year: '1988', track: 'open', title: 'Connectionist expert systems', who: 'Stephen I. Gallant', venue: 'Communications of the ACM', detail: 'Networks as the knowledge base of an expert system that could justify its answers with rules.', link: 'https://doi.org/10.1145/42372.42377' },
  { year: '1991', track: 'open', title: 'KT: searching subsets of weights', who: 'LiMin Fu', venue: 'AAAI', detail: 'Search groups of inputs that guarantee a unit fires, layer by layer (Figure 2.1).' },
  { year: '1991', track: 'design', title: "The MONK's problems", who: 'Sebastian Thrun and more than 20 colleagues', venue: 'CMU technical report', detail: 'Three made-up problems about 432 robots, with known hidden rules, to compare learning methods. The robots of this site.', link: 'https://archive.ics.uci.edu/dataset/70/monk+s+problems' },
  { year: '1992', track: 'open', title: 'State machines from recurrent networks', who: 'C. Lee Giles and colleagues', venue: 'Neural Computation', detail: 'Recurrent networks trained on simple languages, with finite-state machines extracted from them.' },
  { year: '1993', track: 'open', title: 'M-of-N rules', who: 'Geoffrey Towell and Jude Shavlik', venue: 'Machine Learning', detail: 'Group similar weights and read units as “at least M of these N”: nearly as accurate as the network, much easier to read.', link: 'https://doi.org/10.1007/BF00993103' },
  { year: '1994', track: 'question', title: 'Extraction as learning, with queries', who: 'Mark Craven and Jude Shavlik', venue: 'ICML', detail: 'Treat the network as the concept to be learned, and ask it questions.' },
  { year: '1995', track: 'open', title: 'The taxonomy: decompositional and pedagogical', who: 'Robert Andrews, Joachim Diederich and Alan Tickle', venue: 'Knowledge-Based Systems', detail: 'The survey that named the families and made fidelity, accuracy and comprehensibility the standard measures.', landmark: true, link: 'https://doi.org/10.1016/0950-7051(96)81920-4' },
  { year: '1995', track: 'open', title: 'NeuroRule: prune, then read', who: 'Rudy Setiono and Huan Liu', venue: 'IJCAI', detail: 'Prune the network hard and group hidden activations before extracting rules.' },
  { year: '1995', track: 'design', title: 'RIPPER', who: 'William W. Cohen', venue: 'ICML', detail: 'A fast rule learner that works straight from the data, still a standard baseline.', link: 'https://mlanthology.org/icml/1995/cohen1995icml-fast' },
  { year: '1996', track: 'question', title: 'TREPAN', who: 'Mark Craven and Jude Shavlik', venue: 'NIPS', detail: 'Grow a tree to imitate the network, asking it about made-up cases. The trees beat trees learned from the data (Figures 3.1–3.3).', landmark: true, link: 'https://proceedings.neurips.cc/paper/1995/hash/45f31d16b1058d586fc3be7207b58053-Abstract.html' },
  { year: '1996', track: 'question', title: 'Born again trees', who: 'Leo Breiman and Nong Shang', venue: 'Berkeley technical report', detail: 'Replace a forest with one tree trained on the forest’s answers.', link: 'https://www.stat.berkeley.edu/~breiman/BAtrees.pdf' },
  { year: '1996', track: 'open', title: 'State machines by clustering hidden states', who: 'Christian Omlin and C. Lee Giles', venue: 'Neural Networks', detail: 'Cluster the states a recurrent network visits and read the transitions between clusters (Figure 2.4).', link: 'https://clgiles.ist.psu.edu/papers/NN-1996-rule-extraction.pdf' },
  { year: '1999', track: 'design', title: 'SLIPPER', who: 'William W. Cohen and Yoram Singer', venue: 'AAAI', detail: 'Rule learning by boosting a simple rule-builder. Its loop returns in 2026 with a language model inside.', link: 'https://cdn.aaai.org/AAAI/1999/AAAI99-049.pdf' },
  { year: '2006', track: 'question', title: 'Model compression', who: 'Cristian Bucilă, Rich Caruana and Alexandru Niculescu-Mizil', venue: 'KDD', detail: 'Train a small, fast model on a big ensemble’s answers.', link: 'https://www.cs.cornell.edu/~caruana/compression.kdd06.pdf' },
  { year: '2008', track: 'question', title: 'RuleFit', who: 'Jerome Friedman and Bogdan Popescu', venue: 'Annals of Applied Statistics', detail: 'Every rule in a tree ensemble, then a lasso keeps a handful (Figure 3.5).', landmark: true, link: 'https://arxiv.org/abs/0811.1679' },
  { year: '2015', track: 'design', title: 'The asthma rule, retold', who: 'Rich Caruana and colleagues', venue: 'KDD', detail: 'Intelligible models for healthcare, and the 1990s story that opens this site.', link: 'https://doi.org/10.1145/2783258.2788613' },
  { year: '2015', track: 'design', title: 'Bayesian Rule Lists', who: 'Benjamin Letham, Cynthia Rudin, Tyler McCormick and David Madigan', venue: 'Annals of Applied Statistics', detail: 'A stroke-risk rule list as readable as the clinical score, and more accurate.', link: 'https://arxiv.org/abs/1511.01644' },
  { year: '2015', track: 'question', title: 'Knowledge distillation', who: 'Geoffrey Hinton, Oriol Vinyals and Jeff Dean', venue: 'NIPS workshop', detail: 'A small network trained on a big one’s answers: TREPAN’s trick, now standard for large networks.', link: 'https://arxiv.org/abs/1503.02531' },
  { year: '2016', track: 'local', title: 'LIME', who: 'Marco Tulio Ribeiro, Sameer Singh and Carlos Guestrin', venue: 'KDD', detail: 'A weighted straight line around one decision (Figure 4.1).', link: 'https://arxiv.org/abs/1602.04938' },
  { year: '2016', track: 'design', title: 'Interpretable Decision Sets', who: 'Himabindu Lakkaraju, Stephen Bach and Jure Leskovec', venue: 'KDD', detail: 'Rule sets optimised for accuracy and simplicity together.' },
  { year: '2016', track: 'open', title: 'DeepRED', who: 'Jan Ruben Zilke, Eneldo Loza Mencía and Frederik Janssen', venue: 'Discovery Science', detail: 'Layer-by-layer extraction for deep networks, with a small tree between each pair of layers.' },
  { year: '2017', track: 'local', title: 'SHAP', who: 'Scott Lundberg and Su-In Lee', venue: 'NIPS', detail: 'Feature attributions from Shapley values: the most used explanations, though not rules.', link: 'https://arxiv.org/abs/1705.07874' },
  { year: '2017', track: 'local', title: 'Counterfactual explanations', who: 'Sandra Wachter, Brent Mittelstadt and Chris Russell', venue: 'arXiv; Harvard JOLT 2018', detail: '“What would have to change” as the explanation people need.', link: 'https://arxiv.org/abs/1711.00399' },
  { year: '2017', track: 'design', title: 'CORELS', who: 'Elaine Angelino, Nicholas Larus-Stone, Daniel Alabi, Margo Seltzer and Cynthia Rudin', venue: 'KDD; JMLR 2018', detail: 'The provably best rule list, by branch and bound (Figure 5.1).', landmark: true, link: 'https://arxiv.org/abs/1704.01701' },
  { year: '2018', track: 'local', title: 'Anchors', who: 'Marco Tulio Ribeiro, Sameer Singh and Carlos Guestrin', venue: 'AAAI', detail: 'Short rules that pin one prediction with 95% precision (Figure 4.2).', landmark: true, link: 'https://ojs.aaai.org/index.php/AAAI/article/view/11491' },
  { year: '2018', track: 'local', title: 'LORE', who: 'Riccardo Guidotti and colleagues', venue: 'arXiv; IEEE Intelligent Systems 2019', detail: 'Factual and counterfactual rules from a local tree (Figure 4.3).', link: 'https://arxiv.org/abs/1805.10820' },
  { year: '2018', track: 'question', title: 'State machines from RNNs with L*', who: 'Gail Weiss, Yoav Goldberg and Eran Yahav', venue: 'ICML', detail: 'Learn the machine by asking the network questions.', link: 'https://arxiv.org/abs/1711.09576' },
  { year: '2018', track: 'question', title: 'VIPER', who: 'Osbert Bastani, Yewen Pu and Armando Solar-Lezama', venue: 'NeurIPS', detail: 'Decision-tree policies from game-playing agents, small enough to verify (Figure 3.4).', landmark: true, link: 'https://arxiv.org/abs/1805.08328' },
  { year: '2019', track: 'design', title: '“Stop explaining black boxes”', who: 'Cynthia Rudin', venue: 'Nature Machine Intelligence', detail: 'For high-stakes decisions, use a model that is rules.', landmark: true, link: 'https://arxiv.org/abs/1811.10154' },
  { year: '2019', track: 'local', title: 'Fairwashing', who: 'Ulrich Aïvodji and colleagues', venue: 'ICML', detail: 'Rule lists faithful to an unfair model that look fair.', link: 'https://arxiv.org/abs/1901.09749' },
  { year: '2020', track: 'local', title: 'Fooling LIME and SHAP', who: 'Dylan Slack, Sophie Hilgard, Emily Jia, Sameer Singh and Himabindu Lakkaraju', venue: 'AIES', detail: 'A model that answers made-up questions innocently while staying biased (Figure 4.4).', link: 'https://arxiv.org/abs/1911.02508' },
  { year: '2020', track: 'local', title: 'Realistic questions for LIME', who: 'Sean Saito, Eugene Chua, Nicholas Capel and Rocco Hu', venue: 'arXiv', detail: 'Questions from a generative model, so a rigged model can’t tell it is being explained.', preprint: true, link: 'https://arxiv.org/abs/2006.12302' },
  { year: '2020', track: 'question', title: 'Born-again tree ensembles', who: 'Thibaut Vidal, Toni Pacheco and Maximilian Schiffer', venue: 'ICML', detail: 'The smallest single tree that matches a whole forest everywhere.', link: 'https://arxiv.org/abs/2003.11132' },
  { year: '2021', track: 'question', title: 'SIRUS', who: 'Clément Bénard, Gérard Biau, Sébastien Da Veiga and Erwan Scornet', venue: 'Electronic Journal of Statistics', detail: 'Stable rules from forests with quantile splits (Figure 3.5).', link: 'https://arxiv.org/abs/1908.06852' },
  { year: '2021', track: 'design', title: 'DR-Net', who: 'Litao Qiao, Weijia Wang and Bill Lin', venue: 'AAAI', detail: 'A network whose hidden neurons are rules (Figure 5.3).', link: 'https://arxiv.org/abs/2103.02826' },
  { year: '2021', track: 'design', title: 'RRL', who: 'Zhuo Wang, Wei Zhang, Ning Liu and Jianyong Wang', venue: 'NeurIPS', detail: 'Layers of soft logic, trained with gradient grafting.', link: 'https://arxiv.org/abs/2109.15103' },
  { year: '2021', track: 'open', title: 'ECLAIRE', who: 'Mateo Espinosa Zarlenga, Zohreh Shams and Mateja Jamnik', venue: 'NeurIPS workshop', detail: 'Decompositional extraction in polynomial time, for large networks.', link: 'https://arxiv.org/abs/2111.12628' },
  { year: '2022', track: 'design', title: 'The Rashomon set of sparse trees', who: 'Rui Xin and colleagues', venue: 'NeurIPS', detail: 'Every nearly-optimal tree, listed (Figure 5.2).', link: 'https://arxiv.org/abs/2209.08040' },
  { year: '2023', track: 'design', title: 'Logic Explained Networks', who: 'Gabriele Ciravegna and colleagues', venue: 'Artificial Intelligence', detail: 'Networks over human concepts that explain in logic.', link: 'https://arxiv.org/abs/2108.05149' },
  { year: '2022', track: 'giant', title: 'A theory of grokking', who: 'Ziming Liu, Ouail Kitouni, Niklas Nolte, Eric J. Michaud, Max Tegmark and Mike Williams', venue: 'NeurIPS', detail: 'Generalisation arrives when the embeddings become structured (Figure 6.1).', link: 'https://arxiv.org/abs/2205.10343' },
  { year: '2023', track: 'giant', title: 'Grokking, reverse-engineered', who: 'Neel Nanda, Lawrence Chan, Tom Lieberum, Jess Smith and Jacob Steinhardt', venue: 'ICLR', detail: 'A transformer found to do addition by rotating around a circle.', link: 'https://arxiv.org/abs/2301.05217' },
  { year: '2023', track: 'giant', title: 'Learning Transformer Programs', who: 'Dan Friedman, Alexander Wettig and Danqi Chen', venue: 'NeurIPS', detail: 'Transformers that convert automatically into readable Python.', link: 'https://arxiv.org/abs/2306.01128' },
  { year: '2023', track: 'giant', title: 'Language models explain neurons', who: 'Steven Bills and colleagues', venue: 'OpenAI', detail: 'GPT-4 writes and scores explanations of all 307,200 neurons in GPT-2.', link: 'https://openai.com/index/language-models-can-explain-neurons-in-language-models/' },
  { year: '2023', track: 'giant', title: 'Large language models can learn rules', who: 'Zhaocheng Zhu and colleagues', venue: 'arXiv', detail: 'Generate candidate rules, keep the ones that check out.', link: 'https://arxiv.org/abs/2310.07064' },
  { year: '2025', track: 'giant', title: 'Circuit tracing in a production model', who: 'Jack Lindsey, Emmanuel Ameisen and colleagues', venue: 'Anthropic', detail: 'Attribution graphs trace intermediate steps inside Claude 3.5 Haiku.', landmark: true, link: 'https://transformer-circuits.pub/2025/attribution-graphs/biology.html' },
  { year: '2026', track: 'giant', title: 'Zero-shot rule induction', who: 'Yin Jun Phua', venue: 'arXiv', detail: 'A model pre-trained on synthetic rules writes rules for new tables without retraining.', preprint: true, link: 'https://arxiv.org/abs/2605.04916' },
  { year: '2026', track: 'giant', title: 'MechaRule: rules tied to neurons', who: 'Francesco Sovrano, Gabriele Dominici and Marc Langheinrich', venue: 'KDD', detail: 'Boolean rules that predict when switching off particular neurons changes a language model’s answer.', link: 'https://arxiv.org/abs/2605.03058' },
  { year: '2026', track: 'giant', title: 'NeuroRule: evolving rule sets', who: 'Tapaswini Kodavanti, Hormoz Shahrzad and Risto Miikkulainen', venue: 'arXiv', detail: 'Evolution searches for concise rule sets that mimic a network.', preprint: true, link: 'https://arxiv.org/abs/2609.26841' },
  { year: '2026', track: 'giant', title: 'CLIPPER: a coding model writes the rules', who: 'Aditya Kumar, Cassandra A. Cohen and William W. Cohen', venue: 'arXiv', detail: 'SLIPPER’s 1999 boosting loop with a language model writing each rule as code (Figure 6.2).', landmark: true, preprint: true, link: 'https://arxiv.org/abs/2610.14006' },
];

/** The exact titles behind the timeline's links, for the citation list on the About page. */
export const PAPER_TITLES: Record<string, string> = {
  'https://doi.org/10.1145/42372.42377': 'Connectionist expert systems',
  'https://archive.ics.uci.edu/dataset/70/monk+s+problems': "The MONK's Problems (UCI Machine Learning Repository)",
  'https://doi.org/10.1007/BF00993103': 'Extracting refined rules from knowledge-based neural networks',
  'https://doi.org/10.1016/0950-7051(96)81920-4': 'Survey and critique of techniques for extracting rules from trained artificial neural networks',
  'https://mlanthology.org/icml/1995/cohen1995icml-fast': 'Fast Effective Rule Induction',
  'https://proceedings.neurips.cc/paper/1995/hash/45f31d16b1058d586fc3be7207b58053-Abstract.html': 'Extracting Tree-Structured Representations of Trained Networks',
  'https://www.stat.berkeley.edu/~breiman/BAtrees.pdf': 'Born again trees',
  'https://clgiles.ist.psu.edu/papers/NN-1996-rule-extraction.pdf': 'Extraction of rules from discrete-time recurrent neural networks',
  'https://cdn.aaai.org/AAAI/1999/AAAI99-049.pdf': 'A Simple, Fast, and Effective Rule Learner',
  'https://www.cs.cornell.edu/~caruana/compression.kdd06.pdf': 'Model compression',
  'https://arxiv.org/abs/0811.1679': 'Predictive learning via rule ensembles',
  'https://doi.org/10.1145/2783258.2788613': 'Intelligible Models for HealthCare: Predicting Pneumonia Risk and Hospital 30-day Readmission',
  'https://arxiv.org/abs/1511.01644': 'Interpretable classifiers using rules and Bayesian analysis: Building a better stroke prediction model',
  'https://arxiv.org/abs/1503.02531': 'Distilling the Knowledge in a Neural Network',
  'https://arxiv.org/abs/1602.04938': '“Why Should I Trust You?”: Explaining the Predictions of Any Classifier',
  'https://arxiv.org/abs/1705.07874': 'A Unified Approach to Interpreting Model Predictions',
  'https://arxiv.org/abs/1711.00399': 'Counterfactual Explanations without Opening the Black Box: Automated Decisions and the GDPR',
  'https://arxiv.org/abs/1704.01701': 'Learning Certifiably Optimal Rule Lists for Categorical Data',
  'https://ojs.aaai.org/index.php/AAAI/article/view/11491': 'Anchors: High-Precision Model-Agnostic Explanations',
  'https://arxiv.org/abs/1805.10820': 'Local Rule-Based Explanations of Black Box Decision Systems',
  'https://arxiv.org/abs/1711.09576': 'Extracting Automata from Recurrent Neural Networks Using Queries and Counterexamples',
  'https://arxiv.org/abs/1805.08328': 'Verifiable Reinforcement Learning via Policy Extraction',
  'https://arxiv.org/abs/1811.10154': 'Stop Explaining Black Box Machine Learning Models for High Stakes Decisions and Use Interpretable Models Instead',
  'https://arxiv.org/abs/1901.09749': 'Fairwashing: the risk of rationalization',
  'https://arxiv.org/abs/1911.02508': 'Fooling LIME and SHAP: Adversarial Attacks on Post hoc Explanation Methods',
  'https://arxiv.org/abs/2003.11132': 'Born-Again Tree Ensembles',
  'https://arxiv.org/abs/1908.06852': 'SIRUS: Stable and Interpretable RUle Set for Classification',
  'https://arxiv.org/abs/2103.02826': 'Learning Accurate and Interpretable Decision Rule Sets from Neural Networks',
  'https://arxiv.org/abs/2109.15103': 'Scalable Rule-Based Representation Learning for Interpretable Classification',
  'https://arxiv.org/abs/2111.12628': 'Efficient Decompositional Rule Extraction for Deep Neural Networks',
  'https://arxiv.org/abs/2209.08040': 'Exploring the Whole Rashomon Set of Sparse Decision Trees',
  'https://arxiv.org/abs/2108.05149': 'Logic Explained Networks',
  'https://arxiv.org/abs/2006.12302': 'Improving LIME Robustness with Smarter Locality Sampling',
  'https://arxiv.org/abs/2205.10343': 'Towards Understanding Grokking: An Effective Theory of Representation Learning',
  'https://arxiv.org/abs/2301.05217': 'Progress measures for grokking via mechanistic interpretability',
  'https://arxiv.org/abs/2306.01128': 'Learning Transformer Programs',
  'https://openai.com/index/language-models-can-explain-neurons-in-language-models/': 'Language models can explain neurons in language models',
  'https://arxiv.org/abs/2310.07064': 'Large Language Models can Learn Rules',
  'https://transformer-circuits.pub/2025/attribution-graphs/biology.html': 'On the Biology of a Large Language Model',
  'https://arxiv.org/abs/2605.04916': 'A Foundation Model for Zero-Shot Logical Rule Induction',
  'https://arxiv.org/abs/2605.03058': 'Neuron-Anchored Rule Extraction for Large Language Models via Contrastive Hierarchical Ablation',
  'https://arxiv.org/abs/2609.26841': 'NeuroRule: Making Black-Box Neural Networks Explainable through Rule-set Evolution',
  'https://arxiv.org/abs/2610.14006': 'Coding LLMs Can Be Harnessed to Learn Interpretable Models from Data',
};
