import { explainByNodeId } from "./graph-node-explain.js";

export const LAYER_COLORS = {
  entry:   0xF20587,
  middleware: 0xB83574,
  router:  0x8C3061,
  domain:  0x82346B,
  service: 0xd3904b,
  infra:   0xF2B077,
  runner:  0xF2D479,
  model:   0xC9B44A,
  util:    0x7a6e6e,
  metal:   0x06b6d4,
  device:  0x0891b2,
};

export const LAYER_LABELS = {
  entry:      "Entry Point",
  middleware: "Middleware",
  router:     "API Routers",
  domain:     "Request Models",
  service:    "Services",
  infra:      "Infrastructure",
  runner:     "Model Runners",
  model:      "Model Configs",
  util:       "Utilities",
  metal:      "TT Software Stack",
  device:     "TT Hardware",
};

export const LAYER_ORDER = ["entry", "middleware", "router", "domain", "service", "infra", "runner", "model", "util", "metal", "device"];

export const LAYER_DESCRIPTIONS = {
  entry:      "Where HTTP requests first land — creates the FastAPI app and wires everything together.",
  middleware:  "Cross-cutting concerns that run before every route: auth, CORS, metrics, health probes.",
  router:     "OpenAI-compatible API endpoints — completions, audio, images, video, embeddings, fine-tuning.",
  domain:     "Pydantic request models that validate and type-check every incoming JSON body.",
  service:    "Business logic layer — orchestrates runners, queues, streaming, and job tracking per modality.",
  infra:      "Scheduling, queuing, and worker infrastructure that bridges services to device runners.",
  runner:     "Model-specific inference engines — vLLM, Whisper, SDXL, DiT — running on TT hardware.",
  model:      "YAML configuration profiles for each supported model variant (weights, device, context length).",
  util:       "Shared helpers — audio/image/video I/O, device management, job tracking, SSE streaming.",
  metal:      "Tenstorrent software stack — TTNN (Python tensor API) and TT-Metalium (C++ device runtime).",
  device:     "Physical Tenstorrent hardware — Wormhole B0 chips in n150, n300, T3K, or Galaxy configurations.",
};

//  row: vertical position — callers always above callees
//  row 0  = FastAPI App entry
//  row 1  = Middleware (auth, CORS, metrics, health)
//  row 2  = API Routers
//  row 3  = ServiceResolver
//  row 4  = BaseService
//  row 5  = Concrete Services
//  row 6  = Scheduler
//  row 7  = Queues, Workers
//  row 8  = RunnerFabric
//  row 9  = BaseDeviceRunner
//  row 10 = Concrete Runners
//  row 11 = Model Configs (specific model variants)
//  row 12 = Utility managers
//  row 13 = TT Software Stack (TTNN, TT-Metalium)
//  row 14 = TT Hardware Devices (n150, n300, t3k, Galaxy)
//  domain nodes: side = "right"

const NODES_RAW = [
  // ── Row 0: Entry ──
  { id: "main", layer: "entry", row: 0, group: "entry", label: "FastAPI App", file: "tt-media-server/main.py", func: "create_app()", description: "Application entry point. Creates FastAPI app, mounts all routers via SERVICE_ROUTER_MAP.", internals: [
    { type: "entry",    name: "create_app()",               desc: "Instantiate FastAPI with title, version, docs URL." },
    { type: "step",     name: "add_middleware(CORS)",        desc: "Register CORS headers for browser clients." },
    { type: "step",     name: "add_middleware(Auth)",        desc: "Register API-key / JWT verification middleware." },
    { type: "step",     name: "instrument(Prometheus)",      desc: "Attach Prometheus metrics middleware." },
    { type: "step",     name: "mount_routers(ROUTER_MAP)",  desc: "Loop SERVICE_ROUTER_MAP, attach each APIRouter." },
    { type: "step",     name: "register_health()",           desc: "Mount /health liveness endpoint." },
    { type: "return",   name: "return app",                  desc: "Return configured FastAPI instance to uvicorn." },
  ] },

  // ── Row 1: Middleware ──
  { id: "mw_auth",    layer: "middleware", row: 1, group: "mw", label: "Auth Middleware",    file: "security/api_key_checker.py",     func: "verify_api_key(req)", description: "JWT / API-key verification. Runs before every protected endpoint.", internals: [
    { type: "entry",    name: "__call__(request)",           desc: "ASGI middleware entry; intercept every request." },
    { type: "branch",   name: "if path in WHITELIST",       desc: "Skip auth for /health, /docs, /openapi.json." },
    { type: "step",     name: "extract_token(headers)",      desc: "Read Authorization header or x-api-key." },
    { type: "validate", name: "verify_jwt(token)",           desc: "Decode JWT, check expiry and signature." },
    { type: "branch",   name: "if invalid → 401",           desc: "Return 401 Unauthorized with error detail." },
    { type: "step",     name: "request.state.user = claims", desc: "Attach decoded claims to request state." },
    { type: "call",     name: "await call_next(request)",    desc: "Pass request to the next middleware / route." },
  ] },
  { id: "mw_cors",    layer: "middleware", row: 1, group: "mw", label: "CORS Middleware",    file: "tt-media-server/main.py",         func: "add_middleware(CORS)", description: "Cross-Origin Resource Sharing headers for browser clients.", internals: [
    { type: "entry",  name: "CORSMiddleware(app)",       desc: "Wrap ASGI app with CORS handler." },
    { type: "step",   name: "check_origin(request)",     desc: "Compare Origin header against allow_origins list." },
    { type: "branch", name: "if preflight → OPTIONS",    desc: "Handle CORS preflight with 200 + headers." },
    { type: "step",   name: "inject_headers(response)",  desc: "Add Access-Control-Allow-* headers to response." },
    { type: "call",   name: "await call_next(request)",  desc: "Pass request to next middleware." },
  ] },
  { id: "mw_metrics", layer: "middleware", row: 1, group: "mw", label: "Metrics Middleware", file: "telemetry/prometheus_metrics.py", func: "instrument(app)", description: "Prometheus instrumentation: request count, latency histograms, error rates.", internals: [
    { type: "entry",  name: "__call__(request)",         desc: "Intercept every inbound request." },
    { type: "step",   name: "start_timer()",             desc: "Record request start time." },
    { type: "call",   name: "await call_next(request)",  desc: "Forward to next middleware / route." },
    { type: "step",   name: "record_latency(elapsed)",   desc: "Push duration to histogram metric." },
    { type: "step",   name: "increment_counter(status)", desc: "Bump request_count by method+path+status." },
    { type: "return", name: "return response",           desc: "Pass response back to client." },
  ] },
  { id: "mw_health",  layer: "middleware", row: 1, group: "mw", label: "Health Check",       file: "open_ai_api/health.py",           func: "health_check()", description: "/health endpoint for liveness / readiness probes.", internals: [
    { type: "entry",  name: "health_check()",            desc: "GET /health handler." },
    { type: "step",   name: "check_device_status()",     desc: "Verify TT device is reachable." },
    { type: "step",   name: "check_workers_alive()",     desc: "Confirm worker processes are running." },
    { type: "return", name: "return {status: 'ok'}",     desc: "Return JSON health status." },
  ] },

  // ── Row 2: API Routers ──
  { id: "router_llm",       layer: "router", row: 2, group: "routers", label: "/v1/completions",          file: "open_ai_api/llm.py",            func: "create_completion(body)", description: "LLM text completion & chat endpoints. Supports streaming via SSE.", internals: [
    { type: "entry",    name: "create_completion(body)",     desc: "POST /v1/chat/completions handler." },
    { type: "validate", name: "CompletionRequest(**body)",   desc: "Pydantic validation of model, messages, params." },
    { type: "call",     name: "resolver.resolve('llm')",     desc: "Get or create LLMService instance." },
    { type: "branch",   name: "if req.stream",               desc: "Check whether client requested streaming." },
    { type: "call",     name: "svc.process_request(req)",    desc: "Submit to LLMService for inference." },
    { type: "step",     name: "format_response(result)",     desc: "Wrap in OpenAI-compatible JSON envelope." },
    { type: "return",   name: "return JSONResponse",         desc: "Send completion back to caller." },
  ] },
  { id: "router_audio",     layer: "router", row: 2, group: "routers", label: "/v1/audio/transcriptions", file: "open_ai_api/audio.py",           func: "transcribe(file, model)", description: "Audio transcription endpoint (Whisper). Accepts audio file uploads.", internals: [
    { type: "entry",    name: "transcribe(file, model)",     desc: "POST /v1/audio/transcriptions handler." },
    { type: "validate", name: "validate_audio_file(file)",   desc: "Check file type, size limits." },
    { type: "step",     name: "AudioProcessingRequest()",    desc: "Build Pydantic request from multipart form." },
    { type: "call",     name: "resolver.resolve('audio')",   desc: "Get or create AudioService instance." },
    { type: "call",     name: "svc.process_request(req)",    desc: "Submit audio to AudioService." },
    { type: "return",   name: "return JSONResponse",         desc: "Return transcription text." },
  ] },
  { id: "router_tts",       layer: "router", row: 2, group: "routers", label: "/v1/audio/speech",         file: "open_ai_api/text_to_speech.py",  func: "synthesize(body)", description: "Text-to-speech endpoint. Converts text to audio.", internals: [
    { type: "entry",    name: "synthesize(body)",            desc: "POST /v1/audio/speech handler." },
    { type: "validate", name: "TextToSpeechRequest(**body)", desc: "Validate input text, voice, format." },
    { type: "call",     name: "resolver.resolve('tts')",     desc: "Get or create TTSService instance." },
    { type: "call",     name: "svc.process_request(req)",    desc: "Submit to TTSService for synthesis." },
    { type: "return",   name: "return StreamingResponse",    desc: "Stream audio bytes back to caller." },
  ] },
  { id: "router_image",     layer: "router", row: 2, group: "routers", label: "/v1/images/generations",   file: "open_ai_api/image.py",           func: "generate_image(body)", description: "Image generation, editing, and image-to-image (SDXL).", internals: [
    { type: "entry",    name: "generate_image(body)",        desc: "POST /v1/images/generations handler." },
    { type: "validate", name: "ImageGenerateRequest(**body)",desc: "Validate prompt, size, n, response_format." },
    { type: "call",     name: "resolver.resolve('image')",   desc: "Get or create ImageService instance." },
    { type: "call",     name: "svc.process_request(req)",    desc: "Submit to ImageService pipeline." },
    { type: "step",     name: "encode_images(results)",      desc: "Base64-encode or return URLs for generated images." },
    { type: "return",   name: "return JSONResponse",         desc: "Send image data array back to caller." },
  ] },
  { id: "router_video",     layer: "router", row: 2, group: "routers", label: "/v1/videos/generations",   file: "open_ai_api/video.py",           func: "generate_video(body)", description: "Video generation endpoint (DiT-based models).", internals: [
    { type: "entry",    name: "generate_video(body)",        desc: "POST /v1/videos/generations handler." },
    { type: "validate", name: "VideoGenerateRequest(**body)",desc: "Validate prompt, duration, resolution." },
    { type: "call",     name: "resolver.resolve('video')",   desc: "Get or create VideoService instance." },
    { type: "call",     name: "svc.process_request(req)",    desc: "Submit to VideoService for generation." },
    { type: "step",     name: "encode_video(result)",        desc: "Encode frames into video file." },
    { type: "return",   name: "return FileResponse",         desc: "Stream video file back to caller." },
  ] },
  { id: "router_embedding", layer: "router", row: 2, group: "routers", label: "/v1/embeddings",           file: "open_ai_api/embedding.py",       func: "create_embedding(body)", description: "Text embedding endpoint. Returns vector representations.", internals: [
    { type: "entry",    name: "create_embedding(body)",           desc: "POST /v1/embeddings handler." },
    { type: "validate", name: "TextEmbeddingRequest(**body)",     desc: "Validate input text and model." },
    { type: "call",     name: "resolver.resolve('embedding')",    desc: "Get or create EmbeddingService." },
    { type: "call",     name: "svc.process_request(req)",         desc: "Submit text for embedding." },
    { type: "return",   name: "return JSONResponse",              desc: "Return vector array." },
  ] },
  { id: "router_cnn",       layer: "router", row: 2, group: "routers", label: "/v1/cnn",                  file: "open_ai_api/cnn.py",             func: "classify(body)", description: "CNN inference endpoint for image classification.", internals: [
    { type: "entry",    name: "classify(body)",                   desc: "POST /v1/cnn handler." },
    { type: "validate", name: "validate_image(body.image)",       desc: "Check image format and size." },
    { type: "call",     name: "resolver.resolve('cnn')",          desc: "Get or create CNNService." },
    { type: "call",     name: "svc.process_request(req)",         desc: "Submit image for classification." },
    { type: "return",   name: "return JSONResponse",              desc: "Return class predictions." },
  ] },
  { id: "router_finetune",  layer: "router", row: 2, group: "routers", label: "/v1/fine_tuning",          file: "open_ai_api/fine_tuning.py",     func: "create_job(body)", description: "Fine-tuning job management endpoints.", internals: [
    { type: "entry",    name: "create_job(body)",                 desc: "POST /v1/fine_tuning/jobs handler." },
    { type: "validate", name: "TrainingRequest(**body)",          desc: "Validate model, dataset, hyperparams." },
    { type: "call",     name: "resolver.resolve('training')",     desc: "Get or create TrainingService." },
    { type: "call",     name: "svc.create_job(req)",              desc: "Launch fine-tuning job." },
    { type: "return",   name: "return JSONResponse",              desc: "Return job ID and status." },
  ] },
  { id: "router_tokenizer", layer: "router", row: 2, group: "routers", label: "/v1/tokenize",             file: "open_ai_api/tokenizer.py",       func: "tokenize(text)", description: "Tokenize and detokenize text utilities.", internals: [
    { type: "entry",    name: "tokenize(text)",                   desc: "POST /v1/tokenize handler." },
    { type: "step",     name: "load_tokenizer(model)",            desc: "Lazy-load tokenizer for requested model." },
    { type: "step",     name: "tokens = encode(text)",            desc: "Encode text to token IDs." },
    { type: "return",   name: "return JSONResponse",              desc: "Return token IDs and count." },
  ] },

  // ── Domain (request models) – side column ──
  { id: "domain_completion", layer: "domain", row: 2, group: "domain", side: "right", label: "CompletionRequest",      file: "domain/completion_request.py",       func: "CompletionRequest(**body)", description: "Pydantic model for LLM completion requests.", internals: [
    { type: "validate", name: "model: str",             desc: "Required model identifier (e.g. 'llama-3.1-8b')." },
    { type: "validate", name: "messages: List[Message]", desc: "Conversation message array with role + content." },
    { type: "step",     name: "temperature: float=0.7",  desc: "Sampling temperature, 0-2." },
    { type: "step",     name: "max_tokens: int=256",     desc: "Max output tokens to generate." },
    { type: "step",     name: "stream: bool=False",      desc: "Enable Server-Sent Events streaming." },
  ] },
  { id: "domain_audio",     layer: "domain", row: 2, group: "domain", side: "right", label: "AudioProcessingRequest", file: "domain/audio_processing_request.py", func: "AudioProcessingRequest(**body)", description: "Pydantic model for audio transcription requests.", internals: [
    { type: "validate", name: "file: UploadFile",        desc: "Audio file upload (wav, mp3, flac)." },
    { type: "validate", name: "model: str",              desc: "Whisper model variant identifier." },
    { type: "step",     name: "language: Optional[str]",  desc: "Optional language hint for transcription." },
    { type: "step",     name: "response_format: str",     desc: "Output format: json, text, srt, vtt." },
  ] },
  { id: "domain_tts",       layer: "domain", row: 2, group: "domain", side: "right", label: "TextToSpeechRequest",    file: "domain/text_to_speech_request.py",   func: "TextToSpeechRequest(**body)", description: "Pydantic model for TTS requests.", internals: [
    { type: "validate", name: "input: str",              desc: "Text to synthesize into speech." },
    { type: "validate", name: "voice: str",              desc: "Voice preset identifier." },
    { type: "step",     name: "speed: float=1.0",        desc: "Playback speed multiplier." },
    { type: "step",     name: "response_format: str",     desc: "Audio format: mp3, wav, opus." },
  ] },
  { id: "domain_image",     layer: "domain", row: 2, group: "domain", side: "right", label: "ImageGenerateRequest",   file: "domain/image_generate_request.py",   func: "ImageGenerateRequest(**body)", description: "Pydantic model for image generation requests.", internals: [
    { type: "validate", name: "prompt: str",             desc: "Text description of desired image." },
    { type: "step",     name: "n: int=1",                desc: "Number of images to generate." },
    { type: "step",     name: "size: str='1024x1024'",   desc: "Output resolution." },
    { type: "step",     name: "response_format: str",     desc: "url or b64_json." },
    { type: "step",     name: "num_inference_steps: int", desc: "Diffusion steps (quality vs speed)." },
  ] },
  { id: "domain_video",     layer: "domain", row: 2, group: "domain", side: "right", label: "VideoGenerateRequest",   file: "domain/video_generate_request.py",   func: "VideoGenerateRequest(**body)", description: "Pydantic model for video generation requests.", internals: [
    { type: "validate", name: "prompt: str",             desc: "Text description of desired video." },
    { type: "step",     name: "num_frames: int=16",      desc: "Number of video frames to generate." },
    { type: "step",     name: "resolution: str",          desc: "Output resolution (e.g. 480p)." },
    { type: "step",     name: "fps: int=8",              desc: "Frames per second in output." },
  ] },
  { id: "domain_embedding", layer: "domain", row: 2, group: "domain", side: "right", label: "TextEmbeddingRequest",   file: "domain/text_embedding_request.py",   func: "TextEmbeddingRequest(**body)", description: "Pydantic model for embedding requests.", internals: [
    { type: "validate", name: "input: str|List[str]",    desc: "Text or batch of texts to embed." },
    { type: "validate", name: "model: str",              desc: "Embedding model identifier." },
    { type: "step",     name: "encoding_format: str",     desc: "float or base64 encoding." },
  ] },
  { id: "domain_training",  layer: "domain", row: 2, group: "domain", side: "right", label: "TrainingRequest",        file: "domain/training_request.py",         func: "TrainingRequest(**body)", description: "Pydantic model for fine-tuning job creation.", internals: [
    { type: "validate", name: "model: str",              desc: "Base model to fine-tune." },
    { type: "validate", name: "training_file: str",      desc: "ID of uploaded JSONL training data." },
    { type: "step",     name: "n_epochs: int=3",         desc: "Number of training epochs." },
    { type: "step",     name: "learning_rate: float",     desc: "Learning rate multiplier." },
  ] },

  // ── Row 3: ServiceResolver ──
  { id: "resolver", layer: "infra", row: 3, group: "infra_resolver", label: "ServiceResolver", file: "resolver/service_resolver.py", func: "resolve(service_type)", description: "Singleton factory. Routers call resolve(service_type) to get the correct service instance. Lazily creates and caches.", internals: [
    { type: "entry",    name: "resolve(service_type)",       desc: "Lookup requested service type string." },
    { type: "branch",   name: "if cached → return",         desc: "Return existing instance if already created." },
    { type: "step",     name: "lookup_class(type)",          desc: "Map string to concrete service class." },
    { type: "step",     name: "load_config(type)",           desc: "Read model config YAML for the service." },
    { type: "call",     name: "ServiceClass(config)",        desc: "Instantiate the concrete service." },
    { type: "step",     name: "cache[type] = instance",      desc: "Store in singleton cache for reuse." },
    { type: "return",   name: "return instance",             desc: "Return ready service to the caller." },
  ] },

  // ── Row 4: BaseService ──
  { id: "svc_base", layer: "service", row: 4, group: "svc_abc", label: "BaseService", file: "model_services/base_service.py", func: "process_request(req)", description: "Abstract base class. Provides process_request(), streaming helpers, worker lifecycle, deep reset.", internals: [
    { type: "entry",  name: "process_request(req)",     desc: "Abstract entry — overridden by each concrete service." },
    { type: "step",   name: "validate_worker()",        desc: "Ensure worker process is alive, restart if needed." },
    { type: "step",   name: "check_queue_health()",     desc: "Verify queue is accepting tasks." },
    { type: "call",   name: "scheduler.enqueue(task)",  desc: "Submit task via shared Scheduler." },
    { type: "await",  name: "await task.result",        desc: "Block until worker resolves the future." },
    { type: "return", name: "return result",            desc: "Return inference output to caller." },
  ] },

  // ── Row 5: Concrete Services ──
  { id: "svc_llm",       layer: "service", row: 5, group: "svc_concrete", label: "LLMService",       file: "model_services/llm_service.py",            func: "process_request(req)", description: "LLM service. Handles completion and chat requests via vLLM backend.", internals: [
    { type: "entry",    name: "process_request(req)",        desc: "Accept CompletionRequest from router." },
    { type: "step",     name: "apply_chat_template(req)",    desc: "Format messages into model prompt template." },
    { type: "step",     name: "build_sampling_params(req)",  desc: "Create vLLM SamplingParams (temp, top_p, max_tokens)." },
    { type: "call",     name: "scheduler.enqueue(task)",     desc: "Submit InferenceTask to scheduler queue." },
    { type: "await",    name: "await task.result",           desc: "Block until worker returns generated tokens." },
    { type: "branch",   name: "if streaming → SSE",         desc: "Yield tokens via SSE if stream=True." },
    { type: "step",     name: "format_completion(tokens)",   desc: "Build OpenAI completion response object." },
    { type: "return",   name: "return result",               desc: "Return completion to router." },
  ] },
  { id: "svc_audio",     layer: "service", row: 5, group: "svc_concrete", label: "AudioService",     file: "model_services/audio_service.py",          func: "process_request(req)", description: "Audio transcription service. Pre/post-processes audio for Whisper.", internals: [
    { type: "entry",    name: "process_request(req)",        desc: "Accept AudioProcessingRequest." },
    { type: "step",     name: "preprocess_audio(req.data)",  desc: "Normalize sample rate, chunk long audio." },
    { type: "call",     name: "scheduler.enqueue(task)",     desc: "Submit transcription task to scheduler." },
    { type: "await",    name: "await task.result",           desc: "Block until Whisper returns transcription." },
    { type: "step",     name: "postprocess(result)",         desc: "Merge chunks, format as final text." },
    { type: "return",   name: "return transcription",        desc: "Return transcription to router." },
  ] },
  { id: "svc_tts",       layer: "service", row: 5, group: "svc_concrete", label: "TTSService",       file: "model_services/text_to_speech_service.py", func: "process_request(req)", description: "TTS service. Manages SpeechT5 runner and audio output.", internals: [
    { type: "entry",  name: "process_request(req)",     desc: "Accept TextToSpeechRequest." },
    { type: "step",   name: "tokenize_text(req.input)", desc: "Tokenize input text for SpeechT5." },
    { type: "call",   name: "scheduler.enqueue(task)",  desc: "Submit synthesis task to scheduler." },
    { type: "await",  name: "await task.result",        desc: "Block until SpeechT5 returns waveform." },
    { type: "step",   name: "encode_audio(result)",     desc: "Encode waveform to requested format." },
    { type: "return", name: "return audio_bytes",       desc: "Return audio stream to router." },
  ] },
  { id: "svc_image",     layer: "service", row: 5, group: "svc_concrete", label: "ImageService",     file: "model_services/image_service.py",          func: "process_request(req)", description: "Image generation service. Orchestrates SDXL pipeline.", internals: [
    { type: "entry",    name: "process_request(req)",        desc: "Accept ImageGenerateRequest." },
    { type: "step",     name: "encode_prompt(req.prompt)",   desc: "Tokenize and encode the text prompt." },
    { type: "step",     name: "build_latent_params(req)",    desc: "Prepare latent noise, size, CFG scale." },
    { type: "call",     name: "scheduler.enqueue(task)",     desc: "Submit generation task to scheduler." },
    { type: "await",    name: "await task.result",           desc: "Block until SDXL returns image tensors." },
    { type: "step",     name: "decode_latents(result)",      desc: "VAE decode latents to pixel images." },
    { type: "return",   name: "return images",               desc: "Return generated images to router." },
  ] },
  { id: "svc_video",     layer: "service", row: 5, group: "svc_concrete", label: "VideoService",     file: "model_services/video_service.py",          func: "process_request(req)", description: "Video generation service. Manages DiT runner pipeline.", internals: [
    { type: "entry",    name: "process_request(req)",        desc: "Accept VideoGenerateRequest." },
    { type: "step",     name: "encode_prompt(req.prompt)",   desc: "Tokenize prompt with T5 encoder." },
    { type: "step",     name: "build_noise_schedule(req)",   desc: "Prepare latent noise and diffusion schedule." },
    { type: "call",     name: "scheduler.enqueue(task)",     desc: "Submit video generation task." },
    { type: "await",    name: "await task.result",           desc: "Block until DiT returns frame tensors." },
    { type: "step",     name: "decode_frames(result)",       desc: "VAE decode latents to video frames." },
    { type: "call",     name: "video_mgr.encode(frames)",    desc: "Encode frames into MP4 via VideoManager." },
    { type: "return",   name: "return video_path",           desc: "Return video file path to router." },
  ] },
  { id: "svc_embedding", layer: "service", row: 5, group: "svc_concrete", label: "EmbeddingService", file: "model_services/embedding_service.py",      func: "process_request(req)", description: "Embedding service. Returns text vector representations.", internals: [
    { type: "entry",  name: "process_request(req)",     desc: "Accept TextEmbeddingRequest." },
    { type: "step",   name: "tokenize(req.input)",      desc: "Tokenize input text(s) for embedding model." },
    { type: "call",   name: "scheduler.enqueue(task)",  desc: "Submit embedding task." },
    { type: "await",  name: "await task.result",        desc: "Block until runner returns vectors." },
    { type: "return", name: "return vectors",           desc: "Return embedding array to router." },
  ] },
  { id: "svc_cnn",       layer: "service", row: 5, group: "svc_concrete", label: "CNNService",       file: "model_services/cnn_service.py",            func: "process_request(req)", description: "CNN inference service for image classification.", internals: [
    { type: "entry",  name: "process_request(req)",     desc: "Accept image classification request." },
    { type: "step",   name: "preprocess_image(req)",    desc: "Resize and normalize image tensor." },
    { type: "call",   name: "scheduler.enqueue(task)",  desc: "Submit classification task." },
    { type: "await",  name: "await task.result",        desc: "Block until CNN returns predictions." },
    { type: "step",   name: "format_predictions(out)",  desc: "Map logits to class labels + scores." },
    { type: "return", name: "return predictions",       desc: "Return top-k classes to router." },
  ] },
  { id: "svc_training",  layer: "service", row: 5, group: "svc_concrete", label: "TrainingService",  file: "model_services/training_service.py",       func: "process_request(req)", description: "Fine-tuning service. Manages training job lifecycle.", internals: [
    { type: "entry",  name: "create_job(req)",          desc: "Accept TrainingRequest." },
    { type: "step",   name: "load_dataset(req.file)",   desc: "Load and validate JSONL training data." },
    { type: "step",   name: "prepare_model(req.model)", desc: "Load base model weights + LoRA adapters." },
    { type: "call",   name: "job_mgr.create_job(task)", desc: "Register job with JobManager for tracking." },
    { type: "step",   name: "launch_training_loop()",   desc: "Start async training in background worker." },
    { type: "return", name: "return job_id",            desc: "Return job ID for status polling." },
  ] },

  // ── Row 6: Scheduler ──
  { id: "scheduler", layer: "infra", row: 6, group: "infra_scheduler", label: "Scheduler", file: "model_services/scheduler.py", func: "enqueue(task)", description: "Core orchestrator. Enqueues requests, dispatches to workers based on queue type.", internals: [
    { type: "entry",    name: "enqueue(task)",               desc: "Accept InferenceTask from a service." },
    { type: "step",     name: "select_queue(task.type)",     desc: "Choose TTQueue or TTBatchFIFOQueue by model type." },
    { type: "branch",   name: "if batch → batch_queue",     desc: "LLM models use batch queue, others use basic." },
    { type: "call",     name: "queue.put(task)",             desc: "Place task into the selected queue." },
    { type: "step",     name: "notify_worker()",             desc: "Signal worker thread that new work is available." },
    { type: "await",    name: "await task.future",           desc: "Return future to caller for result retrieval." },
  ] },

  // ── Row 7: Queues + Workers ──
  { id: "queue_basic",    layer: "infra", row: 7, group: "infra_queues",  label: "TTQueue",            file: "model_services/queues/tt_queue.py",             func: "put(item)", description: "Basic single-item task queue.", internals: [
    { type: "entry",    name: "put(item)",                   desc: "Add single InferenceTask to queue." },
    { type: "step",     name: "acquire_lock()",              desc: "Thread-safe lock before queue mutation." },
    { type: "step",     name: "deque.append(item)",          desc: "Push task onto internal collections.deque." },
    { type: "step",     name: "event.set()",                 desc: "Signal waiting worker that item is ready." },
    { type: "return",   name: "return",                      desc: "Caller resumes; worker will pull when ready." },
  ] },
  { id: "queue_batch",    layer: "infra", row: 7, group: "infra_queues",  label: "TTBatchFIFOQueue",   file: "model_services/queues/tt_batch_fifo_queue.py",  func: "add_batch(items)", description: "Batched FIFO queue for throughput-optimized continuous batching.", internals: [
    { type: "entry",    name: "add_batch(items)",            desc: "Accept one or more tasks for batching." },
    { type: "step",     name: "acquire_lock()",              desc: "Thread-safe lock on batch buffer." },
    { type: "step",     name: "buffer.extend(items)",        desc: "Append tasks to internal batch buffer." },
    { type: "branch",   name: "if len ≥ batch_size",        desc: "Check if batch threshold is met." },
    { type: "step",     name: "flush_batch()",               desc: "Move full batch to ready queue for worker." },
    { type: "step",     name: "event.set()",                 desc: "Signal DynamicBatchWorker." },
    { type: "return",   name: "return",                      desc: "Tasks queued; results arrive via futures." },
  ] },
  { id: "worker_single",  layer: "infra", row: 7, group: "infra_workers", label: "DeviceWorker",       file: "device_workers/device_worker.py",               func: "run_loop() → pull()", description: "Single-batch device worker process. Pulls from TTQueue.", internals: [
    { type: "entry",    name: "run_loop()",                  desc: "Main worker loop in subprocess." },
    { type: "await",    name: "task = queue.get()",          desc: "Block until a task is available." },
    { type: "step",     name: "prepare_input(task)",         desc: "Convert task payload to model input tensors." },
    { type: "call",     name: "runner.run(input)",           desc: "Execute inference on TT device via runner." },
    { type: "step",     name: "task.set_result(output)",     desc: "Resolve the task's future with output." },
    { type: "step",     name: "continue loop",               desc: "Return to top, wait for next task." },
  ] },
  { id: "worker_dynamic", layer: "infra", row: 7, group: "infra_workers", label: "DynamicBatchWorker", file: "device_workers/device_worker_dynamic_batch.py", func: "run_loop() → pull_batch()", description: "Dynamic batching worker for vLLM continuous batching.", internals: [
    { type: "entry",    name: "run_loop()",                  desc: "Main worker loop for batched inference." },
    { type: "await",    name: "batch = queue.pull_batch()",  desc: "Block until a full batch is ready." },
    { type: "step",     name: "collate_inputs(batch)",       desc: "Pad and stack batch inputs into tensors." },
    { type: "call",     name: "runner.run_batch(inputs)",    desc: "Execute batched inference on TT device." },
    { type: "step",     name: "scatter_results(batch, out)", desc: "Split batched output, resolve each task's future." },
    { type: "step",     name: "continue loop",               desc: "Return to top, pull next batch." },
  ] },

  // ── Row 8: RunnerFabric ──
  { id: "runner_fabric", layer: "infra", row: 8, group: "infra_fabric", label: "RunnerFabric", file: "tt_model_runners/runner_fabric.py", func: "create_runner(config)", description: "Factory that reads model config and instantiates the correct runner class.", internals: [
    { type: "entry",    name: "create_runner(config)",       desc: "Accept model config dict." },
    { type: "step",     name: "parse_runner_type(config)",   desc: "Extract runner class name from config." },
    { type: "step",     name: "import_class(runner_type)",   desc: "Dynamic import of the runner module." },
    { type: "call",     name: "RunnerClass(config)",         desc: "Instantiate concrete runner with config." },
    { type: "call",     name: "runner.warmup()",             desc: "Run warmup inference to compile TT graph." },
    { type: "return",   name: "return runner",               desc: "Return initialized runner to worker." },
  ] },

  // ── Row 9: BaseDeviceRunner ──
  { id: "runner_base", layer: "runner", row: 9, group: "runner_abc", label: "BaseDeviceRunner", file: "tt_model_runners/base_device_runner.py", func: "run(input)", description: "Abstract runner interface. Defines run(), warmup(), reset(). All concrete runners inherit.", internals: [
    { type: "entry",  name: "run(input)",               desc: "Abstract — each runner implements this." },
    { type: "step",   name: "warmup()",                 desc: "Compile TT graph with dummy input on first call." },
    { type: "step",   name: "reset()",                  desc: "Clear device state, free memory." },
    { type: "step",   name: "get_device_info()",        desc: "Return device type, chip count, memory usage." },
  ] },

  // ── Row 10: Concrete Runners ──
  { id: "runner_vllm",       layer: "runner", row: 10, group: "runner_llm",   label: "vLLM Runner",          file: "tt_model_runners/vllm_runner.py",                      func: "generate(prompt, params)", description: "vLLM-based runner. Uses PagedAttention for efficient LLM inference.", internals: [
    { type: "entry",    name: "generate(prompt, params)",    desc: "Accept tokenized prompt and sampling params." },
    { type: "step",     name: "prepare_kv_cache()",          desc: "Allocate PagedAttention KV-cache blocks." },
    { type: "step",     name: "schedule_sequences()",        desc: "vLLM scheduler selects sequences for this step." },
    { type: "call",     name: "model.forward(tokens)",       desc: "Run transformer forward pass on TT device." },
    { type: "step",     name: "sample(logits, params)",      desc: "Apply temperature, top_p, top_k sampling." },
    { type: "branch",   name: "if eos_token → stop",        desc: "Check for end-of-sequence or max_tokens." },
    { type: "step",     name: "decode_tokens(output_ids)",   desc: "Detokenize generated token IDs to text." },
    { type: "return",   name: "return generated_text",       desc: "Return completed text to worker." },
  ] },
  { id: "runner_vllm_forge", layer: "runner", row: 10, group: "runner_llm",   label: "vLLM Forge Runner",    file: "tt_model_runners/vllm_forge_llama_70b.py",             func: "generate(prompt, params)", description: "Forge+vLLM runner for Llama 70B on TT Galaxy hardware.", internals: [
    { type: "entry",  name: "generate(prompt, params)", desc: "Accept tokenized prompt for 70B model." },
    { type: "step",   name: "shard_kv_cache(chips)",    desc: "Distribute KV-cache across Galaxy chips." },
    { type: "call",   name: "forge.forward(tokens)",    desc: "Run Forge-compiled forward pass across mesh." },
    { type: "step",   name: "all_gather(logits)",       desc: "Gather logits from all chips." },
    { type: "step",   name: "sample(logits, params)",   desc: "Apply sampling strategy." },
    { type: "branch", name: "if eos → stop",            desc: "Check end-of-sequence." },
    { type: "return", name: "return generated_text",    desc: "Return decoded text to worker." },
  ] },
  { id: "runner_whisper",    layer: "runner", row: 10, group: "runner_audio", label: "Whisper Runner",       file: "tt_model_runners/whisper_runner.py",                   func: "transcribe(audio_data)", description: "Whisper ASR runner. Processes audio, returns transcriptions.", internals: [
    { type: "entry",    name: "transcribe(audio_data)",      desc: "Accept preprocessed audio waveform." },
    { type: "step",     name: "mel_spectrogram(audio)",      desc: "Compute log-mel spectrogram features." },
    { type: "call",     name: "encoder.forward(mel)",        desc: "Run Whisper encoder on TT device." },
    { type: "step",     name: "init_decoder(enc_out)",       desc: "Prepare decoder with encoder output + prompt tokens." },
    { type: "call",     name: "decoder.forward(tokens)",     desc: "Autoregressive decoding loop on TT device." },
    { type: "branch",   name: "if eot_token → stop",        desc: "Check for end-of-transcription token." },
    { type: "step",     name: "decode_tokens(output_ids)",   desc: "Detokenize to transcription text." },
    { type: "return",   name: "return text",                 desc: "Return transcription to worker." },
  ] },
  { id: "runner_speecht5",   layer: "runner", row: 10, group: "runner_audio", label: "SpeechT5 Runner",     file: "tt_model_runners/speecht5_runner.py",                  func: "synthesize(text)", description: "SpeechT5 TTS runner. Generates speech waveforms from text.", internals: [
    { type: "entry",  name: "synthesize(text)",          desc: "Accept tokenized text input." },
    { type: "step",   name: "encode_text(tokens)",       desc: "SpeechT5 encoder produces hidden states." },
    { type: "step",   name: "load_speaker_embedding()",  desc: "Load speaker voice profile vector." },
    { type: "call",   name: "decoder.forward(enc, spk)", desc: "Autoregressive mel-spectrogram generation." },
    { type: "step",   name: "vocoder(mel_spec)",         desc: "HiFi-GAN vocoder converts mel to waveform." },
    { type: "return", name: "return waveform",           desc: "Return raw audio samples to worker." },
  ] },
  { id: "runner_sdxl",       layer: "runner", row: 10, group: "runner_image", label: "SDXL Runner",         file: "tt_model_runners/sdxl_generate_runner_trace.py",       func: "generate(prompt, steps)", description: "SDXL image generation runner with TT trace optimization.", internals: [
    { type: "entry",    name: "generate(prompt, steps)",     desc: "Accept encoded prompt and diffusion steps." },
    { type: "step",     name: "encode_prompt(text)",         desc: "CLIP text encoder produces conditioning vectors." },
    { type: "step",     name: "init_latents(size)",          desc: "Create random latent noise tensor." },
    { type: "call",     name: "unet.forward(latents, t)",    desc: "Run UNet denoising step on TT device." },
    { type: "step",     name: "scheduler.step(noise_pred)",  desc: "DDPM/DPM scheduler updates latents." },
    { type: "branch",   name: "if t < T → loop",            desc: "Repeat for all diffusion timesteps." },
    { type: "call",     name: "vae.decode(latents)",         desc: "VAE decode final latents to pixel image." },
    { type: "return",   name: "return image_tensor",         desc: "Return decoded image to worker." },
  ] },
  { id: "runner_dit",        layer: "runner", row: 10, group: "runner_video", label: "DiT Runner",          file: "tt_model_runners/dit_runners.py",                      func: "generate(prompt, frames)", description: "Diffusion Transformer video generation runner.", internals: [
    { type: "entry",    name: "generate(prompt, frames)",    desc: "Accept prompt encoding and frame count." },
    { type: "step",     name: "encode_prompt(text)",         desc: "T5 text encoder produces conditioning." },
    { type: "step",     name: "init_video_latents(frames)",  desc: "Create spatio-temporal noise latent." },
    { type: "call",     name: "dit.forward(latents, t)",     desc: "Run DiT denoising block on TT device." },
    { type: "step",     name: "scheduler.step(noise_pred)",  desc: "Flow-matching scheduler updates latents." },
    { type: "branch",   name: "if t < T → loop",            desc: "Repeat for all diffusion timesteps." },
    { type: "call",     name: "vae_3d.decode(latents)",      desc: "3D VAE decode latents to video frames." },
    { type: "return",   name: "return frame_tensors",        desc: "Return decoded frames to worker." },
  ] },
  { id: "runner_embedding",  layer: "runner", row: 10, group: "runner_embed", label: "Embedding Runner",    file: "tt_model_runners/embedding_runner.py",                 func: "embed(text)", description: "Text embedding runner for sentence-level vectors.", internals: [
    { type: "entry",  name: "embed(text)",               desc: "Accept tokenized text." },
    { type: "step",   name: "encode(tokens)",            desc: "Run transformer encoder on TT device." },
    { type: "step",   name: "mean_pool(hidden_states)",  desc: "Mean-pool last hidden layer for sentence vector." },
    { type: "step",   name: "normalize(vector)",         desc: "L2-normalize embedding vector." },
    { type: "return", name: "return embedding",          desc: "Return 1024-dim vector to worker." },
  ] },
  { id: "runner_forge_qwen", layer: "runner", row: 10, group: "runner_embed", label: "Forge Qwen Embed",    file: "tt_model_runners/vllm_forge_qwen_embedding_runner.py", func: "embed(text)", description: "Forge+vLLM embedding runner for Qwen on TT hardware.", internals: [
    { type: "entry",  name: "embed(text)",               desc: "Accept tokenized text for Qwen model." },
    { type: "call",   name: "forge.forward(tokens)",     desc: "Run Forge-compiled Qwen on TT device." },
    { type: "step",   name: "extract_embedding(out)",    desc: "Extract embedding from last hidden state." },
    { type: "step",   name: "normalize(vector)",         desc: "L2-normalize embedding vector." },
    { type: "return", name: "return embedding",          desc: "Return vector to worker." },
  ] },

  // ── Row 11: Model Configs (specific model variants each runner supports) ──
  { id: "model_llama_8b",    layer: "model", row: 11, group: "models_llm",   label: "Llama 3.1 8B",        file: "configs/llama_3_1_8b.yaml",      func: "load_config()", description: "Meta Llama 3.1 8B Instruct. Fast single-chip inference.", internals: [
    { type: "step", name: "model_name: llama-3.1-8b",  desc: "HuggingFace model identifier." },
    { type: "step", name: "max_seq_len: 8192",         desc: "Maximum context window." },
    { type: "step", name: "device: n150",              desc: "Single Tenstorrent N150 chip." },
    { type: "step", name: "dtype: bfloat16",           desc: "Weight precision for inference." },
  ] },
  { id: "model_llama_70b",   layer: "model", row: 11, group: "models_llm",   label: "Llama 3.1 70B",       file: "configs/llama_3_1_70b.yaml",     func: "load_config()", description: "Meta Llama 3.1 70B Instruct. Multi-chip Galaxy deployment.", internals: [
    { type: "step", name: "model_name: llama-3.1-70b", desc: "HuggingFace model identifier." },
    { type: "step", name: "max_seq_len: 8192",         desc: "Maximum context window." },
    { type: "step", name: "device: galaxy (8×n300)",   desc: "TT Galaxy mesh — 8 N300 chips." },
    { type: "step", name: "tensor_parallel: 8",        desc: "Shard model across 8 devices." },
  ] },
  { id: "model_llama_3_3",   layer: "model", row: 11, group: "models_llm",   label: "Llama 3.3 70B",       file: "configs/llama_3_3_70b.yaml",     func: "load_config()", description: "Meta Llama 3.3 70B Instruct. Latest 70B from Meta.", internals: [
    { type: "step", name: "model_name: llama-3.3-70b", desc: "HuggingFace model identifier." },
    { type: "step", name: "max_seq_len: 131072",       desc: "128K extended context window." },
    { type: "step", name: "device: galaxy (8×n300)",   desc: "TT Galaxy mesh — 8 N300 chips." },
    { type: "step", name: "rope_scaling: dynamic",     desc: "Dynamic RoPE for long contexts." },
  ] },
  { id: "model_qwen_7b",     layer: "model", row: 11, group: "models_llm",   label: "Qwen 2.5 7B",         file: "configs/qwen_2_5_7b.yaml",       func: "load_config()", description: "Alibaba Qwen 2.5 7B Instruct. Multilingual LLM.", internals: [
    { type: "step", name: "model_name: qwen-2.5-7b",   desc: "HuggingFace model identifier." },
    { type: "step", name: "max_seq_len: 32768",        desc: "32K context window." },
    { type: "step", name: "device: n150",              desc: "Single Tenstorrent N150 chip." },
    { type: "step", name: "dtype: bfloat16",           desc: "Weight precision." },
  ] },
  { id: "model_falcon_40b",  layer: "model", row: 11, group: "models_llm",   label: "Falcon 40B",          file: "configs/falcon_40b.yaml",        func: "load_config()", description: "TII Falcon 40B Instruct.", internals: [
    { type: "step", name: "model_name: falcon-40b",    desc: "HuggingFace model identifier." },
    { type: "step", name: "max_seq_len: 2048",         desc: "Context window." },
    { type: "step", name: "device: galaxy (4×n300)",   desc: "TT Galaxy mesh — 4 N300 chips." },
    { type: "step", name: "tensor_parallel: 4",        desc: "Shard model across 4 devices." },
  ] },
  { id: "model_whisper_l",   layer: "model", row: 11, group: "models_audio", label: "Whisper Large v3",    file: "configs/whisper_large_v3.yaml",  func: "load_config()", description: "OpenAI Whisper Large v3. Multi-language ASR.", internals: [
    { type: "step", name: "model_name: whisper-large-v3", desc: "HuggingFace model identifier." },
    { type: "step", name: "max_audio_len: 30s",           desc: "Max audio segment length." },
    { type: "step", name: "device: n150",                 desc: "Single Tenstorrent N150 chip." },
    { type: "step", name: "beam_size: 5",                 desc: "Beam search width for decoding." },
  ] },
  { id: "model_speecht5_ms", layer: "model", row: 11, group: "models_audio", label: "SpeechT5 MS",        file: "configs/speecht5.yaml",          func: "load_config()", description: "Microsoft SpeechT5 base. English TTS.", internals: [
    { type: "step", name: "model_name: speecht5_tts",  desc: "HuggingFace model identifier." },
    { type: "step", name: "sample_rate: 16000",        desc: "Output audio sample rate." },
    { type: "step", name: "device: n150",              desc: "Single Tenstorrent N150 chip." },
    { type: "step", name: "vocoder: hifigan",          desc: "HiFi-GAN vocoder for waveform synthesis." },
  ] },
  { id: "model_sdxl_base",   layer: "model", row: 11, group: "models_image", label: "SDXL 1.0 Base",      file: "configs/sdxl_1_0.yaml",          func: "load_config()", description: "Stability AI SDXL 1.0 Base. 1024x1024 image generation.", internals: [
    { type: "step", name: "model_name: sdxl-base-1.0", desc: "HuggingFace model identifier." },
    { type: "step", name: "resolution: 1024×1024",     desc: "Native output resolution." },
    { type: "step", name: "device: n150",              desc: "Single Tenstorrent N150 chip." },
    { type: "step", name: "num_inference_steps: 30",   desc: "Default diffusion steps." },
  ] },
  { id: "model_mochi",       layer: "model", row: 11, group: "models_video", label: "Mochi 1",            file: "configs/mochi_1.yaml",           func: "load_config()", description: "Genmo Mochi 1 preview. DiT-based video generation.", internals: [
    { type: "step", name: "model_name: mochi-1-preview", desc: "HuggingFace model identifier." },
    { type: "step", name: "num_frames: 84",               desc: "Default frames per generation." },
    { type: "step", name: "device: t3k (4×n300)",          desc: "TT T3K mesh — 8 chips in 2×4." },
    { type: "step", name: "resolution: 480p",             desc: "Native output resolution." },
  ] },
  { id: "model_cogvideo",    layer: "model", row: 11, group: "models_video", label: "CogVideoX",          file: "configs/cogvideox.yaml",         func: "load_config()", description: "THUDM CogVideoX-5b. Text-to-video diffusion model.", internals: [
    { type: "step", name: "model_name: cogvideox-5b",  desc: "HuggingFace model identifier." },
    { type: "step", name: "num_frames: 49",            desc: "Default frames per generation." },
    { type: "step", name: "device: galaxy (4×n300)",   desc: "TT Galaxy mesh — 4 N300 chips." },
    { type: "step", name: "resolution: 720p",          desc: "Native output resolution." },
  ] },
  { id: "model_qwen_embed",  layer: "model", row: 11, group: "models_embed", label: "Qwen 2.5 Embed",    file: "configs/qwen_2_5_embed.yaml",    func: "load_config()", description: "Alibaba Qwen 2.5 embedding model. 1024-dim vectors.", internals: [
    { type: "step", name: "model_name: qwen-2.5-embed", desc: "HuggingFace model identifier." },
    { type: "step", name: "embed_dim: 1024",            desc: "Output embedding dimension." },
    { type: "step", name: "device: n150",               desc: "Single Tenstorrent N150 chip." },
    { type: "step", name: "max_seq_len: 512",           desc: "Max input token length." },
  ] },

  // ── Row 12: Utilities ──
  { id: "util_audio",   layer: "util", row: 12, group: "util_managers", side: "left", label: "AudioManager",       file: "utils/audio_manager.py",      func: "process_audio(data)", description: "Audio I/O: format conversion, chunking, resampling (ffmpeg wrapper).", internals: [
    { type: "entry",  name: "process_audio(data)",       desc: "Accept raw audio bytes." },
    { type: "step",   name: "detect_format(data)",       desc: "Sniff codec from file header." },
    { type: "call",   name: "ffmpeg.convert(data, wav)", desc: "Transcode to 16kHz mono WAV via ffmpeg." },
    { type: "step",   name: "chunk_audio(wav, 30s)",     desc: "Split into 30-second segments." },
    { type: "return", name: "return chunks[]",           desc: "Return list of audio chunks." },
  ] },
  { id: "util_image",   layer: "util", row: 12, group: "util_managers", side: "left", label: "ImageManager",       file: "utils/image_manager.py",      func: "process_image(data)", description: "Image I/O: resize, encode/decode, base64, format conversion.", internals: [
    { type: "entry",  name: "process_image(data)",       desc: "Accept image bytes or base64." },
    { type: "step",   name: "decode(data)",              desc: "Decode to PIL Image." },
    { type: "step",   name: "resize(img, target_size)",  desc: "Resize to model's expected dimensions." },
    { type: "step",   name: "to_tensor(img)",            desc: "Convert to normalized float tensor." },
    { type: "return", name: "return tensor",             desc: "Return preprocessed image tensor." },
  ] },
  { id: "util_video",   layer: "util", row: 12, group: "util_managers", side: "left", label: "VideoManager",       file: "utils/video_manager.py",      func: "encode_frames(data)", description: "Video I/O: frame extraction, encoding, format muxing.", internals: [
    { type: "entry",  name: "encode_frames(frames)",     desc: "Accept list of frame tensors." },
    { type: "step",   name: "to_uint8(frames)",          desc: "Denormalize and convert to uint8." },
    { type: "call",   name: "ffmpeg.mux(frames, fps)",   desc: "Encode frames to H.264 MP4 via ffmpeg." },
    { type: "step",   name: "write_file(path)",          desc: "Write MP4 to temp file." },
    { type: "return", name: "return file_path",          desc: "Return path to encoded video." },
  ] },
  { id: "util_device",  layer: "util", row: 12, group: "util_device", side: "left", label: "DeviceManager",      file: "utils/device_manager.py",     func: "allocate_device()", description: "TT hardware device management: chip allocation, reset, health monitoring.", internals: [
    { type: "entry",  name: "allocate_device()",         desc: "Request a free TT device." },
    { type: "step",   name: "scan_devices()",            desc: "Enumerate available TT chips via tt-smi." },
    { type: "branch", name: "if free_device → assign",   desc: "Find first unallocated chip." },
    { type: "step",   name: "lock(device_id)",           desc: "Mark device as in-use." },
    { type: "return", name: "return device_handle",      desc: "Return handle for runner to use." },
  ] },
  { id: "util_jobmgr",  layer: "util", row: 12, group: "util_jobs", side: "left", label: "JobManager",         file: "utils/job_manager.py",        func: "create_job(task)", description: "Async job tracking for long-running generation tasks (video, images).", internals: [
    { type: "entry",  name: "create_job(task)",          desc: "Register a new async job." },
    { type: "step",   name: "job_id = uuid4()",          desc: "Generate unique job identifier." },
    { type: "step",   name: "store(job_id, status)",     desc: "Persist job metadata to in-memory store." },
    { type: "step",   name: "launch_background(task)",   desc: "Start async worker coroutine." },
    { type: "return", name: "return job_id",             desc: "Return ID for client polling." },
  ] },
  { id: "util_sse",     layer: "util", row: 12, group: "util_streaming", side: "left", label: "SSE Streamer",       file: "utils/sse_streamer.py",       func: "stream_tokens(gen)", description: "Server-Sent Events helper for streaming LLM token output to clients.", internals: [
    { type: "entry",  name: "stream_tokens(generator)",  desc: "Accept async token generator." },
    { type: "step",   name: "set_headers(text/event-stream)", desc: "Set SSE content-type headers." },
    { type: "await",  name: "async for token in gen",    desc: "Yield each token as it's generated." },
    { type: "step",   name: "format_sse(token)",         desc: "Wrap token in 'data: {...}\\n\\n' format." },
    { type: "step",   name: "yield data: [DONE]",       desc: "Send termination sentinel." },
  ] },

  // ── Row 13: TT Software Stack ──
  { id: "ttnn", layer: "metal", row: 13, group: "tt_stack", label: "TTNN", file: "tt-metal/ttnn/", func: "ttnn.open_device()", description: "TT Neural Network library. High-level Python API for tensor operations, model compilation, and device management on Tenstorrent hardware.", internals: [
    { type: "entry",    name: "ttnn.open_device(device_id)",   desc: "Open a Tenstorrent device by ID." },
    { type: "step",     name: "ttnn.from_torch(tensor)",       desc: "Convert PyTorch tensor to TTNN tensor on device." },
    { type: "step",     name: "ttnn.to_layout(TILE_LAYOUT)",   desc: "Convert tensor to hardware-native tile layout." },
    { type: "call",     name: "ttnn.linear(x, weights)",       desc: "Execute fused matmul + bias on device." },
    { type: "step",     name: "ttnn.softmax(logits)",          desc: "Hardware-accelerated softmax." },
    { type: "call",     name: "ttnn.deallocate(tensor)",       desc: "Free device SRAM for tensor." },
    { type: "return",   name: "ttnn.to_torch(result)",         desc: "Move result tensor back to host." },
  ] },
  { id: "tt_metal", layer: "metal", row: 13, group: "tt_stack", label: "TT-Metalium", file: "tt-metal/tt_metal/", func: "CreateDevice()", description: "Low-level C++ runtime for Tenstorrent chips. Manages device lifecycle, L1/DRAM memory allocation, kernel compilation, and dispatch to RISC-V cores.", internals: [
    { type: "entry",    name: "CreateDevice(device_id)",       desc: "Initialize and open a Wormhole device." },
    { type: "step",     name: "InitializeDevice(arch)",        desc: "Detect chip architecture (Wormhole B0)." },
    { type: "step",     name: "ConfigureDeviceMesh(shape)",    desc: "Set up multi-chip mesh topology." },
    { type: "call",     name: "AllocateBuffer(size, L1)",      desc: "Allocate L1 SRAM buffer on cores." },
    { type: "call",     name: "CompileKernel(compute)",        desc: "Compile compute kernel for Tensix cores." },
    { type: "call",     name: "EnqueueProgram(device, pgm)",   desc: "Dispatch program to device command queue." },
    { type: "step",     name: "Synchronize(device)",           desc: "Block until device completes all work." },
    { type: "return",   name: "ReadBuffer(result)",            desc: "Read result from device memory to host." },
  ] },

  // ── Row 14: Active Hardware Device (dynamic — controlled by sidebar selector) ──
  { id: "dev_active", layer: "device", row: 14, group: "devices", label: "n150", file: "hardware/n150", func: "Wormhole B0", description: "Single Tenstorrent Wormhole B0 chip. 1 device, mesh shape 1x1.", internals: [
    { type: "step",     name: "device_ids: [0]",              desc: "Single device ID allocation." },
    { type: "step",     name: "mesh_shape: 1x1",              desc: "1 row x 1 column — single chip." },
    { type: "step",     name: "chip: Wormhole B0",            desc: "Tenstorrent Wormhole B0 ASIC." },
    { type: "step",     name: "SRAM: 108 MB L1",              desc: "108 MB L1 SRAM across 64 Tensix cores." },
    { type: "step",     name: "DRAM: 12 GB",                  desc: "12 GB HBM-equivalent DRAM for weights." },
  ] },
];

export const nodes = NODES_RAW.map(n => ({ ...n, ...(explainByNodeId[n.id] || {}) }));

export const edges = [
  // ─── Entry → Middleware ───
  { source: "main", target: "mw_auth",    type: "data-flow" },
  { source: "main", target: "mw_cors",    type: "data-flow" },
  { source: "main", target: "mw_metrics", type: "data-flow" },
  { source: "main", target: "mw_health",  type: "data-flow" },

  // ─── Entry → Routers (mounts) ───
  { source: "main", target: "router_llm",       type: "data-flow" },
  { source: "main", target: "router_audio",     type: "data-flow" },
  { source: "main", target: "router_tts",       type: "data-flow" },
  { source: "main", target: "router_image",     type: "data-flow" },
  { source: "main", target: "router_video",     type: "data-flow" },
  { source: "main", target: "router_embedding", type: "data-flow" },
  { source: "main", target: "router_cnn",       type: "data-flow" },
  { source: "main", target: "router_finetune",  type: "data-flow" },
  { source: "main", target: "router_tokenizer", type: "data-flow" },

  // ─── Middleware → Routers (auth guards every protected route) ───
  { source: "mw_auth", target: "router_llm",       type: "data-flow" },
  { source: "mw_auth", target: "router_audio",     type: "data-flow" },
  { source: "mw_auth", target: "router_tts",       type: "data-flow" },
  { source: "mw_auth", target: "router_image",     type: "data-flow" },
  { source: "mw_auth", target: "router_video",     type: "data-flow" },
  { source: "mw_auth", target: "router_embedding", type: "data-flow" },
  { source: "mw_auth", target: "router_cnn",       type: "data-flow" },

  // ─── Routers → Domain models (validation) ───
  { source: "router_llm",       target: "domain_completion", type: "data-flow" },
  { source: "router_audio",     target: "domain_audio",      type: "data-flow" },
  { source: "router_tts",       target: "domain_tts",        type: "data-flow" },
  { source: "router_image",     target: "domain_image",      type: "data-flow" },
  { source: "router_video",     target: "domain_video",      type: "data-flow" },
  { source: "router_embedding", target: "domain_embedding",  type: "data-flow" },
  { source: "router_finetune",  target: "domain_training",   type: "data-flow" },

  // ─── Routers → ServiceResolver (resolve correct service) ───
  { source: "router_llm",       target: "resolver", type: "data-flow" },
  { source: "router_audio",     target: "resolver", type: "data-flow" },
  { source: "router_tts",       target: "resolver", type: "data-flow" },
  { source: "router_image",     target: "resolver", type: "data-flow" },
  { source: "router_video",     target: "resolver", type: "data-flow" },
  { source: "router_embedding", target: "resolver", type: "data-flow" },
  { source: "router_cnn",       target: "resolver", type: "data-flow" },
  { source: "router_finetune",  target: "resolver", type: "data-flow" },

  // ─── ServiceResolver → concrete services (creates / returns) ───
  { source: "resolver", target: "svc_llm",       type: "data-flow" },
  { source: "resolver", target: "svc_audio",     type: "data-flow" },
  { source: "resolver", target: "svc_tts",       type: "data-flow" },
  { source: "resolver", target: "svc_image",     type: "data-flow" },
  { source: "resolver", target: "svc_video",     type: "data-flow" },
  { source: "resolver", target: "svc_embedding", type: "data-flow" },
  { source: "resolver", target: "svc_cnn",       type: "data-flow" },
  { source: "resolver", target: "svc_training",  type: "data-flow" },

  // ─── BaseService → concrete (inheritance) ───
  { source: "svc_base", target: "svc_llm",       type: "inheritance" },
  { source: "svc_base", target: "svc_audio",     type: "inheritance" },
  { source: "svc_base", target: "svc_tts",       type: "inheritance" },
  { source: "svc_base", target: "svc_image",     type: "inheritance" },
  { source: "svc_base", target: "svc_video",     type: "inheritance" },
  { source: "svc_base", target: "svc_embedding", type: "inheritance" },
  { source: "svc_base", target: "svc_cnn",       type: "inheritance" },
  { source: "svc_base", target: "svc_training",  type: "inheritance" },

  // ─── Services → Scheduler ───
  { source: "svc_llm",       target: "scheduler", type: "data-flow" },
  { source: "svc_audio",     target: "scheduler", type: "data-flow" },
  { source: "svc_tts",       target: "scheduler", type: "data-flow" },
  { source: "svc_image",     target: "scheduler", type: "data-flow" },
  { source: "svc_video",     target: "scheduler", type: "data-flow" },
  { source: "svc_embedding", target: "scheduler", type: "data-flow" },
  { source: "svc_cnn",       target: "scheduler", type: "data-flow" },
  { source: "svc_training",  target: "scheduler", type: "data-flow" },

  // ─── Scheduler → Queues / Workers ───
  { source: "scheduler", target: "queue_basic",    type: "data-flow" },
  { source: "scheduler", target: "queue_batch",    type: "data-flow" },
  { source: "scheduler", target: "worker_single",  type: "data-flow" },
  { source: "scheduler", target: "worker_dynamic", type: "data-flow" },

  // ─── Workers → RunnerFabric ───
  { source: "worker_single",  target: "runner_fabric", type: "data-flow" },
  { source: "worker_dynamic", target: "runner_fabric", type: "data-flow" },

  // ─── RunnerFabric → concrete runners ───
  { source: "runner_fabric", target: "runner_vllm",       type: "data-flow" },
  { source: "runner_fabric", target: "runner_vllm_forge", type: "data-flow" },
  { source: "runner_fabric", target: "runner_whisper",    type: "data-flow" },
  { source: "runner_fabric", target: "runner_speecht5",   type: "data-flow" },
  { source: "runner_fabric", target: "runner_sdxl",       type: "data-flow" },
  { source: "runner_fabric", target: "runner_dit",        type: "data-flow" },
  { source: "runner_fabric", target: "runner_embedding",  type: "data-flow" },
  { source: "runner_fabric", target: "runner_forge_qwen", type: "data-flow" },

  // ─── BaseDeviceRunner → concrete (inheritance) ───
  { source: "runner_base", target: "runner_vllm",       type: "inheritance" },
  { source: "runner_base", target: "runner_vllm_forge", type: "inheritance" },
  { source: "runner_base", target: "runner_whisper",    type: "inheritance" },
  { source: "runner_base", target: "runner_speecht5",   type: "inheritance" },
  { source: "runner_base", target: "runner_sdxl",       type: "inheritance" },
  { source: "runner_base", target: "runner_dit",        type: "inheritance" },
  { source: "runner_base", target: "runner_embedding",  type: "inheritance" },
  { source: "runner_base", target: "runner_forge_qwen", type: "inheritance" },

  // ─── Runners → Model Configs (what models each runner loads) ───
  { source: "runner_vllm",       target: "model_llama_8b",    type: "data-flow" },
  { source: "runner_vllm",       target: "model_qwen_7b",     type: "data-flow" },
  { source: "runner_vllm",       target: "model_falcon_40b",  type: "data-flow" },
  { source: "runner_vllm_forge", target: "model_llama_70b",   type: "data-flow" },
  { source: "runner_vllm_forge", target: "model_llama_3_3",   type: "data-flow" },
  { source: "runner_whisper",    target: "model_whisper_l",   type: "data-flow" },
  { source: "runner_speecht5",   target: "model_speecht5_ms", type: "data-flow" },
  { source: "runner_sdxl",       target: "model_sdxl_base",   type: "data-flow" },
  { source: "runner_dit",        target: "model_mochi",       type: "data-flow" },
  { source: "runner_dit",        target: "model_cogvideo",    type: "data-flow" },
  { source: "runner_embedding",  target: "model_qwen_embed",  type: "data-flow" },
  { source: "runner_forge_qwen", target: "model_qwen_embed",  type: "data-flow" },

  // ─── Runners → Utility managers (actual calls) ───
  { source: "runner_whisper",  target: "util_audio", type: "data-flow" },
  { source: "runner_speecht5", target: "util_audio", type: "data-flow" },
  { source: "runner_sdxl",     target: "util_image", type: "data-flow" },
  { source: "runner_dit",      target: "util_video", type: "data-flow" },

  // ─── Workers → DeviceManager (chip allocation) ───
  { source: "worker_single",  target: "util_device", type: "data-flow" },
  { source: "worker_dynamic", target: "util_device", type: "data-flow" },

  // ─── Services → JobManager (async job tracking) ───
  { source: "svc_video", target: "util_jobmgr", type: "data-flow" },
  { source: "svc_image", target: "util_jobmgr", type: "data-flow" },

  // ─── LLMService → SSE Streamer (token streaming) ───
  { source: "svc_llm", target: "util_sse", type: "data-flow" },

  // ─── Metrics (telemetry wiring) ───
  { source: "mw_metrics", target: "svc_base", type: "dependency" },

  // ─── DeviceManager / Runners → TT Software Stack ───
  { source: "util_device",  target: "ttnn",     type: "data-flow" },
  { source: "runner_base",  target: "ttnn",     type: "data-flow" },
  { source: "ttnn",         target: "tt_metal", type: "data-flow" },

  // ─── TT-Metal → Active Device ───
  { source: "tt_metal", target: "dev_active", type: "data-flow" },
];

export const modelPaths = {
  "Whisper": [
    "main", "mw_auth", "router_audio", "domain_audio",
    "resolver", "svc_audio", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_whisper", "model_whisper_l", "util_audio",
    "ttnn", "tt_metal", "dev_active"
  ],
  "Llama 3.1 8B (vLLM)": [
    "main", "mw_auth", "router_llm", "domain_completion",
    "resolver", "svc_llm", "util_sse", "scheduler", "queue_batch",
    "worker_dynamic", "util_device",
    "runner_fabric", "runner_vllm", "model_llama_8b",
    "ttnn", "tt_metal", "dev_active"
  ],
  "Llama 70B (Forge)": [
    "main", "mw_auth", "router_llm", "domain_completion",
    "resolver", "svc_llm", "util_sse", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_vllm_forge", "model_llama_70b",
    "ttnn", "tt_metal", "dev_active"
  ],
  "Llama 3.3 70B (Forge)": [
    "main", "mw_auth", "router_llm", "domain_completion",
    "resolver", "svc_llm", "util_sse", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_vllm_forge", "model_llama_3_3",
    "ttnn", "tt_metal", "dev_active"
  ],
  "Qwen 2.5 7B (vLLM)": [
    "main", "mw_auth", "router_llm", "domain_completion",
    "resolver", "svc_llm", "util_sse", "scheduler", "queue_batch",
    "worker_dynamic", "util_device",
    "runner_fabric", "runner_vllm", "model_qwen_7b",
    "ttnn", "tt_metal", "dev_active"
  ],
  "SDXL (Image)": [
    "main", "mw_auth", "router_image", "domain_image",
    "resolver", "svc_image", "util_jobmgr", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_sdxl", "model_sdxl_base", "util_image",
    "ttnn", "tt_metal", "dev_active"
  ],
  "Mochi (Video)": [
    "main", "mw_auth", "router_video", "domain_video",
    "resolver", "svc_video", "util_jobmgr", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_dit", "model_mochi", "util_video",
    "ttnn", "tt_metal", "dev_active"
  ],
  "CogVideoX (Video)": [
    "main", "mw_auth", "router_video", "domain_video",
    "resolver", "svc_video", "util_jobmgr", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_dit", "model_cogvideo", "util_video",
    "ttnn", "tt_metal", "dev_active"
  ],
  "SpeechT5 (TTS)": [
    "main", "mw_auth", "router_tts", "domain_tts",
    "resolver", "svc_tts", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_speecht5", "model_speecht5_ms", "util_audio",
    "ttnn", "tt_metal", "dev_active"
  ],
  "Qwen 2.5 Embedding": [
    "main", "mw_auth", "router_embedding", "domain_embedding",
    "resolver", "svc_embedding", "scheduler", "queue_basic",
    "worker_single", "util_device",
    "runner_fabric", "runner_embedding", "model_qwen_embed",
    "ttnn", "tt_metal", "dev_active"
  ],
};

export const DEVICE_CONFIGS = {
  n150: {
    label: "n150",
    func: "Wormhole B0",
    file: "hardware/n150",
    description: "Single Tenstorrent Wormhole B0 chip. 1 device, mesh shape 1x1.",
    meshShape: [1, 1],
    chipCount: 1,
    deviceIds: [0],
    sramPerChip: "108 MB L1",
    dramPerChip: "12 GB",
    interconnect: null,
    internals: [
      { type: "step", name: "device_ids: [0]",   desc: "Single device ID allocation." },
      { type: "step", name: "mesh_shape: 1x1",   desc: "1 row x 1 column — single chip." },
      { type: "step", name: "chip: Wormhole B0",  desc: "Tenstorrent Wormhole B0 ASIC." },
      { type: "step", name: "SRAM: 108 MB L1",    desc: "108 MB L1 SRAM across 64 Tensix cores." },
      { type: "step", name: "DRAM: 12 GB",        desc: "12 GB HBM-equivalent DRAM for weights." },
    ],
  },
  n300: {
    label: "n300",
    func: "2x Wormhole B0",
    file: "hardware/n300",
    description: "Dual Tenstorrent Wormhole B0 chips on one card. 2 devices, mesh shape 1x2.",
    meshShape: [1, 2],
    chipCount: 2,
    deviceIds: [0, 1],
    sramPerChip: "108 MB L1",
    dramPerChip: "12 GB",
    interconnect: "on-board Ethernet",
    internals: [
      { type: "step", name: "device_ids: [0, 1]",       desc: "Two device IDs allocated." },
      { type: "step", name: "mesh_shape: 1x2",          desc: "1 row x 2 columns — paired chips." },
      { type: "step", name: "chips: 2x Wormhole B0",    desc: "Two Wormhole B0 ASICs on one PCB." },
      { type: "step", name: "SRAM: 216 MB L1 total",    desc: "108 MB per chip, 216 MB aggregate." },
      { type: "step", name: "interconnect: on-board Eth", desc: "Chip-to-chip Ethernet on PCB." },
    ],
  },
  t3k: {
    label: "t3k (TG)",
    func: "4x n300 = 8 chips",
    file: "hardware/t3k",
    description: "TT Galaxy subset (TG). 4 n300 cards = 8 Wormhole B0 chips in a 2x4 mesh.",
    meshShape: [2, 4],
    chipCount: 8,
    deviceIds: [0, 1, 2, 3, 4, 5, 6, 7],
    sramPerChip: "108 MB L1",
    dramPerChip: "12 GB",
    interconnect: "Ethernet mesh fabric",
    internals: [
      { type: "step", name: "device_ids: [0..7]",          desc: "8 device IDs across 4 n300 cards." },
      { type: "step", name: "mesh_shape: 2x4",             desc: "2 rows x 4 columns chip mesh." },
      { type: "step", name: "cards: 4x n300",              desc: "Four n300 dual-chip cards." },
      { type: "step", name: "SRAM: 864 MB L1 total",       desc: "108 MB x 8 chips aggregate." },
      { type: "step", name: "interconnect: Ethernet mesh",  desc: "Galaxy Ethernet fabric between cards." },
    ],
  },
  galaxy: {
    label: "Galaxy (TGG)",
    func: "16x n300 = 32 chips",
    file: "hardware/galaxy",
    description: "Full TT Galaxy (TGG). 16 n300 cards = 32 Wormhole B0 chips in a 4x8 mesh.",
    meshShape: [4, 8],
    chipCount: 32,
    deviceIds: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
    sramPerChip: "108 MB L1",
    dramPerChip: "12 GB",
    interconnect: "full Galaxy mesh fabric",
    internals: [
      { type: "step", name: "device_ids: [0..31]",            desc: "32 device IDs across 16 n300 cards." },
      { type: "step", name: "mesh_shape: 4x8",                desc: "4 rows x 8 columns chip mesh." },
      { type: "step", name: "cards: 16x n300",                desc: "Sixteen n300 dual-chip cards." },
      { type: "step", name: "SRAM: 3.4 GB L1 total",          desc: "108 MB x 32 chips aggregate." },
      { type: "step", name: "DRAM: 384 GB total",             desc: "12 GB x 32 chips aggregate." },
      { type: "step", name: "interconnect: full Galaxy mesh",  desc: "Full Ethernet mesh fabric, all-to-all." },
    ],
  },
};

export const MODEL_DEVICE_DEFAULTS = {
  model_llama_8b:    "n150",
  model_qwen_7b:     "n150",
  model_whisper_l:   "n150",
  model_speecht5_ms: "n150",
  model_sdxl_base:   "n150",
  model_qwen_embed:  "n150",
  model_falcon_40b:  "t3k",
  model_cogvideo:    "t3k",
  model_llama_70b:   "galaxy",
  model_llama_3_3:   "galaxy",
  model_mochi:       "t3k",
};
