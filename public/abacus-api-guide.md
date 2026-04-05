# Abacus.AI RouteLLM API Guide
## For Google AI Studio (Gemini) Integration

---

## Overview

Abacus.AI provides a unified OpenAI-compatible API gateway called **RouteLLM** that gives access to 100+ AI models from all major providers (OpenAI, Anthropic, Google, Meta, etc.) through a single endpoint.

**Base URL:** `https://apps.abacus.ai/v1`

**Authentication:** Bearer token via `Authorization: Bearer <API_KEY>`

---

## 1. Chat Completions (Text Generation)

### Endpoint
```
POST https://apps.abacus.ai/v1/chat/completions
```

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_KEY"
}
```

### Basic Request
```json
{
  "model": "gpt-4.1-mini",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain quantum computing in simple terms."}
  ],
  "max_tokens": 3000,
  "temperature": 0.7
}
```

### Response
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Quantum computing uses quantum bits..."
      }
    }
  ]
}
```

---

## 2. Streaming Responses

Add `"stream": true` to the request body. The response is an SSE (Server-Sent Events) stream:

```json
{
  "model": "gpt-4.1-mini",
  "messages": [{"role": "user", "content": "Write a poem"}],
  "stream": true
}
```

Each chunk:
```
data: {"choices":[{"delta":{"content":"word "}}]}
```

Final chunk:
```
data: [DONE]
```

---

## 3. JSON / Structured Output

### Option A: JSON Object
```json
{
  "model": "gpt-4.1-mini",
  "messages": [{"role": "user", "content": "List 3 movies as JSON with title and year"}],
  "response_format": {"type": "json_object"}
}
```

### Option B: JSON Schema (Strict)
```json
{
  "model": "gpt-4.1-mini",
  "messages": [{"role": "user", "content": "List 3 movies"}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "movie_list",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "movies": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": {"type": "string"},
                "year": {"type": "number"}
              },
              "required": ["title", "year"],
              "additionalProperties": false
            }
          }
        },
        "required": ["movies"],
        "additionalProperties": false
      }
    }
  }
}
```

---

## 4. Image Generation

Add `"modalities": ["image"]` to generate images.

### Request
```json
{
  "model": "gpt-5.1",
  "messages": [{"role": "user", "content": "A cinematic sunset over mountains, 35mm film grain"}],
  "modalities": ["image"],
  "image_config": {
    "num_images": 1,
    "aspect_ratio": "16:9",
    "quality": "high"
  }
}
```

### Image Config Options
| Parameter | Values | Notes |
|-----------|--------|-------|
| `aspect_ratio` | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`, `16:9` | 9:16/16:9 Gemini/OpenAI only |
| `image_size` | `1024x1024`, `1024x1536`, `1536x1024`, `auto` | Gemini/OpenAI only |
| `quality` | `auto`, `low`, `medium`, `high` | Gemini/OpenAI only |
| `resolution` | `1K`, `2K`, `4K` | Gemini/OpenAI only |
| `num_images` | 1-4 | Default: 1 |

### Response
Images appear in `choices[0].message.images` as data URLs:
```json
{
  "choices": [{
    "message": {
      "images": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgo..."
          }
        }
      ]
    }
  }]
}
```

### Supported Image Models
- **Dedicated:** `flux-2-pro`, `flux-kontext`, `seedream`, `ideogram`, `recraft`, `imagen`, `nano-banana-pro`, `dall-e`
- **Gemini:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro`, `gemini-3-flash`
- **OpenAI:** `gpt-5.1`, `gpt-5.2`, `gpt-5`, `gpt-4o`

---

## 5. Vision / Image Analysis

Send images as `image_url` in messages:

```json
{
  "model": "gpt-4.1-mini",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Describe this image in detail."},
      {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQ..."}}
    ]
  }]
}
```

Also supports direct URLs:
```json
{"type": "image_url", "image_url": {"url": "https://i.ytimg.com/vi/kIRp6HOQzP8/maxresdefault.jpg"}}
```

---

## 6. PDF / Document Analysis

Send PDFs as base64-encoded file content:

```json
{
  "model": "gpt-4.1-mini",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "file", "file": {
        "filename": "document.pdf",
        "file_data": "data:application/pdf;base64,JVBERi0xLjQ..."
      }},
      {"type": "text", "text": "Summarize this document."}
    ]
  }]
}
```

---

## 7. Available Models

### Fetch Current Model List
```
GET https://apps.abacus.ai/v1/models
```

### Key Models by Provider

| Provider | Models |
|----------|--------|
| **OpenAI** | `gpt-5.1`, `gpt-5`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `o3`, `o4-mini` |
| **Anthropic** | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **Google** | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro`, `gemini-3-flash`, `gemini-3.1-pro-preview` |
| **Meta** | `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`, `llama-3.3-70b-versatile` |
| **DeepSeek** | `deepseek-ai/DeepSeek-R1`, `deepseek-ai/DeepSeek-V3.2` |
| **Qwen** | `Qwen/Qwen3-235B-A22B-Instruct-2507`, `qwen3-max` |
| **xAI** | `grok-4-0709`, `grok-4-fast-non-reasoning` |
| **Route** | `route-llm` (auto-selects best model) |

---

## 8. Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model identifier (required) |
| `messages` | array | Conversation messages (required) |
| `max_tokens` | number | Maximum response tokens |
| `temperature` | number | Creativity (0.0-2.0, default ~1.0) |
| `top_p` | number | Nucleus sampling (0.0-1.0) |
| `stream` | boolean | Enable streaming |
| `response_format` | object | JSON output format |
| `modalities` | array | `["image"]` for image generation |
| `image_config` | object | Image generation settings |
| `n` | number | Number of completions |

---

## 9. Video Generation

Video is generated using the same chat completions endpoint with video-specific models:

### Supported Video Models
`runway`, `luma_labs`, `kling_ai`, `kling_ai_v3`, `veo3`, `sora`, `seedance_pro`, `grok_imagine_video`

### Request
```json
{
  "model": "kling_ai_v3",
  "messages": [{"role": "user", "content": "A cinematic drone shot over a misty forest at sunrise"}],
  "modalities": ["video"]
}
```

---

## 10. cURL Examples

### Text Generation
```bash
curl -X POST https://apps.abacus.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 500
  }'
```

### Image Generation
```bash
curl -X POST https://apps.abacus.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-5.1",
    "messages": [{"role": "user", "content": "A futuristic city at night"}],
    "modalities": ["image"],
    "image_config": {"aspect_ratio": "16:9", "quality": "high"}
  }'
```

---

## 11. Error Handling

| HTTP Code | Meaning |
|-----------|--------|
| 200 | Success |
| 400 | Bad request (invalid model, params) |
| 401 | Invalid API key |
| 429 | Rate limited |
| 500 | Server error |

---

## 12. Rate Limits & Best Practices

1. **Use streaming** for long responses to improve UX
2. **Set max_tokens** to avoid unexpected costs
3. **Use route-llm** model to auto-select the best model for each task
4. **Cache responses** when appropriate
5. **Handle errors gracefully** with retries for 429/500 errors

---

## Full API Documentation

For complete specs, model-specific features, and latest updates:
**https://abacus.ai/help/developer-platform/route-llm**
