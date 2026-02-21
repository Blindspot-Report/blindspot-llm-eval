# Blindspot LLM Evaluation

Systematic evaluation of candidate LLM models for [Blindspot](https://github.com/your-org/blindspot) podcast political analysis, using [Promptfoo](https://promptfoo.dev).

## What this evaluates

Blindspot uses a local LLM (via Ollama) to analyze podcast transcripts and extract:
- Political stance signals and positions
- Key quotes with sentence references
- Topics and tone
- Synthesized episode summaries with political stance classification

The current production model is **Gemma3:12b**. This framework evaluates alternative models side-by-side.

## Candidate models

| Model | Size | Notes |
|-------|------|-------|
| Gemma3:12b | 12B | Baseline (production) |
| Phi-4 Mini | 3.8B | Microsoft, strong reasoning for size |
| Llama 3.2:3b | 3B | Meta, fast but limited |
| Granite 3.3:8b | 8B | IBM, good at structured output |

## Quick start

### Prerequisites

- [Ollama](https://ollama.com) running locally
- Node.js 18+

### Setup

```bash
npm install

# Pull candidate models (gemma3:12b should already be present)
ollama pull phi4-mini
ollama pull llama3.2:3b
ollama pull granite3.3:8b
```

### Run evaluation

```bash
# Run all models against all test cases
npm run eval

# Run only the baseline model
npm run eval:gemma

# Open the web UI to compare results
npm run view
```

### Extract fresh test data from Blindspot DB

```bash
DATABASE_URL=postgresql://... npm run extract-data
```

## Project structure

```
prompts/              # System + user prompt templates (JSON chat format)
test-cases/
  transcripts/        # Numbered-sentence transcript segments
  expected/           # Reference outputs from Gemma3:12b
assertions/           # Custom JS quality checks (field validation, ranges)
schemas/              # JSON Schema for structured output (Ollama format constraint)
scripts/              # Data extraction utilities
promptfooconfig.yaml  # Main eval configuration
```

## Assertions

Each model output is checked against:

1. **`is-json`** — valid JSON parse
2. **Custom JS assertions** — field-level quality (array lengths, enum values, index validity)
3. **`llm-rubric`** — semantic quality grading (are positions accurately captured?)

## Adding test cases

1. Add a numbered-sentence transcript file to `test-cases/transcripts/`
2. Optionally add a reference output to `test-cases/expected/`
3. Add a test entry in `promptfooconfig.yaml` using the `*chunk-assertions` anchor

## Adding models

Add a new provider entry in `promptfooconfig.yaml`:

```yaml
- id: ollama:chat:your-model:tag
  label: "Your Model Name"
  config: *chunk-config
```

Then pull the model: `ollama pull your-model:tag`
