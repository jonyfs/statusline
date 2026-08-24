# Writing Standard

The bar is a competent engineer who writes well, publishing under their own name.

## Voice

- Write from the position of someone who did the work. Specific, first-hand, willing to say
  what did not work.
- Plain declaratives. Short sentences carry weight; vary length so the rhythm is not mechanical.
- Concrete over abstract, always. "The queue backed up to 40,000 messages" beats "we
  encountered scalability challenges".
- Take a position and defend it. Hedged prose that offends nobody is forgettable.
- Respect the reader's time and knowledge. Skip the paragraph explaining what an API is.
- Humour is fine when it is dry and rare. Enthusiasm markers are not.

## Structure

- **Open with the problem or the surprise**, in the first two sentences. No throat-clearing
  about the industry, no "in today's landscape".
- **Deliver the thesis early.** The reader should know within a paragraph what claim the article
  defends.
- **One idea per section**, with headings that say something ("The retry loop was the bug"),
  not labels ("Implementation").
- **Show, then explain.** Code or numbers first, interpretation after.
- **End where the argument ends.** A short closing that says what changed or what you would do
  next. Never a summary of what the reader just read.

## Strip These

The reliable signatures of machine-written prose. Cut on sight:

- Openings that set a scene: "In today's fast-paced world", "In the ever-evolving landscape of",
  "We live in an era where".
- Vocabulary tells: delve, leverage (as a verb), robust, seamless, unlock, harness, elevate,
  game-changer, revolutionize, cutting-edge, testament to, tapestry, realm, landscape,
  navigate (figurative), embark, plethora, myriad.
- The negation-flip cadence: "It's not just X — it's Y", "This isn't about X. It's about Y".
- Triads everywhere: three adjectives, three-item lists, three parallel clauses, paragraph after
  paragraph.
- Empty transitions: "Moreover", "Furthermore", "Additionally", "That said" used as filler.
- Unsourced authority: "Studies show", "Experts agree", "It's widely known that".
- Symmetry: every section the same length, every list the same shape, every paragraph three
  sentences.
- Meta-narration: "Let's dive in", "In this article, we'll explore", "By the end of this post,
  you'll have learned".
- A "Conclusion" heading that restates the article, followed by a question to drive comments.
- Bold scattered across half the sentences; emoji in headings; a rocket at the end.
- Universal claims with no exceptions, and superlatives the evidence does not support.
- Perfectly balanced "on one hand / on the other" paragraphs that reach no conclusion.

## Then Run `humanizer`

After the draft reads as intended, run the `humanizer` skill over it and save the result back to
the same file. It catches patterns this list does not. It only removes machine-writing tells —
it must not change facts, numbers, structure, code, or the language the article is written in.

## Final Read

Read the draft once as a stranger would, and answer honestly:

- Would a person who has never seen this project finish it?
- Is there one sentence in it that only someone who did this work could have written? If not,
  the article is not ready.
- Does any paragraph exist only to reach a word count?
- Would the operator be comfortable putting their name on every claim in it?
