// Data for the fine-tuning figure on the RLHF page. Everything here is hand-authored
// and illustrative: the "before" and "after" answers are written by hand to show the
// behavior of specializing a general model, NOT produced by any real training run.

export const DOMAIN_NAME = 'AcmeCloud support'

// The small labeled dataset that fine-tuning trains on (input -> desired output).
export const DATASET = [
  { in: 'reset my password', out: 'Settings > Security > Reset password' },
  { in: 'where are my invoices', out: 'Settings > Billing > Invoices' },
  { in: 'upload keeps failing', out: 'files over 2 GB need the acme CLI' },
]

// Test prompts. Domain prompts specialize as fine-tuning runs (each flips once the
// progress passes its threshold, so the shift is staggered and legible). General
// prompts are retained: their good answers do not change, showing that specializing
// does not erase the base model's general knowledge.
export const PROMPTS = [
  {
    id: 'pw',
    kind: 'domain',
    tuneAt: 0.4,
    q: 'How do I reset my password?',
    base: 'There is usually a "forgot password" link on the sign-in page somewhere.',
    tuned: 'In AcmeCloud, open Settings > Security > Reset password and use the emailed link.',
  },
  {
    id: 'upload',
    kind: 'domain',
    tuneAt: 0.8,
    q: 'My file upload keeps failing.',
    base: 'Try again, and maybe check your internet connection.',
    tuned: 'AcmeCloud caps uploads at 2 GB per file. For bigger files use the "acme push" CLI, and check Settings > Storage for your quota.',
  },
  {
    id: 'france',
    kind: 'general',
    q: 'What is the capital of France?',
    base: 'Paris.',
    tuned: 'Paris.',
  },
  {
    id: 'mona',
    kind: 'general',
    q: 'Who painted the Mona Lisa?',
    base: 'Leonardo da Vinci.',
    tuned: 'Leonardo da Vinci.',
  },
]
