/** Plain-language definitions shown when a reader hovers or taps a <Term>. */
export const GLOSSARY = {
  model:
    'What a machine-learning method produces: a function, learned from examples, that takes a case (a robot, a player position) and gives a prediction.',
  'black-box':
    'A model whose reasoning people can’t follow, such as a neural network with thousands of weights or a forest of hundreds of trees. You can see what goes in and what comes out, but not why.',
  rule: 'An IF–THEN statement: IF these conditions hold THEN predict this. For example: IF the jacket is red THEN friendly.',
  condition: 'One test inside a rule, such as “jacket is red” or “distance < 6 m”. A rule fires when all its conditions hold.',
  coverage: 'How often a rule applies: the share of cases where all its conditions hold.',
  precision: 'How often a rule is right when it applies: among the cases it covers, the share where its prediction is correct.',
  fidelity:
    'How often extracted rules agree with the model they explain. Not the same as accuracy: rules can be faithful to a model that is wrong.',
  accuracy: 'How often a model or a rule set agrees with reality: the share of cases it gets right.',
  'rule-list': 'Rules in order: IF … ELSE IF … ELSE. The first rule that applies decides.',
  'rule-set': 'Rules without an order. Usually: predict “yes” if any of the rules applies, and “no” otherwise.',
  'decision-tree':
    'A flowchart of yes/no questions. Each case follows the answers down to a leaf, which gives the prediction. Every path from the top to a leaf is a rule.',
  'neural-network':
    'A model built from layers of simple units (neurons). Each unit adds up its weighted inputs and passes the result on. Training adjusts the weights.',
  neuron: 'One unit of a neural network: it multiplies each input by a weight, adds them up with a bias, and switches on if the total is high enough.',
  weight: 'A number on a connection in a neural network. Large positive weights mean “this input pushes me on”; negative ones push off.',
  training: 'Adjusting a model’s numbers, little by little, until its predictions match the examples it is shown.',
  surrogate: 'A simple model (a tree or a few rules) trained to imitate a complex one.',
  decompositional: 'Rule extraction that looks inside the model: its weights, neurons or trees. “Opening the box.”',
  pedagogical: 'Rule extraction that only asks the model questions (inputs in, predictions out), like a pupil learning from a teacher. “Questioning the box.”',
  'global-local': 'A global explanation describes a model everywhere; a local one describes it only around one case.',
  oracle: 'A model used as an answering machine: show it any case, even a made-up one, and it says what it would predict.',
  'm-of-n': 'A condition of the form “at least M of these N tests hold”. Compact for vote-like rules.',
  anchor:
    'A short rule that pins down one prediction: as long as its conditions hold, the model gives the same answer (at least 95% of the time), whatever else changes.',
  counterfactual: 'The smallest change to a case that would change the model’s decision: “if the light had been below 30%, you’d have stayed hidden”.',
  'random-forest': 'Many decision trees, each trained on a random sample of the data, voting together. Accurate, but hundreds of trees are unreadable.',
  lasso: 'A way of fitting a model that pushes most of its numbers to exactly zero, so only a few ingredients (here, a few rules) survive.',
  'branch-and-bound':
    'A search that proves whole families of candidates can’t beat the best one found so far, and skips them without looking at them one by one.',
  rashomon:
    'The Rashomon set: all the models that are almost as good as the best one. Named after the film in which witnesses tell different, equally believable stories.',
  automaton: 'A finite-state machine: a few states and arrows between them. It reads a sequence one symbol at a time and follows the arrows.',
  policy: 'In reinforcement learning, an agent’s rule for picking an action in each situation, like “if the pole leans right, push right”.',
  distillation: 'Training a small model to imitate a big one, using the big model’s answers as the examples.',
  'mechanistic-interpretability':
    'Reverse-engineering a neural network: working out, from its weights and activations, the actual algorithm it carries out.',
  'label-noise': 'Examples recorded with the wrong answer, as real data always has some.',
  overfitting: 'Learning the quirks and noise of the training examples instead of the real pattern, so the model does worse on new cases.',
} as const;

export type GlossaryId = keyof typeof GLOSSARY;
